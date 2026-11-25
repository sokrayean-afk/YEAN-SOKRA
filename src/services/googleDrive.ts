export const DRIVE_DATA_FILENAME = 'household-finance-data.json';

export interface DriveFileMeta {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

export class DriveAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveAuthError';
  }
}

async function handleDriveResponse(res: Response): Promise<Response> {
  if (res.status === 401) {
    throw new DriveAuthError('សម័យចូលគណនី Google បានផុតកំណត់ សូមចូលគណនីម្តងទៀត។');
  }
  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || '';
    } catch {
      // Ignore parse error
    }
    throw new Error(detail || `កំហុស Google Drive (${res.status})`);
  }
  return res;
}

export async function findDriveDataFile(
  accessToken: string
): Promise<DriveFileMeta | null> {
  const query = encodeURIComponent(
    `name='${DRIVE_DATA_FILENAME}' and trashed=false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=1`;

  const res = await handleDriveResponse(
    await fetch(url, {
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
    await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  );

  return (await res.json()) as T;
}

export async function saveDataToDrive(
  accessToken: string,
  payload: unknown,
  existingFileId?: string | null
): Promise<DriveFileMeta> {
  const jsonBody = JSON.stringify(payload, null, 2);

  if (existingFileId) {
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
      existingFileId
    )}?uploadType=media&fields=id,name,modifiedTime,size`;

    const res = await handleDriveResponse(
      await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: jsonBody,
      })
    );
    return (await res.json()) as DriveFileMeta;
  }

  const metadata = {
    name: DRIVE_DATA_FILENAME,
    mimeType: 'application/json',
  };

  const boundary = 'household_finance_boundary_' + Date.now();
  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    jsonBody,
    `--${boundary}--`,
  ].join('\r\n');

  const createUrl =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size';

  const res = await handleDriveResponse(
    await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    })
  );

  return (await res.json()) as DriveFileMeta;
}

export async function deleteDriveDataFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
  await handleDriveResponse(
    await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  );
}
