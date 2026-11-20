# YAO English Teacher Hub — Security Specification (Phase 0)

## 1. Data Invariants
1. **Allowlist Gate**: Only verified users (`email_verified == true`) whose normalized email exists in `/allowlist/{entryId}` (or the bootstrapped coordinator email `heintayzabusinessmail@gmail.com`) may access any hub data.
2. **Role Integrity**: Only admins (`role == 'admin'` in allowlist or bootstrapped admin) can create, update, or delete `/allowlist` entries, `/hubConfig`, `/galleryItems`, `/trainingSessions`, `/oneToOneSlots` creation/deletion, and `/observations` creation/feedback. Regular teachers can never escalate privileges.
3. **Private Observation Isolation**: `/observations/{obsId}` documents are readable ONLY by admins and the specific teacher (`teacherUid == request.auth.uid` or `teacherEmailKey == myEmailKey()`). Teachers may only update `teacherReply` and `updatedAt`.
4. **Personal Resource State & Survey Isolation**: `/teacherResourceStates/{stateId}` and `/needsSurveys/{uid}` are readable and writable only by their owner (`uid == request.auth.uid`) or admins (read-only for aggregate progress).
5. **Anonymous Suggestions**: `/suggestions/{suggestionId}` stores zero author identity fields, can be created by allowlisted teachers, and can be read/deleted only by admins.
6. **Zero Sensitive HR / Student Data**: No salary, contract, pay, phone numbers, personal coordinator email, referee details, or student personal data are accepted or stored in any entity schema.
7. **Master Gate on Subcollections**: `/curriculumMaps/{levelId}/comments/{commentId}` requires the parent `/curriculumMaps/{levelId}` document to exist.
8. **Temporal Integrity**: All `createdAt` (on create) and `updatedAt` (on update) fields must equal `request.time`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unverified Admin Email Spoof**: Signed-in user with `email: "heintayzabusinessmail@gmail.com"` and `email_verified: false` attempts to read `/allowlist` -> DENIED.
2. **Non-Allowlisted User Read**: Verified user not in `/allowlist` attempts to read `/teachers` or `/resources` -> DENIED.
3. **Self-Privilege Escalation**: Allowlisted teacher attempts to write `/allowlist/{myEmailKey}` with `{ role: "admin" }` -> DENIED.
4. **Shadow Field Injection on Profile**: Teacher updates `/teachers/{uid}` adding ghost field `{ isAdmin: true }` -> DENIED by `hasOnly()`.
5. **Cross-Teacher Profile Edit**: Teacher A attempts to update `/teachers/{teacherBUid}` -> DENIED.
6. **Observation Snooping (Get)**: Teacher A attempts `get` on Teacher B's `/observations/{obsId}` -> DENIED.
7. **Observation Snooping (List)**: Teacher A attempts unfiltered `list` on `/observations` -> DENIED because rule checks `resource.data.teacherUid == request.auth.uid || resource.data.teacherEmailKey == myEmailKey()`.
8. **Observation Feedback Tampering**: Teacher attempts to overwrite `whatWorked` or `actions` on their own `/observations/{obsId}` -> DENIED by `affectedKeys().hasOnly(['teacherReply', 'updatedAt'])`.
9. **Slot Hijacking**: Teacher A attempts to overwrite an already-booked `/oneToOneSlots/{slotId}` belonging to Teacher B -> DENIED because `existing().bookedByUid == ''` fails.
10. **Unapproved Resource Injection**: Regular teacher tries to create `/resources/{id}` with `approved: true` -> DENIED.
11. **Oversized ID / Resource Poisoning**: User attempts to write a 500-character document ID or 50,000-character FAQ question -> DENIED by `isValidId()` and `.size()` limits.
12. **Client Timestamp Forgery**: User submits `createdAt: Timestamp(2020-01-01)` instead of `serverTimestamp()` -> DENIED by `incoming().createdAt == request.time`.
