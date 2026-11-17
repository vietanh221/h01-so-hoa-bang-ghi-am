# Security Specification — Ký Ức Băng Từ (H01)

## 1. Data Invariants
1. **User Profile Isolation (`/users/{userId}`)**: A user profile may only be created, read, or updated by the authenticated user whose `request.auth.uid == userId`, with `role` strictly locked to `'contributor'`. List queries on `/users` are denied.
2. **Record Ownership & Identity Integrity (`/audioRecords/{recordId}`)**: Every `AudioRecord` must have `ownerId == request.auth.uid` on creation, verified email (`request.auth.token.email_verified == true`), and `ownerId` and `createdAt` remain immutable on update.
3. **Usage Scope Read Enforcement**: Unauthenticated or non-owner queries cannot list or read `'private'` or `'family'` records. `'community'` records require a verified authenticated user (`email_verified == true`). Only `'public'` records are publicly readable.
4. **Server Timestamp Enforcement**: `createdAt` must equal `request.time` on create; `updatedAt` must equal `request.time` on create and update.
5. **Volumetric & Schema Bounds**: Every string has strict `size()` limits, `accessionCode` and `ownerId` match strict regexes, `waveformPeaks` is bounded to `1..64` items, `markers` is bounded to `0..20` items, and unknown shadow keys are rejected via `hasAll` + `hasOnly` and `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Create**: Adding `isVerified: true` or `adminOverride: true` to `audioRecords` create payload -> **PERMISSION_DENIED**.
2. **Role Self-Escalation**: Creating `/users/{uid}` with `role: 'admin'` -> **PERMISSION_DENIED**.
3. **Identity Spoofing**: Creating an `AudioRecord` with `ownerId: 'other-user-uid'` -> **PERMISSION_DENIED**.
4. **ID Poisoning**: Writing to `/audioRecords/invalid$id!with@1500chars...` -> **PERMISSION_DENIED**.
5. **Unverified Email Write**: Attempting create/update when `email_verified == false` -> **PERMISSION_DENIED**.
6. **Client Timestamp Tampering**: Submitting `createdAt: Timestamp(1990)` instead of `serverTimestamp()` -> **PERMISSION_DENIED**.
7. **Immortal Field Mutation**: Updating `ownerId` or `createdAt` on an existing `AudioRecord` -> **PERMISSION_DENIED**.
8. **Blanket List Query Scraping**: Listing `/audioRecords` without constraining `usageScope` or `ownerId` -> **PERMISSION_DENIED**.
9. **Private/Family Record Leakage**: Non-owner requesting `get` on a record with `usageScope: 'private'` or `'family'` -> **PERMISSION_DENIED**.
10. **Array Exhaustion (Denial of Wallet)**: Submitting `waveformPeaks` with 500 elements or `markers` with 100 elements -> **PERMISSION_DENIED**.
11. **Type Poisoning on Update**: Updating `year` to `"1994"` (string) or `description` to a 5,000-char string -> **PERMISSION_DENIED**.
12. **Cross-User Deletion**: User B attempting to delete User A's `AudioRecord` -> **PERMISSION_DENIED**.
