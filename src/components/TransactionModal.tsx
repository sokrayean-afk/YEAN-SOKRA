import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  ActiveUser,
  Category,
  CurrencyCode,
  HouseholdMember,
  PaymentMethod,
  Transaction,
  TransactionType,
} from '../types/finance';
import { getTodayIso } from '../utils/cycle';
import { formatMoney, PAYMENT_METHOD_LABELS } from '../utils/format';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, 'id' | 'createdAt'>, editId?: string) => void;
  editingTransaction: Transaction | null;
  categories: Category[];
  defaultCurrency: CurrencyCode;
  exchangeRate: number;
  activeUser: ActiveUser;
  husbandName: string;
  wifeName: string;
}

const USD_QUICK_AMOUNTS = [5, 10, 20, 50, 100];
const KHR_QUICK_AMOUNTS = [10000, 20000, 50000, 100000, 200000];

export function TransactionModal({
  isOpen,
  onClose,
  onSave,
  editingTransaction,
  categories,
  defaultCurrency,
  exchangeRate,
  activeUser,
  husbandName,
  wifeName,
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [categoryId, setCategoryId] = useState('food');
  const [date, setDate] = useState(getTodayIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('aba');
  const [member, setMember] = useState<HouseholdMember>(activeUser);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const filteredCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (editingTransaction) {
      setType(editingTransaction.type);
      setCurrency(editingTransaction.originalCurrency);
      setAmountInput(String(editingTransaction.originalAmount));
      setCategoryId(editingTransaction.categoryId);
      setDate(editingTransaction.date);
      setPaymentMethod(editingTransaction.paymentMethod);
      setMember(editingTransaction.member);
      setNote(editingTransaction.note);
    } else {
      setType('expense');
      setCurrency(defaultCurrency);
      setAmountInput('');
      setCategoryId('food');
      setDate(getTodayIso());
      setPaymentMethod('aba');
      setMember(activeUser);
      setNote('');
    }
  }, [isOpen, editingTransaction, defaultCurrency, activeUser]);

  useEffect(() => {
    if (!filteredCategories.some((c) => c.id === categoryId) && filteredCategories.length > 0) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [type, categoryId, filteredCategories]);

  if (!isOpen) return null;

  const numericVal = parseFloat(amountInput);
  const computedUsd =
    Number.isFinite(numericVal) && numericVal > 0
      ? currency === 'USD'
        ? numericVal
        : numericVal / exchangeRate
      : 0;

  const quickPresets = currency === 'USD' ? USD_QUICK_AMOUNTS : KHR_QUICK_AMOUNTS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(numericVal) || numericVal <= 0) {
      setError('សូមបញ្ចូលចំនួនទឹកប្រាក់ដែលត្រឹមត្រូវ (ធំជាង 0)');
      return;
    }
    if (!date) {
      setError('សូមជ្រើសរើសកាលបរិច្ឆេទ');
      return;
    }

    onSave(
      {
        type,
        amountUsd: Number(computedUsd.toFixed(2)),
        originalAmount: numericVal,
        originalCurrency: currency,
        categoryId,
        date,
        paymentMethod,
        member,
        note: note.trim() || filteredCategories.find((c) => c.id === categoryId)?.name || '',
        billId: editingTransaction?.billId,
      },
      editingTransaction?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
    >
      <div className="w-full sm:max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-200 shrink-0">
          <h2 id="tx-modal-title" className="text-base font-semibold text-slate-900">
            {editingTransaction ? 'កែប្រែប្រតិបត្តិការ' : 'កត់ត្រាចំណូល ឬចំណាយថ្មី'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl"
            aria-label="បិទ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Segmented Type Control */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`min-h-[44px] py-2 px-3 text-sm font-semibold rounded-lg transition-colors ${
                type === 'expense'
                  ? 'bg-white text-red-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ចំណាយ (ចេញ)
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`min-h-[44px] py-2 px-3 text-sm font-semibold rounded-lg transition-colors ${
                type === 'income'
                  ? 'bg-white text-green-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ចំណូល (ចូល)
            </button>
          </div>

          {/* Amount + Currency */}
          <div className="space-y-2">
            <label htmlFor="tx-amount" className="block text-sm font-medium text-slate-700">
              ចំនួនទឹកប្រាក់
            </label>
            <div className="flex gap-2">
              <input
                id="tx-amount"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                autoFocus
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder={currency === 'USD' ? '0.00' : '0'}
                className="flex-1 min-h-[48px] px-4 py-2.5 text-lg num-tabular font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-3 min-h-[40px] text-xs font-semibold rounded-lg transition-colors ${
                    currency === 'USD'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  USD
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('KHR')}
                  className={`px-3 min-h-[40px] text-xs font-semibold rounded-lg transition-colors ${
                    currency === 'KHR'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  KHR
                </button>
              </div>
            </div>

            {/* 1-tap quick amount buttons for fast mobile entry */}
            <div className="flex flex-wrap gap-1.5">
              {quickPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountInput(String(preset))}
                  className="min-h-[36px] px-3 py-1 text-xs font-medium num-tabular text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  {currency === 'USD'
                    ? `$${preset}`
                    : `${(preset / 1000).toLocaleString('en-US')}k ៛`}
                </button>
              ))}
            </div>

            {computedUsd > 0 && (
              <div className="text-xs text-slate-500 num-tabular">
                ស្មើនឹង{' '}
                {currency === 'USD'
                  ? formatMoney(computedUsd, 'KHR', exchangeRate)
                  : formatMoney(computedUsd, 'USD', exchangeRate)}{' '}
                (1$ = {exchangeRate.toLocaleString('en-US')} ៛)
              </div>
            )}
          </div>

          {/* Touch-friendly Category Selector */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">ជ្រើសរើសប្រភេទក្រុម</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredCategories.map((cat) => {
                const active = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`min-h-[44px] px-3 py-2 text-xs font-medium text-left rounded-xl border transition-colors truncate ${
                      active
                        ? 'bg-teal-50 border-teal-600 text-teal-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Who recorded: Husband / Wife / Joint */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-600">អ្នកកត់ត្រា (ប្តី / ប្រពន្ធ / រួម)</div>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {(
                [
                  { id: 'husband' as const, label: husbandName.trim() || 'ប្តី' },
                  { id: 'wife' as const, label: wifeName.trim() || 'ប្រពន្ធ' },
                  { id: 'joint' as const, label: 'រួម' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMember(opt.id)}
                  className={`min-h-[42px] px-2.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors truncate ${
                    member === opt.id || (opt.id === 'joint' && member === 'family')
                      ? 'bg-white text-teal-800 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="tx-date" className="block text-xs font-medium text-slate-600">
                កាលបរិច្ឆេទ
              </label>
              <input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm num-tabular text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tx-payment" className="block text-xs font-medium text-slate-600">
                វិធីទូទាត់
              </label>
              <select
                id="tx-payment"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full min-h-[44px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((key) => (
                  <option key={key} value={key}>
                    {PAYMENT_METHOD_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label htmlFor="tx-note" className="block text-xs font-medium text-slate-600">
              កំណត់ចំណាំ (បរិយាយ)
            </label>
            <input
              id="tx-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ឧ. ទិញម្ហូបផ្សារ, បង់ថ្លៃភ្លើង, ប្រាក់ខែ..."
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none min-h-[48px] px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              បោះបង់
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[48px] px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 rounded-xl hover:bg-teal-800 transition-colors whitespace-nowrap"
            >
              {editingTransaction ? 'រក្សាទុកការកែប្រែ' : 'រក្សាទុកកំណត់ត្រា'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
