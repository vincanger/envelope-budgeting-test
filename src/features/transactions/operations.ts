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
import { ensureUserRole, getCurrentBudgetProfileId } from '../user/permissions'

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
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const budgetProfileId = await getCurrentBudgetProfileId(context);

  // Ensure user has permission (MEMBER+)
  await ensureUserRole(context, budgetProfileId, ['MEMBER', 'ADMIN', 'OWNER']);

  const results: BulkImportResult = { successCount: 0, errorCount: 0, errors: [] };

  // Process each transaction individually within a loop
  for (const txData of args.transactions) {
    try {
      // NEW LOGIC: Determine type and adjust amount
      const originalAmount = txData.amount; // Amount parsed on client (could be negative)
      const finalAmount = Math.abs(originalAmount); // Store positive amount
      // Determine type based on original sign. If it was 0, default to EXPENSE or throw error?
      // Let's assume client validation prevents zero amounts, default to EXPENSE if somehow 0.
      const finalType = originalAmount < 0 ? TransactionType.EXPENSE : 
                        originalAmount > 0 ? TransactionType.INCOME :
                        TransactionType.EXPENSE; // Default for 0, though should be caught by validation
      
      // Validate final amount (optional server-side check)
      if (finalAmount === 0) {
          throw new Error('Transaction amount cannot be zero.');
      }

      await context.entities.Transaction.create({
        data: {
          description: txData.description,
          amount: finalAmount, // Use the absolute value
          date: txData.date,
          type: finalType,    // Use the determined type
          // envelopeId: null, // Envelope is not assigned during bulk import
          budgetProfile: { connect: { id: budgetProfileId } },
          // createdBy: { connect: { id: context.user.id } } // Removed
        },
      });
      results.successCount++;
    } catch (error: any) {
      results.errorCount++;
      const errorMsg = `Failed to import row (Description: ${txData.description}): ${error.message || 'Unknown error'}`;
      console.error(errorMsg, error); // Log full error on server
      results.errors.push(errorMsg);
    }
  }

  // Note: This implementation does NOT update Envelope spent amounts.
  // Doing so requires fetching each envelope and updating, which can be slow for large imports.
  // A separate job or manual recalc might be better for updating envelope aggregates after bulk import.

  return results;
} 