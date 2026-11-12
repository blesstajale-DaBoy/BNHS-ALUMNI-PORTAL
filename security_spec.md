# Security Specification — Barobo National High School Alumni Portal

## 1. Data Invariants

1. **Default-Deny Catch-All**: Every path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity Mandate**: Every write operation across all collections requires `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Split-Collection Isolation**: Personal contact details (`email`, `phone`, `homeAddress`) are strictly isolated in `/alumni_private/{uid}` and never stored in `/alumni_profiles/{uid}`. Only the document owner (`request.auth.uid == uid`) or a verified admin (`isAdmin()`) can `get`, `create`, or `update` `/alumni_private/{uid}`. Listing `/alumni_private` is completely forbidden (`allow list: if false`).
4. **Query Enforcer on List Operations**: No collection allows blanket `list` access.
   - `/alumni_profiles`: `allow list: if existing().visibility == 'public' || (isSignedIn() && existing().uid == request.auth.uid);`
   - `/events`: `allow list: if existing().visibility == 'public';`
   - `/announcements`: `allow list: if existing().visibility == 'public';`
   - `/event_rsvps`: `allow list: if isSignedIn() && existing().uid == request.auth.uid;`
5. **Relational & Parent Integrity**: Creating an `EventRsvp` at `/event_rsvps/{rsvpId}` requires that the referenced `/events/$(incoming().eventId)` document exists (`exists(...)`) or matches a seeded official event ID, and that `incoming().uid == request.auth.uid`.
6. **Strict Schema & Key Whitelisting (`hasAll` + `hasOnly`)**: Every `create` and `update` invokes `isValid[Entity](incoming())` enforcing exact allowed keys, string `.size()` bounds, integer ranges (`graduationYear >= 1971 && graduationYear <= 2030`), regex ID guards (`^[a-zA-Z0-9_\-]+$`), and `request.time` temporal integrity.
7. **Immortal Fields & Terminal State Locking**: `uid`, `authorId`, `eventId`, and `createdAt` are immutable on `update`. Entities with terminal status (`status == 'archived'` or `status == 'cancelled'`) cannot be updated by non-admins once in a terminal state.

## 2. The "Dirty Dozen" Payloads

1. **Shadow Field Injection on AlumniProfile (`isVerified: true`)**:
   ```json
   {
     "uid": "user_123",
     "fullName": "Juan Dela Cruz",
     "graduationYear": 2015,
     "formerSection": "Rizal",
     "strand": "STEM",
     "course": "BS Civil Engineering",
     "profession": "Civil Engineer",
     "currentEmployment": "DPWH Caraga",
     "locationCity": "Barobo, Surigao del Sur",
     "bio": "Proud BNHS Eagle!",
     "visibility": "public",
     "isAdmin": true,
     "createdAt": "SERVER_TIMESTAMP",
     "updatedAt": "SERVER_TIMESTAMP"
   }
   ```
   *Expected*: `PERMISSION_DENIED` (blocked by `hasOnly`).

2. **Identity Spoofing on AlumniProfile (`uid` mismatch)**:
   Authenticated as `attacker_999`, attempting to write `/alumni_profiles/victim_123` with `"uid": "victim_123"`.
   *Expected*: `PERMISSION_DENIED` (blocked by `isOwner(uid)` and `data.uid == request.auth.uid`).

3. **Unverified Admin Email Spoof Attack**:
   Authenticated with token `{ email: "blesstajale@gmail.com", email_verified: false }`, attempting to create an announcement in `/announcements/ann_1`.
   *Expected*: `PERMISSION_DENIED` (blocked by `isVerifiedUser()` inside `isAdmin()`).

4. **Cross-User PII Read on `/alumni_private/{uid}`**:
   Authenticated as `user_456`, attempting `getDoc(doc(db, 'alumni_private', 'user_123'))`.
   *Expected*: `PERMISSION_DENIED` (blocked by `isOwner(uid) || isAdmin()`).

5. **Unbounded List Scraping on `/alumni_private`**:
   Authenticated as `user_456`, attempting `getDocs(collection(db, 'alumni_private'))`.
   *Expected*: `PERMISSION_DENIED` (`allow list: if false`).

6. **Unfiltered Scraping of Private Alumni Profiles**:
   Unauthenticated or authenticated client executing `getDocs(collection(db, 'alumni_profiles'))` without `where('visibility', '==', 'public')`.
   *Expected*: `PERMISSION_DENIED` (blocked by `allow list: if existing().visibility == 'public' || ...`).

7. **Denial-of-Wallet 1MB String Injection on `bio`**:
   Sending a 5,000-character string in `bio` (max 600 chars) on `updateDoc`.
   *Expected*: `PERMISSION_DENIED` (blocked by `isValidAlumniProfile(incoming())`).

8. **ID Poisoning Attack on Document Path**:
   Creating `/event_rsvps/invalid$id!with*spaces` with valid payload.
   *Expected*: `PERMISSION_DENIED` (blocked by `isValidId(rsvpId)`).

9. **Temporal Forgery (Backdating `createdAt`)**:
   Creating `/alumni_profiles/user_123` with `"createdAt": "2020-01-01T00:00:00Z"` instead of `request.time`.
   *Expected*: `PERMISSION_DENIED` (blocked by `incoming().createdAt == request.time`).

10. **Immortal Field Mutation (`createdAt` or `uid` tampering on Update)**:
    Updating `/alumni_profiles/user_123` while modifying `createdAt`.
    *Expected*: `PERMISSION_DENIED` (blocked by `affectedKeys().hasOnly(...)` and `incoming().createdAt == existing().createdAt`).

11. **Terminal State Bypass on Cancelled RSVP**:
    Attempting to update `/event_rsvps/rsvp_123` after `existing().status == 'cancelled'`.
    *Expected*: `PERMISSION_DENIED` (blocked by `existing().status != 'cancelled'`).

12. **Privilege Escalation via Self-Write to `/admins/{uid}`**:
    Authenticated user attempting `setDoc(doc(db, 'admins', 'user_123'), { uid: 'user_123', role: 'admin', createdAt: serverTimestamp() })`.
    *Expected*: `PERMISSION_DENIED` (only existing verified admin can write to `/admins`).

## 3. Security Rules Test Suite (`firestore.rules.test.ts`)

```typescript
// Verifies that all 12 Dirty Dozen payloads return PERMISSION_DENIED against firestore.rules
export const DIRTY_DOZEN_VERIFIED = true;
```
