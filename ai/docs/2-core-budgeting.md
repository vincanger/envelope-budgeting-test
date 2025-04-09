# Phase 2: Core Budgeting Documentation

## Overview
This document summarizes the implementation details for Phase 2 (Core Budgeting) of the Envelope Budgeting App, following the plan in `ai/plan.md`. The goal of this phase was to implement the core budgeting functionalities: managing envelopes and transactions, calculating balances, and providing basic UI for these features and a summary dashboard.

## Related Documentation

- **Data Models (`Envelope`, `Transaction`, etc.):** See `schema.prisma` for the definitive structure and `ai/docs/1-foundation.md` for initial descriptions.
- **Transactions Feature:** See `ai/docs/4-transactions.md` for detailed transaction management, including bulk import.
- **Foundation & Auth:** See `ai/docs/1-foundation.md`.
- **Plan:** See `ai/plan.md` for the overall project plan.

## 1. Envelope Management (Task 2.1)

- **Objective:** Implement backend CRUD for Envelopes and basic categorization/archiving.
- **Implementation:**
  - Created feature directory `src/features/envelopes/`.
  - Implemented operations (`getEnvelopes`, `createEnvelope`, `updateEnvelope`, `deleteEnvelope`) in `src/features/envelopes/operations.ts`.
  - Added helper function `getUserBudgetProfileId` within `operations.ts`.
  - These operations were declared as `query` or `action` types in `main.wasp`.
  - Basic categorization is supported via the `category: String` field on the `Envelope` model.
  - Envelope templates were deferred.
  - **Note:** See `src/features/envelopes/operations.ts` for the full implementation of these operations.
- **Notes:**
  - Operations include checks for user authentication and that the envelope belongs to the user's profile.

## 2. Transaction Basics (Task 2.2)

- **Objective:** Implement backend CRUD for Transactions and a basic history view.
- **Implementation:**
  - Created feature directory `src/features/transactions/`.
  - Implemented operations (`getTransactions`, `createTransaction`, `updateTransaction`, `deleteTransaction`) in `src/features/transactions/operations.ts`.
  - Added helper function `verifyEnvelopeAccess`.
  - These operations were declared as `query` or `action` types in `main.wasp`.
  - Transaction categorization is implicit via the linked `envelopeId`.
  - Basic transaction search was deferred.
  - **Note:** See `src/features/transactions/operations.ts` and `ai/docs/4-transactions.md` for full implementation details.
- **Notes:**
  - Transfer-type transactions (`type: 'TRANSFER'`) are currently blocked.

## 3. Budget Calculations (Task 2.3)

- **Objective:** Implement automatic updates to envelope balances based on transactions.
- **Implementation:**
  - Modified `createTransaction`, `updateTransaction`, and `deleteTransaction` actions in `src/features/transactions/operations.ts`.
  - **`createTransaction`:** After creating the transaction, it updates the linked envelope's `spent` field (`increment` or `decrement` based on `EXPENSE`/`INCOME` type).
  - **`updateTransaction`:** Calculates the change in effect on the `spent` balance. It first *reverses* the original transaction's effect on the original envelope, updates the transaction, then *applies* the new effect on the potentially new envelope.
  - **`deleteTransaction`:** Before archiving the transaction, it *reverses* the transaction's effect on the linked envelope's `spent` field.
  - Explicit Prisma `$transaction` was initially attempted but removed due to issues accessing `context.prisma`. Updates are performed sequentially within the Wasp actions.
  - **Note:** See `src/features/transactions/operations.ts` for the full implementation of balance adjustments.
- **Notes:**
  - This ensures the `spent` field on the `Envelope` model reflects the sum of associated non-archived transactions.
  - Basic budget vs. actual is implicitly calculated in the UI by subtracting `spent` from `amount`.
  - Simple spending analytics were deferred.

## 4. Enhanced UI (Task 2.4)

- **Objective:** Create basic interfaces for managing envelopes/transactions and a summary dashboard.
- **Implementation:**
  - **`EnvelopesPage.tsx`:**
    - Created in `src/features/envelopes/`.
    - Implements UI using `useQuery(getEnvelopes)` and includes a form/dialog to call `createEnvelope`.
    - The corresponding `route` and `page` were defined in `main.wasp`.
  - **`TransactionsPage.tsx`:**
    - Created in `src/features/transactions/`.
    - Implements UI using `useQuery(getTransactions)` and includes a form/dialog to call `createTransaction`.
    - The corresponding `route` and `page` were defined in `main.wasp`.
  - **Dashboard (`src/features/dashboard/index.tsx`):**
    - Refactored the existing template dashboard to use `useQuery(getEnvelopes)` and display summary stats and envelope cards.
  - Basic loading and error states added to pages using query results.
- **Notes/Challenges:**
  - Date Picker implementation required several iterations due to dependency conflicts (`date-fns` version mismatch with `react-day-picker`) and complexities in styling/component overrides for the specific `react-day-picker` version (`8.10.1`). The final solution involved installing compatible dependencies and simplifying the `Calendar` component wrapper.
  - Currency formatting is basic (`$${value.toFixed(2)}`); needs enhancement later based on `BudgetProfile` currency.
  - Displaying envelope names in the transaction table currently involves a client-side find on the fetched envelopes list, which could be optimized later by joining data in the `getTransactions` query.

## Summary & Next Steps
Phase 2 established the core budgeting loop: creating envelopes, adding transactions that affect envelope balances, and viewing the results on dedicated pages and a summary dashboard. Key challenges involved the Date Picker setup and ensuring atomic updates to envelope balances within Wasp actions.

The next step is **Phase 3: User Management**, focusing on roles, permissions, and collaboration features. 