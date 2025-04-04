# Phase 1: Foundation Documentation

## Overview
This document summarizes the implementation details for Phase 1 (Foundation) of the Envelope Budgeting App, following the plan in `ai/plan.md`. The goal of this phase was to establish the basic project structure, core data models, authentication, and initial UI pages.

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
- **Notes/Challenges:**
  - The `permissions: String[]` field in `UserBudgetProfile` caused a linting error with the default SQLite provider. It was changed to `permissions: String` with the expectation that application logic will handle serialization/deserialization (e.g., comma-separated values).
  - Database migration (`wasp db migrate dev`) initially failed due to an outdated Node.js version (required >= 20.0.0). This was resolved by updating Node.js.

```prisma
// Excerpt from schema.prisma (Phase 1 models)
model User {
  id              Int      @id @default(autoincrement())
  email           String   @unique
  emailVerified   Boolean  @default(false)
  password        String   // Hashed - managed by Wasp auth
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  lastLoginAt     DateTime?
  budgetProfile   BudgetProfile? @relation("OwnedProfile")
  memberProfiles  UserBudgetProfile[]
  transactions    Transaction[]    @relation("CreatedTransactions")
}

model BudgetProfile { /* ... fields ... */ 
  owner       User     @relation("OwnedProfile", fields: [ownerId], references: [id])
  ownerId     Int      @unique 
  /* ... relations ... */ 
}

model UserBudgetProfile { /* ... fields ... */ 
  permissions     String // Was String[]
  /* ... relations ... */ 
}

model Envelope { /* ... fields and relations ... */ }

model Transaction { /* ... fields and relations ... */ }
```

## 2. Basic Authentication (`main.wasp`, `src/features/auth/`)

- **Objective:** Configure Wasp's email/password auth with verification/reset flows using the Dummy provider for development.
- **Implementation:**
  - Modified the `auth` block in `main.wasp`:
    - Used the `email: {}` method under `auth.methods`.
    - Added required configuration within `auth.methods.email`: `fromField`, `emailVerification: { clientRoute: ... }`, `passwordReset: { clientRoute: ... }`.
  - Added a top-level `emailSender` block in `main.wasp` to specify the `provider: Dummy`.
  - Defined standard auth routes and pages in `main.wasp` (`SignupRoute`, `LoginRoute`, `VerifyEmailRoute`, `RequestPasswordResetRoute`, `PasswordResetRoute`).
  - Initial attempt used direct `wasp/client/auth` imports for page components in `main.wasp`, causing linter errors. Corrected to use `@src/` imports pointing to custom files.
  - Ensured auth page component files exist in `src/features/auth/` (`login.tsx`, `signup.tsx`, `VerifyEmailPage.tsx`, `RequestPasswordResetPage.tsx`, `PasswordResetPage.tsx`).
  - Styled the newly added auth pages (`VerifyEmailPage`, `RequestPasswordResetPage`, `PasswordResetPage`) to match the existing `login.tsx` and `signup.tsx` structure (using `Card`, centered layout, `useTheme`, and Wasp's auth form components like `VerifyEmailForm`).
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
    - Checks if the authenticated user (`context.user`) already owns a profile to enforce the one-to-one relationship.
    - Creates a `BudgetProfile` record, connecting the `ownerId` to `context.user.id`.
    - Returns the newly created profile.
    - Declared in `main.wasp` under `//#region Budget Profile`.
  - **`updateUserProfile`:**
    - Created in `src/features/user/operations.ts`.
    - Provides a basic structure to update `User` fields (currently only `email` is implemented as an example).
    - Checks for `context.user` authentication.
    - Explicitly excludes the `password` field from the return value.
    - Declared in `main.wasp` under `//#region User Profile`.
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
  - The existing layout in `src/main.tsx` (including sidebar, theme providers, etc.) was deemed sufficient, utilizing `Outlet` for page content.
  - **`CreateBudgetProfilePage.tsx`:**
    - Created in `src/features/budgets/`.
    - Uses `useAuth` to check for authenticated user.
    - Implements a form using `shadcn/ui` components (`Card`, `Input`, `Textarea`, `Button`, `Label`) imported via relative paths.
    - Calls `createBudgetProfile` action directly using `async/await` within `handleSubmit`.
    - Manages loading (`isExecuting`) and `error` states manually using `useState`.
    - Redirects to Dashboard on success using `useNavigate`.
    - Route added in `main.wasp` (`/create-profile`).
  - **`UserProfilePage.tsx`:**
    - Created in `src/features/user/`.
    - Uses `useAuth` to fetch user data and pre-fill form.
    - Implements a form using `shadcn/ui` components imported via relative paths.
    - Calls `updateUserProfile` action directly using `async/await` within `handleSubmit`.
    - Manages loading (`isExecuting`) and `error` states manually using `useState`.
    - Shows basic `alert()` for success/error (to be replaced with toasts later).
    - Route added in `main.wasp` (`/profile`).
- **Notes/Challenges:**
  - Initial implementation incorrectly used `useAction` hook; refactored to use direct `async/await` calls as per `.cursorrules`.
  - Initial implementation incorrectly used `@src/` aliases for `shadcn/ui` components; corrected to use relative paths (`../../components/ui/...`).

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