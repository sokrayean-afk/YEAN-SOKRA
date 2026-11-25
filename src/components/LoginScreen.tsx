import type { User } from 'firebase/auth';
import {
  Check,
  Copy,
  KeyRound,
  Link2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import {
  getFirebaseProjectId,
  MASTER_ADMIN_EMAIL,
} from '../services/googleAuth';
import { GoogleSignInButton } from './GoogleSignInButton';

interface LoginScreenProps {
  authReady: boolean;
  googleUser: User | null;
  needsInvite: boolean;
  isBusy: boolean;
  isConnectingCloud: boolean;
  errorMsg: string;
  errorCode: string;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onJoinByCode: (code: string) => Promise<void>;
  onRetryAccess: () => void;
}

export function LoginScreen({
  authReady,
  googleUser,
  needsInvite,
  isBusy,
  isConnectingCloud,
  errorMsg,
  errorCode,
  onSignIn,
  onSignOut,
  onJoinByCode,
  onRetryAccess,
}: LoginScreenProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [copiedDomain, setCopiedDomain] = useState(false);

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const projectId = getFirebaseProjectId();
  const isUnauthorizedDomain = errorCode === 'auth/unauthorized-domain';

  const handleCopyDomain = async () => {
    if (!currentHost) return;
    try {
      await navigator.clipboard.writeText(currentHost);
      setCopiedDomain(true);
      window.setTimeout(() => setCopiedDomain(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCode.trim().length < 6) return;
    setJoinBusy(true);
    setJoinError('');
    try {
      await onJoinByCode(inviteCode);
      setInviteCode('');
    } catch (err: unknown) {
      setJoinError(
        err instanceof Error ? err.message : 'មិនអាចភ្ជាប់តាមលេខកូដនេះបានទេ។'
      );
    } finally {
      setJoinBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-sm p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-teal-700" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              គណនីគ្រួសារ
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              ប្រព័ន្ធគ្រប់គ្រងចំណូល-ចំណាយប្រចាំខែតែមួយសម្រាប់គ្រួសារ
            </p>
          </div>
        </div>

        {/* State 1: Checking persisted auth session */}
        {!authReady ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-6 h-6 mx-auto border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500">កំពុងពិនិត្យការចូលប្រព័ន្ធ...</p>
          </div>
        ) : !googleUser ? (
          /* State 2: Sign in with Google */
          <div className="space-y-5">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <Users className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  ប្តី និងប្រពន្ធចូលប្រព័ន្ធដោយគណនី Google ដើម្បីប្រើទិន្នន័យគ្រួសារតែមួយរួមគ្នាលើគ្រប់ឧបករណ៍។
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  ការភ្ជាប់ Google Drive ប្រើតែលើ <strong className="text-slate-800">គណនីមេមួយ</strong> ប៉ុណ្ណោះ — អ្នកប្រើផ្សេងគ្រាន់តែចូលប្រព័ន្ធធម្មតា។
                </span>
              </div>
            </div>

            <GoogleSignInButton
              onClick={onSignIn}
              disabled={isBusy}
              fullWidth
              label={isBusy ? 'កំពុងចូលប្រព័ន្ធ...' : 'ចូលប្រព័ន្ធជាមួយ Google'}
            />
          </div>
        ) : needsInvite ? (
          /* State 3: Signed-in spouse/member joining the single Master household */
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {googleUser.displayName || 'អ្នកប្រើប្រាស់'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {googleUser.email}
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                disabled={isBusy || joinBusy}
                className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                ប្តូរគណនី
              </button>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 space-y-1.5 text-xs text-slate-700 leading-relaxed">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                ភ្ជាប់ចូលប្រព័ន្ធគ្រួសារតែមួយ
              </div>
              <p>
                គណនីនេះមិនទាន់មានសិទ្ធិចូលប្រព័ន្ធគ្រួសារនៅឡើយទេ។ សូមបញ្ចូល{' '}
                <strong>លេខកូដគ្រួសារ</strong> ពីគណនីមេ (
                <span className="font-mono">{MASTER_ADMIN_EMAIL}</span>) ឬឱ្យគណនីមេបន្ថែមអ៊ីមែលរបស់អ្នកក្នុងប្រព័ន្ធ។
              </p>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="login-invite-code"
                  className="block text-xs font-medium text-slate-700"
                >
                  លេខកូដភ្ជាប់គ្រួសារ (ពីគណនីមេ)
                </label>
                <input
                  id="login-invite-code"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="ឧ. AB12CD34"
                  maxLength={12}
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono uppercase tracking-widest bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                />
              </div>

              <button
                type="submit"
                disabled={joinBusy || inviteCode.trim().length < 6}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors disabled:opacity-50"
              >
                <Link2 className="w-4 h-4" />
                {joinBusy ? 'កំពុងភ្ជាប់...' : 'ចូលប្រើប្រព័ន្ធគ្រួសារ'}
              </button>

              <button
                type="button"
                onClick={onRetryAccess}
                disabled={joinBusy || isConnectingCloud}
                className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isConnectingCloud ? 'animate-spin' : ''}`} />
                ពិនិត្យសិទ្ធិម្តងទៀត (ប្រសិនបើគណនីមេទើបបន្ថែមអ៊ីមែល)
              </button>

              {joinError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  {joinError}
                </p>
              )}
            </form>
          </div>
        ) : (
          /* State 4: Connecting to single shared household */
          <div className="py-6 text-center space-y-4">
            <div className="space-y-2">
              <div className="w-6 h-6 mx-auto border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-800">
                កំពុងផ្ទុកទិន្នន័យប្រព័ន្ធគ្រួសារ...
              </p>
              <p className="text-xs text-slate-500 truncate">{googleUser.email}</p>
            </div>
            {errorMsg && (
              <div className="space-y-2.5 text-left">
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
                  {errorMsg}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onRetryAccess}
                    className="flex-1 min-h-[42px] px-3 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl"
                  >
                    ព្យាយាមម្តងទៀត
                  </button>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="min-h-[42px] px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-xl"
                  >
                    ចាកចេញ
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Auth Error + Authorized Domain Guide */}
        {!googleUser && errorMsg && (
          <div className="space-y-3 bg-red-50 border border-red-200 rounded-2xl p-3.5">
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
                    ជ្រើសរើស{' '}
                    <span className="font-semibold">
                      Authentication → Settings → Authorized domains
                    </span>
                  </li>
                  <li>
                    ចុច <span className="font-semibold">Add domain</span> រួចបញ្ចូលដែនខាងក្រោម៖
                  </li>
                </ol>
                <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <span className="font-mono text-xs text-slate-900 truncate">
                    {currentHost}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyDomain}
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
      </div>
    </div>
  );
}
