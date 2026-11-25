import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  Category,
  CycleRange,
  HouseholdSettings,
  PaymentMethod,
  Transaction,
} from '../types/finance';
import { getCycleRangeFromSettings, isDateInCycle } from '../utils/cycle';
import {
  formatMoney,
  formatPercent,
  PAYMENT_METHOD_LABELS,
} from '../utils/format';

interface AnalyticsViewProps {
  allTransactions: Transaction[];
  activeCycle: CycleRange;
  previousCycle: CycleRange;
  cycleOffset: number;
  categories: Category[];
  settings: HouseholdSettings;
}

export function AnalyticsView({
  allTransactions,
  activeCycle,
  previousCycle,
  cycleOffset,
  categories,
  settings,
}: AnalyticsViewProps) {
  const { displayCurrency, exchangeRate, cycleStartDay, cycleMode, monthlyBudgetTargetUsd } =
    settings;

  const activeTx = useMemo(
    () => allTransactions.filter((t) => isDateInCycle(t.date, activeCycle)),
    [allTransactions, activeCycle]
  );

  const prevTx = useMemo(
    () => allTransactions.filter((t) => isDateInCycle(t.date, previousCycle)),
    [allTransactions, previousCycle]
  );

  // 6-Period History Trend respecting either customStartDate..customEndDate or cycleStartDay
  const sixCycleData = useMemo(() => {
    const offsets = [-5, -4, -3, -2, -1, 0];
    return offsets.map((rel) => {
      const range = getCycleRangeFromSettings(settings, cycleOffset + rel);
      const txs = allTransactions.filter((t) => isDateInCycle(t.date, range));
      const income = txs
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amountUsd, 0);
      const expense = txs
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amountUsd, 0);
      const net = income - expense;
      return {
        label: range.shortLabel,
        rangeLabel: range.label,
        income: Number(income.toFixed(2)),
        expense: Number(expense.toFixed(2)),
        net: Number(net.toFixed(2)),
      };
    });
  }, [allTransactions, settings, cycleOffset]);

  const categoryStats = useMemo(() => {
    const curTotals = new Map<string, number>();
    const prevTotals = new Map<string, number>();

    let totalCurExpense = 0;
    for (const tx of activeTx) {
      if (tx.type === 'expense') {
        totalCurExpense += tx.amountUsd;
        curTotals.set(tx.categoryId, (curTotals.get(tx.categoryId) || 0) + tx.amountUsd);
      }
    }
    for (const tx of prevTx) {
      if (tx.type === 'expense') {
        prevTotals.set(tx.categoryId, (prevTotals.get(tx.categoryId) || 0) + tx.amountUsd);
      }
    }

    const rows = categories
      .filter((c) => c.type === 'expense')
      .map((c) => {
        const cur = curTotals.get(c.id) || 0;
        const prev = prevTotals.get(c.id) || 0;
        const diff = cur - prev;
        const diffPct = prev > 0 ? (diff / prev) * 100 : cur > 0 ? 100 : 0;
        const sharePct = totalCurExpense > 0 ? (cur / totalCurExpense) * 100 : 0;
        return { category: c, cur, prev, diff, diffPct, sharePct };
      })
      .filter((r) => r.cur > 0 || r.prev > 0)
      .sort((a, b) => b.cur - a.cur);

    return { rows, totalCurExpense };
  }, [activeTx, prevTx, categories]);

  const methodStats = useMemo(() => {
    const map = new Map<PaymentMethod, number>();
    let total = 0;
    for (const tx of activeTx) {
      if (tx.type === 'expense') {
        total += tx.amountUsd;
        map.set(tx.paymentMethod, (map.get(tx.paymentMethod) || 0) + tx.amountUsd);
      }
    }
    return (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[])
      .map((key) => ({
        key,
        label: PAYMENT_METHOD_LABELS[key],
        amount: map.get(key) || 0,
        pct: total > 0 ? ((map.get(key) || 0) / total) * 100 : 0,
      }))
      .filter((m) => m.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [activeTx]);

  const coupleStats = useMemo(() => {
    const buckets = {
      husband: {
        key: 'husband',
        label: settings.husbandName.trim() || 'ប្តី',
        income: 0,
        expense: 0,
      },
      wife: {
        key: 'wife',
        label: settings.wifeName.trim() || 'ប្រពន្ធ',
        income: 0,
        expense: 0,
      },
      joint: {
        key: 'joint',
        label: 'រួម (ប្តី+ប្រពន្ធ)',
        income: 0,
        expense: 0,
      },
    };

    let totalExpense = 0;
    for (const tx of activeTx) {
      const target =
        tx.member === 'husband'
          ? buckets.husband
          : tx.member === 'wife'
          ? buckets.wife
          : buckets.joint;
      if (tx.type === 'income') {
        target.income += tx.amountUsd;
      } else {
        target.expense += tx.amountUsd;
        totalExpense += tx.amountUsd;
      }
    }

    return [buckets.husband, buckets.wife, buckets.joint].map((item) => ({
      ...item,
      expensePct: totalExpense > 0 ? (item.expense / totalExpense) * 100 : 0,
    }));
  }, [activeTx, settings.husbandName, settings.wifeName]);

  const highlights = useMemo(() => {
    const curExpense = categoryStats.totalCurExpense;
    const elapsed = Math.max(1, activeCycle.daysElapsed);
    const projectedSpend = activeCycle.isCurrent
      ? (curExpense / elapsed) * activeCycle.totalDays
      : curExpense;

    const topCategory = categoryStats.rows[0] || null;
    const biggestIncrease =
      [...categoryStats.rows].sort((a, b) => b.diff - a.diff)[0] || null;

    const populatedCycles = sixCycleData.filter((d) => d.income > 0);
    const avgSavingsRate =
      populatedCycles.length > 0
        ? populatedCycles.reduce((acc, d) => acc + ((d.income - d.expense) / d.income) * 100, 0) /
          populatedCycles.length
        : 0;

    return {
      projectedSpend,
      topCategory,
      biggestIncrease: biggestIncrease && biggestIncrease.diff > 0 ? biggestIncrease : null,
      avgSavingsRate,
    };
  }, [categoryStats, activeCycle, sixCycleData]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 2-Col Mobile / 4-Col Desktop Analytical Insights Strip */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">ព្យាករណ៍ចុងវដ្ត</div>
          <div
            className={`text-lg sm:text-xl font-bold num-tabular truncate ${
              highlights.projectedSpend > monthlyBudgetTargetUsd
                ? 'text-red-600'
                : 'text-slate-900'
            }`}
          >
            {formatMoney(highlights.projectedSpend, displayCurrency, exchangeRate)}
          </div>
          <div className="text-[11px] sm:text-xs text-slate-500 truncate">
            {highlights.projectedSpend > monthlyBudgetTargetUsd
              ? `អាចលើស ${formatMoney(
                  highlights.projectedSpend - monthlyBudgetTargetUsd,
                  displayCurrency,
                  exchangeRate
                )}`
              : 'ក្នុងកម្រិតគោលដៅ'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">ចំណាយធំបំផុត</div>
          <div className="text-sm sm:text-lg font-bold text-slate-900 truncate">
            {highlights.topCategory ? highlights.topCategory.category.name : '—'}
          </div>
          <div className="text-[11px] sm:text-xs text-slate-500 num-tabular truncate">
            {highlights.topCategory
              ? `${formatMoney(highlights.topCategory.cur, displayCurrency, exchangeRate)} (${formatPercent(
                  highlights.topCategory.sharePct
                )})`
              : 'មិនទាន់មានទិន្នន័យ'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">កើនឡើងធៀបមុន</div>
          <div className="text-sm sm:text-lg font-bold text-slate-900 truncate">
            {highlights.biggestIncrease ? highlights.biggestIncrease.category.name : 'គ្មានកំណើន'}
          </div>
          <div className="text-[11px] sm:text-xs text-amber-700 num-tabular truncate">
            {highlights.biggestIncrease
              ? `+${formatMoney(highlights.biggestIncrease.diff, displayCurrency, exchangeRate)}`
              : 'ថយចុះ ឬស្មើវដ្តមុន'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">សន្សំមធ្យម (៦ វដ្ត)</div>
          <div className="text-lg sm:text-xl font-bold text-green-700 num-tabular">
            {formatPercent(Math.max(0, highlights.avgSavingsRate))}
          </div>
          <div className="text-[11px] sm:text-xs text-slate-500 truncate">
            {cycleMode === 'custom_range'
              ? `រយៈពេល ${activeCycle.totalDays} ថ្ងៃ`
              : `ថ្ងៃចាប់ផ្តើមទី ${cycleStartDay}`}
          </div>
        </div>
      </section>

      {/* 6-Period Income vs Expense Chart */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">
              ប្រៀបធៀបចំណូល និងចំណាយ ៦ រយៈពេលចុងក្រោយ
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{activeCycle.label}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-700 inline-block" />
              ចំណូល
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 inline-block" />
              ចំណាយ
            </span>
          </div>
        </div>

        <div className="h-60 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sixCycleData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              barGap={4}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#475569' }}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
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
                cursor={{ fill: '#F8FAFC' }}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderRadius: '10px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                }}
                formatter={(value: unknown, name?: string | number) => {
                  const num = typeof value === 'number' ? value : 0;
                  return [
                    formatMoney(num, displayCurrency, exchangeRate),
                    name === 'income' ? 'ចំណូល' : 'ចំណាយ',
                  ];
                }}
              />
              <Bar dataKey="income" fill="#0F766E" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expense" fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Category Distribution + Comparison */}
      <section className="grid grid-cols-1 xl:grid-cols-5 gap-5 sm:gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900">
            សមាមាត្រចំណាយតាមប្រភេទ
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">{activeCycle.label}</p>

          {categoryStats.rows.filter((r) => r.cur > 0).length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-sm text-slate-500">
              មិនទាន់មានចំណាយក្នុងរយៈពេលនេះទេ
            </div>
          ) : (
            <div className="h-56 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStats.rows.filter((r) => r.cur > 0)}
                    dataKey="cur"
                    nameKey="category.name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={86}
                    paddingAngle={2}
                  >
                    {categoryStats.rows
                      .filter((r) => r.cur > 0)
                      .map((entry) => (
                        <Cell key={entry.category.id} fill={entry.category.color} />
                      ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '10px',
                      fontSize: '12px',
                    }}
                    formatter={(value: unknown) => [
                      formatMoney(
                        typeof value === 'number' ? value : 0,
                        displayCurrency,
                        exchangeRate
                      ),
                      'ចំណាយ',
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="xl:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900">
            ប្រៀបធៀបចំណាយតាមប្រភេទ
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            {activeCycle.shortLabel} ធៀបនឹង {previousCycle.shortLabel}
          </p>

          {categoryStats.rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              មិនទាន់មានទិន្នន័យសម្រាប់ប្រៀបធៀបទេ
            </div>
          ) : (
            <>
              {/* Mobile Clean Rows */}
              <div className="md:hidden divide-y divide-slate-100">
                {categoryStats.rows.map((row) => (
                  <div
                    key={row.category.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: row.category.color }}
                        />
                        <span className="truncate">{row.category.name}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 num-tabular">
                        {formatPercent(row.sharePct)} · មុន៖{' '}
                        {formatMoney(row.prev, displayCurrency, exchangeRate)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-slate-900 num-tabular">
                        {formatMoney(row.cur, displayCurrency, exchangeRate)}
                      </div>
                      <div
                        className={`text-xs num-tabular font-medium ${
                          row.diff > 0
                            ? 'text-red-600'
                            : row.diff < 0
                            ? 'text-green-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.diff === 0
                          ? '0%'
                          : `${row.diff > 0 ? '+' : ''}${formatMoney(
                              row.diff,
                              displayCurrency,
                              exchangeRate
                            )}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto -mx-5 px-5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-2.5 pr-3">ប្រភេទក្រុម</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">រយៈពេលនេះ</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">ភាគរយ</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">រយៈពេលមុន</th>
                      <th className="py-2.5 pl-3 text-right whitespace-nowrap">បម្រែបម្រួល</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {categoryStats.rows.map((row) => (
                      <tr key={row.category.id}>
                        <td className="py-2.5 pr-3 font-medium text-slate-800 whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: row.category.color }}
                            />
                            {row.category.name}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900 num-tabular whitespace-nowrap">
                          {formatMoney(row.cur, displayCurrency, exchangeRate)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs text-slate-500 num-tabular whitespace-nowrap">
                          {formatPercent(row.sharePct)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500 num-tabular whitespace-nowrap">
                          {formatMoney(row.prev, displayCurrency, exchangeRate)}
                        </td>
                        <td
                          className={`py-2.5 pl-3 text-right text-xs font-medium num-tabular whitespace-nowrap ${
                            row.diff > 0
                              ? 'text-red-600'
                              : row.diff < 0
                              ? 'text-green-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {row.diff === 0
                            ? '0%'
                            : `${row.diff > 0 ? '+' : ''}${formatMoney(
                                row.diff,
                                displayCurrency,
                                exchangeRate
                              )}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Payment Method & Household Member Breakdown */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900">
            ចំណាយតាមវិធីទូទាត់
          </h3>
          {methodStats.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">មិនទាន់មានទិន្នន័យ</p>
          ) : (
            <div className="space-y-3">
              {methodStats.map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 font-medium">{item.label}</span>
                    <span className="num-tabular text-slate-900 font-semibold">
                      {formatMoney(item.amount, displayCurrency, exchangeRate)}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        ({formatPercent(item.pct)})
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-700 rounded-full"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900">
            ប្រៀបធៀប ប្តី និង ប្រពន្ធ (ចំណូល និង ចំណាយ)
          </h3>
          <div className="space-y-4">
            {coupleStats.map((item) => (
              <div key={item.key} className="space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="text-slate-800 font-semibold">{item.label}</span>
                  <div className="flex items-center gap-3 text-xs num-tabular">
                    <span className="text-green-700 font-medium">
                      ចូល {formatMoney(item.income, displayCurrency, exchangeRate)}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="text-slate-900 font-semibold">
                      ចេញ {formatMoney(item.expense, displayCurrency, exchangeRate)} (
                      {formatPercent(item.expensePct)})
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.key === 'husband'
                        ? 'bg-teal-700'
                        : item.key === 'wife'
                        ? 'bg-sky-700'
                        : 'bg-slate-600'
                    }`}
                    style={{ width: `${item.expensePct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
