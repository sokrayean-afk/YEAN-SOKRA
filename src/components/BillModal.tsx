import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Category, PaymentMethod, RecurringBill } from '../types/finance';
import { PAYMENT_METHOD_LABELS } from '../utils/format';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bill: Omit<RecurringBill, 'id' | 'paidCycles'>, editId?: string) => void;
  editingBill: RecurringBill | null;
  categories: Category[];
}

export function BillModal({
  isOpen,
  onClose,
  onSave,
  editingBill,
  categories,
}: BillModalProps) {
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('utilities');
  const [amountUsd, setAmountUsd] = useState('');
  const [dueDay, setDueDay] = useState(10);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('aba');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (editingBill) {
      setTitle(editingBill.title);
      setCategoryId(editingBill.categoryId);
      setAmountUsd(String(editingBill.amountUsd));
      setDueDay(editingBill.dueDay);
      setPaymentMethod(editingBill.paymentMethod);
      setNote(editingBill.note || '');
    } else {
      setTitle('');
      setCategoryId('utilities');
      setAmountUsd('');
      setDueDay(10);
      setPaymentMethod('aba');
      setNote('');
    }
  }, [isOpen, editingBill]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amountUsd);
    if (!title.trim()) {
      setError('សូមបញ្ចូលឈ្មោះចំណាយប្រចាំខែ');
      return;
    }
    if (!Number.isFinite(num) || num <= 0) {
      setError('សូមបញ្ចូលទឹកប្រាក់ប៉ាន់ស្មាន (USD) ធំជាង 0');
      return;
    }
    onSave(
      {
        title: title.trim(),
        categoryId,
        amountUsd: Number(num.toFixed(2)),
        dueDay: Math.max(1, Math.min(28, Math.floor(dueDay))),
        paymentMethod,
        note: note.trim(),
      },
      editingBill?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bill-modal-title"
    >
      <div className="w-full sm:max-w-md bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-200">
          <h2 id="bill-modal-title" className="text-base font-semibold text-slate-900">
            {editingBill ? 'កែប្រែថ្ងៃកំណត់បង់ប្រាក់' : 'បន្ថែមថ្ងៃកំណត់បង់ប្រាក់ប្រចាំខែ'}
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

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label htmlFor="bill-title" className="block text-sm font-medium text-slate-700">
              ឈ្មោះវិក្កយបត្រ ឬការបង់ប្រាក់
            </label>
            <input
              id="bill-title"
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ឧ. ថ្លៃភ្លើង EDC, ថ្លៃទឹក, បង់រំលស់ផ្ទះ..."
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="bill-amount" className="block text-xs font-medium text-slate-600">
                ទឹកប្រាក់ប៉ាន់ស្មាន (USD)
              </label>
              <input
                id="bill-amount"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[44px] px-3 py-2 text-sm num-tabular text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="bill-day" className="block text-xs font-medium text-slate-600">
                ថ្ងៃកំណត់រៀងរាល់ខែ (1–28)
              </label>
              <select
                id="bill-day"
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 text-sm num-tabular text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    ថ្ងៃទី {day}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="bill-cat" className="block text-xs font-medium text-slate-600">
                ប្រភេទក្រុម
              </label>
              <select
                id="bill-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="bill-method" className="block text-xs font-medium text-slate-600">
                វិធីទូទាត់
              </label>
              <select
                id="bill-method"
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

          <div className="space-y-1.5">
            <label htmlFor="bill-note" className="block text-xs font-medium text-slate-600">
              កំណត់ចំណាំបន្ថែម
            </label>
            <input
              id="bill-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ឧ. លេខកូដអតិថិជន ឬវិធីផ្ទេរ..."
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
              className="flex-1 min-h-[46px] px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              បោះបង់
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[46px] px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 rounded-xl hover:bg-teal-800 transition-colors"
            >
              រក្សាទុក
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
