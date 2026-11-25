import type { User } from 'firebase/auth';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_SETTINGS } from '../data/defaults';
import type {
  HouseholdSettings,
  RecurringBill,
  Transaction,
} from '../types/finance';
import { getTodayIso } from '../utils/cycle';
import {
  getFirebaseDbSafe,
  handleFirestoreError,
  OperationType,
} from './firebase';

export interface CloudHouseholdMeta {
  householdId: string;
  ownerId: string;
  memberIds: string[];
  inviteCode: string;
  settings: HouseholdSettings;
}

const VALID_PAYMENT = new Set(['cash', 'aba', 'acleda', 'wing', 'other']);
const VALID_MEMBER = new Set(['joint', 'husband', 'wife', 'family']);
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeId(raw: string, prefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  if (cleaned && SAFE_ID_RE.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function sanitizeSettingsForFirestore(settings: HouseholdSettings) {
  const budgets: Record<string, number> = {};
  for (const [k, v] of Object.entries(settings.categoryBudgets || {}).slice(0, 45)) {
    if (SAFE_ID_RE.test(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      budgets[k] = Number(v.toFixed(2));
    }
  }

  return {
    householdName: (settings.householdName || DEFAULT_SETTINGS.householdName).trim().slice(0, 100) || 'គ្រួសារយើង',
    husbandName: (settings.husbandName || DEFAULT_SETTINGS.husbandName).trim().slice(0, 60) || 'ប្តី',
    wifeName: (settings.wifeName || DEFAULT_SETTINGS.wifeName).trim().slice(0, 60) || 'ប្រពន្ធ',
    activeUser: settings.activeUser === 'wife' ? 'wife' : 'husband',
    cycleMode: settings.cycleMode === 'custom_range' ? 'custom_range' : 'monthly_day',
    cycleStartDay: Math.max(1, Math.min(28, Math.floor(settings.cycleStartDay || 1))),
    customStartDate: DATE_RE.test(settings.customStartDate)
      ? settings.customStartDate
      : DEFAULT_SETTINGS.customStartDate,
    customEndDate: DATE_RE.test(settings.customEndDate)
      ? settings.customEndDate
      : DEFAULT_SETTINGS.customEndDate,
    displayCurrency: settings.displayCurrency === 'KHR' ? 'KHR' : 'USD',
    exchangeRate: Math.max(
      1000,
      Math.min(100000, Number.isFinite(settings.exchangeRate) ? settings.exchangeRate : 4050)
    ),
    monthlyBudgetTargetUsd: Math.max(
      0,
      Math.min(
        10000000,
        Number.isFinite(settings.monthlyBudgetTargetUsd) ? settings.monthlyBudgetTargetUsd : 0
      )
    ),
    notificationsEnabled: Boolean(settings.notificationsEnabled),
    reminderDaysBefore: Math.max(1, Math.min(10, Math.floor(settings.reminderDaysBefore || 5))),
    browserNotificationsEnabled: Boolean(settings.browserNotificationsEnabled),
    categoryBudgets: budgets,
  };
}

function buildTransactionPayload(
  tx: Transaction,
  householdId: string,
  authorId: string,
  memberIds: string[],
  isCreate: boolean
) {
  const safeId = sanitizeId(tx.id, 'tx');
  const safeCat = sanitizeId(tx.categoryId || (tx.type === 'income' ? 'other_inc' : 'other_exp'), 'cat').slice(0, 50);
  const amountUsd = Math.max(0, Math.min(100000000, Number.isFinite(tx.amountUsd) ? Number(tx.amountUsd.toFixed(2)) : 0));
  const originalAmount = Math.max(
    0,
    Math.min(1000000000000, Number.isFinite(tx.originalAmount) ? Number(tx.originalAmount.toFixed(2)) : amountUsd)
  );

  const base: Record<string, unknown> = {
    type: tx.type === 'income' ? 'income' : 'expense',
    amountUsd,
    originalAmount,
    originalCurrency: tx.originalCurrency === 'KHR' ? 'KHR' : 'USD',
    categoryId: safeCat,
    date: DATE_RE.test(tx.date) ? tx.date : getTodayIso(),
    paymentMethod: VALID_PAYMENT.has(tx.paymentMethod) ? tx.paymentMethod : 'cash',
    member: VALID_MEMBER.has(tx.member) ? tx.member : 'joint',
    note: (tx.note || '').slice(0, 300),
    updatedAt: serverTimestamp(),
  };

  if (tx.billId && SAFE_ID_RE.test(tx.billId)) {
    base.billId = tx.billId.slice(0, 128);
  }

  if (isCreate) {
    base.id = safeId;
    base.householdId = householdId;
    base.authorId = authorId;
    base.memberIds = memberIds.slice(0, 5);
    base.createdAt = serverTimestamp();
  }

  return { safeId, payload: base };
}

function buildBillPayload(
  bill: RecurringBill,
  householdId: string,
  authorId: string,
  memberIds: string[],
  isCreate: boolean
) {
  const safeId = sanitizeId(bill.id, 'bill');
  const safeCat = sanitizeId(bill.categoryId || 'utilities', 'cat').slice(0, 50);
  const paidCycles: Record<string, string> = {};
  for (const [k, v] of Object.entries(bill.paidCycles || {}).slice(0, 220)) {
    if (typeof k === 'string' && typeof v === 'string') {
      paidCycles[k] = v;
    }
  }

  const base: Record<string, unknown> = {
    title: (bill.title || 'វិក្កយបត្រប្រចាំខែ').trim().slice(0, 120) || 'វិក្កយបត្រប្រចាំខែ',
    categoryId: safeCat,
    amountUsd: Math.max(0, Math.min(100000000, Number.isFinite(bill.amountUsd) ? Number(bill.amountUsd.toFixed(2)) : 0)),
    dueDay: Math.max(1, Math.min(28, Math.floor(bill.dueDay || 1))),
    paymentMethod: VALID_PAYMENT.has(bill.paymentMethod) ? bill.paymentMethod : 'aba',
    note: (bill.note || '').slice(0, 300),
    paidCycles,
    updatedAt: serverTimestamp(),
  };

  if (isCreate) {
    base.id = safeId;
    base.householdId = householdId;
    base.authorId = authorId;
    base.memberIds = memberIds.slice(0, 5);
    base.createdAt = serverTimestamp();
  }

  return { safeId, payload: base };
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val) {
    return val;
  }
  return new Date().toISOString();
}

function mapDocToHouseholdMeta(
  householdId: string,
  data: Record<string, unknown>
): CloudHouseholdMeta {
  const settings: HouseholdSettings = {
    householdName:
      typeof data.householdName === 'string' && data.householdName
        ? data.householdName
        : DEFAULT_SETTINGS.householdName,
    husbandName:
      typeof data.husbandName === 'string' && data.husbandName
        ? data.husbandName
        : DEFAULT_SETTINGS.husbandName,
    wifeName:
      typeof data.wifeName === 'string' && data.wifeName
        ? data.wifeName
        : DEFAULT_SETTINGS.wifeName,
    activeUser: data.activeUser === 'wife' ? 'wife' : 'husband',
    cycleMode: data.cycleMode === 'custom_range' ? 'custom_range' : 'monthly_day',
    cycleStartDay:
      typeof data.cycleStartDay === 'number'
        ? Math.max(1, Math.min(28, Math.floor(data.cycleStartDay)))
        : DEFAULT_SETTINGS.cycleStartDay,
    customStartDate:
      typeof data.customStartDate === 'string' && DATE_RE.test(data.customStartDate)
        ? data.customStartDate
        : DEFAULT_SETTINGS.customStartDate,
    customEndDate:
      typeof data.customEndDate === 'string' && DATE_RE.test(data.customEndDate)
        ? data.customEndDate
        : DEFAULT_SETTINGS.customEndDate,
    displayCurrency: data.displayCurrency === 'KHR' ? 'KHR' : 'USD',
    exchangeRate:
      typeof data.exchangeRate === 'number' && data.exchangeRate >= 1000
        ? data.exchangeRate
        : DEFAULT_SETTINGS.exchangeRate,
    monthlyBudgetTargetUsd:
      typeof data.monthlyBudgetTargetUsd === 'number' && data.monthlyBudgetTargetUsd >= 0
        ? data.monthlyBudgetTargetUsd
        : DEFAULT_SETTINGS.monthlyBudgetTargetUsd,
    notificationsEnabled:
      typeof data.notificationsEnabled === 'boolean'
        ? data.notificationsEnabled
        : DEFAULT_SETTINGS.notificationsEnabled,
    reminderDaysBefore:
      typeof data.reminderDaysBefore === 'number'
        ? Math.max(1, Math.min(10, Math.floor(data.reminderDaysBefore)))
        : DEFAULT_SETTINGS.reminderDaysBefore,
    browserNotificationsEnabled:
      typeof data.browserNotificationsEnabled === 'boolean'
        ? data.browserNotificationsEnabled
        : DEFAULT_SETTINGS.browserNotificationsEnabled,
    categoryBudgets:
      data.categoryBudgets && typeof data.categoryBudgets === 'object'
        ? {
            ...DEFAULT_SETTINGS.categoryBudgets,
            ...(data.categoryBudgets as Record<string, number>),
          }
        : DEFAULT_SETTINGS.categoryBudgets,
  };

  return {
    householdId,
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
    memberIds: Array.isArray(data.memberIds)
      ? data.memberIds.filter((x): x is string => typeof x === 'string')
      : [],
    inviteCode: typeof data.inviteCode === 'string' ? data.inviteCode : '',
    settings,
  };
}

function mapDocToTransaction(id: string, data: Record<string, unknown>): Transaction {
  return {
    id: typeof data.id === 'string' && data.id ? data.id : id,
    type: data.type === 'income' ? 'income' : 'expense',
    amountUsd: typeof data.amountUsd === 'number' ? data.amountUsd : 0,
    originalAmount:
      typeof data.originalAmount === 'number'
        ? data.originalAmount
        : typeof data.amountUsd === 'number'
        ? data.amountUsd
        : 0,
    originalCurrency: data.originalCurrency === 'KHR' ? 'KHR' : 'USD',
    categoryId: typeof data.categoryId === 'string' ? data.categoryId : 'other_exp',
    date: typeof data.date === 'string' && DATE_RE.test(data.date) ? data.date : getTodayIso(),
    paymentMethod:
      typeof data.paymentMethod === 'string' && VALID_PAYMENT.has(data.paymentMethod)
        ? (data.paymentMethod as Transaction['paymentMethod'])
        : 'cash',
    member:
      typeof data.member === 'string' && VALID_MEMBER.has(data.member)
        ? (data.member as Transaction['member'])
        : 'joint',
    note: typeof data.note === 'string' ? data.note : '',
    billId: typeof data.billId === 'string' && data.billId ? data.billId : undefined,
    createdAt: timestampToIso(data.createdAt),
  };
}

function mapDocToBill(id: string, data: Record<string, unknown>): RecurringBill {
  return {
    id: typeof data.id === 'string' && data.id ? data.id : id,
    title: typeof data.title === 'string' ? data.title : 'វិក្កយបត្រប្រចាំខែ',
    categoryId: typeof data.categoryId === 'string' ? data.categoryId : 'utilities',
    amountUsd: typeof data.amountUsd === 'number' ? data.amountUsd : 0,
    dueDay: typeof data.dueDay === 'number' ? data.dueDay : 1,
    paymentMethod:
      typeof data.paymentMethod === 'string' && VALID_PAYMENT.has(data.paymentMethod)
        ? (data.paymentMethod as RecurringBill['paymentMethod'])
        : 'aba',
    note: typeof data.note === 'string' && data.note ? data.note : undefined,
    paidCycles:
      data.paidCycles && typeof data.paidCycles === 'object'
        ? (data.paidCycles as Record<string, string>)
        : {},
  };
}

async function commitBatchedWrites(
  ops: Array<(batch: ReturnType<typeof writeBatch>) => void>
): Promise<void> {
  const db = getFirebaseDbSafe();
  if (!db) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + CHUNK_SIZE)) {
      op(batch);
    }
    await batch.commit();
  }
}

/**
 * Ensures the signed-in user has an active shared household in Firestore.
 * - Existing user (on any device): returns their existing activeHouseholdId immediately.
 * - New user: atomically creates household + owner membership + invite code + workspace pointer,
 *   then uploads any current local transactions & bills so nothing is lost.
 */
export async function ensureUserHousehold(
  user: User,
  initialLocal: {
    transactions: Transaction[];
    bills: RecurringBill[];
    settings: HouseholdSettings;
  }
): Promise<string> {
  const db = getFirebaseDbSafe();
  if (!db) {
    throw new Error('មិនអាចភ្ជាប់ទៅមូលដ្ឋានទិន្នន័យ Cloud បានទេ។');
  }

  const userPath = `users/${user.uid}`;
  let existingHouseholdId: string | null = null;
  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (typeof data.activeHouseholdId === 'string' && data.activeHouseholdId) {
        existingHouseholdId = data.activeHouseholdId;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  if (existingHouseholdId) {
    return existingHouseholdId;
  }

  const householdId = sanitizeId(`hh_${user.uid}`, 'hh');
  const inviteCode = generateInviteCode();
  const safeSettings = sanitizeSettingsForFirestore(initialLocal.settings);

  // Atomic Batch 1: Create household + owner member + invite lookup + user workspace
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'households', householdId), {
      ownerId: user.uid,
      memberIds: [user.uid],
      inviteCode,
      ...safeSettings,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'households', householdId, 'members', user.uid), {
      uid: user.uid,
      householdId,
      role: 'owner',
      inviteCode,
      joinedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'householdInvites', inviteCode), {
      inviteCode,
      householdId,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', user.uid), {
      uid: user.uid,
      activeHouseholdId: householdId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `households/${householdId}`);
  }

  // Batch 2: Seed initial local transactions & bills into the newly created cloud household
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  for (const tx of initialLocal.transactions) {
    const { safeId, payload } = buildTransactionPayload(
      tx,
      householdId,
      user.uid,
      [user.uid],
      true
    );
    ops.push((b) =>
      b.set(doc(db, 'households', householdId, 'transactions', safeId), payload)
    );
  }
  for (const bill of initialLocal.bills) {
    const { safeId, payload } = buildBillPayload(
      bill,
      householdId,
      user.uid,
      [user.uid],
      true
    );
    ops.push((b) =>
      b.set(doc(db, 'households', householdId, 'bills', safeId), payload)
    );
  }

  if (ops.length > 0) {
    try {
      await commitBatchedWrites(ops);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `households/${householdId}`);
    }
  }

  return householdId;
}

/**
 * Joins an existing shared household using the spouse's 8-character invite code.
 */
export async function joinHouseholdByInviteCode(
  user: User,
  rawCode: string
): Promise<string> {
  const db = getFirebaseDbSafe();
  if (!db) {
    throw new Error('មិនអាចភ្ជាប់ទៅមូលដ្ឋានទិន្នន័យ Cloud បានទេ។');
  }

  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 6 || code.length > 12) {
    throw new Error('លេខកូដគ្រួសារមិនត្រឹមត្រូវទេ (ត្រូវមាន ៦ ដល់ ១២ តួអក្សរ/លេខ)។');
  }

  const invitePath = `householdInvites/${code}`;
  let targetHouseholdId = '';
  try {
    const inviteSnap = await getDoc(doc(db, 'householdInvites', code));
    if (!inviteSnap.exists()) {
      throw new Error('រកមិនឃើញលេខកូដគ្រួសារនេះទេ។ សូមពិនិត្យម្តងទៀត។');
    }
    const data = inviteSnap.data();
    targetHouseholdId = typeof data.householdId === 'string' ? data.householdId : '';
  } catch (err) {
    if (err instanceof Error && err.message.includes('រកមិនឃើញ')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.GET, invitePath);
  }

  if (!targetHouseholdId) {
    throw new Error('លេខកូដគ្រួសារមិនមានទិន្នន័យត្រឹមត្រូវទេ។');
  }

  // Check if already a member
  const memberRef = doc(db, 'households', targetHouseholdId, 'members', user.uid);
  let alreadyMember = false;
  try {
    const memberSnap = await getDoc(memberRef);
    alreadyMember = memberSnap.exists();
  } catch {
    alreadyMember = false;
  }

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (alreadyMember) {
    try {
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          activeHouseholdId: targetHouseholdId,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, {
          uid: user.uid,
          activeHouseholdId: targetHouseholdId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      return targetHouseholdId;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  }

  // Use arrayUnion(user.uid) to add self to memberIds atomically with member doc creation
  try {
    const batch = writeBatch(db);
    batch.set(memberRef, {
      uid: user.uid,
      householdId: targetHouseholdId,
      role: 'member',
      inviteCode: code,
      joinedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'households', targetHouseholdId), {
      memberIds: arrayUnion(user.uid),
      updatedAt: serverTimestamp(),
    });
    if (userSnap.exists()) {
      batch.update(userRef, {
        activeHouseholdId: targetHouseholdId,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(userRef, {
        uid: user.uid,
        activeHouseholdId: targetHouseholdId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `households/${targetHouseholdId}`
    );
  }

  return targetHouseholdId;
}

/**
 * Backfills memberIds on existing transactions & bills when a new spouse joins the household
 * so the spouse immediately sees full household history on their device.
 */
async function syncSubcollectionMemberIds(
  householdId: string,
  uid: string,
  targetMemberIds: string[]
): Promise<void> {
  const db = getFirebaseDbSafe();
  if (!db || targetMemberIds.length <= 1) return;

  const targetSorted = [...targetMemberIds].sort().join(',');
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  for (const sub of ['transactions', 'bills'] as const) {
    const q = query(
      collection(db, 'households', householdId, sub),
      where('memberIds', 'array-contains', uid)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data();
      const docMembers = Array.isArray(data.memberIds)
        ? [...data.memberIds].sort().join(',')
        : '';
      if (docMembers !== targetSorted) {
        ops.push((b) =>
          b.update(d.ref, {
            memberIds: targetMemberIds.slice(0, 5),
            updatedAt: serverTimestamp(),
          })
        );
      }
    }
  }

  if (ops.length > 0) {
    await commitBatchedWrites(ops);
  }
}

export function subscribeHousehold(
  householdId: string,
  uid: string,
  callbacks: {
    onHouseholdMeta: (meta: CloudHouseholdMeta) => void;
    onTransactions: (txs: Transaction[]) => void;
    onBills: (bills: RecurringBill[]) => void;
    onError: (err: Error) => void;
  }
): Unsubscribe {
  const db = getFirebaseDbSafe();
  if (!db) {
    return () => {};
  }

  const unsubs: Unsubscribe[] = [];

  const hhPath = `households/${householdId}`;
  unsubs.push(
    onSnapshot(
      doc(db, 'households', householdId),
      (snap) => {
        if (!snap.exists()) return;
        const meta = mapDocToHouseholdMeta(householdId, snap.data() as Record<string, unknown>);
        callbacks.onHouseholdMeta(meta);
        if (meta.memberIds.length > 1) {
          void syncSubcollectionMemberIds(householdId, uid, meta.memberIds).catch(() => {
            // Non-fatal background sync for newly joined members
          });
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, hhPath);
        } catch (wrapped) {
          callbacks.onError(wrapped as Error);
        }
      }
    )
  );

  const txPath = `households/${householdId}/transactions`;
  const txQuery = query(
    collection(db, 'households', householdId, 'transactions'),
    where('memberIds', 'array-contains', uid)
  );
  unsubs.push(
    onSnapshot(
      txQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => mapDocToTransaction(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => (b.date !== a.date ? b.date.localeCompare(a.date) : b.createdAt.localeCompare(a.createdAt)));
        callbacks.onTransactions(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, txPath);
        } catch (wrapped) {
          callbacks.onError(wrapped as Error);
        }
      }
    )
  );

  const billsPath = `households/${householdId}/bills`;
  const billsQuery = query(
    collection(db, 'households', householdId, 'bills'),
    where('memberIds', 'array-contains', uid)
  );
  unsubs.push(
    onSnapshot(
      billsQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => mapDocToBill(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => a.dueDay - b.dueDay);
        callbacks.onBills(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, billsPath);
        } catch (wrapped) {
          callbacks.onError(wrapped as Error);
        }
      }
    )
  );

  return () => {
    for (const u of unsubs) {
      u();
    }
  };
}

export async function updateHouseholdSettingsInCloud(
  householdId: string,
  settings: HouseholdSettings
): Promise<void> {
  const db = getFirebaseDbSafe();
  if (!db) return;
  const path = `households/${householdId}`;
  try {
    await updateDoc(doc(db, 'households', householdId), {
      ...sanitizeSettingsForFirestore(settings),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createTransactionInCloud(
  householdId: string,
  authorId: string,
  memberIds: string[],
  tx: Transaction
): Promise<void> {
  const db = getFirebaseDbSafe();
  if (!db) return;
  const { safeId, payload } = buildTransactionPayload(
    tx,
    householdId,
    authorId,
    memberIds,
    true
  );
  const path = `households/${householdId}/transactions/${safeId}`;
  try {
    await setDoc(doc(db, 'households', householdId, 'transactions', safeId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateTransactionInCloud(
  householdId: string,
  tx: Transaction
): Promise<void> {
  const db = getFirebaseDbSafe();
  if (!db) return;
  const { safeId, payload } = buildTransactionPayload(tx, householdId, '', [], false);
  const path = `households/${householdId}/transactions/${safeId}`;
  try {
    await updateDoc(doc(db, 'households', householdId, 'transactions', safeId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteTransactionFromCloud(
  householdId: string,
  txId: string
): Promise<void> {
  const db = getFirebaseDbSafe();
  if (!db) return;
  const path = `households/${householdId}/transactions/${txId}`;
  try {
    await deleteDoc(doc(db, 'households', householdId, 'transactions', txId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function createBillInCloud(
  householdId: string,
  authorId: string,
  memberIds: string[],
  bill: RecurringBill
): Promise<void> {
  const db = getFirebaseDbSafe();
  if (!db) return;
  const { safeId, payload } = buildBillPayload(
    bill,
    householdId,
    authorId,
    memberIds,
    true
  );
  const path = `households/${householdId}/bills/${safeId}`;
  try {
    await setDoc(doc(db, 'households', householdId, 'bills', safeId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateBillInCloud(
  householdId: string,
  bill: RecurringBill
): Promise<void> {
  const db = getFirebaseDbSafe();
  if (!db) return;
  const { safeId, payload } = buildBillPayload(bill, householdId, '', [], false);
  const path = `households/${householdId}/bills/${safeId}`;
  try {
    await updateDoc(doc(db, 'households', householdId, 'bills', safeId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteBillFromCloud(
  householdId: string,
  billId: string
): Promise<void> {
  const db = getFirebaseDbSafe();
  if (!db) return;
  const path = `households/${householdId}/bills/${billId}`;
  try {
    await deleteDoc(doc(db, 'households', householdId, 'bills', billId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function replaceAllHouseholdDataInCloud(
  householdId: string,
  authorId: string,
  memberIds: string[],
  next: {
    transactions: Transaction[];
    bills: RecurringBill[];
    settings: HouseholdSettings;
  }
): Promise<void> {
  const db = getFirebaseDbSafe();
  if (!db) return;

  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  // Delete existing cloud transactions and bills belonging to this member query
  try {
    const existingTxSnap = await getDocs(
      query(
        collection(db, 'households', householdId, 'transactions'),
        where('memberIds', 'array-contains', authorId)
      )
    );
    for (const d of existingTxSnap.docs) {
      ops.push((b) => b.delete(d.ref));
    }

    const existingBillsSnap = await getDocs(
      query(
        collection(db, 'households', householdId, 'bills'),
        where('memberIds', 'array-contains', authorId)
      )
    );
    for (const d of existingBillsSnap.docs) {
      ops.push((b) => b.delete(d.ref));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `households/${householdId}`);
  }

  // Update household settings
  ops.push((b) =>
    b.update(doc(db, 'households', householdId), {
      ...sanitizeSettingsForFirestore(next.settings),
      updatedAt: serverTimestamp(),
    })
  );

  // Write replacement transactions & bills
  for (const tx of next.transactions) {
    const { safeId, payload } = buildTransactionPayload(
      tx,
      householdId,
      authorId,
      memberIds,
      true
    );
    ops.push((b) =>
      b.set(doc(db, 'households', householdId, 'transactions', safeId), payload)
    );
  }
  for (const bill of next.bills) {
    const { safeId, payload } = buildBillPayload(
      bill,
      householdId,
      authorId,
      memberIds,
      true
    );
    ops.push((b) =>
      b.set(doc(db, 'households', householdId, 'bills', safeId), payload)
    );
  }

  try {
    await commitBatchedWrites(ops);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `households/${householdId}`);
  }
}
