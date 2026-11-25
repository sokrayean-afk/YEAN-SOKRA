# Security Specification — Household Finance Real-Time Sync

## 1. Data Invariants
1. **Default Deny**: All unmatched Firestore paths are strictly denied (`allow read, write: if false;`).
2. **Verified Authentication**: Every read/write operation requires a signed-in user with `request.auth.token.email_verified == true`.
3. **No PII Leakage**: User workspace documents (`/users/{userId}`) store only `uid` and `activeHouseholdId` (no email, phone, or address) and are strictly readable/writable only by `request.auth.uid == userId`.
4. **Master Gate Membership**: Access to any subcollection document (`/households/{householdId}/transactions/{txId}` or `/bills/{billId}`) requires authoritative membership in `/households/{householdId}/members/{uid}`.
5. **Bounded Member Lists & Secure List Queries**: `memberIds` is strictly bounded (`size >= 1 && size <= 5`) with type validation, and `allow list` on `transactions` and `bills` enforces `request.auth.uid in resource.data.memberIds` without any `get()`/`exists()` inside `allow list`.
6. **Zero Privilege Escalation**: A joining user can ONLY create a member doc with `role == 'member'` using a valid `inviteCode` verified against `/householdInvites/{inviteCode}`. Only the household owner can create an `owner` member doc.
7. **Temporal & Immutability Integrity**: `createdAt`, `joinedAt`, `ownerId`, `authorId`, `householdId`, and `uid` are strictly immutable after creation, and `createdAt`/`updatedAt` must equal `request.time`.
8. **Strict Key Allowlists & Size Bounds**: Every create enforces `hasAll` + `hasOnly`; every update enforces `isValid[Entity](incoming())` + named action `affectedKeys().hasOnly(...)`; every string enforces `.size()` limits; every ID path variable enforces `isValidId()`.
9. **Single-System Master Ownership & Email Invite PII Isolation**: Only the verified Master Admin (`sokrayean@gmail.com` with `email_verified == true`) can create the household. `/householdEmailInvites/{inviteId}` contains member emails and is strictly readable only when `resource.data.email == request.auth.token.email.lower()` or `resource.data.ownerId == request.auth.uid`, and writable only by the household owner.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: Unauthenticated user attempts `get` on `/households/hh_u1`.
2. **Unverified Admin Email Spoof**: Signed-in user with `email: 'sokrayean@gmail.com'` and `email_verified: false` attempts to create `/households/hh_master`.
3. **Identity Spoofing on User Workspace**: User `u2` attempts to write `/users/u1` with `{ uid: 'u1', activeHouseholdId: 'hh_u1', ... }`.
4. **Cross-Household Transaction Injection**: Non-member `u3` attempts to create `/households/hh_u1/transactions/tx1`.
5. **Self-Assigned Owner Role Escalation**: Spouse `u2` joins `/households/hh_u1/members/u2` with `{ role: 'owner', ... }`.
6. **Invalid Invite Code Join**: Attacker `u3` attempts to join `/households/hh_u1/members/u3` with forged `inviteCode: 'FAKE1234'`.
7. **Shadow Field Injection**: Member `u1` attempts to update `/households/hh_u1/transactions/tx1` with extra ghost key `{ isAdmin: true }`.
8. **Immutable Field Tampering**: Member `u1` attempts to update `authorId` or `createdAt` on an existing transaction.
9. **Client Timestamp Forgery**: Member `u1` creates a transaction with client-forged `createdAt` instead of `request.time`.
10. **ID Poisoning / Resource Exhaustion**: Member `u1` attempts to create a transaction with a 200-char invalid ID or 5000-char `note`.
11. **Email Invite PII Scraping**: Non-owner `u3` (`evil@example.com`) attempts `get` or `list` on `/householdEmailInvites` targeting `wife@example.com`.
12. **Rogue Household Creation by Non-Master**: Non-admin user `u3` attempts to create a separate parallel `/households/hh_rogue`.
