import type {
  BillNotification,
  CycleRange,
  HouseholdSettings,
  RecurringBill,
} from '../types/finance';
import { daysBetweenIso, getBillDueDateInCycle, getTodayIso } from './cycle';
import { formatMoney } from './format';

/**
 * Computes active unpaid bill reminders (overdue, due today, or within reminderDaysBefore)
 * for the current real-world billing cycle.
 */
export function computeBillNotifications(
  bills: RecurringBill[],
  currentCycle: CycleRange,
  reminderDaysBefore: number
): BillNotification[] {
  const todayIso = getTodayIso();
  const windowDays = Math.max(0, Math.min(28, Math.floor(reminderDaysBefore)));

  const items: BillNotification[] = [];

  for (const bill of bills) {
    if (bill.paidCycles[currentCycle.key]) continue;

    const dueDate = getBillDueDateInCycle(bill.dueDay, currentCycle);
    const daysUntil = daysBetweenIso(todayIso, dueDate);

    if (daysUntil < 0) {
      items.push({
        bill,
        dueDate,
        daysUntil,
        severity: 'overdue',
        cycleKey: currentCycle.key,
      });
    } else if (daysUntil === 0) {
      items.push({
        bill,
        dueDate,
        daysUntil,
        severity: 'today',
        cycleKey: currentCycle.key,
      });
    } else if (daysUntil <= windowDays) {
      items.push({
        bill,
        dueDate,
        daysUntil,
        severity: 'upcoming',
        cycleKey: currentCycle.key,
      });
    }
  }

  return items.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    return await window.Notification.requestPermission();
  } catch {
    return window.Notification.permission;
  }
}

export function sendBrowserBillNotification(
  notifications: BillNotification[],
  settings: HouseholdSettings,
  isTest = false
): boolean {
  if (!isBrowserNotificationSupported()) return false;
  if (window.Notification.permission !== 'granted') return false;

  try {
    if (notifications.length === 0) {
      if (!isTest) return false;
      new window.Notification('គណនីគ្រួសារ — ការជូនដំណឹងដំណើរការល្អ', {
        body: 'មិនមានវិក្កយបត្រហួស ឬជិតដល់ថ្ងៃកំណត់នៅពេលនេះទេ។',
      });
      return true;
    }

    const totalUsd = notifications.reduce((s, n) => s + n.bill.amountUsd, 0);
    const topTitles = notifications
      .slice(0, 2)
      .map((n) => n.bill.title)
      .join(', ');
    const more = notifications.length > 2 ? ` និង ${notifications.length - 2} ទៀត` : '';

    const title =
      notifications.some((n) => n.severity === 'overdue')
        ? `រំលឹកវិក្កយបត្រ៖ មាន ${notifications.length} មុខត្រូវបង់`
        : `រំលឹកវិក្កយបត្រជិតដល់ថ្ងៃកំណត់ (${notifications.length} មុខ)`;

    const body = `${topTitles}${more} · សរុប ${formatMoney(
      totalUsd,
      settings.displayCurrency,
      settings.exchangeRate
    )}`;

    new window.Notification(title, { body });
    return true;
  } catch {
    return false;
  }
}
