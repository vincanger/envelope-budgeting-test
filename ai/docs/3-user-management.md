# Phase 3 Implementation Summary: User Management

This document summarizes the features and changes implemented during Phase 3: User Management, based on the plan outlined in `../plan.md`.

## Phase Goals
- Verify core authentication functionality.
- Implement Role-Based Access Control (RBAC) for budget profiles.
- Add collaboration features allowing users to invite others and manage members.
- Implement basic user profile customization.

## Related Documentation

- **Data Models (`User`, `UserBudgetProfile`, `Invitation`, etc.):** The definitive source for all data models is `schema.prisma`. This document describes changes and additions made during Phase 3.
- **Foundation & Auth:** See `ai/docs/1-foundation.md` for initial setup.
- **Core Budgeting:** See `ai/docs/2-core-budgeting.md` for envelope/transaction context.
- **Plan:** See `ai/plan.md` for the overall project plan.

## 1. Data Model Changes (`schema.prisma`)

### `User` Model:
- Added optional `displayName: String?` field for user-settable display names.
- Added optional `avatarUrl: String?` field for user profile pictures.

### `UserBudgetProfile` Model:
- Modified the `permissions: String` field to `role: String` to represent specific roles (`OWNER`, `ADMIN`, `MEMBER`).

### `Invitation` Model:
- Added a new model to manage pending invitations.
- Key fields include `email`, `budgetProfileId`, `role`, `token`, `status` (`InvitationStatus` enum), `expiresAt`.
- Established relations to `User` (invitedBy, acceptedBy) and `BudgetProfile`.
- **Note:** See `schema.prisma` for the full definition of the `Invitation` model and `InvitationStatus` enum.

## 2. Backend Implementation (`src/`)

### Permissions (`src/lib/server/permissions.ts`):
- Implemented `ensureUserRole` helper function to check if the logged-in user has the required role (e.g., `OWNER`, `ADMIN`) for a given budget profile before allowing an operation to proceed.
- Applied `ensureUserRole` checks within relevant actions (e.g., `createEnvelope`, `updateTransaction`, `inviteUser`, `revokeInvitation`, `removeUserFromBudget`, `updateUserRole`).

### User Operations (`src/features/user/operations.ts`):
- **`updateUserProfile`:** Modified to accept and update the new `displayName` and `avatarUrl` fields on the `User` model. (Declared as an `action` in `main.wasp`).
- **`getCurrentUserProfile`:** Fetches the `UserBudgetProfile` for the logged-in user relative to their currently selected/associated budget profile. (Declared as a `query` in `main.wasp`).
- **`getUsers`:** Fetches basic `User` info based on IDs. (Declared as a `query` in `main.wasp`).

### Budget Operations (`src/features/budgets/operations.ts`):
- **`createBudgetProfile`:** Updated to assign the `OWNER` role in the `UserBudgetProfile` record created for the budget creator. (Action already declared in Phase 1).
- **`inviteUser`:** Implements logic to invite existing or new users via email/token. (Declared as an `action` in `main.wasp`).
- **`getBudgetProfileMembers`:** Fetches all `UserBudgetProfile` records for a budget profile. (Declared as a `query` in `main.wasp`).
- **`getPendingInvitations`:** Fetches pending `Invitation` records. (Declared as a `query` in `main.wasp`).
- **`revokeInvitation`:** Deletes a pending `Invitation` record. (Declared as an `action` in `main.wasp`).
- **`removeUserFromBudget`:** Deletes the `UserBudgetProfile` record linking a user to a budget. (Declared as an `action` in `main.wasp`).
- **`updateUserRole`:** Updates the `role` field on a `UserBudgetProfile` record. (Declared as an `action` in `main.wasp`).

### Auth Hooks (`src/server/authHooks.ts`):
- **`onBeforeSignup`:** Checks for/validates an `inviteToken` query parameter. (Hook configured in `main.wasp` `app.auth`).
- **`onAfterSignup`:** Links user to budget profile and updates invitation status based on valid token. (Hook configured in `main.wasp` `app.auth`).

## 3. Frontend Implementation (`src/`)

### User Profile Page (`src/features/user/UserProfilePage.tsx`):
- Implements UI to display/edit `displayName` and `avatarUrl` using `useAuth` and `updateUserProfile` action.
- Uses `useToast` for feedback. (Route/Page configured in `main.wasp`).

### Members Page (`src/features/settings/MembersPage.tsx`):
- Added under `/settings/members` route (Route/Page configured in `main.wasp`, nested within Settings layout).
- Uses relevant queries (`getBudgetProfileMembers`, `getUsers`, `getPendingInvitations`, `getCurrentUserProfile`) and actions (`inviteUser`, `revokeInvitation`, `updateUserRole`, `removeUserFromBudget`) to display member/invitation lists and provide management UI.
- Implements client-side access control based on user role.

### Sidebar (`src/components/layout/app-sidebar.tsx` & `nav-user.tsx`):
- Modified `AppSidebar` to use `useAuth` to fetch the logged-in user.
- Uses `getEmail` helper and user data (`displayName`, `avatarUrl`) to populate the `NavUser` component.
- `NavUser` displays the user's avatar, name (displayName or email fallback), and email in the sidebar footer.

### General UI Updates:
- Buttons/actions related to envelope creation/editing, transaction creation/editing, inviting users, and managing members are conditionally disabled based on the user's role fetched via `getCurrentUserProfile`.

## 4. Key Decisions & Notes
- **RBAC Implementation:** A simple string-based role (`OWNER`, `ADMIN`, `MEMBER`) stored on the `UserBudgetProfile` link table was chosen for initial implementation. More granular permissions were deferred.
- **Invitation Flow:** Handles both existing and new users. New users accept the invitation implicitly by signing up via the special link.
- **Profile Customization:** Focused on basic `displayName` and `avatarUrl`. More extensive profile settings deferred.
- **Deferred Items:** Shared access controls, real-time updates, notification preferences, currency settings, and user activity tracking were explicitly deferred to later phases. 