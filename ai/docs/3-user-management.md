# Phase 3 Implementation Summary: User Management

This document summarizes the features and changes implemented during Phase 3: User Management, based on the plan outlined in `../plan.md`.

## Phase Goals
- Verify core authentication functionality.
- Implement Role-Based Access Control (RBAC) for budget profiles.
- Add collaboration features allowing users to invite others and manage members.
- Implement basic user profile customization.

## 1. Data Model Changes (`schema.prisma`)

### `User` Model:
- Added optional `displayName: String?` field for user-settable display names.
- Added optional `avatarUrl: String?` field for user profile pictures.

### `UserBudgetProfile` Model:
- Modified the `permissions: String` field to `role: String` to represent specific roles (`OWNER`, `ADMIN`, `MEMBER`).

### `Invitation` Model:
- Added a new model to manage pending invitations:
  ```prisma
  model Invitation {
    id              String      @id @default(uuid())
    email           String      // Email address invited
    budgetProfileId Int         // ID of the profile they are invited to
    budgetProfile   BudgetProfile @relation(fields: [budgetProfileId], references: [id], onDelete: Cascade)
    role            String      // Role assigned upon acceptance (e.g., MEMBER, ADMIN)
    token           String      @unique // Secure, unique token for the invitation link
    status          InvitationStatus @default(PENDING) // PENDING, ACCEPTED, EXPIRED, DECLINED
    expiresAt       DateTime    // When the invitation expires
    createdAt       DateTime    @default(now())
    updatedAt       DateTime    @updatedAt

    invitedByUserId Int?        // Optional: ID of the user who sent the invite
    invitedByUser   User?       @relation("SentInvitations", fields: [invitedByUserId], references: [id], onDelete: SetNull)

    acceptedByUserId Int?       // Optional: ID of the user who accepted the invite
    acceptedByUser  User?       @relation("AcceptedInvitations", fields: [acceptedByUserId], references: [id], onDelete: SetNull)

    @@index([email])
    @@index([budgetProfileId])
    @@index([status])
  }

  enum InvitationStatus {
    PENDING
    ACCEPTED
    EXPIRED
    DECLINED // Optional
  }
  ```
- Established relations to `User` (invitedBy, acceptedBy) and `BudgetProfile`.

## 2. Wasp Configuration (`main.wasp`)

### Authentication (`app.auth`):
- Added `onBeforeSignup` hook: `import { onBeforeSignup } from "@src/server/authHooks.ts"` (Used to validate invite token).
- Added `onAfterSignup` hook: `import { updateInvitationStatus } from "@src/server/authHooks.ts"` (Used to accept invitation post-signup).

### User Profile Section (`//#region User Profile`):
- **`updateUserProfile` Action:**
  - `fn: import { updateUserProfile } from "@src/features/user/operations.ts"`
  - `entities: [User]`
- **`getCurrentUserProfile` Query:**
  - `fn: import { getCurrentUserProfile } from "@src/features/user/operations.js"` (Note: Still uses .js extension)
  - `entities: [UserBudgetProfile]`
- **`getUsers` Query:**
  - `fn: import { getUsers } from "@src/features/user/operations.ts"`
  - `entities: [User]`
- **`UserProfileRoute` / `UserProfilePage`:**
  - `route UserProfileRoute { path: "/profile", to: UserProfilePage }`
  - `page UserProfilePage { component: import { UserProfilePage } from "@src/features/user/UserProfilePage.tsx" }`

### Budget Profile Section (`//#region Budget Profile`):
- **`getBudgetProfileMembers` Query:**
  - `fn: import { getBudgetProfileMembers } from "@src/features/budgets/operations.ts"`
  - `entities: [UserBudgetProfile, User, BudgetProfile]`
- **`inviteUser` Action:**
  - `fn: import { inviteUser } from "@src/features/budgets/operations.ts"`
  - `entities: [User, UserBudgetProfile, BudgetProfile, Invitation]`
- **`getPendingInvitations` Query:**
  - `fn: import { getPendingInvitations } from "@src/features/budgets/operations.ts"`
  - `entities: [Invitation, UserBudgetProfile, BudgetProfile]`
- **`revokeInvitation` Action:**
  - `fn: import { revokeInvitation } from "@src/features/budgets/operations.ts"`
  - `entities: [Invitation, UserBudgetProfile, BudgetProfile]`
- **`removeUserFromBudget` Action:**
  - `fn: import { removeUserFromBudget } from "@src/features/budgets/operations.ts"`
  - `entities: [UserBudgetProfile, BudgetProfile]`
- **`updateUserRole` Action:**
  - `fn: import { updateUserRole } from "@src/features/budgets/operations.ts"`
  - `entities: [UserBudgetProfile, BudgetProfile]`

## 3. Backend Implementation (`src/`)

### Permissions (`src/lib/server/permissions.ts`):
- Implemented `ensureUserRole` helper function to check if the logged-in user has the required role (e.g., `OWNER`, `ADMIN`) for a given budget profile before allowing an operation to proceed.
- Applied `ensureUserRole` checks within relevant actions (e.g., `createEnvelope`, `updateTransaction`, `inviteUser`, `revokeInvitation`, `removeUserFromBudget`, `updateUserRole`).

### User Operations (`src/features/user/operations.ts`):
- **`updateUserProfile`:** Modified to accept and update the new `displayName` and `avatarUrl` fields on the `User` model.
- **`getCurrentUserProfile`:** Fetches the `UserBudgetProfile` for the logged-in user relative to their currently selected/associated budget profile. This provides the user's role for the *current* budget context.
- **`getUsers`:** Fetches basic `User` info (id, email, potentially displayName/avatarUrl in future) based on a list of IDs, used primarily for displaying member details.

### Budget Operations (`src/features/budgets/operations.ts`):
- **`createBudgetProfile`:** Updated to assign the `OWNER` role in the `UserBudgetProfile` record created for the budget creator.
- **`inviteUser`:**
    - Checks if the target email belongs to an existing user.
    - If yes, directly adds them to the `UserBudgetProfile` with the specified role (if permissions allow).
    - If no, creates an `Invitation` record with a unique token and expiry.
    - Sends an email notification (logged via Dummy provider) containing the signup link with the invite token.
- **`getBudgetProfileMembers`:** Fetches all `UserBudgetProfile` records for a given budget profile ID, used to display the member list.
- **`getPendingInvitations`:** Fetches `Invitation` records with `PENDING` status for a budget profile.
- **`revokeInvitation`:** Deletes a pending `Invitation` record.
- **`removeUserFromBudget`:** Deletes the `UserBudgetProfile` record linking a user to a budget. Includes checks to prevent removing the owner or self-removal.
- **`updateUserRole`:** Updates the `role` field on a `UserBudgetProfile` record. Includes checks to prevent changing the owner's role, self-promotion, or ADMINs modifying other ADMINs.

### Auth Hooks (`src/server/authHooks.ts`):
- **`onBeforeSignup`:** Checks for an `inviteToken` query parameter in the signup URL. If present, validates the token against the `Invitation` table.
- **`onAfterSignup`:** If a valid `inviteToken` was processed in `onBeforeSignup`, this hook automatically creates the `UserBudgetProfile` record to link the newly signed-up user to the budget profile from the invitation and updates the `Invitation` status to `ACCEPTED`.

## 4. Frontend Implementation (`src/`)

### User Profile Page (`src/features/user/UserProfilePage.tsx`):
- Fetches authenticated user data using `useAuth`.
- Displays input fields for `displayName` and `avatarUrl`.
- Uses the `updateUserProfile` action to save changes.
- Uses `useToast` for success/error feedback.

### Members Page (`src/features/settings/MembersPage.tsx`):
- Added under the `/settings/members` route (nested within the main Settings layout).
- Fetches and displays current budget members (`getBudgetProfileMembers` query + `getUsers` query for details) in a table, showing roles.
- Fetches and displays pending invitations (`getPendingInvitations` query) in a separate table.
- Provides UI (dialogs, buttons, dropdowns) for:
    - Inviting new members (`inviteUser` action).
    - Revoking pending invitations (`revokeInvitation` action).
    - Changing member roles (`updateUserRole` action).
    - Removing members (`removeUserFromBudget` action).
- Implements client-side access control logic based on the current user's role (`getCurrentUserProfile` query) to disable/hide actions (e.g., MEMBER cannot invite, ADMIN cannot remove OWNER).

### Sidebar (`src/components/layout/app-sidebar.tsx` & `nav-user.tsx`):
- Modified `AppSidebar` to use `useAuth` to fetch the logged-in user.
- Uses `getEmail` helper and user data (`displayName`, `avatarUrl`) to populate the `NavUser` component.
- `NavUser` displays the user's avatar, name (displayName or email fallback), and email in the sidebar footer.

### General UI Updates:
- Buttons/actions related to envelope creation/editing, transaction creation/editing, inviting users, and managing members are conditionally disabled based on the user's role fetched via `getCurrentUserProfile`.

## 5. Key Decisions & Notes
- **RBAC Implementation:** A simple string-based role (`OWNER`, `ADMIN`, `MEMBER`) stored on the `UserBudgetProfile` link table was chosen for initial implementation. More granular permissions were deferred.
- **Invitation Flow:** Handles both existing and new users. New users accept the invitation implicitly by signing up via the special link.
- **Profile Customization:** Focused on basic `displayName` and `avatarUrl`. More extensive profile settings deferred.
- **Deferred Items:** Shared access controls, real-time updates, notification preferences, currency settings, and user activity tracking were explicitly deferred to later phases. 