import type { User } from 'firebase/auth';
import {
  Check,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  Download,
  Link2,
  LogOut,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { getFirebaseProjectId } from '../services/googleAuth';
import { DRIVE_DATA_FILENAME, type DriveFileMeta } from '../services/googleDrive';
import type { CloudHouseholdMeta } from '../services/householdSync';
import { GoogleSignInButton } from './GoogleSignInButton';

interface DriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleUser: User | null;
  cloudMeta: CloudHouseholdMeta | null;
  cloudSyncStatus: 'offline' | 'connecting' | 'synced' | 'error';
  cloudSyncError: string;
  hasDriveToken: boolean;
  driveFile: DriveFileMeta | null;
  isBusy: boolean;
  errorMsg: string;
  errorCode?: string;
  successMsg: string;
  localTxCount: number;
  localBillCount: number;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onJoinHousehold: (inviteCode: string) => Promise<void>;
  onRefreshFile: () => Promise<void>;
  onConfirmSaveToDrive: () => Promise<void>;
  onConfirmLoadFromDrive: () => Promise<void>;
  onConfirmDeleteDriveFile: () => Promise<void>;
  onExportLocalBackup: () => void;
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
  cloudMeta,
  cloudSyncStatus,
  cloudSyncError,
  hasDriveToken,
  driveFile,
  isBusy,
  errorMsg,
  errorCode = '',
  successMsg,
  localTxCount,
  localBillCount,
  onSignIn,
  onSignOut,
  onJoinHousehold,
  onRefreshFile,
  onConfirmSaveToDrive,
  onConfirmLoadFromDrive,
  onConfirmDeleteDriveFile,
  onExportLocalBackup,
}: DriveModalProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const projectId = getFirebaseProjectId();
  const isUnauthorizedDomain = errorCode === 'auth/unauthorized-domain';

  const handleCopyText = async (text: string, which: 'domain' | 'code') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'domain') {
        setCopiedDomain(true);
        window.setTimeout(() => setCopiedDomain(false), 2000);
      } else {
        setCopiedCode(true);
        window.setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      // Ignore clipboard failure
    }
  };

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

  const handleSubmitJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinBusy(true);
    setJoinError('');
    setJoinSuccess('');
    try {
      await onJoinHousehold(joinCode);
      setJoinCode('');
      setJoinSuccess('បានភ្ជាប់ចូលគណនីគ្រួសារដូចគ្នាដោយជោគជ័យ! ទិន្នន័យកំពុងធ្វើសមកាលកម្ម។');
    } catch (err: unknown) {
      setJoinError(
        err instanceof Error ? err.message : 'មិនអាចភ្ជាប់តាមលេខកូដនេះបានទេ។'
      );
    } finally {
      setJoinBusy(false);
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
              សមកាលកម្មអនឡាញ និងបម្រុងទុក
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
          {!googleUser ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                ចូលគណនី Google ដើម្បីរក្សាទុកទិន្នន័យលើ Cloud អនឡាញដោយស្វ័យប្រវត្តិ។
                អ្នកអាចបើកកម្មវិធីលើទូរស័ព្ទ ឬកុំព្យូទ័រណាក៏ដោយ ហើយមើលឃើញ និងកត់ត្រាទិន្នន័យគ្រួសារតែមួយភ្លាមៗ។
              </p>

              <GoogleSignInButton
                onClick={onSignIn}
                disabled={isBusy}
                fullWidth
                label={isBusy ? 'កំពុងភ្ជាប់...' : 'ចូលគណនីជាមួយ Google'}
              />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Connected Account Header */}
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {googleUser.displayName || 'គណនី Google'}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {googleUser.email}
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

              {/* Section 1: Real-Time Online Multi-Device Cloud Sync */}
              <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-teal-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-teal-700" />
                    សមកាលកម្មអនឡាញគ្រប់ឧបករណ៍
                  </span>
                  <span className="text-[11px] font-semibold text-teal-800">
                    {cloudSyncStatus === 'synced'
                      ? 'កំពុងដំណើរការ'
                      : cloudSyncStatus === 'connecting'
                      ? 'កំពុងភ្ជាប់...'
                      : 'មានបញ្ហា'}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">
                  រាល់ការកត់ត្រាថ្មីត្រូវបានរក្សាទុកអនឡាញដោយស្វ័យប្រវត្តិ។ ចូលគណនី Google
                  ដូចគ្នាលើឧបករណ៍ផ្សេង ឬប្រើលេខកូដខាងក្រោមដើម្បីភ្ជាប់គណនីប្តី និងប្រពន្ធចូលគ្នា។
                </p>

                {cloudMeta?.inviteCode && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-slate-600">
                      លេខកូដភ្ជាប់គ្រួសារ ({cloudMeta.memberIds.length} គណនីបានភ្ជាប់)
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-white border border-teal-200 rounded-lg px-3 py-2">
                      <span className="font-mono text-sm font-bold tracking-widest text-slate-900">
                        {cloudMeta.inviteCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(cloudMeta.inviteCode, 'code')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md shrink-0"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            បានចម្លង
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            ចម្លងកូដ
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Join another spouse's household by invite code */}
                <form onSubmit={handleSubmitJoin} className="pt-2 border-t border-teal-200/70 space-y-2">
                  <label
                    htmlFor="join-household-code"
                    className="block text-[11px] font-medium text-slate-700"
                  >
                    មានលេខកូដគ្រួសារពីឧបករណ៍មួយទៀត? បញ្ចូលដើម្បីភ្ជាប់ទិន្នន័យតែមួយ៖
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="join-household-code"
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="ឧ. AB12CD34"
                      maxLength={12}
                      className="flex-1 min-h-[40px] px-3 py-1.5 text-xs font-mono uppercase bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                    />
                    <button
                      type="submit"
                      disabled={joinBusy || joinCode.trim().length < 6}
                      className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      {joinBusy ? 'កំពុងភ្ជាប់...' : 'ភ្ជាប់គ្រួសារ'}
                    </button>
                  </div>
                  {joinError && (
                    <p className="text-xs text-red-700">{joinError}</p>
                  )}
                  {joinSuccess && (
                    <p className="text-xs text-teal-800 font-medium">{joinSuccess}</p>
                  )}
                </form>

                {cloudSyncError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {cloudSyncError}
                  </p>
                )}
              </div>

              {/* Section 2: Google Drive File Backup */}
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    ឯកសារបម្រុងទុកលើ Google Drive
                  </span>
                  {hasDriveToken && (
                    <button
                      type="button"
                      onClick={onRefreshFile}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                      ពិនិត្យម្តងទៀត
                    </button>
                  )}
                </div>

                {!hasDriveToken ? (
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      ចង់រក្សាទុកច្បាប់ចម្លងបន្ថែមជាឯកសារ <span className="font-mono">{DRIVE_DATA_FILENAME}</span> ក្នុង Google Drive?
                    </p>
                    <GoogleSignInButton
                      onClick={onSignIn}
                      disabled={isBusy}
                      fullWidth
                      label={isBusy ? 'កំពុងភ្ជាប់...' : 'ភ្ជាប់សិទ្ធិ Google Drive'}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                      {driveFile ? (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-slate-900 font-mono truncate">
                            {driveFile.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            កែប្រែចុងក្រោយ៖ {formatModifiedTime(driveFile.modifiedTime)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-600">
                          មិនទាន់មានឯកសារបម្រុងទុកលើ Google Drive ទេ។
                        </div>
                      )}
                    </div>

                    {/* Mandatory Confirmation Panel before mutating/overwriting/deleting Drive data */}
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
                            ? `ទិន្នន័យពីឯកសារ "${DRIVE_DATA_FILENAME}" នឹងត្រូវបានទាញយកមកជំនួសទិន្នន័យបច្ចុប្បន្ននៅលើគណនីគ្រួសារនេះ។`
                            : `ឯកសារ "${DRIVE_DATA_FILENAME}" នឹងត្រូវបានលុបចេញពី Google Drive របស់អ្នកជាអចិន្ត្រៃយ៍ (ទិន្នន័យអនឡាញនៅរក្សាដដែល)។`}
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
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setPendingAction('save')}
                          className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors disabled:opacity-50"
                        >
                          <CloudUpload className="w-4 h-4 shrink-0" />
                          បម្រុងទុកឯកសារទៅ Google Drive
                        </button>

                        {driveFile && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setPendingAction('load')}
                            className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors disabled:opacity-50"
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
                            className="w-full min-h-[40px] flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            លុបឯកសារបម្រុងទុកលើ Google Drive
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="space-y-3 bg-red-50 border border-red-200 rounded-xl p-3.5">
              <p className="text-xs text-red-700 leading-relaxed">{errorMsg}</p>

              {isUnauthorizedDomain && currentHost && (
                <div className="pt-2.5 border-t border-red-200/80 space-y-2 text-xs text-slate-700">
                  <div className="font-semibold text-slate-900">
                    របៀបបើកសិទ្ធិចូលគណនី Google សម្រាប់គេហទំព័រនេះ (ប្រើពេល ១ នាទី)៖
                  </div>
                  <ol className="list-decimal pl-4 space-y-1 leading-relaxed">
                    <li>
                      ចូលទៅ <span className="font-semibold">Firebase Console</span> → គម្រោង{' '}
                      <span className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {projectId}
                      </span>
                    </li>
                    <li>
                      ជ្រើសរើស <span className="font-semibold">Authentication → Settings → Authorized domains</span>
                    </li>
                    <li>ចុច <span className="font-semibold">Add domain</span> រួចបញ្ចូលដែនខាងក្រោម៖</li>
                  </ol>
                  <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                    <span className="font-mono text-xs text-slate-900 truncate">{currentHost}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(currentHost, 'domain')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md shrink-0"
                    >
                      {copiedDomain ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          បានចម្លង
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          ចម្លង
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!googleUser && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="text-xs text-slate-500 leading-relaxed">
                ជម្រើសរក្សាទុកបន្ទាន់៖ ទាញយកឯកសារ JSON ទុកក្នុងម៉ាស៊ីន។
              </div>
              <button
                type="button"
                onClick={onExportLocalBackup}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4 shrink-0" />
                ទាញយកឯកសារបម្រុងទុក (JSON)
              </button>
            </div>
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
