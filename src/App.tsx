/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { User } from 'firebase/auth';
import { Bell, Cloud, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnalyticsView } from './components/AnalyticsView';
import { BillModal } from './components/BillModal';
import { BudgetsCycleView } from './components/BudgetsCycleView';
import { DriveModal } from './components/DriveModal';
import { LedgerView } from './components/LedgerView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { NotificationsModal } from './components/NotificationsModal';
import { OverviewView } from './components/OverviewView';
import { PeriodModal } from './components/PeriodModal';
import { Sidebar } from './components/Sidebar';
import { TransactionModal } from './components/TransactionModal';
import {
  createSeedData,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
} from './data/defaults';
import {
  clearCachedAccessToken,
  getCachedAccessToken,
  initGoogleAuth,
  markNeedsConsentPrompt,
  signInWithGoogleDrive,
  signOutGoogle,
} from './services/googleAuth';
import {
  deleteDriveDataFile,
  DriveAuthError,
  findDriveDataFile,
  loadDataFromDrive,
  saveDataToDrive,
  type DriveFileMeta,
} from './services/googleDrive';
import type {
  ActiveUser,
  HouseholdSettings,
  RecurringBill,
  Transaction,
  UserViewFilter,
  ViewTab,
} from './types/finance';
import {
  getBillDueDateInCycle,
  getCycleRangeFromSettings,
  getTodayIso,
  isDateInCycle,
} from './utils/cycle';
import {
  computeBillNotifications,
  sendBrowserBillNotification,
} from './utils/notifications';

const STORAGE_KEY = 'kh_household_finance_v1';
const SNOOZE_KEY = 'kh_household_snooze_date';
const BROWSER_NOTIFIED_KEY = 'kh_household_browser_notified_date';

interface StoredState {
  transactions: Transaction[];
  bills: RecurringBill[];
  settings: HouseholdSettings;
}

function normalizeSettings(partial?: Partial<HouseholdSettings>): HouseholdSettings {
  const p = partial || {};
  return {
    householdName:
      typeof p.householdName === 'string' ? p.householdName : DEFAULT_SETTINGS.householdName,
    husbandName:
      typeof p.husbandName === 'string' ? p.husbandName : DEFAULT_SETTINGS.husbandName,
    wifeName:
      typeof p.wifeName === 'string' ? p.wifeName : DEFAULT_SETTINGS.wifeName,
    activeUser: p.activeUser === 'wife' ? 'wife' : 'husband',
    cycleMode: p.cycleMode === 'custom_range' ? 'custom_range' : 'monthly_day',
    cycleStartDay:
      typeof p.cycleStartDay === 'number' && Number.isFinite(p.cycleStartDay)
        ? Math.max(1, Math.min(28, Math.floor(p.cycleStartDay)))
        : DEFAULT_SETTINGS.cycleStartDay,
    customStartDate:
      typeof p.customStartDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.customStartDate)
        ? p.customStartDate
        : DEFAULT_SETTINGS.customStartDate,
    customEndDate:
      typeof p.customEndDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.customEndDate)
        ? p.customEndDate
        : DEFAULT_SETTINGS.customEndDate,
    displayCurrency: p.displayCurrency === 'KHR' ? 'KHR' : 'USD',
    exchangeRate:
      typeof p.exchangeRate === 'number' && Number.isFinite(p.exchangeRate) && p.exchangeRate >= 1000
        ? p.exchangeRate
        : DEFAULT_SETTINGS.exchangeRate,
    monthlyBudgetTargetUsd:
      typeof p.monthlyBudgetTargetUsd === 'number' &&
      Number.isFinite(p.monthlyBudgetTargetUsd) &&
      p.monthlyBudgetTargetUsd >= 0
        ? p.monthlyBudgetTargetUsd
        : DEFAULT_SETTINGS.monthlyBudgetTargetUsd,
    notificationsEnabled:
      typeof p.notificationsEnabled === 'boolean'
        ? p.notificationsEnabled
        : DEFAULT_SETTINGS.notificationsEnabled,
    reminderDaysBefore:
      typeof p.reminderDaysBefore === 'number' && Number.isFinite(p.reminderDaysBefore)
        ? Math.max(1, Math.min(10, Math.floor(p.reminderDaysBefore)))
        : DEFAULT_SETTINGS.reminderDaysBefore,
    browserNotificationsEnabled:
      typeof p.browserNotificationsEnabled === 'boolean'
        ? p.browserNotificationsEnabled
        : DEFAULT_SETTINGS.browserNotificationsEnabled,
    categoryBudgets: {
      ...DEFAULT_SETTINGS.categoryBudgets,
      ...(p.categoryBudgets && typeof p.categoryBudgets === 'object' ? p.categoryBudgets : {}),
    },
  };
}

function normalizeTransactions(rawList: unknown[]): Transaction[] {
  const validPayment = new Set(['cash', 'aba', 'acleda', 'wing', 'other']);
  const validMembers = new Set(['joint', 'husband', 'wife', 'family']);
  const todayIso = getTodayIso();

  return rawList
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, idx) => {
      const amountUsd =
        typeof item.amountUsd === 'number' && Number.isFinite(item.amountUsd)
          ? Math.max(0, item.amountUsd)
          : 0;
      const originalCurrency = item.originalCurrency === 'KHR' ? 'KHR' : 'USD';
      const originalAmount =
        typeof item.originalAmount === 'number' && Number.isFinite(item.originalAmount)
          ? Math.max(0, item.originalAmount)
          : amountUsd;
      const dateStr =
        typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
          ? item.date
          : todayIso;

      return {
        id: typeof item.id === 'string' && item.id ? item.id : `tx-restored-${Date.now()}-${idx}`,
        type: item.type === 'income' ? 'income' : 'expense',
        amountUsd,
        originalAmount,
        originalCurrency,
        categoryId:
          typeof item.categoryId === 'string' && item.categoryId
            ? item.categoryId
            : item.type === 'income'
            ? 'other_inc'
            : 'other_exp',
        date: dateStr,
        paymentMethod:
          typeof item.paymentMethod === 'string' && validPayment.has(item.paymentMethod)
            ? (item.paymentMethod as Transaction['paymentMethod'])
            : 'cash',
        member:
          typeof item.member === 'string' && validMembers.has(item.member)
            ? (item.member as Transaction['member'])
            : 'joint',
        note: typeof item.note === 'string' ? item.note : '',
        billId: typeof item.billId === 'string' ? item.billId : undefined,
        createdAt:
          typeof item.createdAt === 'string' && item.createdAt
            ? item.createdAt
            : new Date().toISOString(),
      };
    });
}

function normalizeBills(rawList: unknown[]): RecurringBill[] {
  const validPayment = new Set(['cash', 'aba', 'acleda', 'wing', 'other']);

  return rawList
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, idx) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `bill-restored-${Date.now()}-${idx}`,
      title: typeof item.title === 'string' && item.title ? item.title : 'វិក្កយបត្រប្រចាំខែ',
      categoryId:
        typeof item.categoryId === 'string' && item.categoryId ? item.categoryId : 'utilities',
      amountUsd:
        typeof item.amountUsd === 'number' && Number.isFinite(item.amountUsd)
          ? Math.max(0, item.amountUsd)
          : 0,
      dueDay:
        typeof item.dueDay === 'number' && Number.isFinite(item.dueDay)
          ? Math.max(1, Math.min(28, Math.floor(item.dueDay)))
          : 1,
      paymentMethod:
        typeof item.paymentMethod === 'string' && validPayment.has(item.paymentMethod)
          ? (item.paymentMethod as RecurringBill['paymentMethod'])
          : 'aba',
      note: typeof item.note === 'string' ? item.note : undefined,
      paidCycles:
        item.paidCycles && typeof item.paidCycles === 'object' && !Array.isArray(item.paidCycles)
          ? (item.paidCycles as Record<string, string>)
          : {},
    }));
}

function loadInitialState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      if (
        Array.isArray(parsed.transactions) &&
        Array.isArray(parsed.bills) &&
        parsed.settings
      ) {
        return {
          transactions: normalizeTransactions(parsed.transactions),
          bills: normalizeBills(parsed.bills),
          settings: normalizeSettings(parsed.settings),
        };
      }
    }
  } catch {
    // Fallback to seed data if storage is unavailable or corrupted
  }

  const seed = createSeedData();
  return {
    transactions: seed.transactions,
    bills: seed.bills,
    settings: DEFAULT_SETTINGS,
  };
}

const TAB_TITLES: Record<ViewTab, string> = {
  overview: 'ទិដ្ឋភាពទូទៅ',
  ledger: 'កត់ត្រាចំណូលចំណាយ',
  analytics: 'វិភាគទិន្នន័យ',
  settings: 'ថវិកា និងថ្ងៃកំណត់',
};

export default function App() {
  const [initial] = useState<StoredState>(() => loadInitialState());
  const [transactions, setTransactions] = useState<Transaction[]>(initial.transactions);
  const [bills, setBills] = useState<RecurringBill[]>(initial.bills);
  const [settings, setSettings] = useState<HouseholdSettings>(initial.settings);

  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [cycleOffset, setCycleOffset] = useState<number>(0);
  const [userViewFilter, setUserViewFilter] = useState<UserViewFilter>('all');

  // Modals
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [snoozedDate, setSnoozedDate] = useState<string>(() => {
    try {
      return localStorage.getItem(SNOOZE_KEY) || '';
    } catch {
      return '';
    }
  });

  // Google Drive Auth & Sync State (token kept strictly in memory)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [hasDriveToken, setHasDriveToken] = useState(false);
  const [driveFile, setDriveFile] = useState<DriveFileMeta | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [driveSuccess, setDriveSuccess] = useState('');

  // Persist locally so offline/mobile usage is always instant
  useEffect(() => {
    try {
      const payload: StoredState = { transactions, bills, settings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [transactions, bills, settings]);

  const handleDriveError = useCallback((err: unknown, fallbackMsg: string) => {
    if (err instanceof DriveAuthError) {
      clearCachedAccessToken();
      setHasDriveToken(false);
      if (err.requiresConsent) {
        markNeedsConsentPrompt();
      }
    }
    setDriveError(err instanceof Error ? err.message : fallbackMsg);
  }, []);

  const refreshDriveFileMeta = useCallback(
    async (tokenOverride?: string): Promise<boolean> => {
      const token = tokenOverride || getCachedAccessToken();
      if (!token) {
        setHasDriveToken(false);
        return false;
      }
      setDriveBusy(true);
      setDriveError('');
      try {
        const found = await findDriveDataFile(token);
        setDriveFile(found);
        return true;
      } catch (err: unknown) {
        handleDriveError(err, 'មិនអាចពិនិត្យ Google Drive បានទេ។');
        return false;
      } finally {
        setDriveBusy(false);
      }
    },
    [handleDriveError]
  );

  // Initialize Firebase Auth listener for Google Drive
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setHasDriveToken(Boolean(token));
        void refreshDriveFileMeta(token);
      },
      (user) => {
        setGoogleUser(user);
        setHasDriveToken(false);
      }
    );
    return () => unsubscribe();
  }, [refreshDriveFileMeta]);

  const handleGoogleSignIn = async () => {
    setDriveBusy(true);
    setDriveError('');
    setDriveSuccess('');
    try {
      const result = await signInWithGoogleDrive();
      setGoogleUser(result.user);
      setHasDriveToken(true);
      const ok = await refreshDriveFileMeta(result.accessToken);
      if (ok) {
        setDriveSuccess('បានភ្ជាប់ Google Drive ដោយជោគជ័យ។');
      }
    } catch (err: unknown) {
      handleDriveError(err, 'ការចូលគណនី Google មិនបានជោគជ័យទេ។');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setDriveBusy(true);
    setDriveError('');
    setDriveSuccess('');
    try {
      await signOutGoogle();
      setGoogleUser(null);
      setHasDriveToken(false);
      setDriveFile(null);
    } finally {
      setDriveBusy(false);
    }
  };

  const handleConfirmSaveToDrive = async () => {
    const token = getCachedAccessToken();
    if (!token) {
      setHasDriveToken(false);
      setDriveError('សូមចូលគណនី Google ម្តងទៀតដើម្បីរក្សាទុក។');
      return;
    }
    setDriveBusy(true);
    setDriveError('');
    setDriveSuccess('');
    try {
      const payload: StoredState = { transactions, bills, settings };
      const saved = await saveDataToDrive(token, payload, driveFile?.id);
      setDriveFile(saved);
      setDriveSuccess('បានរក្សាទុកទិន្នន័យទៅក្នុង Google Drive ដោយជោគជ័យ។');
    } catch (err: unknown) {
      handleDriveError(err, 'មិនអាចរក្សាទុកទៅ Google Drive បានទេ។');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleConfirmLoadFromDrive = async () => {
    const token = getCachedAccessToken();
    if (!token || !driveFile) {
      setDriveError('មិនមានឯកសារ ឬសិទ្ធិចូលប្រើ Google Drive ទេ។');
      return;
    }
    setDriveBusy(true);
    setDriveError('');
    setDriveSuccess('');
    try {
      const loaded = await loadDataFromDrive<Partial<StoredState>>(token, driveFile.id);
      if (!Array.isArray(loaded.transactions) || !Array.isArray(loaded.bills)) {
        throw new Error('ទម្រង់ឯកសារនៅលើ Google Drive មិនត្រឹមត្រូវទេ។');
      }
      setTransactions(normalizeTransactions(loaded.transactions));
      setBills(normalizeBills(loaded.bills));
      if (loaded.settings) {
        setSettings(normalizeSettings(loaded.settings));
      }
      setCycleOffset(0);
      setDriveSuccess('បានទាញយកទិន្នន័យពី Google Drive មកប្រើដោយជោគជ័យ។');
    } catch (err: unknown) {
      handleDriveError(err, 'មិនអាចទាញយកទិន្នន័យពី Google Drive បានទេ។');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleConfirmDeleteDriveFile = async () => {
    const token = getCachedAccessToken();
    if (!token || !driveFile) return;
    setDriveBusy(true);
    setDriveError('');
    setDriveSuccess('');
    try {
      await deleteDriveDataFile(token, driveFile.id);
      setDriveFile(null);
      setDriveSuccess('បានលុបឯកសារបម្រុងទុកចេញពី Google Drive រួចរាល់។');
    } catch (err: unknown) {
      handleDriveError(err, 'មិនអាចលុបឯកសារពី Google Drive បានទេ។');
    } finally {
      setDriveBusy(false);
    }
  };

  const currentRealCycle = useMemo(
    () => getCycleRangeFromSettings(settings, 0),
    [settings]
  );

  const activeCycle = useMemo(
    () => getCycleRangeFromSettings(settings, cycleOffset),
    [settings, cycleOffset]
  );

  const previousCycle = useMemo(
    () => getCycleRangeFromSettings(settings, cycleOffset - 1),
    [settings, cycleOffset]
  );

  const billNotifications = useMemo(
    () =>
      settings.notificationsEnabled
        ? computeBillNotifications(bills, currentRealCycle, settings.reminderDaysBefore)
        : [],
    [bills, currentRealCycle, settings.notificationsEnabled, settings.reminderDaysBefore]
  );

  // Send at most one daily Browser Notification if the user opted in
  useEffect(() => {
    if (!settings.notificationsEnabled || !settings.browserNotificationsEnabled) return;
    if (billNotifications.length === 0) return;
    const todayIso = getTodayIso();
    try {
      if (localStorage.getItem(BROWSER_NOTIFIED_KEY) === todayIso) return;
      const sent = sendBrowserBillNotification(billNotifications, settings, false);
      if (sent) {
        localStorage.setItem(BROWSER_NOTIFIED_KEY, todayIso);
      }
    } catch {
      // Ignore storage/notification errors
    }
  }, [billNotifications, settings]);

  const showReminderBanner =
    settings.notificationsEnabled &&
    billNotifications.length > 0 &&
    snoozedDate !== getTodayIso();

  const handleSnoozeReminderBanner = () => {
    const todayIso = getTodayIso();
    setSnoozedDate(todayIso);
    try {
      localStorage.setItem(SNOOZE_KEY, todayIso);
    } catch {
      // Ignore
    }
  };

  const cycleTransactions = useMemo(
    () => transactions.filter((tx) => isDateInCycle(tx.date, activeCycle)),
    [transactions, activeCycle]
  );

  const previousCycleTransactions = useMemo(
    () => transactions.filter((tx) => isDateInCycle(tx.date, previousCycle)),
    [transactions, previousCycle]
  );

  const filteredOverviewTransactions = useMemo(() => {
    if (userViewFilter === 'all') return cycleTransactions;
    return cycleTransactions.filter((tx) => tx.member === userViewFilter);
  }, [cycleTransactions, userViewFilter]);

  const filteredPreviousOverviewTransactions = useMemo(() => {
    if (userViewFilter === 'all') return previousCycleTransactions;
    return previousCycleTransactions.filter((tx) => tx.member === userViewFilter);
  }, [previousCycleTransactions, userViewFilter]);

  const handleActiveUserChange = (user: ActiveUser) => {
    handleUpdateSettings({ activeUser: user });
  };

  const handleUpdateSettings = (patch: Partial<HouseholdSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    if (
      patch.cycleMode !== undefined ||
      patch.cycleStartDay !== undefined ||
      patch.customStartDate !== undefined ||
      patch.customEndDate !== undefined
    ) {
      setCycleOffset(0);
    }
  };

  const handleSaveTransaction = (
    data: Omit<Transaction, 'id' | 'createdAt'>,
    editId?: string
  ) => {
    if (editId) {
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === editId ? { ...tx, ...data } : tx))
      );
    } else {
      const newTx: Transaction = {
        ...data,
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [newTx, ...prev]);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    setBills((prev) =>
      prev.map((bill) => {
        const nextPaid = { ...bill.paidCycles };
        let changed = false;
        for (const [k, txId] of Object.entries(nextPaid)) {
          if (txId === id) {
            delete nextPaid[k];
            changed = true;
          }
        }
        return changed ? { ...bill, paidCycles: nextPaid } : bill;
      })
    );
  };

  const handleSaveBill = (
    data: Omit<RecurringBill, 'id' | 'paidCycles'>,
    editId?: string
  ) => {
    if (editId) {
      setBills((prev) =>
        prev.map((b) => (b.id === editId ? { ...b, ...data } : b))
      );
    } else {
      const newBill: RecurringBill = {
        ...data,
        id: `bill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        paidCycles: {},
      };
      setBills((prev) => [...prev, newBill]);
    }
  };

  const handleDeleteBill = (id: string) => {
    setBills((prev) => prev.filter((b) => b.id !== id));
  };

  const payBillForCycle = (bill: RecurringBill, targetCycle: typeof activeCycle) => {
    if (bill.paidCycles[targetCycle.key]) return;
    const todayIso = getTodayIso();
    const dueDateInCycle = getBillDueDateInCycle(bill.dueDay, targetCycle);
    const txDate = isDateInCycle(todayIso, targetCycle) ? todayIso : dueDateInCycle;

    const txId = `tx-bill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTx: Transaction = {
      id: txId,
      type: 'expense',
      amountUsd: bill.amountUsd,
      originalAmount: bill.amountUsd,
      originalCurrency: 'USD',
      categoryId: bill.categoryId,
      date: txDate,
      paymentMethod: bill.paymentMethod,
      member: 'joint',
      note: bill.title,
      billId: bill.id,
      createdAt: new Date().toISOString(),
    };

    setTransactions((prev) => [newTx, ...prev]);
    setBills((prev) =>
      prev.map((b) =>
        b.id === bill.id
          ? { ...b, paidCycles: { ...b.paidCycles, [targetCycle.key]: txId } }
          : b
      )
    );
  };

  const handlePayBill = (bill: RecurringBill) => {
    payBillForCycle(bill, activeCycle);
  };

  const handlePayBillInCurrentCycle = (bill: RecurringBill) => {
    payBillForCycle(bill, currentRealCycle);
  };

  const handleExportBackup = () => {
    const payload: StoredState = { transactions, bills, settings };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `household-finance-backup-${getTodayIso()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImportBackup = (jsonText: string): string | null => {
    try {
      const parsed = JSON.parse(jsonText) as Partial<StoredState>;
      if (!Array.isArray(parsed.transactions) || !Array.isArray(parsed.bills)) {
        return 'ឯកសារ JSON មិនត្រឹមត្រូវតាមទម្រង់ប្រព័ន្ធទេ។';
      }
      setTransactions(normalizeTransactions(parsed.transactions));
      setBills(normalizeBills(parsed.bills));
      if (parsed.settings) {
        setSettings(normalizeSettings(parsed.settings));
      }
      setCycleOffset(0);
      return null;
    } catch {
      return 'មិនអាចអានឯកសារ JSON បានទេ សូមពិនិត្យម្តងទៀត។';
    }
  };

  const handleResetSampleData = () => {
    const seed = createSeedData();
    setTransactions(seed.transactions);
    setBills(seed.bills);
    setSettings(DEFAULT_SETTINGS);
    setCycleOffset(0);
  };

  const handleClearAllTransactions = () => {
    setTransactions([]);
    setBills((prev) => prev.map((b) => ({ ...b, paidCycles: {} })));
    setCycleOffset(0);
  };

  const toggleCurrency = () => {
    handleUpdateSettings({
      displayCurrency: settings.displayCurrency === 'USD' ? 'KHR' : 'USD',
    });
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        settings={settings}
        activeCycle={activeCycle}
        onActiveUserChange={handleActiveUserChange}
        onCurrencyChange={(c) => handleUpdateSettings({ displayCurrency: c })}
        googleUser={googleUser}
        hasDriveToken={hasDriveToken}
        onOpenDriveModal={() => {
          setDriveError('');
          setDriveSuccess('');
          setDriveModalOpen(true);
        }}
        reminderCount={billNotifications.length}
        onOpenNotifications={() => setNotificationsModalOpen(true)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Compact Mobile Top Bar (52px) + Crisp Desktop Header (64px) */}
        <header className="sticky top-0 z-30 h-[52px] lg:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="hidden lg:inline text-slate-400 whitespace-nowrap">
              {settings.householdName}
            </span>
            <span className="hidden lg:inline text-slate-300" aria-hidden="true">
              /
            </span>
            <h1 className="text-base lg:text-sm font-bold lg:font-semibold text-slate-900 truncate">
              {TAB_TITLES[activeTab]}
            </h1>
          </div>

          {/* Mobile Compact Actions: Currency Toggle + Notifications Bell + Google Drive */}
          <div className="flex lg:hidden items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleCurrency}
              className="min-h-[40px] px-2.5 text-xs font-semibold num-tabular text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap"
              aria-label="ប្តូររូបិយប័ណ្ណ"
            >
              {settings.displayCurrency === 'USD' ? '$' : '៛'}
            </button>
            <button
              type="button"
              onClick={() => setNotificationsModalOpen(true)}
              className={`min-h-[40px] min-w-[40px] px-2 flex items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                billNotifications.length > 0
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
              aria-label="ការជូនដំណឹងវិក្កយបត្រ"
            >
              <Bell className="w-4 h-4 shrink-0" />
              {billNotifications.length > 0 && (
                <span className="num-tabular text-xs">{billNotifications.length}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setDriveError('');
                setDriveSuccess('');
                setDriveModalOpen(true);
              }}
              className={`min-h-[40px] min-w-[40px] px-2.5 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap ${
                hasDriveToken
                  ? 'border-teal-200 bg-teal-50 text-teal-800'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
              aria-label="Google Drive"
            >
              <Cloud className="w-4 h-4 shrink-0" />
            </button>
          </div>

          {/* Desktop Primary Action CTA */}
          <button
            type="button"
            onClick={() => {
              setEditingTx(null);
              setTxModalOpen(true);
            }}
            className="hidden lg:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>កត់ត្រាថ្មី</span>
          </button>
        </header>

        {/* Main Workspace Canvas (extra bottom padding on mobile for fixed bottom tab bar) */}
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-8">
          {activeTab === 'overview' && (
            <OverviewView
              activeCycle={activeCycle}
              previousCycle={previousCycle}
              cycleTransactions={filteredOverviewTransactions}
              previousCycleTransactions={filteredPreviousOverviewTransactions}
              allCycleTransactionsUnfiltered={cycleTransactions}
              categories={DEFAULT_CATEGORIES}
              bills={bills}
              billNotifications={billNotifications}
              showReminderBanner={showReminderBanner}
              settings={settings}
              userViewFilter={userViewFilter}
              onUserViewFilterChange={setUserViewFilter}
              onActiveUserChange={handleActiveUserChange}
              onShiftCycle={(delta) => setCycleOffset((o) => o + delta)}
              onResetCurrentCycle={() => setCycleOffset(0)}
              onOpenPeriodModal={() => setPeriodModalOpen(true)}
              onOpenNotifications={() => setNotificationsModalOpen(true)}
              onSnoozeReminderBanner={handleSnoozeReminderBanner}
              onOpenNewTx={() => {
                setEditingTx(null);
                setTxModalOpen(true);
              }}
              onEditTx={(tx) => {
                setEditingTx(tx);
                setTxModalOpen(true);
              }}
              onPayBill={handlePayBill}
              onPayBillInCurrentCycle={handlePayBillInCurrentCycle}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'ledger' && (
            <LedgerView
              allTransactions={transactions}
              activeCycle={activeCycle}
              categories={DEFAULT_CATEGORIES}
              settings={settings}
              onOpenPeriodModal={() => setPeriodModalOpen(true)}
              onOpenNewTx={() => {
                setEditingTx(null);
                setTxModalOpen(true);
              }}
              onEditTx={(tx) => {
                setEditingTx(tx);
                setTxModalOpen(true);
              }}
              onDeleteTx={handleDeleteTransaction}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              allTransactions={transactions}
              activeCycle={activeCycle}
              previousCycle={previousCycle}
              cycleOffset={cycleOffset}
              categories={DEFAULT_CATEGORIES}
              settings={settings}
            />
          )}

          {activeTab === 'settings' && (
            <BudgetsCycleView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              activeCycle={activeCycle}
              cycleTransactions={cycleTransactions}
              categories={DEFAULT_CATEGORIES}
              bills={bills}
              googleUser={googleUser}
              hasDriveToken={hasDriveToken}
              driveFile={driveFile}
              driveBusy={driveBusy}
              driveError={driveError}
              driveSuccess={driveSuccess}
              onSignInGoogle={handleGoogleSignIn}
              onOpenDriveModal={() => {
                setDriveSuccess('');
                setDriveModalOpen(true);
              }}
              reminderCount={billNotifications.length}
              onOpenNotifications={() => setNotificationsModalOpen(true)}
              onAddBill={() => {
                setEditingBill(null);
                setBillModalOpen(true);
              }}
              onEditBill={(bill) => {
                setEditingBill(bill);
                setBillModalOpen(true);
              }}
              onDeleteBill={handleDeleteBill}
              onPayBill={handlePayBill}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              onResetSampleData={handleResetSampleData}
              onClearAllTransactions={handleClearAllTransactions}
            />
          )}
        </main>
      </div>

      {/* Fixed Ergonomic Mobile Bottom Tab Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewTx={() => {
          setEditingTx(null);
          setTxModalOpen(true);
        }}
      />

      {/* Modals & Mobile Bottom Sheets */}
      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => {
          setTxModalOpen(false);
          setEditingTx(null);
        }}
        onSave={handleSaveTransaction}
        editingTransaction={editingTx}
        categories={DEFAULT_CATEGORIES}
        defaultCurrency={settings.displayCurrency}
        exchangeRate={settings.exchangeRate}
        activeUser={settings.activeUser}
        husbandName={settings.husbandName}
        wifeName={settings.wifeName}
      />

      <BillModal
        isOpen={billModalOpen}
        onClose={() => {
          setBillModalOpen(false);
          setEditingBill(null);
        }}
        onSave={handleSaveBill}
        editingBill={editingBill}
        categories={DEFAULT_CATEGORIES}
      />

      <PeriodModal
        isOpen={periodModalOpen}
        onClose={() => setPeriodModalOpen(false)}
        settings={settings}
        onApply={handleUpdateSettings}
      />

      <DriveModal
        isOpen={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        googleUser={googleUser}
        hasDriveToken={hasDriveToken}
        driveFile={driveFile}
        isBusy={driveBusy}
        errorMsg={driveError}
        successMsg={driveSuccess}
        localTxCount={transactions.length}
        localBillCount={bills.length}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleGoogleSignOut}
        onRefreshFile={async () => {
          await refreshDriveFileMeta();
        }}
        onConfirmSaveToDrive={handleConfirmSaveToDrive}
        onConfirmLoadFromDrive={handleConfirmLoadFromDrive}
        onConfirmDeleteDriveFile={handleConfirmDeleteDriveFile}
      />

      <NotificationsModal
        isOpen={notificationsModalOpen}
        onClose={() => setNotificationsModalOpen(false)}
        notifications={billNotifications}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onPayBillInCurrentCycle={handlePayBillInCurrentCycle}
        onManageBills={() => setActiveTab('settings')}
      />
    </div>
  );
}
