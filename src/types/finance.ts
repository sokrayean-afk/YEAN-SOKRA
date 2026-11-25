export type TransactionType = 'income' | 'expense';

export type CurrencyCode = 'USD' | 'KHR';

export type PaymentMethod = 'cash' | 'aba' | 'acleda' | 'wing' | 'other';

export type HouseholdMember = 'joint' | 'husband' | 'wife' | 'family';

export type ActiveUser = 'husband' | 'wife';

export type UserViewFilter = 'all' | 'husband' | 'wife';

export type ViewTab = 'overview' | 'ledger' | 'analytics' | 'settings';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  /** Stored normalized in USD for consistent math, with original currency metadata */
  amountUsd: number;
  originalAmount: number;
  originalCurrency: CurrencyCode;
  categoryId: string;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  member: HouseholdMember;
  note: string;
  billId?: string;
  createdAt: string;
}

export interface RecurringBill {
  id: string;
  title: string;
  categoryId: string;
  amountUsd: number;
  dueDay: number; // 1 - 28
  paymentMethod: PaymentMethod;
  note?: string;
  /** Map of cycleKey (e.g. "2026-10-25") -> transactionId when marked paid */
  paidCycles: Record<string, string>;
}

export type CycleMode = 'monthly_day' | 'custom_range';

export interface HouseholdSettings {
  householdName: string;
  /** Display name for Husband user (default: ប្តី) */
  husbandName: string;
  /** Display name for Wife user (default: ប្រពន្ធ) */
  wifeName: string;
  /** Currently active user recording transactions */
  activeUser: ActiveUser;
  /** Whether the active 1-month period repeats by monthly day or uses a custom start/end date */
  cycleMode: CycleMode;
  /** Day of month (1-28) when the monthly budget cycle begins */
  cycleStartDay: number;
  /** Custom period start date (YYYY-MM-DD) used when cycleMode === 'custom_range' */
  customStartDate: string;
  /** Custom period end date (YYYY-MM-DD) used when cycleMode === 'custom_range' */
  customEndDate: string;
  displayCurrency: CurrencyCode;
  exchangeRate: number; // KHR per 1 USD, e.g., 4050
  /** Category monthly budget limits in USD */
  categoryBudgets: Record<string, number>;
  /** Overall monthly expense target in USD */
  monthlyBudgetTargetUsd: number;
  /** Enable in-app reminders for upcoming/overdue recurring bills */
  notificationsEnabled: boolean;
  /** How many days before due date to remind the user (e.g. 1, 3, 5, 7, 10) */
  reminderDaysBefore: number;
  /** Enable native browser/OS notifications when permission is granted */
  browserNotificationsEnabled: boolean;
}

export type NotificationSeverity = 'overdue' | 'today' | 'upcoming';

export interface BillNotification {
  bill: RecurringBill;
  dueDate: string; // YYYY-MM-DD
  daysUntil: number; // <0 overdue, 0 today, >0 upcoming
  severity: NotificationSeverity;
  cycleKey: string;
}

export interface CycleRange {
  key: string; // YYYY-MM-DD of start date
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string; // Khmer readable range e.g. "25 តុលា – 24 វិច្ឆិកា 2026"
  shortLabel: string; // e.g. "វិច្ឆិកា 2026" or "5 វិច្ឆិកា–4 ធ្នូ"
  totalDays: number;
  daysElapsed: number;
  daysRemaining: number;
  isCurrent: boolean;
  isFuture: boolean;
  dates: string[]; // All YYYY-MM-DD dates in cycle
  mode: CycleMode;
}
