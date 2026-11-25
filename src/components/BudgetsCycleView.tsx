import type { User } from 'firebase/auth';
import {
  Bell,
  Check,
  Cloud,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { DriveFileMeta } from '../services/googleDrive';
import type {
  Category,
  CycleRange,
  HouseholdSettings,
  RecurringBill,
  Transaction,
} from '../types/finance';
import {
  addDaysIso,
  addMonthsMinusOneDayIso,
  formatKhmerDate,
  formatKhmerShortDate,
  getBillDueDateInCycle,
  getCycleRangeFromSettings,
  getTodayIso,
} from '../utils/cycle';
import { formatMoney, PAYMENT_METHOD_LABELS } from '../utils/format';
import { GoogleSignInButton } from './GoogleSignInButton';

interface BudgetsCycleViewProps {
  settings: HouseholdSettings;
  onUpdateSettings: (next: Partial<HouseholdSettings>) => void;
  activeCycle: CycleRange;
  cycleTransactions: Transaction[];
  categories: Category[];
  bills: RecurringBill[];
  googleUser: User | null;
  hasDriveToken: boolean;
  driveFile: DriveFileMeta | null;
  driveBusy: boolean;
  driveError: string;
  driveSuccess: string;
  onSignInGoogle: () => Promise<void>;
  onOpenDriveModal: () => void;
  reminderCount: number;
  onOpenNotifications: () => void;
  onAddBill: () => void;
  onEditBill: (bill: RecurringBill) => void;
  onDeleteBill: (id: string) => void;
  onPayBill: (bill: RecurringBill) => void;
  onExportBackup: () => void;
  onImportBackup: (jsonText: string) => string | null;
  onResetSampleData: () => void;
  onClearAllTransactions: () => void;
}

const PRESET_DAYS = [1, 5, 10, 15, 25, 28];

export function BudgetsCycleView({
  settings,
  onUpdateSettings,
  activeCycle,
  cycleTransactions,
  categories,
  bills,
  googleUser,
  hasDriveToken,
  driveFile,
  driveBusy,
  driveError,
  driveSuccess,
  onSignInGoogle,
  onOpenDriveModal,
  reminderCount,
  onOpenNotifications,
  onAddBill,
  onEditBill,
  onDeleteBill,
  onPayBill,
  onExportBackup,
  onImportBackup,
  onResetSampleData,
  onClearAllTransactions,
}: BudgetsCycleViewProps) {
  const {
    displayCurrency,
    exchangeRate,
    cycleMode,
    cycleStartDay,
    customStartDate,
    customEndDate,
    categoryBudgets,
    monthlyBudgetTargetUsd,
  } = settings;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusIsError, setStatusIsError] = useState<boolean>(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const previewCurrentCycle = getCycleRangeFromSettings(settings, 0);
  const previewNextCycle = getCycleRangeFromSettings(settings, 1);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const spendByCat = new Map<string, number>();
  for (const tx of cycleTransactions) {
    if (tx.type === 'expense') {
      spendByCat.set(tx.categoryId, (spendByCat.get(tx.categoryId) || 0) + tx.amountUsd);
    }
  }

  const handleCategoryBudgetChange = (catId: string, rawVal: string) => {
    const val = parseFloat(rawVal);
    const nextBudgets = {
      ...categoryBudgets,
      [catId]: Number.isFinite(val) && val >= 0 ? val : 0,
    };
    onUpdateSettings({ categoryBudgets: nextBudgets });
  };

  const applyQuickRange = (kind: '1m' | '30d' | 'cal_month') => {
    if (kind === 'cal_month') {
      const today = getTodayIso();
      const [y, m] = today.split('-').map(Number);
      const first = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDate = new Date(y, m, 0);
      const last = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`;
      onUpdateSettings({
        cycleMode: 'custom_range',
        customStartDate: first,
        customEndDate: last,
      });
      return;
    }
    const start = customStartDate || getTodayIso();
    onUpdateSettings({
      cycleMode: 'custom_range',
      customStartDate: start,
      customEndDate:
        kind === '30d' ? addDaysIso(start, 29) : addMonthsMinusOneDayIso(start, 1),
    });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const err = onImportBackup(text);
      if (err) {
        setStatusIsError(true);
        setStatusMessage(err);
      } else {
        setStatusIsError(false);
        setStatusMessage('បានផ្ទុកទិន្នន័យបម្រុងទុកឡើងវិញដោយជោគជ័យ។');
      }
    };
    reader.onerror = () => {
      setStatusIsError(true);
      setStatusMessage('មិនអាចអានឯកសារដែលបានជ្រើសរើសបានទេ។ សូមព្យាយាមម្តងទៀត។');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 0. Two Users Setup (Husband & Wife) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-700 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900">
                គណនីអ្នកប្រើប្រាស់ (២ នាក់៖ ប្តី និង ប្រពន្ធ)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              ជ្រើសរើសអ្នកដែលកំពុងប្រើប្រាស់ និងកែឈ្មោះបង្ហាញសម្រាប់ប្តី និងប្រពន្ធ
            </p>
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => onUpdateSettings({ activeUser: 'husband' })}
              className={`min-h-[42px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                settings.activeUser === 'husband'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {settings.husbandName.trim() || 'ប្តី'}
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ activeUser: 'wife' })}
              className={`min-h-[42px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                settings.activeUser === 'wife'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {settings.wifeName.trim() || 'ប្រពន្ធ'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
          <div className="space-y-1.5">
            <label htmlFor="husband-name" className="block text-xs font-medium text-slate-600">
              ឈ្មោះអ្នកប្រើទី ១ (ប្តី)
            </label>
            <input
              id="husband-name"
              type="text"
              value={settings.husbandName}
              onChange={(e) => onUpdateSettings({ husbandName: e.target.value })}
              placeholder="ប្តី"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="wife-name" className="block text-xs font-medium text-slate-600">
              ឈ្មោះអ្នកប្រើទី ២ (ប្រពន្ធ)
            </label>
            <input
              id="wife-name"
              type="text"
              value={settings.wifeName}
              onChange={(e) => onUpdateSettings({ wifeName: e.target.value })}
              placeholder="ប្រពន្ធ"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>
        </div>
      </section>

      {/* 1. Google Drive Cloud Backup & Sync Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-teal-700 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900">
                រក្សាទុកទិន្នន័យក្នុង Google Drive
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              {hasDriveToken
                ? `បានភ្ជាប់ជាមួយ ${googleUser?.email || 'គណនី Google'}${
                    driveFile ? ' · មានឯកសារបម្រុងទុកលើ Drive' : ''
                  }`
                : 'ភ្ជាប់គណនី Google ដើម្បីរក្សាទុក និងទាញយកទិន្នន័យគ្រួសាររបស់អ្នកលើទូរស័ព្ទ និងកុំព្យូទ័រ។'}
            </p>
          </div>

          <div className="shrink-0">
            {hasDriveToken ? (
              <button
                type="button"
                onClick={onOpenDriveModal}
                disabled={driveBusy}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors whitespace-nowrap disabled:opacity-50"
              >
                គ្រប់គ្រង និងរក្សាទុកលើ Drive
              </button>
            ) : (
              <GoogleSignInButton
                onClick={onSignInGoogle}
                disabled={driveBusy}
                label={
                  driveBusy
                    ? 'កំពុងភ្ជាប់...'
                    : googleUser
                    ? 'ភ្ជាប់ Google Drive ឡើងវិញ'
                    : 'ចូលគណនីជាមួយ Google'
                }
                fullWidth
              />
            )}
          </div>
        </div>

        {driveError && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
            {driveError}
          </p>
        )}

        {driveSuccess && !driveError && (
          <p className="text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
            {driveSuccess}
          </p>
        )}
      </section>

      {/* 2. Custom 1-Month Period & Monthly Cutoff Selector */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">
            កំណត់រយៈពេលមួយខែដោយខ្លួនឯង
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            អ្នកអាចជ្រើសរើសថ្ងៃចាប់ផ្តើម និងថ្ងៃបញ្ចប់ដោយខ្លួនឯង ឬកំណត់ថ្ងៃចាប់ផ្តើមប្រចាំខែស្វ័យប្រវត្តិ (ថ្ងៃទី 1–28)។
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl max-w-xl">
          <button
            type="button"
            onClick={() => onUpdateSettings({ cycleMode: 'custom_range' })}
            className={`min-h-[44px] px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
              cycleMode === 'custom_range'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            កំណត់ថ្ងៃចាប់ផ្តើម – បញ្ចប់
          </button>
          <button
            type="button"
            onClick={() => onUpdateSettings({ cycleMode: 'monthly_day' })}
            className={`min-h-[44px] px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
              cycleMode === 'monthly_day'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            រាប់រៀងរាល់ខែតាមថ្ងៃទី (1–28)
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
          <div className="lg:col-span-7 space-y-4">
            {cycleMode === 'custom_range' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="settings-custom-start"
                      className="block text-xs font-medium text-slate-600"
                    >
                      ថ្ងៃចាប់ផ្តើម
                    </label>
                    <input
                      id="settings-custom-start"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        onUpdateSettings({
                          cycleMode: 'custom_range',
                          customStartDate: val,
                          customEndDate:
                            customEndDate >= val
                              ? customEndDate
                              : addMonthsMinusOneDayIso(val, 1),
                        });
                      }}
                      className="w-full min-h-[46px] px-3.5 py-2.5 text-sm num-tabular text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="settings-custom-end"
                      className="block text-xs font-medium text-slate-600"
                    >
                      ថ្ងៃបញ្ចប់
                    </label>
                    <input
                      id="settings-custom-end"
                      type="date"
                      value={customEndDate}
                      min={customStartDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val || val < customStartDate) return;
                        onUpdateSettings({
                          cycleMode: 'custom_range',
                          customEndDate: val,
                        });
                      }}
                      className="w-full min-h-[46px] px-3.5 py-2.5 text-sm num-tabular text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyQuickRange('1m')}
                    className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors"
                  >
                    + 1 ខែពេញពីថ្ងៃចាប់ផ្តើម
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickRange('30d')}
                    className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    + 30 ថ្ងៃ
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickRange('cal_month')}
                    className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    ដើមខែ ដល់ ចុងខែនេះ
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PRESET_DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => onUpdateSettings({ cycleStartDay: day })}
                      className={`min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap num-tabular ${
                        cycleStartDay === day
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      ថ្ងៃទី {day}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => {
                    const selected = cycleStartDay === day;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => onUpdateSettings({ cycleStartDay: day })}
                        className={`min-h-[42px] rounded-xl text-sm num-tabular font-medium transition-colors border ${
                          selected
                            ? 'bg-teal-700 text-white border-teal-700'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white hover:border-teal-500'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Live Preview */}
          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-medium text-slate-500">
                រយៈពេលបច្ចុប្បន្នដែលកំពុងប្រើ
              </div>
              <div className="text-base sm:text-lg font-bold text-slate-900">
                {previewCurrentCycle.label}
              </div>
              <dl className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs">
                <div>
                  <dt className="text-slate-500">ថ្ងៃចាប់ផ្តើម</dt>
                  <dd className="font-semibold text-slate-900 num-tabular mt-0.5">
                    {formatKhmerDate(previewCurrentCycle.startDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">ថ្ងៃបញ្ចប់</dt>
                  <dd className="font-semibold text-slate-900 num-tabular mt-0.5">
                    {formatKhmerDate(previewCurrentCycle.endDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">ចំនួនថ្ងៃសរុប</dt>
                  <dd className="font-semibold text-slate-900 num-tabular mt-0.5">
                    {previewCurrentCycle.totalDays} ថ្ងៃ
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">នៅសល់ដល់ថ្ងៃបិទ</dt>
                  <dd className="font-semibold text-teal-700 num-tabular mt-0.5">
                    {previewCurrentCycle.daysRemaining} ថ្ងៃ
                  </dd>
                </div>
              </dl>
            </div>

            <div className="pt-3 border-t border-slate-200 text-xs text-slate-500">
              រយៈពេលបន្ទាប់៖{' '}
              <span className="font-medium text-slate-700">{previewNextCycle.label}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Recurring Bills & Monthly Due Dates */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              កាលវិភាគ និងថ្ងៃកំណត់បង់ប្រាក់ប្រចាំខែ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              កំណត់ថ្ងៃត្រូវបង់វិក្កយបត្រទឹក ភ្លើង អ៊ីនធឺណិត ឬបង់រំលស់
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenNotifications}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Bell className="w-4 h-4 text-teal-700" />
              <span>
                ការរំលឹក ({settings.reminderDaysBefore} ថ្ងៃមុន
                {reminderCount > 0 ? ` · ${reminderCount}` : ''})
              </span>
            </button>
            <button
              type="button"
              onClick={onAddBill}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-xl hover:bg-teal-800 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              បន្ថែមថ្ងៃកំណត់បង់ប្រាក់
            </button>
          </div>
        </div>

        {bills.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            មិនទាន់មានកាលវិភាគបង់ប្រាក់ប្រចាំខែទេ
          </div>
        ) : (
          <>
            {/* Mobile Bill Rows */}
            <div className="md:hidden divide-y divide-slate-100">
              {[...bills]
                .sort((a, b) => a.dueDay - b.dueDay)
                .map((bill) => {
                  const dueDate = getBillDueDateInCycle(bill.dueDay, activeCycle);
                  const isPaid = Boolean(bill.paidCycles[activeCycle.key]);
                  return (
                    <div key={bill.id} className="py-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {bill.title}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 num-tabular">
                            ថ្ងៃទី {bill.dueDay} រៀងរាល់ខែ · {formatKhmerShortDate(dueDate)}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-slate-900 num-tabular shrink-0">
                          {formatMoney(bill.amountUsd, displayCurrency, exchangeRate)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                            <Check className="w-4 h-4" />
                            បានបង់រួច
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onPayBill(bill)}
                            className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg"
                          >
                            កត់ត្រាថាបានបង់
                          </button>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditBill(bill)}
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-slate-800 rounded-lg"
                            aria-label="កែប្រែ"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteBill(bill.id)}
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg"
                            aria-label="លុប"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Desktop Bill Table */}
            <div className="hidden md:block overflow-x-auto -mx-6 px-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2.5 pr-3">វិក្កយបត្រ / ការបង់ប្រាក់</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">ថ្ងៃកំណត់រៀងរាល់ខែ</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">ថ្ងៃត្រូវបង់ក្នុងវដ្តនេះ</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">ទឹកប្រាក់</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">ស្ថានភាព</th>
                    <th className="py-2.5 pl-3 text-right whitespace-nowrap">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {[...bills]
                    .sort((a, b) => a.dueDay - b.dueDay)
                    .map((bill) => {
                      const dueDate = getBillDueDateInCycle(bill.dueDay, activeCycle);
                      const isPaid = Boolean(bill.paidCycles[activeCycle.key]);
                      return (
                        <tr key={bill.id} className="hover:bg-slate-50/70">
                          <td className="py-3 pr-3">
                            <div className="font-medium text-slate-900">{bill.title}</div>
                            <div className="text-xs text-slate-500">
                              {PAYMENT_METHOD_LABELS[bill.paymentMethod]}
                              {bill.note ? ` · ${bill.note}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs font-medium text-slate-700 num-tabular whitespace-nowrap">
                            ថ្ងៃទី {bill.dueDay}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-600 num-tabular whitespace-nowrap">
                            {formatKhmerShortDate(dueDate)}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-900 num-tabular whitespace-nowrap">
                            {formatMoney(bill.amountUsd, displayCurrency, exchangeRate)}
                          </td>
                          <td className="py-3 px-3 text-xs whitespace-nowrap">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                                <Check className="w-3.5 h-3.5" />
                                បានបង់រួច
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onPayBill(bill)}
                                className="px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors"
                              >
                                កត់ត្រាថាបានបង់
                              </button>
                            )}
                          </td>
                          <td className="py-3 pl-3 text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onEditBill(bill)}
                                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-md"
                                aria-label="កែប្រែ"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteBill(bill.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-md"
                                aria-label="លុប"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* 4. Monthly Category Budgets */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              កំណត់កម្រិតថវិកាចំណាយក្នុងមួយវដ្ត
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              បញ្ចូលកម្រិតថវិកាជា USD ដើម្បីតាមដានការចំណាយសរុប និងតាមប្រភេទ
            </p>
          </div>
          <div className="w-full sm:w-56 space-y-1">
            <label htmlFor="monthly-target" className="block text-xs font-medium text-slate-600">
              គោលដៅចំណាយសរុប (USD)
            </label>
            <input
              id="monthly-target"
              type="number"
              inputMode="decimal"
              min="0"
              step="10"
              value={monthlyBudgetTargetUsd}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onUpdateSettings({
                  monthlyBudgetTargetUsd: Number.isFinite(v) && v >= 0 ? v : 0,
                });
              }}
              className="w-full min-h-[44px] px-3 py-2 text-sm num-tabular font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {expenseCategories.map((cat) => {
            const limit = categoryBudgets[cat.id] || 0;
            const spent = spendByCat.get(cat.id) || 0;
            const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
            const isOver = limit > 0 && spent > limit;

            return (
              <div
                key={cat.id}
                className="flex items-center justify-between gap-3 py-3 px-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm font-medium text-slate-800 truncate">
                    {cat.name}
                  </div>
                  <div className="text-xs text-slate-500 num-tabular">
                    ចំណាយ៖{' '}
                    <span className={isOver ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                      {formatMoney(spent, displayCurrency, exchangeRate)}
                    </span>
                  </div>
                  {limit > 0 && (
                    <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${isOver ? 'bg-red-600' : 'bg-teal-700'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="w-24 sm:w-28 shrink-0">
                  <label className="sr-only" htmlFor={`budget-${cat.id}`}>
                    ថវិកា {cat.name}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      $
                    </span>
                    <input
                      id={`budget-${cat.id}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="5"
                      value={limit || ''}
                      placeholder="0"
                      onChange={(e) => handleCategoryBudgetChange(cat.id, e.target.value)}
                      className="w-full min-h-[42px] pl-6 pr-2.5 py-1.5 text-sm num-tabular text-right text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Household Preferences & Local JSON Backup */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-900">
          ការកំណត់ទូទៅ និងឯកសារបម្រុងទុកក្នុងម៉ាស៊ីន
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="household-name" className="block text-xs font-medium text-slate-600">
              ឈ្មោះគ្រួសារ / គណនី
            </label>
            <input
              id="household-name"
              type="text"
              value={settings.householdName}
              onChange={(e) => onUpdateSettings({ householdName: e.target.value })}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="exchange-rate" className="block text-xs font-medium text-slate-600">
              អត្រាប្តូរប្រាក់ (រៀល ក្នុង 1 ដុល្លារ)
            </label>
            <input
              id="exchange-rate"
              type="number"
              inputMode="numeric"
              min="1000"
              step="50"
              value={settings.exchangeRate}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v) && v >= 1000) {
                  onUpdateSettings({ exchangeRate: v });
                }
              }}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm num-tabular text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onExportBackup}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            ទាញយក JSON
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            ផ្ទុក JSON ឡើងវិញ
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json,text/plain"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => {
              onResetSampleData();
              setStatusIsError(false);
              setStatusMessage('បានផ្ទុកទិន្នន័យគំរូឡើងវិញ។');
            }}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            ប្រើទិន្នន័យគំរូ
          </button>

          {confirmClear ? (
            <div className="inline-flex items-center gap-2 text-xs">
              <span className="text-red-700 font-medium">លុបទាំងអស់មែនទេ?</span>
              <button
                type="button"
                onClick={() => {
                  onClearAllTransactions();
                  setConfirmClear(false);
                  setStatusIsError(false);
                  setStatusMessage('បានសម្អាតកំណត់ត្រាទាំងអស់រួចរាល់។');
                }}
                className="min-h-[40px] px-3 py-1.5 font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                បញ្ជាក់
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="min-h-[40px] px-2.5 py-1.5 text-slate-600"
              >
                បោះបង់
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              សម្អាតចាប់ផ្តើមពីសូន្យ
            </button>
          )}
        </div>

        {statusMessage && (
          <p
            className={`text-xs rounded-xl px-3.5 py-2.5 border ${
              statusIsError
                ? 'text-red-700 bg-red-50 border-red-200'
                : 'text-teal-800 bg-teal-50 border-teal-200'
            }`}
          >
            {statusMessage}
          </p>
        )}
      </section>
    </div>
  );
}
