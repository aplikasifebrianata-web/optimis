# Security Specification — E-Lamis Blora Firestore Rules

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every path not explicitly matched is denied (`allow read, write: if false;`).
2. **Authentication & Verified Email**: All mutations require an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`), or the bootstrapped administrator (`aplikasifebrianata@gmail.com` with `email_verified == true` or existence in `/admins/$(request.auth.uid)`).
3. **Path ID Hardening**: Document IDs (`periodeId`, `opdId`, `userId`, `matrixId`, `realisasiId`, `logId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` chars (`isValidId`).
4. **Strict Key & Size Validation (`hasAll` / `hasOnly`)**: Every entity creation and update is validated by `isValid[Entity](incoming())`, enforcing exact key allowlists, string length bounds, numeric bounds, and `ownerId == request.auth.uid`.
5. **Terminal State Locking**: Once a `RealisasiSemester` document reaches `status_verifikasi == 'Terverifikasi'`, non-admin users cannot update or delete it. Only `isAdmin()` can unlock or modify verified records.
6. **Temporal & Ownership Immutability**: `createdAt == request.time` on create; `createdAt == existing().createdAt`, `ownerId == existing().ownerId`, and `updatedAt == request.time` on update.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: Creating `/matrices/mtx-1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Admin Email Spoof**: Creating `/periodes/per-2026` with `email: "aplikasifebrianata@gmail.com"` and `email_verified: false` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection**: Updating `/matrices/mtx-1` with an undeclared field `isSuperAdmin: true` -> `PERMISSION_DENIED`.
4. **Owner Spoofing on Create**: Creating `/matrices/mtx-1` where `ownerId != request.auth.uid` -> `PERMISSION_DENIED`.
5. **Owner Mutation on Update**: Updating `/matrices/mtx-1` to change `ownerId` -> `PERMISSION_DENIED`.
6. **Terminal State Bypass**: Non-admin updating `/realisasis/real-1` when `existing().status_verifikasi == 'Terverifikasi'` -> `PERMISSION_DENIED`.
7. **Oversized String DoS**: Creating `/matrices/mtx-1` with `sub_kegiatan` of 5,000 characters (`> 400`) -> `PERMISSION_DENIED`.
8. **Malformed Path ID**: Creating `/matrices/invalid$id!` -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: Creating `/matrices/mtx-1` with `createdAt != request.time` -> `PERMISSION_DENIED`.
10. **Orphaned Realisasi Creation**: Creating `/realisasis/real-1` referencing a non-existent `/matrices/$(incoming().matrix_id)` -> `PERMISSION_DENIED`.
11. **Unauthorized List Scraping**: Listing `/matrices` without `resource.data.ownerId == request.auth.uid` (for non-admin) -> `PERMISSION_DENIED`.
12. **Audit Log Mutation**: Attempting to update or delete an immutable `/audit_logs/{logId}` entry -> `PERMISSION_DENIED`.
