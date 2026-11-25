import { CalendarRange, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  Category,
  CycleRange,
  HouseholdSettings,
  PaymentMethod,
  Transaction,
  TransactionType,
} from '../types/finance';
import { formatKhmerDate, formatKhmerShortDate, isDateInCycle } from '../utils/cycle';
import {
  exportTransactionsToCsv,
  formatMoney,
  getMemberLabel,
  PAYMENT_METHOD_LABELS,
} from '../utils/format';

interface LedgerViewProps {
  allTransactions: Transaction[];
  activeCycle: CycleRange;
  categories: Category[];
  settings: HouseholdSettings;
  onOpenPeriodModal: () => void;
  onOpenNewTx: () => void;
  onEditTx: (tx: Transaction) => void;
  onDeleteTx: (id: string) => void;
}

type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export function LedgerView({
  allTransactions,
  activeCycle,
  categories,
  settings,
  onOpenPeriodModal,
  onOpenNewTx,
  onEditTx,
  onDeleteTx,
}: LedgerViewProps) {
  const { displayCurrency, exchangeRate } = settings;
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const [scope, setScope] = useState<'cycle' | 'all'>('cycle');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [memberFilter, setMemberFilter] = useState<'all' | 'husband' | 'wife' | 'joint'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentMethod>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('date_desc');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const husbandLabel = settings.husbandName.trim() || 'ប្តី';
  const wifeLabel = settings.wifeName.trim() || 'ប្រពន្ធ';

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allTransactions
      .filter((tx) => {
        if (scope === 'cycle' && !isDateInCycle(tx.date, activeCycle)) return false;
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (memberFilter !== 'all') {
          if (memberFilter === 'joint') {
            if (tx.member !== 'joint' && tx.member !== 'family') return false;
          } else if (tx.member !== memberFilter) {
            return false;
          }
        }
        if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;
        if (paymentFilter !== 'all' && tx.paymentMethod !== paymentFilter) return false;
        if (q) {
          const catName = catMap.get(tx.categoryId)?.name.toLowerCase() || '';
          const noteMatch = tx.note.toLowerCase().includes(q);
          const catMatch = catName.includes(q);
          const methodMatch = PAYMENT_METHOD_LABELS[tx.paymentMethod].toLowerCase().includes(q);
          const memberMatch = getMemberLabel(tx.member, settings).toLowerCase().includes(q);
          if (!noteMatch && !catMatch && !methodMatch && !memberMatch) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') {
          return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
        }
        if (sortBy === 'date_asc') {
          return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
        }
        if (sortBy === 'amount_desc') return b.amountUsd - a.amountUsd;
        return a.amountUsd - b.amountUsd;
      });
  }, [
    allTransactions,
    scope,
    activeCycle,
    typeFilter,
    memberFilter,
    categoryFilter,
    paymentFilter,
    searchQuery,
    sortBy,
    catMap,
    settings,
  ]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filtered) {
      if (tx.type === 'income') income += tx.amountUsd;
      else expense += tx.amountUsd;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  const handleExportCsv = () => {
    const suffix = scope === 'cycle' ? activeCycle.key : 'all';
    exportTransactionsToCsv(
      filtered,
      categories,
      exchangeRate,
      `household-ledger-${suffix}.csv`,
      settings
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Filter Toolbar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Segmented Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setScope('cycle')}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  scope === 'cycle'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {activeCycle.shortLabel}
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  scope === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ទាំងអស់
              </button>
            </div>

            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
              {(['all', 'expense', 'income'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    typeFilter === t
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t === 'all' ? 'ទាំងអស់' : t === 'expense' ? 'ចំណាយ' : 'ចំណូល'}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
              {(
                [
                  { id: 'all' as const, label: 'ទាំង២' },
                  { id: 'husband' as const, label: husbandLabel },
                  { id: 'wife' as const, label: wifeLabel },
                  { id: 'joint' as const, label: 'រួម' },
                ] as const
              ).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setMemberFilter(u.id)}
                  className={`min-h-[38px] px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    memberFilter === u.id
                      ? 'bg-white text-teal-800 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenPeriodModal}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors whitespace-nowrap"
            >
              <CalendarRange className="w-3.5 h-3.5" />
              កំណត់រយៈពេល
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        {/* Search & Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ស្វែងរកកំណត់ចំណាំ ឬប្រភេទ..."
              className="w-full min-h-[44px] pl-10 pr-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="ត្រងតាមប្រភេទក្រុម"
            className="min-h-[44px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          >
            <option value="all">គ្រប់ប្រភេទ</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as 'all' | PaymentMethod)}
            aria-label="ត្រងតាមវិធីទូទាត់"
            className="min-h-[44px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          >
            <option value="all">គ្រប់វិធីទូទាត់</option>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
              <option key={k} value={k}>
                {PAYMENT_METHOD_LABELS[k]}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            aria-label="តម្រៀបតាម"
            className="min-h-[44px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          >
            <option value="date_desc">ថ្មីទៅចាស់</option>
            <option value="date_asc">ចាស់ទៅថ្មី</option>
            <option value="amount_desc">ទឹកប្រាក់ខ្ពស់ទៅទាប</option>
            <option value="amount_asc">ទឹកប្រាក់ទាបទៅខ្ពស់</option>
          </select>
        </div>

        {/* Summary Strip */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
          <span>
            <strong className="num-tabular text-slate-900">{filtered.length}</strong> កំណត់ត្រា
          </span>
          <span>
            ចំណូល៖{' '}
            <strong className="num-tabular text-green-700">
              {formatMoney(totals.income, displayCurrency, exchangeRate)}
            </strong>
          </span>
          <span>
            ចំណាយ៖{' '}
            <strong className="num-tabular text-red-600">
              {formatMoney(totals.expense, displayCurrency, exchangeRate)}
            </strong>
          </span>
          <span>
            សុទ្ធ៖{' '}
            <strong
              className={`num-tabular ${
                totals.net >= 0 ? 'text-slate-900' : 'text-red-600'
              }`}
            >
              {formatMoney(totals.net, displayCurrency, exchangeRate, { showSign: true })}
            </strong>
          </span>
        </div>
      </section>

      {/* Ledger Data Container */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-3">
            <p className="text-sm text-slate-600">
              រកមិនឃើញកំណត់ត្រាចំណូល ឬចំណាយដែលត្រូវនឹងលក្ខខណ្ឌត្រងនេះទេ។
            </p>
            <button
              type="button"
              onClick={onOpenNewTx}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-xl hover:bg-teal-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              កត់ត្រាថ្មី
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Clean Card Rows (Zero horizontal scroll!) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((tx) => {
                const cat = catMap.get(tx.categoryId);
                const isConfirming = confirmDeleteId === tx.id;
                return (
                  <div key={tx.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onEditTx(tx)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {tx.note}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {cat?.name || tx.categoryId} · {formatKhmerShortDate(tx.date)}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {getMemberLabel(tx.member, settings)} · {PAYMENT_METHOD_LABELS[tx.paymentMethod]}
                        </div>
                      </button>

                      <div className="text-right shrink-0 space-y-1">
                        <div
                          className={`text-sm font-bold num-tabular ${
                            tx.type === 'income' ? 'text-green-700' : 'text-slate-900'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}
                          {formatMoney(tx.amountUsd, displayCurrency, exchangeRate)}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          {isConfirming ? (
                            <span className="inline-flex items-center gap-1 text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteTx(tx.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="min-h-[34px] px-2.5 font-medium text-white bg-red-600 rounded-lg"
                              >
                                លុប
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="min-h-[34px] px-2 text-slate-600"
                              >
                                ទេ
                              </button>
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditTx(tx)}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-800 rounded-lg"
                                aria-label="កែប្រែ"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(tx.id)}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg"
                                aria-label="លុប"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop High-Density Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-3 pl-5 pr-3 whitespace-nowrap">កាលបរិច្ឆេទ</th>
                    <th className="py-3 px-3">បរិយាយ</th>
                    <th className="py-3 px-3 whitespace-nowrap">ប្រភេទក្រុម</th>
                    <th className="py-3 px-3 whitespace-nowrap">វិធីទូទាត់ · អ្នកប្រើ</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">ទឹកប្រាក់</th>
                    <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((tx) => {
                    const cat = catMap.get(tx.categoryId);
                    const isConfirming = confirmDeleteId === tx.id;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 pl-5 pr-3 text-xs text-slate-600 num-tabular whitespace-nowrap">
                          {formatKhmerDate(tx.date)}
                        </td>
                        <td className="py-3 px-3 min-w-[200px]">
                          <div className="font-medium text-slate-900">{tx.note}</div>
                          <div className="text-xs text-slate-400 num-tabular">
                            {tx.originalCurrency === 'KHR'
                              ? `កត់ត្រាជា ${tx.originalAmount.toLocaleString('en-US')} ៛`
                              : `កត់ត្រាជា $${tx.originalAmount.toFixed(2)}`}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-700 whitespace-nowrap">
                          <span>{cat?.name || tx.categoryId}</span>
                          <span className="text-slate-400">
                            {' '}
                            · {tx.type === 'income' ? 'ចំណូល' : 'ចំណាយ'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                          {PAYMENT_METHOD_LABELS[tx.paymentMethod]} · {getMemberLabel(tx.member, settings)}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-semibold num-tabular whitespace-nowrap ${
                            tx.type === 'income' ? 'text-green-700' : 'text-slate-900'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}
                          {formatMoney(tx.amountUsd, displayCurrency, exchangeRate)}
                        </td>
                        <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                          {isConfirming ? (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteTx(tx.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 font-medium text-white bg-red-600 hover:bg-red-700 rounded"
                              >
                                លុប
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-slate-600 hover:text-slate-900"
                              >
                                ទេ
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onEditTx(tx)}
                                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-md"
                                aria-label="កែប្រែ"
                                title="កែប្រែ"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(tx.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-md"
                                aria-label="លុប"
                                title="លុប"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          )}
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
    </div>
  );
}
