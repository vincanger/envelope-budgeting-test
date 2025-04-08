# Feature: Transactions

## Overview

This feature allows users to manage individual financial transactions (income, expenses, transfers) within their budget profiles. Transactions are linked to specific envelopes and contribute to their balance calculations.

## Data Models

### `Transaction` (schema.prisma)

```prisma
model Transaction {
  id              Int           @id @default(autoincrement())
  description     String
  amount          Float         // Always stored as a positive value
  date            DateTime
  envelope        Envelope      @relation(fields: [envelopeId], references: [id], onDelete: Restrict)
  envelopeId      Int
  budgetProfile   BudgetProfile @relation(fields: [budgetProfileId], references: [id], onDelete: Cascade)
  budgetProfileId Int
  createdBy       User          @relation("CreatedTransactions", fields: [createdById], references: [id])
  createdById     Int
  type            String        // EXPENSE, INCOME, TRANSFER
  recurring       Boolean       @default(false)
  recurringRule   String?       // For recurring transactions (e.g., RRULE string)
  isArchived      Boolean       @default(false)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([envelopeId])
  @@index([budgetProfileId])
  @@index([createdById])
}
```

- **`amount`**: Stored as a positive float. The `type` field determines if it's an expense (-) or income (+).
- **`type`**: Indicates the nature of the transaction (`EXPENSE`, `INCOME`, `TRANSFER`).
- **`onDelete: Restrict`** on `envelope`: Prevents deleting an envelope if transactions are still linked to it.
- **`onDelete: Cascade`** on `budgetProfile`: Deleting a budget profile deletes its associated transactions.

## Operations (Wasp)

Located in `src/features/transactions/operations.ts`.

### Queries

- **`getTransactions`**: Fetches non-archived transactions for the user's current budget profile.
  - **Input**: (Optional filters like `envelopeId`)
  - **Output**: `Transaction[]`

### Actions

- **`createTransaction`**: Creates a new transaction (EXPENSE or INCOME) and updates the corresponding envelope's `spent` amount.
  - **Input**: `Pick<Transaction, 'description' | 'amount' | 'date' | 'envelopeId' | 'type'>`
  - **Output**: `Transaction`
  - **Permissions**: MEMBER, ADMIN, OWNER

- **`updateTransaction`**: Updates an existing transaction and adjusts envelope balances accordingly. Cannot change type to/from TRANSFER.
  - **Input**: `Partial<Pick<Transaction, 'description' | 'amount' | 'date' | 'envelopeId' | 'type' | 'isArchived'>> & { id: number }`
  - **Output**: `Transaction`
  - **Permissions**: MEMBER, ADMIN, OWNER

- **`deleteTransaction`**: Deletes a transaction and reverts its effect on the envelope's `spent` amount. Cannot delete TRANSFER types yet.
  - **Input**: `{ id: number }`
  - **Output**: `Transaction`
  - **Permissions**: MEMBER, ADMIN, OWNER

- **`bulkImportTransactions`**: Imports an array of processed transactions into a specified envelope.
  - **Input**: `{ transactions: { description: string; amount: number; date: Date; type: 'EXPENSE' | 'INCOME'; }[]; targetEnvelopeId: number; }`
  - **Output**: `{ successCount: number; errorCount: number; errors: string[] }`
  - **Permissions**: MEMBER, ADMIN, OWNER

## User Workflows

### Creating a Transaction
1. User navigates to the Transactions page (`/transactions`).
2. User clicks the "Add Transaction" button (Requires MEMBER+ role and at least one envelope).
3. A dialog opens with fields: Description, Amount, Date, Envelope (dropdown), Type (Expense/Income).
4. User fills the form and clicks "Add Transaction".
5. The `createTransaction` action is called.
6. If successful, the dialog closes, and the transaction list updates. The target envelope's balance is adjusted implicitly via the `spent` field update.

### Bulk Importing Transactions (Interactive with Header Mapping)
1. User navigates to the Transactions page (`/transactions`).
2. User clicks the "Import" button (Requires MEMBER+ role and at least one envelope).
3. User is navigated to the Bulk Import page (`/transactions/import`).
4. User selects a CSV file using the file input.
5. The application parses the header row of the CSV file **client-side** and detects the column names.
6. A "Map CSV Columns" section appears, displaying the detected headers.
7. The application attempts to **auto-map** common header names (e.g., "Datum", "Buchungstag" -> Date; "Verwendungszweck", "Description" -> Description; "Betrag", "Amount" -> Amount).
8. User reviews the auto-mapping and uses dropdowns to **manually select** the correct CSV column for each required field (`Date`, `Description`, `Amount`) if the auto-mapping was incorrect or incomplete.
9. User selects a target envelope from the dropdown menu.
10. Once all required fields are mapped, the user clicks the "Preview Transactions" button.
11. The application processes the full CSV using the selected header mappings and displays the data in a preview table.
12. Each row shows the mapped Date, Description, and Amount, a checkbox, and a validation status (Valid/Invalid).
13. User can **edit** the Date, Description, and Amount fields directly in the table. Edits trigger re-validation.
14. User can **select/deselect** individual rows or use the "Select All" checkbox.
15. User clicks the "Import X Valid Transaction(s)" button (enabled only with valid selected rows and a target envelope).
16. The application gathers only the **selected and valid** rows (with edits applied).
17. The `bulkImportTransactions` action is called with the array of processed transaction data and the target envelope ID.
18. The backend performs final validation and attempts `createMany`.
19. The page displays results (success/error counts, messages).
20. The target envelope's balance is adjusted.

### CSV Format for Bulk Import
- The file **must** be a `.csv` file.
- It **must** contain a **header row** as the first line. The importer will read this row to allow mapping.
- The file needs columns that logically represent a transaction's **Date**, **Description**, and **Amount**, but the exact header names are flexible due to the mapping step.
  - **Date Column**: Should contain parsable date strings.
  - **Description Column**: Should contain text describing the transaction.
  - **Amount Column**: Should contain numeric values. Negative values are treated as **EXPENSE**, positive values as **INCOME**. Zero amounts are invalid.
- Other columns are ignored.
- Blank lines are skipped during processing.

**Example German CSV:**
```csv
Buchungstag;Valutadatum;Verwendungszweck;Währung;Betrag
26.10.2023;26.10.2023;REWE Filiale 123;EUR;-55,40
27.10.2023;27.10.2023;Gehalt Oktober;EUR;2000,00
28.10.2023;28.10.2023;Starbucks Coffee;EUR;-4,75 
```
*(Note: Delimiter (`;` vs `,`) and decimal separator (`,` vs `.`) handling might need future adjustments if issues arise, but PapaParse often handles common variations.)*

### Viewing Transactions
- Users can view a list of their transactions on the `/transactions` page, sorted by date descending.

### (Future/Deferred)
- Editing existing transactions.
- Deleting existing transactions.
- Filtering transactions (by date, envelope, etc.).
- Handling `TRANSFER` type transactions.
- Implementing recurring transactions.
- Advanced search.
- Assigning envelopes during bulk import based on rules. 