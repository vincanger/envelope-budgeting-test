# Phase 1: Foundation Documentation

## Overview
This document summarizes the implementation details for Phase 1 (Foundation) of the Envelope Budgeting App, following the plan in `ai/plan.md`. The goal of this phase was to establish the basic project structure, core data models, authentication, and initial UI pages.

## Related Documentation

- **Data Models (`User`, `BudgetProfile`, `UserBudgetProfile`, `Envelope`, `Transaction`):** The definitive source for all data models is `schema.prisma`. This document describes their initial implementation during Phase 1.
- **App Configuration (`main.wasp`):** The definitive source for app structure (routes, pages, operations, auth config) is `main.wasp`.
- **Plan:** See `ai/plan.md` for the overall project plan.
- **Product Requirements:** See `ai/prd.md` for original requirements.

## 1. Data Models (`schema.prisma`)

- **Objective:** Implement core Prisma models as defined in `ai/prd.md`.
- **Implementation:**
  - The existing `User` model in `schema.prisma` (which used a `String` ID) was replaced with the PRD definition, notably using `Int @id @default(autoincrement())` to align with Wasp's default auth requirements.
  - New models added: `BudgetProfile`, `UserBudgetProfile`, `Envelope`, `Transaction`.
  - Key relations established:
    - `User` to `BudgetProfile` (one-to-one, `OwnedProfile` relation, `@unique` on `ownerId`).
    - `User` to `UserBudgetProfile` (one-to-many).
    - `BudgetProfile` to `UserBudgetProfile`, `Envelope`, `Transaction` (one-to-many).
    - `Envelope` to `Transaction` (one-to-many).
    - `User` to `Transaction` (one-to-many, `CreatedTransactions` relation).
  - `onDelete: Cascade` used for `UserBudgetProfile` and `Envelope` relations to `BudgetProfile`.
  - `onDelete: Restrict` used for `Transaction` relation to `Envelope` (prevent deleting an envelope with transactions).
  - Necessary `@@index` attributes added.
  - **Note:** The complete and current definitions of these models are located in the root `schema.prisma` file.
- **Notes/Challenges:**
  - The `permissions: String[]` field in `UserBudgetProfile` caused a linting error with the default SQLite provider. It was changed to `permissions: String` with the expectation that application logic will handle serialization/deserialization (e.g., comma-separated values).
  - Database migration (`wasp db migrate dev`) initially failed due to an outdated Node.js version (required >= 20.0.0). This was resolved by updating Node.js.

## 2. Basic Authentication (`main.wasp`, `src/features/auth/`)

- **Objective:** Configure Wasp's email/password auth with verification/reset flows using the Dummy provider for development.
- **Implementation:**
  - The `auth` block in `main.wasp` was configured for the `email` method, including settings for sender details, email verification, and password reset flows, linking them to the appropriate client page components.
  - The top-level `emailSender` block was configured in `main.wasp` to use the `Dummy` provider for development.
  - Standard auth routes and pages (Signup, Login, Verify Email, Password Reset) were defined in `main.wasp`, pointing to corresponding component files in `src/features/auth/`.
  - Initial attempt used direct `wasp/client/auth` imports for page components in `main.wasp`, causing linter errors. Corrected to use `@src/` imports pointing to custom wrapper files in `src/features/auth/`.
  - Ensured auth page component files exist in `src/features/auth/`.
  - Styled the newly added auth pages (`VerifyEmailPage`, `RequestPasswordResetPage`, `PasswordResetPage`) to match the existing `login.tsx` and `signup.tsx` structure.
  - Removed the temporary `AuthPageLayout.tsx` component.
- **Notes/Challenges:**
  - Several iterations were needed to find the correct syntax for `auth` and `emailSender` configuration in `main.wasp` for Wasp v0.16.2.
  - The linter error regarding `@src/` imports in `main.wasp` was initially misleading when importing `wasp/client/auth` components, necessitating the use of wrapper components in the `src/` directory.
  - The `.cursorrules` file was updated to clarify direct action usage and add a Wasp restart troubleshooting step.

```typescript
// Excerpt from src/features/auth/VerifyEmailPage.tsx (post-styling)
import React from 'react';
import { VerifyEmailForm } from 'wasp/client/auth';
import { Card, CardContent } from '../../components/ui/card';
import { useTheme } from '../../hooks/use-theme';

export function VerifyEmailPage() {
  const { colors } = useTheme();
  return (
    <div className='flex items-center justify-center min-h-screen bg-primary-foreground'>
      <Card className='w-full max-w-md'>
        <CardContent className="pt-6"> 
          <VerifyEmailForm appearance={{ colors }} />
        </CardContent>
      </Card>
    </div>
  );
}
```

## 3. Core Operations (`src/features/.../operations.ts`, `main.wasp`)

- **Objective:** Create backend actions for budget profile creation and user profile updates.
- **Implementation:**
  - **`createBudgetProfile`:**
    - Created in `src/features/budgets/operations.ts`.
    - Implements logic to check for existing profiles and create a new one linked to the user.
    - This operation is declared as an `action` in `main.wasp`.
  - **`updateUserProfile`:**
    - Created in `src/features/user/operations.ts`.
    - Provides logic to update user fields (initially just email).
    - This operation is declared as an `action` in `main.wasp`.
- **Notes:**
  - Both operations include basic `HttpError(401)` checks for authentication.
  - Input validation beyond basic type checking is minimal at this stage.

```typescript
// Excerpt from src/features/budgets/operations.ts
export const createBudgetProfile: CreateBudgetProfile<CreateInput, BudgetProfile> = async (args, context) => {
  if (!context.user) { throw new HttpError(401) }
  const existingProfile = await context.entities.BudgetProfile.findUnique({ where: { ownerId: context.user.id } })
  if (existingProfile) { throw new HttpError(400, 'User can only own one profile.') }
  const newProfile = await context.entities.BudgetProfile.create({ /* ... data ... */ })
  return newProfile
}
```

## 4. Basic UI Components (`src/features/.../*.tsx`, `main.wasp`)

- **Objective:** Create basic layout, navigation, and forms for profile creation/editing.
- **Implementation:**
  - The existing layout in `src/main.tsx` was deemed sufficient.
  - **`CreateBudgetProfilePage.tsx`:**
    - Created in `src/features/budgets/`.
    - Implements the UI form and logic to call the `createBudgetProfile` action.
    - Associated `route` and `page` declarations were added in `main.wasp`.
  - **`UserProfilePage.tsx`:**
    - Created in `src/features/user/`.
    - Implements the UI form and logic to call the `updateUserProfile` action.
    - Associated `route` and `page` declarations were added in `main.wasp`.
- **Notes/Challenges:**
  - Refactored from using `useAction` hook to direct `async/await` calls.
  - Corrected import paths for `shadcn/ui` components.

```typescript
// Excerpt from src/features/budgets/CreateBudgetProfilePage.tsx (action call)
const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
  // ... checks ...
  setIsExecuting(true);
  setError(null);
  try {
    await createBudgetProfile({ name, description, currency });
    navigate(routes.DashboardRoute.to);
  } catch (err: any) {
    setError(err);
  } finally {
    setIsExecuting(false);
  }
};
```

## Summary & Next Steps
Phase 1 successfully set up the project foundations: data schema, basic authentication flows, core backend actions for initial user/profile management, and placeholder UI pages. Key challenges involved Node versioning, Wasp configuration syntax, SQLite limitations, and adhering to import/action call conventions, which were resolved through iteration and rule updates.

The next step is **Phase 2: Core Budgeting**, focusing on Envelope and basic Transaction management. 