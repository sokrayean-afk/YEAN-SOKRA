import {
  AlertCircle,
  Bell,
  BellOff,
  CalendarClock,
  Check,
  Clock,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type {
  BillNotification,
  HouseholdSettings,
  RecurringBill,
} from '../types/finance';
import { formatKhmerShortDate } from '../utils/cycle';
import { formatMoney, PAYMENT_METHOD_LABELS } from '../utils/format';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  sendBrowserBillNotification,
} from '../utils/notifications';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: BillNotification[];
  settings: HouseholdSettings;
  onUpdateSettings: (patch: Partial<HouseholdSettings>) => void;
  onPayBillInCurrentCycle: (bill: RecurringBill) => void;
  onManageBills: () => void;
}

const REMINDER_DAY_OPTIONS = [1, 3, 5, 7, 10];

export function NotificationsModal({
  isOpen,
  onClose,
  notifications,
  settings,
  onUpdateSettings,
  onPayBillInCurrentCycle,
  onManageBills,
}: NotificationsModalProps) {
  const [browserFeedback, setBrowserFeedback] = useState('');
  const [permissionState, setPermissionState] = useState(() =>
    getBrowserNotificationPermission()
  );

  if (!isOpen) return null;

  const { displayCurrency, exchangeRate } = settings;

  const handleToggleBrowserNotifications = async () => {
    setBrowserFeedback('');
    if (settings.browserNotificationsEnabled) {
      onUpdateSettings({ browserNotificationsEnabled: false });
      return;
    }

    const currentPerm = getBrowserNotificationPermission();
    if (currentPerm === 'unsupported') {
      setPermissionState('unsupported');
      setBrowserFeedback('កម្មវិធីរុករកនេះមិនគាំទ្រការជូនដំណឹងលើឧបករណ៍ទេ ប៉ុន្តែការជូនដំណឹងក្នុងកម្មវិធីនៅដំណើរការធម្មតា។');
      return;
    }

    if (currentPerm === 'denied') {
      setPermissionState('denied');
      setBrowserFeedback('សិទ្ធិជូនដំណឹងត្រូវបានបិទនៅក្នុងកម្មវិធីរុករក សូមអនុញ្ញាតក្នុងការកំណត់ Browser ជាមុនសិន។');
      return;
    }

    const result =
      currentPerm === 'granted'
        ? 'granted'
        : await requestBrowserNotificationPermission();
    setPermissionState(result);

    if (result === 'granted') {
      onUpdateSettings({ browserNotificationsEnabled: true });
      sendBrowserBillNotification(notifications, settings, true);
      setBrowserFeedback('បានបើកការជូនដំណឹងលើឧបករណ៍ដោយជោគជ័យ។');
    } else {
      onUpdateSettings({ browserNotificationsEnabled: false });
      setBrowserFeedback('មិនទាន់ទទួលបានការអនុញ្ញាតជូនដំណឹងពីកម្មវិធីរុករកទេ។');
    }
  };

  const handleTestBrowserNotification = () => {
    setBrowserFeedback('');
    const ok = sendBrowserBillNotification(notifications, settings, true);
    if (ok) {
      setBrowserFeedback('បានផ្ញើការជូនដំណឹងសាកល្បងរួចរាល់។');
    } else {
      setBrowserFeedback('មិនអាចផ្ញើការជូនដំណឹងលើឧបករណ៍បានទេ (អាចត្រូវបានរាំងខ្ទប់ដោយកម្មវិធីរុករក)។');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notifications-modal-title"
    >
      <div className="w-full sm:max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-teal-700 shrink-0" />
            <h2
              id="notifications-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              ការជូនដំណឹងវិក្កយបត្រប្រចាំខែ
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

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Active Reminders List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-500">
                វិក្កយបត្រដែលត្រូវរំលឹក (ក្នុងរយៈពេល {settings.reminderDaysBefore} ថ្ងៃ)
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onManageBills();
                }}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900"
              >
                គ្រប់គ្រងវិក្កយបត្រ
              </button>
            </div>

            {!settings.notificationsEnabled ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-2">
                <BellOff className="w-7 h-7 text-slate-400 mx-auto" />
                <div className="text-sm font-medium text-slate-700">
                  ការជូនដំណឹងត្រូវបានផ្អាកបណ្តោះអាសន្ន
                </div>
                <p className="text-xs text-slate-500">
                  បើកមុខងារជូនដំណឹងខាងក្រោម ដើម្បីទទួលការរំលឹកមុនថ្ងៃកំណត់បង់វិក្កយបត្រ។
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-2">
                <Check className="w-7 h-7 text-green-700 mx-auto" />
                <div className="text-sm font-semibold text-slate-900">
                  គ្មានវិក្កយបត្រជិតដល់ថ្ងៃកំណត់ទេ
                </div>
                <p className="text-xs text-slate-500">
                  វិក្កយបត្រទាំងអស់ក្នុងរយៈពេល {settings.reminderDaysBefore} ថ្ងៃខាងមុខ ត្រូវបានបង់រួចរាល់ ឬមិនទាន់ដល់ថ្ងៃរំលឹក។
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                {notifications.map((item) => {
                  const isOverdue = item.severity === 'overdue';
                  const isToday = item.severity === 'today';
                  const statusText = isOverdue
                    ? `ហួសថ្ងៃកំណត់ ${Math.abs(item.daysUntil)} ថ្ងៃ`
                    : isToday
                    ? 'ដល់ថ្ងៃកំណត់ថ្ងៃនេះ'
                    : `នៅសល់ ${item.daysUntil} ថ្ងៃទៀត`;

                  return (
                    <div
                      key={item.bill.id}
                      className="p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          {isOverdue ? (
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                          ) : isToday ? (
                            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                          ) : (
                            <CalendarClock className="w-4 h-4 text-teal-700 shrink-0" />
                          )}
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {item.bill.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span
                            className={`font-semibold ${
                              isOverdue
                                ? 'text-red-600'
                                : isToday
                                ? 'text-amber-700'
                                : 'text-teal-700'
                            }`}
                          >
                            {statusText}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-500 num-tabular">
                            ថ្ងៃកំណត់៖ {formatKhmerShortDate(item.dueDate)}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-500">
                            {PAYMENT_METHOD_LABELS[item.bill.paymentMethod]}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-sm font-bold text-slate-900 num-tabular">
                          {formatMoney(item.bill.amountUsd, displayCurrency, exchangeRate)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onPayBillInCurrentCycle(item.bill)}
                          className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
                        >
                          កត់ត្រាថាបានបង់
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inline Notification Preferences */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <div className="text-xs font-semibold text-slate-700">
              ការកំណត់ការរំលឹក
            </div>

            {/* In-app toggle */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900">
                  បង្ហាញការជូនដំណឹងក្នុងកម្មវិធី
                </div>
                <div className="text-xs text-slate-500">
                  បង្ហាញផ្ទាំងរំលឹកលើទំព័រដើម និងរូបកណ្តឹងខាងលើ
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.notificationsEnabled}
                onClick={() =>
                  onUpdateSettings({
                    notificationsEnabled: !settings.notificationsEnabled,
                  })
                }
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                  settings.notificationsEnabled ? 'bg-teal-700' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                    settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Reminder Lead Days */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-900">
                រំលឹកមុនថ្ងៃកំណត់បង់ប្រាក់
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {REMINDER_DAY_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => onUpdateSettings({ reminderDaysBefore: days })}
                    className={`min-h-[40px] rounded-xl text-xs font-semibold num-tabular border transition-colors ${
                      settings.reminderDaysBefore === days
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                    }`}
                  >
                    {days} ថ្ងៃ
                  </button>
                ))}
              </div>
            </div>

            {/* Browser / OS Notification Opt-In */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">
                    ការជូនដំណឹងលើកម្មវិធីរុករក (Browser)
                  </div>
                  <div className="text-xs text-slate-500">
                    {permissionState === 'unsupported'
                      ? 'មិនគាំទ្រលើកម្មវិធីរុករកនេះទេ'
                      : permissionState === 'denied'
                      ? 'ត្រូវបានបិទសិទ្ធិនៅក្នុង Browser'
                      : settings.browserNotificationsEnabled
                      ? 'បានបើកដំណើរការ'
                      : 'ផ្ញើសារជូនដំណឹងពេលបើកកម្មវិធីប្រចាំថ្ងៃ'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.browserNotificationsEnabled}
                  onClick={handleToggleBrowserNotifications}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                    settings.browserNotificationsEnabled ? 'bg-teal-700' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                      settings.browserNotificationsEnabled
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {settings.browserNotificationsEnabled && permissionState === 'granted' && (
                <button
                  type="button"
                  onClick={handleTestBrowserNotification}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-teal-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  សាកល្បងផ្ញើការជូនដំណឹង
                </button>
              )}

              {browserFeedback && (
                <p className="text-xs text-slate-600">{browserFeedback}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
