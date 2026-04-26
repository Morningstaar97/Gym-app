# Firestore Security Specification for Repz

## 1. Data Invariants
- A user can only read and write their own profile (`/users/{userId}`).
- A user can only read and write their own workout history (`/users/{userId}/history/{workoutId}`).
- A user can only read and write their own favorites (`/users/{userId}/favorites/{workoutId}`).
- `firstName`, `age`, and `gender` are required for a profile.
- Timestamps must be validated using `request.time`.

## 2. The "Dirty Dozen" Payloads (Deny Cases)
1. **Identity Spoofing**: User A trying to write to `/users/UserB`.
2. **Identity Spoofing (History)**: User A trying to write to `/users/UserB/history/workout1`.
3. **Ghost Fields**: Adding `isAdmin: true` to a profile.
4. **Invalid Type**: Setting `age` to a number instead of a string (if schema says string).
5. **Malicious ID**: Creating a workout with a 1MB string as ID.
6. **Bypassing Verification**: Writing search history for someone else.
7. **Resource Poisoning**: Writing a description longer than 5000 characters.
8. **Impersonation**: Writing a workout with an `ownerId` field set to another user (if used).
9. **Timestamp Faking**: Setting `updatedAt` to a future date manually.
10. **State Corruption**: Deleting another user's favorite workout.
11. **Batch Attack**: Trying to write history without creating the user profile (if required).
12. **PII Leak**: Guest user trying to list all user profiles.

## 3. Test Scenarios (Manual/Red Team)
- `get` on `/users/attackerId` by `victimId` -> `PERMISSION_DENIED`.
- `create` on `/users/attackerId` with `isAdmin: true` -> `PERMISSION_DENIED`.
- `update` on `/users/myId` changing `firstName` but omitting `gender` -> `PERMISSION_DENIED` (if strict schema).
