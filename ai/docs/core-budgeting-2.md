# Phase 2: Core Budgeting Documentation

## Overview
This document summarizes the implementation details for Phase 2 (Core Budgeting) of the Envelope Budgeting App, following the plan in `ai/plan.md`. The goal of this phase was to implement the core budgeting functionalities: managing envelopes and transactions, calculating balances, and providing basic UI for these features and a summary dashboard.

## 1. Envelope Management (Task 2.1)

- **Objective:** Implement backend CRUD for Envelopes and basic categorization/archiving.
- **Implementation:**
  - Created feature directory `src/features/envelopes/`.
  - Implemented operations in `src/features/envelopes/operations.ts`:
    - `getEnvelopes`: Fetches active envelopes for the user's budget profile.
    - `createEnvelope`: Creates a new envelope linked to the user's budget profile.
    - `updateEnvelope`: Updates envelope details (name, amount, category, etc., including `isArchived` boolean for basic archiving).
    - `deleteEnvelope`: Deletes an envelope *only if* it has no associated transactions (enforced by DB schema `onDelete: Restrict` and checked in operation).
  - Added helper function `getUserBudgetProfileId` within `operations.ts` to ensure actions operate on the correct profile (Note: This helper is duplicated in transaction ops - potential refactor later).
  - Declared operations in `main.wasp` under `//#region Envelopes`, ensuring necessary entities (`Envelope`, `BudgetProfile`, `Transaction`) were included.
  - Basic categorization is supported via the `category: String` field on the `Envelope` model.
  - Envelope templates were deferred.
- **Notes:**
  - Operations include checks for user authentication and that the envelope belongs to the user's profile.

```typescript
// Excerpt from src/features/envelopes/operations.ts (deleteEnvelope)
export const deleteEnvelope: DeleteEnvelope<DeleteEnvelopeInput, Envelope> = async (args, context) => {
  // ... auth and ownership checks ...
  const envelope = await context.entities.Envelope.findFirst({
    // ... where clause ...
    include: { _count: { select: { transactions: true } } } // Check count
  });
  // ... check if envelope exists ...
  if (envelope._count.transactions > 0) {
     throw new HttpError(400, 'Cannot delete envelope with existing transactions...');
  }
  return context.entities.Envelope.delete({ where: { id: id } });
}
```

## 2. Transaction Basics (Task 2.2)

- **Objective:** Implement backend CRUD for Transactions and a basic history view.
- **Implementation:**
  - Created feature directory `src/features/transactions/`.
  - Implemented operations in `src/features/transactions/operations.ts`:
    - `getTransactions`: Fetches active transactions for the user's budget profile (basic version, pagination/filtering deferred).
    - `createTransaction`: Creates a new transaction linked to a specific envelope, the budget profile, and the creating user.
    - `updateTransaction`: Updates transaction details.
    - `deleteTransaction`: Deletes a transaction.
  - Added helper function `verifyEnvelopeAccess` to ensure transactions are only linked/moved to envelopes within the correct budget profile.
  - Declared operations in `main.wasp` under `//#region Transactions`.
  - Transaction categorization is implicit via the linked `envelopeId`.
  - Basic transaction search was deferred.
- **Notes:**
  - Transfer-type transactions (`type: 'TRANSFER'`) are currently blocked in create/update/delete operations as they require special handling (e.g., creating two linked transactions, adjusting two envelopes).

## 3. Budget Calculations (Task 2.3)

- **Objective:** Implement automatic updates to envelope balances based on transactions.
- **Implementation:**
  - Modified `createTransaction`, `updateTransaction`, and `deleteTransaction` actions in `src/features/transactions/operations.ts`.
  - **`createTransaction`:** After creating the transaction, it updates the linked envelope's `spent` field (`increment` or `decrement` based on `EXPENSE`/`INCOME` type).
  - **`updateTransaction`:** Calculates the change in effect on the `spent` balance. It first *reverses* the original transaction's effect on the original envelope, updates the transaction, then *applies* the new effect on the potentially new envelope.
  - **`deleteTransaction`:** Before deleting the transaction, it *reverses* the transaction's effect on the linked envelope's `spent` field.
  - Explicit Prisma `$transaction` was initially attempted but removed due to issues accessing `context.prisma`. Updates are performed sequentially within the Wasp actions.
- **Notes:**
  - This ensures the `spent` field on the `Envelope` model reflects the sum of associated non-archived transactions.
  - Basic budget vs. actual is implicitly calculated in the UI by subtracting `spent` from `amount`.
  - Simple spending analytics were deferred.

```typescript
// Excerpt from src/features/transactions/operations.ts (createTransaction)
  // ... create newTransaction ...
  const spentAdjustment = args.type === 'EXPENSE' ? args.amount :
                          args.type === 'INCOME' ? -args.amount : 0;
  await context.entities.Envelope.update({
    where: { id: args.envelopeId },
    data: { spent: { increment: spentAdjustment } }
  });
  return newTransaction;
```

## 4. Enhanced UI (Task 2.4)

- **Objective:** Create basic interfaces for managing envelopes/transactions and a summary dashboard.
- **Implementation:**
  - **`EnvelopesPage.tsx`:**
    - Created in `src/features/envelopes/`.
    - Uses `useQuery(getEnvelopes)` to display envelopes in `Card` components.
    - Includes a `Dialog` triggered by an "Add New Envelope" button, using a form to call `createEnvelope`.
    - Dialog state managed with `useState` to allow automatic closing on successful creation.
    - Edit/Delete buttons added but disabled (functionality deferred).
    - Route added in `main.wasp` (`/envelopes`).
  - **`TransactionsPage.tsx`:**
    - Created in `src/features/transactions/`.
    - Uses `useQuery(getTransactions)` to display transactions in a `Table`.
    - Uses `useQuery(getEnvelopes)` to populate a `Select` dropdown in the add form.
    - Includes a `Dialog` for adding new transactions, calling `createTransaction`.
    - Features a Date Picker using `Popover` and `Calendar` components.
    - Edit/Delete buttons added but disabled (functionality deferred).
    - Route added in `main.wasp` (`/transactions`).
  - **Dashboard (`src/features/dashboard/index.tsx`):**
    - Refactored the existing template dashboard.
    - Uses `useQuery(getEnvelopes)`.
    - Calculates summary stats (Total Budgeted, Spent, Remaining, Envelope Count).
    - Displays summary stats in top `Card` components with relevant icons.
    - Replaced main chart/list area with a grid displaying envelope status `Card`s.
  - Basic loading and error states added to pages using query results.
- **Notes/Challenges:**
  - Date Picker implementation required several iterations due to dependency conflicts (`date-fns` version mismatch with `react-day-picker`) and complexities in styling/component overrides for the specific `react-day-picker` version (`8.10.1`). The final solution involved installing compatible dependencies and simplifying the `Calendar` component wrapper.
  - Currency formatting is basic (`$${value.toFixed(2)}`); needs enhancement later based on `BudgetProfile` currency.
  - Displaying envelope names in the transaction table currently involves a client-side find on the fetched envelopes list, which could be optimized later by joining data in the `getTransactions` query.

## Summary & Next Steps
Phase 2 established the core budgeting loop: creating envelopes, adding transactions that affect envelope balances, and viewing the results on dedicated pages and a summary dashboard. Key challenges involved the Date Picker setup and ensuring atomic updates to envelope balances within Wasp actions.

The next step is **Phase 3: User Management**, focusing on roles, permissions, and collaboration features. 