# Feature: Transactions

## Overview

This feature allows users to manage individual financial transactions (income, expenses, transfers) within their budget profiles. Transactions are linked to specific envelopes and contribute to their balance calculations.

## Related Documentation

- **Data Models (`Transaction`, `Envelope`, `BudgetProfile`, `User`):** See `schema.prisma` for the definitive structure and `ai/docs/1-foundation.md` for initial descriptions.
- **Envelopes:** See `ai/docs/2-core-budgeting.md` for envelope management details.
- **User Roles & Permissions:** See `ai/docs/3-user-management.md` for details on user roles (OWNER, ADMIN, MEMBER) and their permissions.

## Operations (Wasp)

Located in `src/features/transactions/operations.ts`. These operations interact with the `Transaction` entity defined in `schema.prisma`. Ensure the corresponding declarations in `main.wasp` list necessary entities (`Transaction`, `Envelope`, `BudgetProfile`, `User`).

### Queries

- **`getTransactions`**: Fetches non-archived transactions for the user's *current* budget profile (determined via context).
  - **Input**: (Optional filters like `envelopeId` - *Verify if implemented*)
  - **Output**: `Transaction[]` (Sorted by date descending by default).
  - **Permissions**: Requires user to be logged in and associated with a budget profile.

### Actions

- **`createTransaction`**: Creates a new transaction (EXPENSE or INCOME). Updates the corresponding envelope's `spent` amount based on transaction type and amount.
  - **Input**: `{ description: string; amount: number; date: Date; envelopeId: number; type: 'EXPENSE' | 'INCOME'; }`
  - **Output**: `Transaction`
  - **Permissions**: MEMBER, ADMIN, OWNER

- **`updateTransaction`**: Updates an existing transaction. Adjusts envelope balances based on changes (old vs. new amount/type/envelope). Cannot change type to/from TRANSFER. Can archive/unarchive.
  - **Input**: `{ id: number; description?: string; amount?: number; date?: Date; envelopeId?: number; type?: 'EXPENSE' | 'INCOME'; isArchived?: boolean; }`
  - **Output**: `Transaction`
  - **Permissions**: MEMBER, ADMIN, OWNER

- **`deleteTransaction`**: Archives a transaction (sets `isArchived = true`). Reverts its effect on the envelope's `spent` amount. *Note: Does not permanently delete.* Cannot delete TRANSFER types yet.
  - **Input**: `{ id: number }`
  - **Output**: `Transaction` (the archived transaction)
  - **Permissions**: MEMBER, ADMIN, OWNER

- **`bulkImportTransactions`**: Imports an array of *processed and validated* transactions (derived from a CSV) into a specified envelope. Called after client-side parsing, mapping, and user confirmation.
  - **Input**: `{ transactions: { description: string; amount: number; date: Date; type: 'EXPENSE' | 'INCOME'; }[]; targetEnvelopeId: number; }`
  - **Output**: `{ successCount: number; errorCount: number; errors: string[] }`
  - **Permissions**: MEMBER, ADMIN, OWNER

## User Workflows

### Creating a Transaction
1.  Navigate to the Transactions page (e.g., `/transactions`).
2.  Click "Add Transaction" button (Requires MEMBER+ role, a budget profile, and at least one envelope).
3.  Dialog opens: Description, Amount, Date, Envelope (dropdown), Type (Expense/Income).
4.  Fill form, click "Add Transaction".
5.  `createTransaction` action is called.
6.  On success: Dialog closes, list updates, envelope balance adjusts.

### Bulk Importing Transactions (Client-Side Processing & Preview)
1.  Navigate to Transactions page (`/transactions`).
2.  Click "Import" button (Requires MEMBER+ role, budget profile, at least one envelope).
3.  Navigate to Bulk Import page (`/transactions/import`).
4.  Select CSV file via input.
5.  **Client-side**: Parse header row.
6.  **UI**: Display "Map CSV Columns" section with detected headers.
7.  **Client-side**: Attempt auto-mapping of common headers (Date, Description, Amount).
8.  **UI**: User reviews/corrects mapping using dropdowns for required fields (`Date`, `Description`, `Amount`).
9.  **UI**: User selects target envelope.
10. Click "Preview Transactions".
11. **Client-side**: Process full CSV using mappings.
12. **UI**: Display preview table: Mapped Date, Description, Amount, Checkbox, Validation Status (Valid/Invalid). Amount sign determines initial Type (Negative -> Expense, Positive -> Income).
13. **UI**: User can **edit** Date, Description, Amount in the table (triggers re-validation).
14. **UI**: User selects/deselects rows via checkboxes.
15. Click "Import X Valid Transaction(s)" button (enabled with valid selections & target envelope).
16. **Client-side**: Gather selected, valid rows (with edits), determining `type` based on the final `amount` sign.
17. `bulkImportTransactions` action called with the processed transaction array and `targetEnvelopeId`.
18. **Backend**: Performs final validation, creates transactions, updates envelope `spent` amounts.
19. **UI**: Display results (success/error counts).

### CSV Format for Bulk Import
- **File Type**: `.csv`
- **Header**: Must contain a header row as the first line for mapping.
- **Required Columns (Logical)**: Needs columns representing Date, Description, and Amount. Exact header names are flexible due to mapping.
  - **Date**: Parsable date strings (e.g., YYYY-MM-DD, DD.MM.YYYY).
  - **Description**: Text.
  - **Amount**: Numeric values. Negative values imply **EXPENSE**, positive imply **INCOME**. Zero is invalid. Decimal separator (`,` or `.`) should be handled by parser (PapaParse).
- **Delimiter**: Common delimiters (`,` , `;`) should be handled by parser.
- **Other Columns**: Ignored.
- **Blank Lines**: Skipped.

**Example (German Format):**
\`\`\`csv
Buchungstag;Valutadatum;Verwendungszweck;Währung;Betrag
26.10.2023;26.10.2023;REWE Filiale 123;EUR;-55,40
27.10.2023;27.10.2023;Gehalt Oktober;EUR;2000,00
\`\`\`
*(Mapping: Buchungstag -> Date, Verwendungszweck -> Description, Betrag -> Amount)*

### Viewing Transactions
- View list on `/transactions` page, sorted by date descending.
- Basic filtering might be available (e.g., by envelope).

## Future Enhancements / Deferred Features
*(Referenced from \`ai/plan.md\`)*

- Handling \`TRANSFER\` type transactions.
- Editing/Deleting TRANSFER types.
- Implementing recurring transactions (scheduling, rule definition).
- Advanced transaction search/filtering (complex criteria).
- Assigning envelopes during bulk import based on rules/keywords.
- Direct editing/archiving from the main transaction list. 