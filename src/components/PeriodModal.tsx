import { CalendarRange, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CycleMode, HouseholdSettings } from '../types/finance';
import {
  addDaysIso,
  addMonthsMinusOneDayIso,
  daysBetweenIso,
  formatKhmerDate,
  getCycleRangeFromSettings,
  getTodayIso,
} from '../utils/cycle';

interface PeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: HouseholdSettings;
  onApply: (patch: Partial<HouseholdSettings>) => void;
}

const PRESET_START_DAYS = [1, 5, 10, 15, 25, 28];

export function PeriodModal({
  isOpen,
  onClose,
  settings,
  onApply,
}: PeriodModalProps) {
  const [mode, setMode] = useState<CycleMode>(settings.cycleMode);
  const [startDay, setStartDay] = useState<number>(settings.cycleStartDay);
  const [customStart, setCustomStart] = useState<string>(settings.customStartDate);
  const [customEnd, setCustomEnd] = useState<string>(settings.customEndDate);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setMode(settings.cycleMode);
    setStartDay(settings.cycleStartDay);
    setCustomStart(settings.customStartDate);
    setCustomEnd(settings.customEndDate);
    setError('');
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const previewSettings: HouseholdSettings = {
    ...settings,
    cycleMode: mode,
    cycleStartDay: startDay,
    customStartDate: customStart,
    customEndDate: customEnd >= customStart ? customEnd : customStart,
  };

  const previewRange = getCycleRangeFromSettings(previewSettings, 0);
  const customDays =
    customStart && customEnd && customEnd >= customStart
      ? daysBetweenIso(customStart, customEnd) + 1
      : 0;

  const applyQuickDuration = (kind: '30d' | '1m' | 'cal_month') => {
    setError('');
    if (kind === 'cal_month') {
      const today = getTodayIso();
      const [y, m] = today.split('-').map(Number);
      const first = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDate = new Date(y, m, 0);
      const last = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`;
      setCustomStart(first);
      setCustomEnd(last);
      return;
    }
    const base = customStart || getTodayIso();
    if (kind === '30d') {
      setCustomEnd(addDaysIso(base, 29));
    } else {
      setCustomEnd(addMonthsMinusOneDayIso(base, 1));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'custom_range') {
      if (!customStart || !customEnd) {
        setError('សូមជ្រើសរើសថ្ងៃចាប់ផ្តើម និងថ្ងៃបញ្ចប់');
        return;
      }
      if (customEnd < customStart) {
        setError('ថ្ងៃបញ្ចប់ត្រូវតែធំជាង ឬស្មើថ្ងៃចាប់ផ្តើម');
        return;
      }
    }

    onApply({
      cycleMode: mode,
      cycleStartDay: startDay,
      customStartDate: customStart,
      customEndDate: customEnd,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="period-modal-title"
    >
      <div className="w-full sm:max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Mobile drag handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <CalendarRange className="w-5 h-5 text-teal-700 shrink-0" />
            <h2 id="period-modal-title" className="text-base font-semibold text-slate-900">
              កំណត់រយៈពេលមួយខែដោយខ្លួនឯង
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl"
            aria-label="បិទ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('custom_range')}
              className={`min-h-[44px] px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                mode === 'custom_range'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ជ្រើសរើសថ្ងៃចាប់ផ្តើម – បញ្ចប់
            </button>
            <button
              type="button"
              onClick={() => setMode('monthly_day')}
              className={`min-h-[44px] px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                mode === 'monthly_day'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              រាប់រៀងរាល់ខែតាមថ្ងៃទី (1–28)
            </button>
          </div>

          {mode === 'custom_range' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="custom-start-date"
                    className="block text-sm font-medium text-slate-700"
                  >
                    ថ្ងៃចាប់ផ្តើម
                  </label>
                  <input
                    id="custom-start-date"
                    type="date"
                    value={customStart}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomStart(val);
                      if (val && (!customEnd || customEnd < val)) {
                        setCustomEnd(addMonthsMinusOneDayIso(val, 1));
                      }
                    }}
                    className="w-full min-h-[46px] px-3.5 py-2.5 text-sm num-tabular text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="custom-end-date"
                    className="block text-sm font-medium text-slate-700"
                  >
                    ថ្ងៃបញ្ចប់
                  </label>
                  <input
                    id="custom-end-date"
                    type="date"
                    value={customEnd}
                    min={customStart}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full min-h-[46px] px-3.5 py-2.5 text-sm num-tabular text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                  />
                </div>
              </div>

              {/* 1-Tap Duration Helpers */}
              <div className="space-y-2">
                <div className="text-xs text-slate-500">ជម្រើសរហ័សពីថ្ងៃចាប់ផ្តើម</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyQuickDuration('1m')}
                    className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors"
                  >
                    + 1 ខែពេញ
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDuration('30d')}
                    className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    + 30 ថ្ងៃ
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDuration('cal_month')}
                    className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    ដើមខែ ដល់ ចុងខែនេះ
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex flex-wrap gap-2">
                {PRESET_START_DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setStartDay(day)}
                    className={`min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-xl border transition-colors num-tabular ${
                      startDay === day
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ថ្ងៃទី {day}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setStartDay(day)}
                    className={`min-h-[40px] rounded-lg text-sm num-tabular font-medium border transition-colors ${
                      startDay === day
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
            <div className="text-xs text-slate-500">រយៈពេលដែលបានជ្រើសរើស</div>
            <div className="text-base font-bold text-slate-900">
              {previewRange.label}
            </div>
            <div className="text-xs text-slate-600 num-tabular">
              {mode === 'custom_range'
                ? `សរុប ${customDays} ថ្ងៃ (${formatKhmerDate(customStart)} ដល់ ${formatKhmerDate(customEnd)})`
                : `រាប់រៀងរាល់ខែពីថ្ងៃទី ${startDay} · សរុប ${previewRange.totalDays} ថ្ងៃ`}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
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
              className="flex-1 min-h-[46px] px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors"
            >
              អនុវត្តរយៈពេលនេះ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
