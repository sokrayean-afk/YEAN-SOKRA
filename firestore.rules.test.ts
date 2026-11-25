/**
 * Security Rules Verification Spec — Dirty Dozen Test Matrix
 * Run with Firebase Emulator Suite (`@firebase/rules-unit-testing`) when testing rules locally.
 */
export interface DirtyDozenCase {
  id: number;
  name: string;
  actor: { uid: string; emailVerified: boolean } | null;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated household read',
    actor: null,
    operation: 'get',
    path: 'households/hh_u1',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email workspace create',
    actor: { uid: 'u1', emailVerified: false },
    operation: 'create',
    path: 'users/u1',
    payload: { uid: 'u1', activeHouseholdId: 'hh_u1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity spoofing on another user workspace',
    actor: { uid: 'u2', emailVerified: true },
    operation: 'create',
    path: 'users/u1',
    payload: { uid: 'u1', activeHouseholdId: 'hh_u1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Non-member cross-household transaction create',
    actor: { uid: 'u3', emailVerified: true },
    operation: 'create',
    path: 'households/hh_u1/transactions/tx_evil',
    payload: { id: 'tx_evil', householdId: 'hh_u1', authorId: 'u3', memberIds: ['u3'] },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Self-assigned owner privilege escalation on join',
    actor: { uid: 'u2', emailVerified: true },
    operation: 'create',
    path: 'households/hh_u1/members/u2',
    payload: { uid: 'u2', householdId: 'hh_u1', role: 'owner', inviteCode: 'AB12CD34' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Forged invite code join attempt',
    actor: { uid: 'u3', emailVerified: true },
    operation: 'create',
    path: 'households/hh_u1/members/u3',
    payload: { uid: 'u3', householdId: 'hh_u1', role: 'member', inviteCode: 'FAKE9999' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Shadow ghost field injection on update',
    actor: { uid: 'u1', emailVerified: true },
    operation: 'update',
    path: 'households/hh_u1/transactions/tx_1',
    payload: { note: 'ok', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immutable authorId tampering on update',
    actor: { uid: 'u1', emailVerified: true },
    operation: 'update',
    path: 'households/hh_u1/transactions/tx_1',
    payload: { authorId: 'u2' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client-forged createdAt timestamp on create',
    actor: { uid: 'u1', emailVerified: true },
    operation: 'create',
    path: 'households/hh_u1/transactions/tx_2',
    payload: { id: 'tx_2', createdAt: '1999-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'ID poisoning and note size overflow',
    actor: { uid: 'u1', emailVerified: true },
    operation: 'create',
    path: `households/hh_u1/transactions/${'a'.repeat(200)}`,
    payload: { id: 'a'.repeat(200), note: 'x'.repeat(5000) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Invite collection enumeration scraping',
    actor: { uid: 'u3', emailVerified: true },
    operation: 'list',
    path: 'householdInvites',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket list query by non-member',
    actor: { uid: 'u3', emailVerified: true },
    operation: 'list',
    path: 'households/hh_u1/transactions',
    expected: 'PERMISSION_DENIED',
  },
];
