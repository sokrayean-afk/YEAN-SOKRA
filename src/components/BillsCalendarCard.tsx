import { Calendar, Check, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  CycleRange,
  HouseholdSettings,
  RecurringBill,
} from '../types/finance';
import {
  daysBetweenIso,
  formatKhmerShortDate,
  getBillDueDateInCycle,
  getTodayIso,
  KHMER_DAYS_SHORT,
  KHMER_MONTHS,
  parseIsoDate,
} from '../utils/cycle';
import { formatMoney, PAYMENT_METHOD_LABELS } from '../utils/format';

interface BillsCalendarCardProps {
  activeCycle: CycleRange;
  bills: RecurringBill[];
  settings: HouseholdSettings;
  onPayBill: (bill: RecurringBill) => void;
  onManageBills: () => void;
}

interface BillOccurrence {
  bill: RecurringBill;
  dueDate: string;
  isPaid: boolean;
  daysUntil: number;
  status: 'paid' | 'overdue' | 'today' | 'upcoming';
}

export function BillsCalendarCard({
  activeCycle,
  bills,
  settings,
  onPayBill,
  onManageBills,
}: BillsCalendarCardProps) {
  const { displayCurrency, exchangeRate } = settings;
  const todayIso = getTodayIso();

  const [filterMode, setFilterMode] = useState<'remaining' | 'all'>('remaining');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Map every recurring bill to its exact date inside the active cycle
  const occurrences = useMemo<BillOccurrence[]>(() => {
    return bills
      .map((bill) => {
        const dueDate = getBillDueDateInCycle(bill.dueDay, activeCycle);
        const isPaid = Boolean(bill.paidCycles[activeCycle.key]);
        const daysUntil = daysBetweenIso(todayIso, dueDate);
        const status: BillOccurrence['status'] = isPaid
          ? 'paid'
          : daysUntil < 0
          ? 'overdue'
          : daysUntil === 0
          ? 'today'
          : 'upcoming';
        return { bill, dueDate, isPaid, daysUntil, status };
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [bills, activeCycle, todayIso]);

  const visibleOccurrences = useMemo(
    () =>
      filterMode === 'remaining'
        ? occurrences.filter((o) => !o.isPaid)
        : occurrences,
    [occurrences, filterMode]
  );

  const byDateMap = useMemo(() => {
    const map = new Map<string, BillOccurrence[]>();
    for (const occ of visibleOccurrences) {
      const list = map.get(occ.dueDate) || [];
      list.push(occ);
      map.set(occ.dueDate, list);
    }
    return map;
  }, [visibleOccurrences]);

  const summary = useMemo(() => {
    const unpaid = occurrences.filter((o) => !o.isPaid);
    const paid = occurrences.filter((o) => o.isPaid);
    const remainingTotalUsd = unpaid.reduce((s, o) => s + o.bill.amountUsd, 0);
    return {
      unpaidCount: unpaid.length,
      paidCount: paid.length,
      totalCount: occurrences.length,
      remainingTotalUsd,
    };
  }, [occurrences]);

  // Reset selected date when cycle changes
  useEffect(() => {
    setSelectedDate(null);
  }, [activeCycle.key]);

  // Build weekday-aligned calendar cells for activeCycle.dates
  const leadingBlankCount = useMemo(() => {
    if (activeCycle.dates.length === 0) return 0;
    return parseIsoDate(activeCycle.dates[0]).getDay(); // 0 (Sun) .. 6 (Sat)
  }, [activeCycle.dates]);

  const detailItems = useMemo(() => {
    if (selectedDate) {
      return byDateMap.get(selectedDate) || [];
    }
    return visibleOccurrences;
  }, [selectedDate, byDateMap, visibleOccurrences]);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-700 shrink-0" />
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">
              ប្រតិទិនកាលវិភាគវិក្កយបត្រប្រចាំខែ
            </h3>
          </div>
          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{activeCycle.label}</span>
            <span aria-hidden="true">·</span>
            <span>
              នៅសល់{' '}
              <strong className="num-tabular text-slate-800">
                {summary.unpaidCount}
              </strong>{' '}
              វិក្កយបត្រ (
              <strong className="num-tabular text-amber-800">
                {formatMoney(summary.remainingTotalUsd, displayCurrency, exchangeRate)}
              </strong>
              )
            </span>
            <span aria-hidden="true">·</span>
            <span className="num-tabular">
              បានបង់ {summary.paidCount}/{summary.totalCount}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setFilterMode('remaining');
                setSelectedDate(null);
              }}
              className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                filterMode === 'remaining'
                  ? 'bg-white text-teal-800 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              នៅសល់ ({summary.unpaidCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode('all');
                setSelectedDate(null);
              }}
              className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                filterMode === 'all'
                  ? 'bg-white text-teal-800 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ទាំងអស់ ({summary.totalCount})
            </button>
          </div>

          <button
            type="button"
            onClick={onManageBills}
            className="min-h-[40px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">គ្រប់គ្រង</span>
          </button>
        </div>
      </div>

      {/* Calendar Grid + Selected Date / Remaining Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 7-Column Calendar */}
        <div className="lg:col-span-7 space-y-2">
          <div className="grid grid-cols-7 gap-1 text-center">
            {KHMER_DAYS_SHORT.map((dayName, i) => (
              <div
                key={i}
                className="py-1 text-[11px] font-semibold text-slate-500"
              >
                {dayName}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: leadingBlankCount }).map((_, idx) => (
              <div key={`blank-${idx}`} aria-hidden="true" />
            ))}

            {activeCycle.dates.map((iso, idx) => {
              const d = parseIsoDate(iso);
              const dayNum = d.getDate();
              const isMonthStart = dayNum === 1 || idx === 0;
              const isToday = iso === todayIso;
              const dayBills = byDateMap.get(iso) || [];
              const hasBills = dayBills.length > 0;
              const isSelected = selectedDate === iso;

              const hasOverdue = dayBills.some((b) => b.status === 'overdue');
              const hasUnpaid = dayBills.some(
                (b) => b.status === 'today' || b.status === 'upcoming'
              );
              const allPaid = hasBills && dayBills.every((b) => b.isPaid);
              const daySumUsd = dayBills.reduce((s, b) => s + b.bill.amountUsd, 0);

              let cellStyle =
                'bg-slate-50/70 border-slate-200/70 text-slate-700 hover:bg-slate-100';
              if (hasOverdue) {
                cellStyle =
                  'bg-red-50 border-red-200 text-red-900 hover:bg-red-100/70';
              } else if (hasUnpaid) {
                cellStyle =
                  'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100/70';
              } else if (allPaid) {
                cellStyle =
                  'bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-100/60';
              }

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() =>
                    setSelectedDate((prev) => (prev === iso ? null : iso))
                  }
                  className={`relative min-h-[48px] sm:min-h-[56px] p-1.5 rounded-xl border text-left flex flex-col justify-between transition-colors ${cellStyle} ${
                    isSelected
                      ? 'ring-2 ring-teal-700 border-teal-700'
                      : isToday
                      ? 'ring-1 ring-teal-600'
                      : ''
                  }`}
                  aria-label={`${formatKhmerShortDate(iso)}${
                    hasBills ? ` មាន ${dayBills.length} វិក្កយបត្រ` : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-0.5 w-full">
                    <span
                      className={`text-xs num-tabular leading-none ${
                        isToday || hasBills ? 'font-bold' : 'font-medium'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {isMonthStart && (
                      <span className="text-[9px] text-slate-400 truncate hidden sm:inline">
                        {KHMER_MONTHS[d.getMonth()]}
                      </span>
                    )}
                  </div>

                  {hasBills ? (
                    <div className="w-full space-y-0.5">
                      <div className="hidden sm:block text-[10px] font-semibold num-tabular truncate leading-tight">
                        {formatMoney(daySumUsd, displayCurrency, exchangeRate, {
                          compact: true,
                        })}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <span
                          className={`h-1.5 flex-1 rounded-full ${
                            hasOverdue
                              ? 'bg-red-600'
                              : hasUnpaid
                              ? 'bg-amber-600'
                              : 'bg-green-700'
                          }`}
                        />
                        {dayBills.length > 1 && (
                          <span className="text-[9px] font-bold num-tabular leading-none">
                            ×{dayBills.length}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : isToday ? (
                    <span className="text-[9px] font-semibold text-teal-700 leading-none truncate">
                      ថ្ងៃនេះ
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Clean Legend */}
          <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-100 border border-amber-400 inline-block" />
              ត្រូវបង់នៅសល់
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-100 border border-red-400 inline-block" />
              ហួសថ្ងៃកំណត់
            </span>
            {filterMode === 'all' && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-100 border border-emerald-400 inline-block" />
                បានបង់រួច
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-white border border-teal-600 inline-block" />
              ថ្ងៃនេះ
            </span>
          </div>
        </div>

        {/* Right / Bottom Panel: Selected Day or All Remaining Bills */}
        <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-800">
              {selectedDate
                ? `វិក្កយបត្រថ្ងៃទី ${formatKhmerShortDate(selectedDate)}`
                : filterMode === 'remaining'
                ? 'កាលបរិច្ឆេទត្រូវបង់នៅសល់ក្នុងវដ្តនេះ'
                : 'វិក្កយបត្រទាំងអស់ក្នុងវដ្តនេះ'}
            </div>
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap"
              >
                បង្ហាញទាំងអស់
              </button>
            )}
          </div>

          {detailItems.length === 0 ? (
            <div className="py-8 text-center space-y-1.5">
              <p className="text-sm font-medium text-slate-700">
                {selectedDate
                  ? 'គ្មានវិក្កយបត្រត្រូវបង់នៅថ្ងៃនេះទេ'
                  : 'បានបង់វិក្កយបត្រទាំងអស់រួចរាល់ក្នុងវដ្តនេះ'}
              </p>
              <p className="text-xs text-slate-500">
                {selectedDate
                  ? 'ចុចលើថ្ងៃដែលមានពណ៌សម្គាល់លើប្រតិទិន ដើម្បីមើលព័ត៌មានលម្អិត។'
                  : 'អ្នកអាចប្តូរទៅ «ទាំងអស់» ដើម្បីពិនិត្យវិក្កយបត្រដែលបានបង់រួច។'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/70">
              {detailItems.map((item) => {
                const statusLabel = item.isPaid
                  ? 'បានបង់រួច'
                  : item.status === 'overdue'
                  ? `ហួស ${Math.abs(item.daysUntil)} ថ្ងៃ`
                  : item.status === 'today'
                  ? 'ដល់ថ្ងៃកំណត់ថ្ងៃនេះ'
                  : `នៅសល់ ${item.daysUntil} ថ្ងៃ`;

                return (
                  <div
                    key={item.bill.id}
                    className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-semibold truncate ${
                          item.isPaid
                            ? 'text-slate-400 line-through'
                            : 'text-slate-900'
                        }`}
                      >
                        {item.bill.title}
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                        <span className="num-tabular font-medium text-slate-700">
                          {formatKhmerShortDate(item.dueDate)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            item.isPaid
                              ? 'text-green-700'
                              : item.status === 'overdue'
                              ? 'text-red-600'
                              : item.status === 'today'
                              ? 'text-amber-700'
                              : 'text-teal-700'
                          }`}
                        >
                          {statusLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{PAYMENT_METHOD_LABELS[item.bill.paymentMethod]}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-sm font-bold text-slate-900 num-tabular">
                        {formatMoney(
                          item.bill.amountUsd,
                          displayCurrency,
                          exchangeRate
                        )}
                      </span>
                      {item.isPaid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                          <Check className="w-3.5 h-3.5" />
                          រួចរាល់
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onPayBill(item.bill)}
                          className="min-h-[36px] px-3 py-1 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
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
      </div>
    </section>
  );
}
