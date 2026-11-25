export const DRIVE_DATA_FILENAME = 'household-finance-data.json';

export interface DriveFileMeta {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

export class DriveAuthError extends Error {
  requiresConsent: boolean;

  constructor(message: string, requiresConsent = false) {
    super(message);
    this.name = 'DriveAuthError';
    this.requiresConsent = requiresConsent;
  }
}

interface GoogleApiErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
}

async function driveFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(
      'មិនអាចភ្ជាប់ទៅ Google Drive បានទេ។ សូមពិនិត្យការភ្ជាប់អ៊ីនធឺណិតរបស់អ្នក រួចព្យាយាមម្តងទៀត។'
    );
  }
}

async function handleDriveResponse(res: Response): Promise<Response> {
  if (res.status === 401) {
    throw new DriveAuthError('សម័យចូលគណនី Google បានផុតកំណត់ សូមចូលគណនីម្តងទៀត។', false);
  }

  if (!res.ok) {
    let errBody: GoogleApiErrorBody | null = null;
    try {
      errBody = (await res.json()) as GoogleApiErrorBody;
    } catch {
      // Ignore non-JSON error body
    }

    const message = errBody?.error?.message || '';
    const status = errBody?.error?.status || '';
    const reasons = (errBody?.error?.errors || [])
      .map((e) => e.reason || '')
      .filter(Boolean);

    if (res.status === 403) {
      const isInsufficientScope =
        reasons.includes('insufficientPermissions') ||
        reasons.includes('insufficientFilePermissions') ||
        status === 'PERMISSION_DENIED' &&
          message.toLowerCase().includes('insufficient authentication scopes') ||
        message.toLowerCase().includes('insufficient authentication scopes') ||
        message.toLowerCase().includes('insufficient permission');

      if (isInsufficientScope) {
        throw new DriveAuthError(
          'គណនីមិនទាន់បានអនុញ្ញាតសិទ្ធិ Google Drive ទេ។ សូមចុចចូលគណនីម្តងទៀត រួចធីកយល់ព្រមសិទ្ធិចូលប្រើ Google Drive។',
          true
        );
      }

      if (
        reasons.includes('accessNotConfigured') ||
        message.toLowerCase().includes('has not been used in project') ||
        message.toLowerCase().includes('it is disabled')
      ) {
        throw new Error(
          'សេវាកម្ម Google Drive API មិនទាន់ដំណើរការពេញលេញទេ។ សូមរង់ចាំបន្តិច រួចព្យាយាមម្តងទៀត ឬប្រើការទាញយក JSON ជាបណ្តោះអាសន្ន។'
        );
      }

      if (reasons.includes('storageQuotaExceeded')) {
        throw new Error('ទំហំផ្ទុក Google Drive របស់អ្នកពេញហើយ។ សូមសម្អាតទំហំ Drive រួចសាកល្បងម្តងទៀត។');
      }
    }

    if (res.status === 404) {
      throw new Error('រកមិនឃើញឯកសារបម្រុងទុកនៅលើ Google Drive ទេ។ សូមចុចពិនិត្យម្តងទៀត។');
    }

    throw new Error(message || `កំហុស Google Drive (${res.status})`);
  }

  return res;
}

export async function findDriveDataFile(
  accessToken: string
): Promise<DriveFileMeta | null> {
  const params = new URLSearchParams({
    q: `name='${DRIVE_DATA_FILENAME}' and trashed=false`,
    spaces: 'drive',
    fields: 'files(id,name,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
    pageSize: '1',
  });
  const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;

  const res = await handleDriveResponse(
    await driveFetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  );

  const data = (await res.json()) as { files?: DriveFileMeta[] };
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

export async function loadDataFromDrive<T>(
  accessToken: string,
  fileId: string
): Promise<T> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    fileId
  )}?alt=media`;

  const res = await handleDriveResponse(
    await driveFetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  );

  const rawText = await res.text();
  if (!rawText.trim()) {
    throw new Error('ឯកសារនៅលើ Google Drive ទទេ មិនមានទិន្នន័យទេ។');
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error('មិនអាចអានទិន្នន័យ JSON ពីឯកសារ Google Drive បានទេ។');
  }
}

async function createDriveDataFile(
  accessToken: string,
  jsonBody: string
): Promise<DriveFileMeta> {
  const metadata = {
    name: DRIVE_DATA_FILENAME,
    mimeType: 'application/json',
  };

  const boundary = `household_finance_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const bodyBlob = new Blob(
    [
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      `${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      `${jsonBody}\r\n`,
      `--${boundary}--\r\n`,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const params = new URLSearchParams({
    uploadType: 'multipart',
    fields: 'id,name,modifiedTime,size',
  });
  const createUrl = `https://www.googleapis.com/upload/drive/v3/files?${params.toString()}`;

  const res = await handleDriveResponse(
    await driveFetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBlob,
    })
  );

  return (await res.json()) as DriveFileMeta;
}

export async function saveDataToDrive(
  accessToken: string,
  payload: unknown,
  existingFileId?: string | null
): Promise<DriveFileMeta> {
  const jsonBody = JSON.stringify(payload, null, 2);

  if (existingFileId) {
    const params = new URLSearchParams({
      uploadType: 'media',
      fields: 'id,name,modifiedTime,size',
    });
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
      existingFileId
    )}?${params.toString()}`;

    const rawRes = await driveFetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: new Blob([jsonBody], { type: 'application/json; charset=UTF-8' }),
    });

    // If the previously stored file was deleted externally on Drive, transparently recreate it
    if (rawRes.status === 404) {
      return createDriveDataFile(accessToken, jsonBody);
    }

    const res = await handleDriveResponse(rawRes);
    return (await res.json()) as DriveFileMeta;
  }

  return createDriveDataFile(accessToken, jsonBody);
}

export async function deleteDriveDataFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
  const rawRes = await driveFetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // Treat already-deleted file as success
  if (rawRes.status === 404) {
    return;
  }
  await handleDriveResponse(rawRes);
}
