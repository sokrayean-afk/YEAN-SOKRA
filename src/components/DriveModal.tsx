import type { User } from 'firebase/auth';
import {
  Cloud,
  CloudDownload,
  CloudUpload,
  LogOut,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { DRIVE_DATA_FILENAME, type DriveFileMeta } from '../services/googleDrive';
import { GoogleSignInButton } from './GoogleSignInButton';

interface DriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleUser: User | null;
  hasDriveToken: boolean;
  driveFile: DriveFileMeta | null;
  isBusy: boolean;
  errorMsg: string;
  successMsg: string;
  localTxCount: number;
  localBillCount: number;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onRefreshFile: () => Promise<void>;
  onConfirmSaveToDrive: () => Promise<void>;
  onConfirmLoadFromDrive: () => Promise<void>;
  onConfirmDeleteDriveFile: () => Promise<void>;
}

type PendingAction = 'save' | 'load' | 'delete' | null;

function formatModifiedTime(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('km-KH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function DriveModal({
  isOpen,
  onClose,
  googleUser,
  hasDriveToken,
  driveFile,
  isBusy,
  errorMsg,
  successMsg,
  localTxCount,
  localBillCount,
  onSignIn,
  onSignOut,
  onRefreshFile,
  onConfirmSaveToDrive,
  onConfirmLoadFromDrive,
  onConfirmDeleteDriveFile,
}: DriveModalProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'save') {
      await onConfirmSaveToDrive();
    } else if (action === 'load') {
      await onConfirmLoadFromDrive();
    } else if (action === 'delete') {
      await onConfirmDeleteDriveFile();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drive-modal-title"
    >
      <div className="w-full sm:max-w-md bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-teal-700 shrink-0" />
            <h2 id="drive-modal-title" className="text-base font-semibold text-slate-900">
              រក្សាទុកទិន្នន័យលើ Google Drive
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setPendingAction(null);
              onClose();
            }}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl"
            aria-label="បិទ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {!hasDriveToken ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                ភ្ជាប់គណនី Google របស់អ្នក ដើម្បីរក្សាទុកឯកសារទិន្នន័យ{' '}
                <span className="font-mono text-xs text-slate-800">{DRIVE_DATA_FILENAME}</span>{' '}
                នៅលើ Google Drive ផ្ទាល់ខ្លួន និងទាញយកមកប្រើលើទូរស័ព្ទ ឬកុំព្យូទ័រផ្សេងបានគ្រប់ពេល។
              </p>

              <GoogleSignInButton
                onClick={onSignIn}
                disabled={isBusy}
                fullWidth
                label={
                  isBusy
                    ? 'កំពុងភ្ជាប់...'
                    : googleUser
                    ? 'ភ្ជាប់ Google Drive ឡើងវិញ'
                    : 'ចូលគណនីជាមួយ Google'
                }
              />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Connected Account */}
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {googleUser?.displayName || 'គណនី Google'}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {googleUser?.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  disabled={isBusy}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  ចាកចេញ
                </button>
              </div>

              {/* Drive File Status */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">
                    ឯកសារលើ Google Drive
                  </span>
                  <button
                    type="button"
                    onClick={onRefreshFile}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                    ពិនិត្យម្តងទៀត
                  </button>
                </div>

                {driveFile ? (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-slate-900 font-mono truncate">
                      {driveFile.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      កែប្រែចុងក្រោយ៖ {formatModifiedTime(driveFile.modifiedTime)}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">
                    មិនទាន់មានឯកសាររក្សាទុកលើ Google Drive ទេ។
                  </div>
                )}
              </div>

              {/* Mandatory Confirmation Panel before mutating/overwriting/deleting Drive or local data */}
              {pendingAction ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {pendingAction === 'save'
                      ? driveFile
                        ? 'បញ្ជាក់ការរក្សាទុក និងជំនួសឯកសារលើ Google Drive?'
                        : 'បញ្ជាក់ការបង្កើតឯកសារថ្មីលើ Google Drive?'
                      : pendingAction === 'load'
                      ? 'បញ្ជាក់ការផ្ទុកទិន្នន័យពី Google Drive?'
                      : 'បញ្ជាក់ការលុបឯកសារចេញពី Google Drive?'}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {pendingAction === 'save'
                      ? `ប្រព័ន្ធនឹងរក្សាទុកកំណត់ត្រាចំនួន ${localTxCount} និងវិក្កយបត្រប្រចាំខែ ${localBillCount} ទៅក្នុងឯកសារ "${DRIVE_DATA_FILENAME}" លើ Google Drive របស់អ្នក${
                          driveFile ? ' (ជំនួសទិន្នន័យចាស់ក្នុងឯកសារនោះ)' : ''
                        }។`
                      : pendingAction === 'load'
                      ? `ទិន្នន័យពីឯកសារ "${DRIVE_DATA_FILENAME}" នឹងត្រូវបានទាញយកមកជំនួសទិន្នន័យបច្ចុប្បន្ននៅលើឧបករណ៍នេះ។`
                      : `ឯកសារ "${DRIVE_DATA_FILENAME}" នឹងត្រូវបានលុបចេញពី Google Drive របស់អ្នកជាអចិន្ត្រៃយ៍ (ទិន្នន័យលើឧបករណ៍នេះនៅរក្សាដដែល)។`}
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPendingAction(null)}
                      disabled={isBusy}
                      className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
                    >
                      បោះបង់
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={isBusy}
                      className={`min-h-[44px] px-4 py-2 text-xs font-semibold text-white rounded-xl transition-colors ${
                        pendingAction === 'delete'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-teal-700 hover:bg-teal-800'
                      }`}
                    >
                      {isBusy ? 'កំពុងដំណើរការ...' : 'បញ្ជាក់'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setPendingAction('save')}
                    className="w-full min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <CloudUpload className="w-4 h-4 shrink-0" />
                    រក្សាទុកទិន្នន័យទៅ Google Drive
                  </button>

                  {driveFile && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setPendingAction('load')}
                      className="w-full min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <CloudDownload className="w-4 h-4 shrink-0" />
                      ទាញយកទិន្នន័យពី Google Drive
                    </button>
                  )}

                  {driveFile && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setPendingAction('delete')}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      លុបឯកសារបម្រុងទុកលើ Google Drive
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {errorMsg}
            </p>
          )}

          {successMsg && (
            <p className="text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-xl px-3.5 py-2.5">
              {successMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
