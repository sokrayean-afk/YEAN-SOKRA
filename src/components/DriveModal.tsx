import type { User } from 'firebase/auth';
import {
  Check,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  Download,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { getFirebaseProjectId } from '../services/googleAuth';
import { DRIVE_DATA_FILENAME, type DriveFileMeta } from '../services/googleDrive';
import type {
  CloudHouseholdMeta,
  HouseholdEmailInvite,
} from '../services/householdSync';
import type { ActiveUser } from '../types/finance';
import { GoogleSignInButton } from './GoogleSignInButton';

interface DriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleUser: User | null;
  isMasterAccount: boolean;
  cloudMeta: CloudHouseholdMeta | null;
  cloudSyncStatus: 'offline' | 'connecting' | 'synced' | 'error';
  cloudSyncError: string;
  emailInvites: HouseholdEmailInvite[];
  hasDriveToken: boolean;
  driveFile: DriveFileMeta | null;
  isBusy: boolean;
  errorMsg: string;
  errorCode?: string;
  successMsg: string;
  localTxCount: number;
  localBillCount: number;
  husbandName: string;
  wifeName: string;
  onConnectMasterDrive: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onAddEmailInvite: (email: string, profileRole: ActiveUser) => Promise<void>;
  onDeleteEmailInvite: (inviteId: string) => Promise<void>;
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
  isMasterAccount,
  cloudMeta,
  cloudSyncStatus,
  cloudSyncError,
  emailInvites,
  hasDriveToken,
  driveFile,
  isBusy,
  errorMsg,
  errorCode = '',
  successMsg,
  localTxCount,
  localBillCount,
  husbandName,
  wifeName,
  onConnectMasterDrive,
  onSignOut,
  onAddEmailInvite,
  onDeleteEmailInvite,
  onRefreshFile,
  onConfirmSaveToDrive,
  onConfirmLoadFromDrive,
  onConfirmDeleteDriveFile,
  onExportLocalBackup,
}: DriveModalProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ActiveUser>('wife');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const projectId = getFirebaseProjectId();
  const isUnauthorizedDomain = errorCode === 'auth/unauthorized-domain';
  const husbandLabel = husbandName.trim() || 'ប្តី';
  const wifeLabel = wifeName.trim() || 'ប្រពន្ធ';

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

  const handleSubmitEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      await onAddEmailInvite(inviteEmail, inviteRole);
      setInviteEmail('');
      setInviteSuccess(
        'បានបន្ថែមអ្នកប្រើប្រាស់រួចរាល់! គាត់គ្រាន់តែចូលប្រព័ន្ធដោយគណនី Google នេះនឹងឃើញទិន្នន័យគ្រួសារតែមួយភ្លាម។'
      );
    } catch (err: unknown) {
      setInviteError(
        err instanceof Error ? err.message : 'មិនអាចបន្ថែមអ៊ីមែលអ្នកប្រើប្រាស់បានទេ។'
      );
    } finally {
      setInviteBusy(false);
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
              គណនីប្រព័ន្ធតែមួយ និង Google Drive
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
          {googleUser && (
            <div className="space-y-5">
              {/* Connected Account Header */}
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {googleUser.displayName || 'គណនី Google'}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                        isMasterAccount
                          ? 'bg-teal-50 text-teal-800 border border-teal-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isMasterAccount ? 'គណនីមេ' : 'សមាជិក'}
                    </span>
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

              {/* Section 1: Single-System Users & Sync */}
              <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-teal-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-teal-700" />
                    អ្នកប្រើប្រាស់ក្នុងប្រព័ន្ធតែមួយ
                  </span>
                  <span className="text-[11px] font-semibold text-teal-800">
                    {cloudSyncStatus === 'synced'
                      ? 'កំពុងភ្ជាប់អនឡាញ'
                      : cloudSyncStatus === 'connecting'
                      ? 'កំពុងភ្ជាប់...'
                      : 'មានបញ្ហា'}
                  </span>
                </div>

                {isMasterAccount ? (
                  <div className="space-y-3.5">
                    <p className="text-xs text-slate-700 leading-relaxed">
                      បន្ថែមអ៊ីមែល Google របស់ប្តី ឬប្រពន្ធខាងក្រោម ដើម្បីឱ្យគាត់ចូលប្រើប្រព័ន្ធគ្រួសារតែមួយនេះភ្លាមៗ (មិនចាំបាច់ភ្ជាប់ Google Drive ទេ)។
                    </p>

                    <form onSubmit={handleSubmitEmailInvite} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="អ៊ីមែល Gmail របស់សមាជិក"
                          required
                          className="sm:col-span-8 min-h-[40px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                        />
                        <select
                          value={inviteRole}
                          onChange={(e) =>
                            setInviteRole(e.target.value === 'husband' ? 'husband' : 'wife')
                          }
                          aria-label="តួនាទីសមាជិក"
                          className="sm:col-span-4 min-h-[40px] px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-teal-600"
                        >
                          <option value="wife">{wifeLabel}</option>
                          <option value="husband">{husbandLabel}</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        disabled={inviteBusy || !inviteEmail.trim()}
                        className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {inviteBusy ? 'កំពុងបន្ថែម...' : 'បន្ថែមអ្នកប្រើប្រាស់'}
                      </button>
                      {inviteError && <p className="text-xs text-red-700">{inviteError}</p>}
                      {inviteSuccess && (
                        <p className="text-xs text-teal-800 font-medium">{inviteSuccess}</p>
                      )}
                    </form>

                    {emailInvites.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-teal-200/70">
                        <div className="text-[11px] font-medium text-slate-600">
                          អ៊ីមែលដែលបានអនុញ្ញាត ({emailInvites.length})
                        </div>
                        <div className="space-y-1.5">
                          {emailInvites.map((inv) => (
                            <div
                              key={inv.id}
                              className="flex items-center justify-between gap-2 bg-white border border-teal-200/80 rounded-lg px-2.5 py-1.5"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-slate-900 truncate">
                                  {inv.email}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {inv.profileRole === 'husband' ? husbandLabel : wifeLabel}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => void onDeleteEmailInvite(inv.id)}
                                className="min-h-[32px] min-w-[32px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-md"
                                aria-label="ដកសិទ្ធិ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {cloudMeta?.inviteCode && (
                      <div className="space-y-1.5 pt-2 border-t border-teal-200/70">
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
                  </div>
                ) : (
                  <p className="text-xs text-slate-700 leading-relaxed">
                    អ្នកកំពុងប្រើប្រាស់ប្រព័ន្ធគ្រួសាររួមគ្នាតែមួយ។ រាល់ការកត់ត្រា និងការកែប្រែទាំងអស់ត្រូវបានធ្វើសមកាលកម្មភ្លាមៗជាមួយគណនីមេដោយស្វ័យប្រវត្តិ។
                  </p>
                )}

                {cloudSyncError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {cloudSyncError}
                  </p>
                )}
              </div>

              {/* Section 2: Google Drive Backup (Master Account ONLY) */}
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-700" />
                    Google Drive (តែគណនីមេមួយប៉ុណ្ណោះ)
                  </span>
                  {isMasterAccount && hasDriveToken && (
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

                {!isMasterAccount ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 leading-relaxed">
                    ការភ្ជាប់ និងបម្រុងទុកលើ Google Drive ត្រូវបានគ្រប់គ្រងដោយ <strong>គណនីមេតែមួយប៉ុណ្ណោះ</strong>។ អ្នកមិនចាំបាច់ភ្ជាប់ Google Drive លើគណនីនេះទេ ព្រោះទិន្នន័យត្រូវបានរក្សាទុកអនឡាញរួមគ្នាស្វ័យប្រវត្តិ។
                  </div>
                ) : !hasDriveToken ? (
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      ភ្ជាប់ Google Drive របស់គណនីមេ ដើម្បីរក្សាទុកច្បាប់បម្រុងទុកជាឯកសារ{' '}
                      <span className="font-mono">{DRIVE_DATA_FILENAME}</span>។
                    </p>
                    <GoogleSignInButton
                      onClick={onConnectMasterDrive}
                      disabled={isBusy}
                      fullWidth
                      label={isBusy ? 'កំពុងភ្ជាប់...' : 'ភ្ជាប់ Google Drive (គណនីមេ)'}
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
                            ? `ប្រព័ន្ធនឹងរក្សាទុកកំណត់ត្រាចំនួន ${localTxCount} និងវិក្កយបត្រប្រចាំខែ ${localBillCount} ទៅក្នុងឯកសារ "${DRIVE_DATA_FILENAME}" លើ Google Drive របស់គណនីមេ${
                                driveFile ? ' (ជំនួសទិន្នន័យចាស់ក្នុងឯកសារនោះ)' : ''
                              }។`
                            : pendingAction === 'load'
                            ? `ទិន្នន័យពីឯកសារ "${DRIVE_DATA_FILENAME}" នឹងត្រូវបានទាញយកមកជំនួសទិន្នន័យបច្ចុប្បន្ននៅលើប្រព័ន្ធគ្រួសារនេះ។`
                            : `ឯកសារ "${DRIVE_DATA_FILENAME}" នឹងត្រូវបានលុបចេញពី Google Drive របស់គណនីមេជាអចិន្ត្រៃយ៍ (ទិន្នន័យអនឡាញនៅរក្សាដដែល)។`}
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

              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onExportLocalBackup}
                  className="w-full min-h-[42px] flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  ទាញយកឯកសារបម្រុងទុក (JSON)
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="space-y-3 bg-red-50 border border-red-200 rounded-xl p-3.5">
              <p className="text-xs text-red-700 leading-relaxed">{errorMsg}</p>

              {isUnauthorizedDomain && currentHost && (
                <div className="pt-2.5 border-t border-red-200/80 space-y-2 text-xs text-slate-700">
                  <div className="font-semibold text-slate-900">
                    របៀបបើកសិទ្ធិចូលគណនី Google សម្រាប់គេហទំព័រនេះ៖
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
