import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Calendar,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  ActiveUser,
  BillNotification,
  Category,
  CycleRange,
  HouseholdSettings,
  RecurringBill,
  Transaction,
  UserViewFilter,
  ViewTab,
} from '../types/finance';
import {
  daysBetweenIso,
  formatKhmerShortDate,
  getBillDueDateInCycle,
  getTodayIso,
  parseIsoDate,
} from '../utils/cycle';
import {
  formatDualHint,
  formatMoney,
  formatPercent,
  getMemberLabel,
  PAYMENT_METHOD_LABELS,
} from '../utils/format';
import { BillsCalendarCard } from './BillsCalendarCard';

interface OverviewViewProps {
  activeCycle: CycleRange;
  previousCycle: CycleRange;
  cycleTransactions: Transaction[];
  previousCycleTransactions: Transaction[];
  allCycleTransactionsUnfiltered: Transaction[];
  categories: Category[];
  bills: RecurringBill[];
  billNotifications: BillNotification[];
  showReminderBanner: boolean;
  settings: HouseholdSettings;
  userViewFilter: UserViewFilter;
  onUserViewFilterChange: (filter: UserViewFilter) => void;
  onActiveUserChange: (user: ActiveUser) => void;
  onShiftCycle: (delta: number) => void;
  onResetCurrentCycle: () => void;
  onOpenPeriodModal: () => void;
  onOpenNotifications: () => void;
  onSnoozeReminderBanner: () => void;
  onOpenNewTx: () => void;
  onEditTx: (tx: Transaction) => void;
  onPayBill: (bill: RecurringBill) => void;
  onPayBillInCurrentCycle: (bill: RecurringBill) => void;
  onNavigateTab: (tab: ViewTab) => void;
}

export function OverviewView({
  activeCycle,
  previousCycle,
  cycleTransactions,
  previousCycleTransactions,
  allCycleTransactionsUnfiltered,
  categories,
  bills,
  billNotifications,
  showReminderBanner,
  settings,
  userViewFilter,
  onUserViewFilterChange,
  onActiveUserChange,
  onShiftCycle,
  onResetCurrentCycle,
  onOpenPeriodModal,
  onOpenNotifications,
  onSnoozeReminderBanner,
  onOpenNewTx,
  onEditTx,
  onPayBill,
  onPayBillInCurrentCycle,
  onNavigateTab,
}: OverviewViewProps) {
  const { displayCurrency, exchangeRate, categoryBudgets, monthlyBudgetTargetUsd } = settings;
  const husbandLabel = settings.husbandName.trim() || 'ប្តី';
  const wifeLabel = settings.wifeName.trim() || 'ប្រពន្ធ';
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Husband vs Wife comparison across the full active period
  const coupleSummary = useMemo(() => {
    let husbandIncome = 0;
    let husbandExpense = 0;
    let wifeIncome = 0;
    let wifeExpense = 0;
    let jointExpense = 0;
    let jointIncome = 0;

    for (const tx of allCycleTransactionsUnfiltered) {
      if (tx.member === 'husband') {
        if (tx.type === 'income') husbandIncome += tx.amountUsd;
        else husbandExpense += tx.amountUsd;
      } else if (tx.member === 'wife') {
        if (tx.type === 'income') wifeIncome += tx.amountUsd;
        else wifeExpense += tx.amountUsd;
      } else {
        if (tx.type === 'income') jointIncome += tx.amountUsd;
        else jointExpense += tx.amountUsd;
      }
    }

    return {
      husbandIncome,
      husbandExpense,
      wifeIncome,
      wifeExpense,
      jointIncome,
      jointExpense,
    };
  }, [allCycleTransactionsUnfiltered]);

  const metrics = useMemo(() => {
    const income = cycleTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amountUsd, 0);
    const expense = cycleTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amountUsd, 0);
    const net = income - expense;

    const prevIncome = previousCycleTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amountUsd, 0);
    const prevExpense = previousCycleTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amountUsd, 0);

    const savingsRate = income > 0 ? (net / income) * 100 : 0;
    const elapsed = Math.max(1, activeCycle.daysElapsed);
    const dailyAvgExpense = activeCycle.isFuture ? 0 : expense / elapsed;
    const budgetUsedPct =
      monthlyBudgetTargetUsd > 0 ? (expense / monthlyBudgetTargetUsd) * 100 : 0;

    const incomeDeltaPct =
      prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : null;
    const expenseDeltaPct =
      prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : null;

    return {
      income,
      expense,
      net,
      prevIncome,
      prevExpense,
      savingsRate,
      dailyAvgExpense,
      budgetUsedPct,
      incomeDeltaPct,
      expenseDeltaPct,
    };
  }, [
    cycleTransactions,
    previousCycleTransactions,
    activeCycle.daysElapsed,
    activeCycle.isFuture,
    monthlyBudgetTargetUsd,
  ]);

  const paceChartData = useMemo(() => {
    const expenseByDate = new Map<string, number>();
    for (const tx of cycleTransactions) {
      if (tx.type === 'expense') {
        expenseByDate.set(tx.date, (expenseByDate.get(tx.date) || 0) + tx.amountUsd);
      }
    }

    const todayIso = getTodayIso();
    let runningSpend = 0;
    const totalDays = activeCycle.dates.length;

    return activeCycle.dates.map((iso, idx) => {
      const daySpend = expenseByDate.get(iso) || 0;
      const isFutureDay = iso > todayIso;
      if (!isFutureDay) {
        runningSpend += daySpend;
      }
      const idealPace =
        monthlyBudgetTargetUsd > 0
          ? (monthlyBudgetTargetUsd * (idx + 1)) / totalDays
          : 0;
      const d = parseIsoDate(iso);

      return {
        date: iso,
        dayLabel: `${d.getDate()}/${d.getMonth() + 1}`,
        actual: isFutureDay ? null : Number(runningSpend.toFixed(2)),
        ideal: Number(idealPace.toFixed(2)),
        daySpend: Number(daySpend.toFixed(2)),
      };
    });
  }, [cycleTransactions, activeCycle.dates, monthlyBudgetTargetUsd]);

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const tx of cycleTransactions) {
      if (tx.type === 'expense') {
        totals.set(tx.categoryId, (totals.get(tx.categoryId) || 0) + tx.amountUsd);
      }
    }
    return categories
      .filter((c) => c.type === 'expense')
      .map((c) => {
        const spent = totals.get(c.id) || 0;
        const limit = categoryBudgets[c.id] || 0;
        const pct = limit > 0 ? (spent / limit) * 100 : 0;
        return { category: c, spent, limit, pct };
      })
      .filter((item) => item.spent > 0 || item.limit > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 6);
  }, [cycleTransactions, categories, categoryBudgets]);

  const cycleBills = useMemo(() => {
    const todayIso = getTodayIso();
    return bills
      .map((bill) => {
        const dueDate = getBillDueDateInCycle(bill.dueDay, activeCycle);
        const isPaid = Boolean(bill.paidCycles[activeCycle.key]);
        const daysUntil = daysBetweenIso(todayIso, dueDate);
        return { bill, dueDate, isPaid, daysUntil };
      })
      .sort((a, b) => {
        if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [bills, activeCycle]);

  const recentTransactions = useMemo(
    () =>
      [...cycleTransactions]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6),
    [cycleTransactions]
  );

  const cycleProgressPct = Math.min(
    100,
    Math.round((activeCycle.daysElapsed / Math.max(1, activeCycle.totalDays)) * 100)
  );

  const urgentReminder = billNotifications[0] || null;
  const hasOverdueReminder = billNotifications.some((n) => n.severity === 'overdue');

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Contextual Recurring Bill Reminder Banner */}
      {showReminderBanner && urgentReminder && (
        <section
          role="region"
          aria-label="ការរំលឹកបង់វិក្កយបត្រ"
          className={`rounded-2xl border p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            hasOverdueReminder
              ? 'bg-red-50/70 border-red-200'
              : 'bg-amber-50/70 border-amber-200'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <Bell
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                hasOverdueReminder ? 'text-red-600' : 'text-amber-700'
              }`}
            />
            <div className="min-w-0 space-y-0.5">
              <div className="text-sm font-semibold text-slate-900">
                {billNotifications.length === 1
                  ? `រំលឹកបង់វិក្កយបត្រ៖ ${urgentReminder.bill.title}`
                  : `មានវិក្កយបត្រ ${billNotifications.length} មុខជិតដល់ ឬហួសថ្ងៃកំណត់`}
              </div>
              <div className="text-xs text-slate-700 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span
                  className={`font-semibold ${
                    urgentReminder.severity === 'overdue'
                      ? 'text-red-700'
                      : 'text-amber-800'
                  }`}
                >
                  {urgentReminder.severity === 'overdue'
                    ? `ហួស ${Math.abs(urgentReminder.daysUntil)} ថ្ងៃ`
                    : urgentReminder.severity === 'today'
                    ? 'ដល់ថ្ងៃកំណត់ថ្ងៃនេះ'
                    : `នៅសល់ ${urgentReminder.daysUntil} ថ្ងៃ`}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">
                  {urgentReminder.bill.title} (
                  <strong className="num-tabular">
                    {formatMoney(
                      urgentReminder.bill.amountUsd,
                      displayCurrency,
                      exchangeRate
                    )}
                  </strong>
                  )
                </span>
                {billNotifications.length > 1 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>និង {billNotifications.length - 1} មុខទៀត</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 pl-8 sm:pl-0">
            <button
              type="button"
              onClick={() => onPayBillInCurrentCycle(urgentReminder.bill)}
              className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors whitespace-nowrap"
            >
              បង់រួច
            </button>
            <button
              type="button"
              onClick={onOpenNotifications}
              className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap"
            >
              មើលទាំងអស់
            </button>
            <button
              type="button"
              onClick={onSnoozeReminderBanner}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-xl"
              aria-label="បិទការរំលឹកសម្រាប់ថ្ងៃនេះ"
              title="បិទសម្រាប់ថ្ងៃនេះ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* Period Selector & Custom 1-Month Control Strip */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3.5">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span>
                {settings.cycleMode === 'custom_range'
                  ? 'រយៈពេលកំណត់ដោយខ្លួនឯង'
                  : `វដ្តប្រចាំខែ · ចាប់ពីថ្ងៃទី ${settings.cycleStartDay}`}
              </span>
              <span aria-hidden="true">·</span>
              <span className="num-tabular">{activeCycle.totalDays} ថ្ងៃ</span>
            </div>
            <h2 className="text-base sm:text-xl font-bold text-slate-900">
              {activeCycle.label}
            </h2>
            <p className="text-xs text-slate-500 num-tabular">
              {activeCycle.isCurrent
                ? `ថ្ងៃទី ${activeCycle.daysElapsed}/${activeCycle.totalDays} · នៅសល់ ${activeCycle.daysRemaining} ថ្ងៃ`
                : activeCycle.isFuture
                ? 'រយៈពេលខាងមុខ'
                : 'បានបញ្ចប់រយៈពេល'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenPeriodModal}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors whitespace-nowrap"
            >
              <CalendarRange className="w-4 h-4 shrink-0" />
              <span>កំណត់រយៈពេល</span>
            </button>

            <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => onShiftCycle(-1)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                aria-label="រយៈពេលមុន"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onResetCurrentCycle}
                className="min-h-[40px] px-2.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition-colors whitespace-nowrap"
              >
                បច្ចុប្បន្ន
              </button>
              <button
                type="button"
                onClick={() => onShiftCycle(1)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                aria-label="រយៈពេលបន្ទាប់"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-700 rounded-full transition-all duration-300"
            style={{ width: `${cycleProgressPct}%` }}
          />
        </div>

        {/* 2-User Filter & Mobile Active User Switcher */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl flex-1 sm:flex-none">
              {(
                [
                  { id: 'all' as const, label: 'ទាំងពីរនាក់' },
                  { id: 'husband' as const, label: husbandLabel },
                  { id: 'wife' as const, label: wifeLabel },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onUserViewFilterChange(tab.id)}
                  className={`min-h-[36px] flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    userViewFilter === tab.id
                      ? 'bg-white text-teal-800 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex lg:hidden items-center justify-between sm:justify-end gap-2 text-xs">
            <span className="text-slate-500">កំពុងកត់ត្រាជា៖</span>
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => onActiveUserChange('husband')}
                className={`min-h-[34px] px-2.5 text-xs font-semibold rounded-md transition-colors ${
                  settings.activeUser === 'husband'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                {husbandLabel}
              </button>
              <button
                type="button"
                onClick={() => onActiveUserChange('wife')}
                className={`min-h-[34px] px-2.5 text-xs font-semibold rounded-md transition-colors ${
                  settings.activeUser === 'wife'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                {wifeLabel}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Husband vs Wife Side-by-Side Summary (shown in combined household view) */}
      {userViewFilter === 'all' && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => onUserViewFilterChange('husband')}
            className="bg-white border border-slate-200 hover:border-teal-300 rounded-2xl p-4 text-left transition-colors space-y-2"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">{husbandLabel}</span>
              <span className="text-slate-400">ចុចដើម្បីមើលលម្អិត</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-slate-500">ចំណូល</div>
                <div className="text-sm font-bold text-green-700 num-tabular mt-0.5">
                  {formatMoney(coupleSummary.husbandIncome, displayCurrency, exchangeRate)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">ចំណាយ</div>
                <div className="text-sm font-bold text-slate-900 num-tabular mt-0.5">
                  {formatMoney(coupleSummary.husbandExpense, displayCurrency, exchangeRate)}
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onUserViewFilterChange('wife')}
            className="bg-white border border-slate-200 hover:border-teal-300 rounded-2xl p-4 text-left transition-colors space-y-2"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">{wifeLabel}</span>
              <span className="text-slate-400">ចុចដើម្បីមើលលម្អិត</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-slate-500">ចំណូល</div>
                <div className="text-sm font-bold text-green-700 num-tabular mt-0.5">
                  {formatMoney(coupleSummary.wifeIncome, displayCurrency, exchangeRate)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">ចំណាយ</div>
                <div className="text-sm font-bold text-slate-900 num-tabular mt-0.5">
                  {formatMoney(coupleSummary.wifeExpense, displayCurrency, exchangeRate)}
                </div>
              </div>
            </div>
          </button>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">ចំណូល-ចំណាយរួម ({husbandLabel}+{wifeLabel})</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-slate-500">ចំណូលរួម</div>
                <div className="text-sm font-bold text-green-700 num-tabular mt-0.5">
                  {formatMoney(coupleSummary.jointIncome, displayCurrency, exchangeRate)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">ចំណាយរួម</div>
                <div className="text-sm font-bold text-slate-900 num-tabular mt-0.5">
                  {formatMoney(coupleSummary.jointExpense, displayCurrency, exchangeRate)}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2-Column Mobile / 4-Column Desktop KPI Strip */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Income */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">ចំណូលសរុប</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-900 num-tabular truncate">
            {formatMoney(metrics.income, displayCurrency, exchangeRate)}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-[11px] sm:text-xs text-slate-500">
            <span className="num-tabular truncate">
              {formatDualHint(metrics.income, displayCurrency, exchangeRate)}
            </span>
            {metrics.incomeDeltaPct !== null && (
              <span
                className={`inline-flex items-center gap-0.5 font-medium num-tabular ${
                  metrics.incomeDeltaPct >= 0 ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {metrics.incomeDeltaPct >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(Math.round(metrics.incomeDeltaPct))}%
              </span>
            )}
          </div>
        </div>

        {/* Expense */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between gap-1 text-xs">
            <span className="font-medium text-slate-500 truncate">ចំណាយសរុប</span>
            <span
              className={`font-medium num-tabular shrink-0 ${
                metrics.budgetUsedPct > 100
                  ? 'text-red-600'
                  : metrics.budgetUsedPct >= 80
                  ? 'text-amber-700'
                  : 'text-slate-600'
              }`}
            >
              {formatPercent(metrics.budgetUsedPct)}
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-slate-900 num-tabular truncate">
            {formatMoney(metrics.expense, displayCurrency, exchangeRate)}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-[11px] sm:text-xs text-slate-500">
            <span className="num-tabular truncate">
              {formatDualHint(metrics.expense, displayCurrency, exchangeRate)}
            </span>
            {metrics.expenseDeltaPct !== null && (
              <span
                className={`inline-flex items-center gap-0.5 font-medium num-tabular ${
                  metrics.expenseDeltaPct <= 0 ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {metrics.expenseDeltaPct >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(Math.round(metrics.expenseDeltaPct))}%
              </span>
            )}
          </div>
        </div>

        {/* Net Balance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between gap-1 text-xs">
            <span className="font-medium text-slate-500 truncate">សមតុល្យសល់</span>
            <span
              className={`font-medium shrink-0 ${
                metrics.net >= 0 ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {metrics.net >= 0 ? 'ល្អ' : 'ខ្វះ'}
            </span>
          </div>
          <div
            className={`text-lg sm:text-2xl font-bold num-tabular truncate ${
              metrics.net >= 0 ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {formatMoney(metrics.net, displayCurrency, exchangeRate, { showSign: true })}
          </div>
          <div className="text-[11px] sm:text-xs text-slate-500 num-tabular truncate">
            សន្សំបាន{' '}
            <strong className="font-semibold text-slate-700">
              {formatPercent(Math.max(0, metrics.savingsRate))}
            </strong>
          </div>
        </div>

        {/* Daily Average */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500 truncate">មធ្យមប្រចាំថ្ងៃ</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-900 num-tabular truncate">
            {formatMoney(metrics.dailyAvgExpense, displayCurrency, exchangeRate)}
          </div>
          <div className="text-[11px] sm:text-xs text-slate-500 num-tabular truncate">
            គោលដៅ៖ {formatMoney(monthlyBudgetTargetUsd, displayCurrency, exchangeRate)}
          </div>
        </div>
      </section>

      {/* Chart + Scheduled Bills */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">
        {/* Daily Spend Pace Chart */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                ល្បឿនចំណាយសរុបធៀបនឹងថវិកា
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                តាមដានចំណាយប្រចាំថ្ងៃក្នុងរយៈពេល {activeCycle.shortLabel}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-teal-700 inline-block" />
                ជាក់ស្តែង
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-slate-400 inline-block" />
                គោលដៅ
              </span>
            </div>
          </div>

          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={paceChartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F766E" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#0F766E" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="dayLabel"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  tickFormatter={(v) =>
                    formatMoney(Number(v), displayCurrency, exchangeRate, { compact: true })
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '10px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                  }}
                  formatter={(value: unknown, name?: string | number) => {
                    const num = typeof value === 'number' ? value : 0;
                    const label =
                      name === 'actual' ? 'ចំណាយសរុបជាក់ស្តែង' : 'កម្រិតថវិកាគោលដៅ';
                    return [formatMoney(num, displayCurrency, exchangeRate), label];
                  }}
                  labelFormatter={(label) => `ថ្ងៃទី ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="ideal"
                  stroke="#94A3B8"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#0F766E"
                  strokeWidth={2.2}
                  fill="url(#spendFill)"
                  connectNulls={false}
                  activeDot={{ r: 4, fill: '#0F766E' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scheduled Bills */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                ថ្ងៃកំណត់បង់ប្រាក់
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ចុច «បង់រួច» ដើម្បីកត់ត្រាស្វ័យប្រវត្តិ
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              className="min-h-[40px] px-2 text-xs font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap"
            >
              គ្រប់គ្រង
            </button>
          </div>

          {cycleBills.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 space-y-2">
              <Calendar className="w-7 h-7 text-slate-300" />
              <p className="text-sm text-slate-500">មិនទាន់មានកាលវិភាគបង់ប្រាក់ទេ</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {cycleBills.map(({ bill, dueDate, isPaid, daysUntil }) => {
                const isOverdue = !isPaid && daysUntil < 0;
                const isDueSoon = !isPaid && daysUntil >= 0 && daysUntil <= 5;
                return (
                  <div
                    key={bill.id}
                    className="py-3 flex items-center justify-between gap-3 min-h-[56px]"
                  >
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-medium truncate ${
                          isPaid ? 'text-slate-400 line-through' : 'text-slate-900'
                        }`}
                      >
                        {bill.title}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <span className="num-tabular">{formatKhmerShortDate(dueDate)}</span>
                        <span aria-hidden="true">·</span>
                        {isPaid ? (
                          <span className="text-green-700 font-medium">បានបង់រួច</span>
                        ) : isOverdue ? (
                          <span className="text-red-600 font-medium">
                            ហួស {Math.abs(daysUntil)} ថ្ងៃ
                          </span>
                        ) : isDueSoon ? (
                          <span className="text-amber-700 font-medium">
                            {daysUntil === 0 ? 'ដល់ថ្ងៃនេះ' : `នៅសល់ ${daysUntil} ថ្ងៃ`}
                          </span>
                        ) : (
                          <span>នៅសល់ {daysUntil} ថ្ងៃ</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold num-tabular text-slate-900">
                        {formatMoney(bill.amountUsd, displayCurrency, exchangeRate)}
                      </span>
                      {isPaid ? (
                        <span
                          className="inline-flex items-center justify-center w-9 h-9 text-green-700"
                          title="បានបង់រួច"
                        >
                          <Check className="w-4 h-4" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onPayBill(bill)}
                          className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap"
                        >
                          បង់រួច
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Recurring Bills Calendar View (Remaining Due Dates in Active Period) */}
      <BillsCalendarCard
        activeCycle={activeCycle}
        bills={bills}
        settings={settings}
        onPayBill={onPayBill}
        onManageBills={() => onNavigateTab('settings')}
      />

      {/* Bottom Row: Category Progress + Recent Transactions */}
      <section className="grid grid-cols-1 xl:grid-cols-5 gap-5 sm:gap-6">
        {/* Category Budgets */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                ចំណាយតាមប្រភេទ
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">ធៀបនឹងកម្រិតថវិកា</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('analytics')}
              className="min-h-[40px] px-2 text-xs font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap"
            >
              វិភាគលម្អិត
            </button>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              មិនទាន់មានទិន្នន័យចំណាយក្នុងរយៈពេលនេះទេ
            </div>
          ) : (
            <div className="space-y-4">
              {categoryBreakdown.map(({ category, spent, limit, pct }) => {
                const isOver = limit > 0 && spent > limit;
                const isNear = limit > 0 && pct >= 80 && !isOver;
                const barWidth =
                  limit > 0
                    ? Math.min(100, pct)
                    : metrics.expense > 0
                    ? (spent / metrics.expense) * 100
                    : 0;
                const barColor = isOver
                  ? 'bg-red-600'
                  : isNear
                  ? 'bg-amber-600'
                  : 'bg-teal-700';

                return (
                  <div key={category.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium text-slate-800 truncate">
                        {category.name}
                      </span>
                      <span className="num-tabular text-xs text-slate-600 shrink-0">
                        <strong className="font-semibold text-slate-900">
                          {formatMoney(spent, displayCurrency, exchangeRate)}
                        </strong>
                        {limit > 0 && (
                          <span className="text-slate-400">
                            {' '}
                            / {formatMoney(limit, displayCurrency, exchangeRate)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="text-xs">
                      <span
                        className={
                          isOver
                            ? 'text-red-600 font-medium'
                            : isNear
                            ? 'text-amber-700 font-medium'
                            : 'text-slate-500'
                        }
                      >
                        {limit > 0
                          ? isOver
                            ? `លើសថវិកា ${formatMoney(spent - limit, displayCurrency, exchangeRate)}`
                            : isNear
                            ? `ជិតពេញកម្រិត (${formatPercent(pct)})`
                            : `ក្នុងកម្រិត (${formatPercent(pct)})`
                          : `${formatPercent(metrics.expense > 0 ? (spent / metrics.expense) * 100 : 0)} នៃចំណាយសរុប`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Transactions — Mobile List + Desktop Table */}
        <div className="xl:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                ប្រតិបត្តិការថ្មីៗ
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                សរុប {cycleTransactions.length} កំណត់ត្រា · ធៀបនឹង {previousCycle.shortLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('ledger')}
              className="min-h-[40px] px-2 text-xs font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap"
            >
              មើលទាំងអស់
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-3">
              <p className="text-sm text-slate-500">
                មិនទាន់មានកំណត់ត្រាក្នុងរយៈពេល {activeCycle.label} ទេ។
              </p>
              <button
                type="button"
                onClick={onOpenNewTx}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-xl hover:bg-teal-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                កត់ត្រាដំបូង
              </button>
            </div>
          ) : (
            <>
              {/* Mobile tappable rows */}
              <div className="md:hidden divide-y divide-slate-100 -mx-1">
                {recentTransactions.map((tx) => {
                  const cat = catMap.get(tx.categoryId);
                  return (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => onEditTx(tx)}
                      className="w-full py-3 px-1 flex items-center justify-between gap-3 text-left min-h-[60px] active:bg-slate-50 rounded-lg transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {tx.note}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {cat?.name || tx.categoryId} · {getMemberLabel(tx.member, settings)} ·{' '}
                          {formatKhmerShortDate(tx.date)}
                        </div>
                      </div>
                      <div
                        className={`text-sm font-semibold num-tabular shrink-0 ${
                          tx.type === 'income' ? 'text-green-700' : 'text-slate-900'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatMoney(tx.amountUsd, displayCurrency, exchangeRate)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto -mx-5 px-5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-2.5 pr-3">បរិយាយ និងប្រភេទ</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">កាលបរិច្ឆេទ</th>
                      <th className="py-2.5 pl-3 text-right whitespace-nowrap">ទឹកប្រាក់</th>
                      <th className="py-2.5 pl-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {recentTransactions.map((tx) => {
                      const cat = catMap.get(tx.categoryId);
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 pr-3 min-w-[200px]">
                            <div className="font-medium text-slate-900 truncate max-w-[280px]">
                              {tx.note}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span>{cat?.name || tx.categoryId}</span>
                              <span aria-hidden="true">·</span>
                              <span>{PAYMENT_METHOD_LABELS[tx.paymentMethod]}</span>
                              <span aria-hidden="true">·</span>
                              <span>{getMemberLabel(tx.member, settings)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-600 num-tabular whitespace-nowrap">
                            {formatKhmerShortDate(tx.date)}
                          </td>
                          <td
                            className={`py-3 pl-3 text-right font-semibold num-tabular whitespace-nowrap ${
                              tx.type === 'income' ? 'text-green-700' : 'text-slate-900'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            {formatMoney(tx.amountUsd, displayCurrency, exchangeRate)}
                          </td>
                          <td className="py-3 pl-2 text-right">
                            <button
                              type="button"
                              onClick={() => onEditTx(tx)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                              aria-label="កែប្រែ"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
