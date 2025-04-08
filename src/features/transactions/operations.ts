import { HttpError } from 'wasp/server'
// Separate type imports and value imports
import type { Transaction, BudgetProfile, Envelope } from 'wasp/entities' 
import { TransactionType } from '@prisma/client' // Value import for enum
import type {
  GetTransactions,
  CreateTransaction,
  UpdateTransaction,
  DeleteTransaction,
  BulkImportTransactions
} from 'wasp/server/operations'
import { ensureUserRole, getCurrentBudgetProfileId } from '../../lib/server/permissions'

// ========= Queries =========

type GetTransactionsInput = { 
  envelopeId?: number;
  // Add pagination, date range filters later
}

// TODO: Add role checking (MEMBER+) once getUserBudgetProfileId is fixed for shared access.
export const getTransactions: GetTransactions<GetTransactionsInput, Transaction[]> = async (args, context) => {
  const budgetProfileId = await getCurrentBudgetProfileId(context);

  return context.entities.Transaction.findMany({
    where: {
      budgetProfileId: budgetProfileId,
      // isArchived: false, // Removed: isArchived no longer exists
    },
    orderBy: { date: 'desc' }, // Show most recent first
  });
}

// ========= Actions =========

// Removed envelopeId from input, it will be assigned later
type CreateTransactionInput = Pick<Transaction, 'description' | 'amount' | 'date' | 'type'> & { envelopeId?: number | null } // Allow optional envelopeId

export const createTransaction: CreateTransaction<CreateTransactionInput, Transaction> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const budgetProfileId = await getCurrentBudgetProfileId(context);

  // Ensure user has permission (MEMBER+)
  await ensureUserRole(context, budgetProfileId, ['MEMBER', 'ADMIN', 'OWNER']);

  if (args.type === 'TRANSFER') {
    throw new HttpError(400, 'Use the transfer operation for transfers between envelopes.');
  }

  // 1. Create the transaction
  const newTransaction = await context.entities.Transaction.create({
    data: {
      description: args.description,
      amount: args.amount,
      date: args.date,
      type: args.type,
      // Conditionally connect envelope if provided
      ...(args.envelopeId && { envelope: { connect: { id: args.envelopeId } } }),
      budgetProfile: { connect: { id: budgetProfileId } },
      // createdBy: { connect: { id: context.user.id } } // Removed: createdBy relation removed
    }
  });

  // 2. Update the envelope's spent amount if envelopeId is provided
  if (args.envelopeId) {
    const spentAdjustment = args.type === 'EXPENSE' ? args.amount :
                            args.type === 'INCOME' ? -args.amount : 0;

    await context.entities.Envelope.update({
      where: { id: args.envelopeId },
      data: {
        spent: { increment: spentAdjustment }
      }
    });
  }

  return newTransaction;
}

// Removed isArchived from input type
type UpdateTransactionInput = Partial<Pick<Transaction, 'description' | 'amount' | 'date' | 'envelopeId' | 'type'>> & { id: number }

export const updateTransaction: UpdateTransaction<UpdateTransactionInput, Transaction> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const { id, ...updateData } = args;

  // 1. Fetch the original transaction
  const originalTransaction = await context.entities.Transaction.findUnique({
    where: { id: id },
    select: { id: true, amount: true, type: true, envelopeId: true, budgetProfileId: true }
  });

  if (!originalTransaction) {
    throw new HttpError(404, 'Transaction not found.');
  }
  const originalEnvelopeId = originalTransaction.envelopeId; // Store for later comparison

  // 2. Ensure user permission (MEMBER+)
  await ensureUserRole(context, originalTransaction.budgetProfileId, ['MEMBER', 'ADMIN', 'OWNER']);

  // Determine the target envelope ID (can be null)
  const newEnvelopeId = updateData.envelopeId !== undefined ? updateData.envelopeId : originalEnvelopeId;

  // Cannot change type to/from TRANSFER
  const newType = updateData.type !== undefined ? updateData.type : originalTransaction.type;
  if ((newType === 'TRANSFER' && originalTransaction.type !== 'TRANSFER') || 
      (newType !== 'TRANSFER' && originalTransaction.type === 'TRANSFER')) {
    throw new HttpError(400, 'Cannot change transaction type to/from TRANSFER...');
  }
  // Simple update if it's a TRANSFER (no envelope logic)
  if (newType === 'TRANSFER') {
     return context.entities.Transaction.update({ 
       where: { id: id }, 
       // Ensure envelopeId is explicitly handled in updateData if changing
       data: { 
         ...updateData, 
         envelopeId: updateData.envelopeId !== undefined ? updateData.envelopeId : originalEnvelopeId 
       } 
     });
  }

  // 3. Calculate adjustments needed
  const originalAmount = originalTransaction.amount;
  const newAmount = updateData.amount !== undefined ? updateData.amount : originalAmount;

  const originalSpentAdjustment = originalTransaction.type === 'EXPENSE' ? originalAmount :
                                  originalTransaction.type === 'INCOME' ? -originalAmount : 0;
                                  
  const newSpentAdjustment = newType === 'EXPENSE' ? newAmount :
                           newType === 'INCOME' ? -newAmount : 0;

  // 4. Update transaction and envelope(s) sequentially

  // 4a. Revert effect on original envelope if it existed
  if (originalEnvelopeId) {
    await context.entities.Envelope.update({
      where: { id: originalEnvelopeId },
      data: {
        spent: { decrement: originalSpentAdjustment }
      }
    });
  }

  // 4b. Update the transaction itself (handle potential null envelopeId)
  const updatedTransaction = await context.entities.Transaction.update({
    where: { id: id },
    data: { 
      ...updateData, 
      envelopeId: newEnvelopeId // Explicitly set potentially null envelopeId
     }, 
  });

  // 4c. Apply new effect on the target envelope if it exists
  if (newEnvelopeId) { 
    await context.entities.Envelope.update({
      where: { id: newEnvelopeId }, 
      data: {
        spent: { increment: newSpentAdjustment }
      }
    });
  }

  return updatedTransaction;
}

type DeleteTransactionInput = { id: number }

export const deleteTransaction: DeleteTransaction<DeleteTransactionInput, Transaction> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const { id } = args;

  // 1. Fetch the transaction
  const transaction = await context.entities.Transaction.findUnique({
    where: { id: id },
    select: { id: true, amount: true, type: true, envelopeId: true, budgetProfileId: true }
  });

  if (!transaction) {
    throw new HttpError(404, 'Transaction not found.');
  }
  const originalEnvelopeId = transaction.envelopeId; // Store for adjustment

  // 2. Ensure user permission (MEMBER+)
  await ensureUserRole(context, transaction.budgetProfileId, ['MEMBER', 'ADMIN', 'OWNER']);

  // Prevent deleting TRANSFER transactions
  if (transaction.type === 'TRANSFER') {
      throw new HttpError(400, 'Deleting transfer transactions is not supported yet...');
  }

  // 3. Calculate the effect to reverse
  const spentAdjustment = transaction.type === 'EXPENSE' ? transaction.amount :
                          transaction.type === 'INCOME' ? -transaction.amount : 0;

  // 4. Update original envelope if it existed
  if (originalEnvelopeId) {
    await context.entities.Envelope.update({
        where: { id: originalEnvelopeId },
        data: {
          spent: { decrement: spentAdjustment }
        }
    });
  }

  // 5. Delete the transaction
  const deletedTransaction = await context.entities.Transaction.delete({
      where: { id: id },
  });

  return deletedTransaction; 
}

// ========= Bulk Import Action (Refactored) =========

// Define the structure of transaction data coming from the client
type TransactionImportData = {
  description: string;
  amount: number; // Already parsed to float/number on client
  date: Date;     // Already parsed to Date object on client
  type: TransactionType; 
}

// Update BulkImportInput: removed targetEnvelopeId
type BulkImportInput = {
  transactions: TransactionImportData[]; // Array of processed transactions
}

// Result type remains similar
type BulkImportResult = {
  successCount: number;
  errorCount: number;
  errors: string[]; // List of errors encountered (mainly DB errors)
}

export const bulkImportTransactions: BulkImportTransactions<BulkImportInput, BulkImportResult> = async (args, context) => {
  if (!context.user) { throw new HttpError(401); }
  const { transactions } = args; // Removed targetEnvelopeId
  const budgetProfileId = await getCurrentBudgetProfileId(context);
  // Ensure user permission (MEMBER+)
  await ensureUserRole(context, budgetProfileId, ['MEMBER', 'ADMIN', 'OWNER']);

  // Removed targetEnvelope check
  
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];
  // Removed isArchived and createdById from Omit
  const transactionsToCreate: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'envelopeId'>[] = [];
  // Removed totalSpentAdjustment

  if (!transactions || transactions.length === 0) {
    return { successCount: 0, errorCount: 0, errors: ['No valid transactions received.'] };
  }

  for (const txData of transactions) {
     // Server-side validation
     if (!txData.description || !txData.amount || isNaN(txData.amount) || txData.amount === 0 || !(txData.date instanceof Date) || isNaN(txData.date.getTime()) || !Object.values(TransactionType).includes(txData.type)) {
        errors.push(`Skipping invalid transaction data: ${JSON.stringify(txData)}`);
        errorCount++;
        continue; // Skip to next transaction
     }

     transactionsToCreate.push({
        description: txData.description,
        amount: txData.amount,
        date: txData.date,
        type: txData.type,
        budgetProfileId: budgetProfileId,
        // envelopeId is omitted, will be null by default
     });
  }

  if (transactionsToCreate.length === 0) {
    return { successCount: 0, errorCount: errorCount, errors: [...errors, 'No valid transactions to import after validation.'] };
  }

  try {
    // Use createMany for efficiency
    const result = await context.entities.Transaction.createMany({
      data: transactionsToCreate,
      skipDuplicates: true, // Optional: skip if a unique constraint violation occurs (though we don't have one defined here)
    });
    successCount = result.count;
    errorCount += transactions.length - transactionsToCreate.length; // Add initial validation errors

    // Removed envelope update logic

  } catch (dbError: any) {
    console.error("Database error during bulk import:", dbError);
    errors.push(`Database error during import: ${dbError.message || 'Unknown error'}`);
    errorCount = transactions.length; // Assume all failed if DB error occurs during createMany
    successCount = 0;
  }

  return {
    successCount,
    errorCount,
    errors,
  };
} 