import { HttpError } from 'wasp/server'
import type { Transaction, BudgetProfile, Envelope } from 'wasp/entities'
import type {
  GetTransactions,
  CreateTransaction,
  UpdateTransaction,
  DeleteTransaction
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
      isArchived: false, // Usually only show active transactions
    },
    orderBy: { date: 'desc' }, // Show most recent first
  });
}

// ========= Actions =========

type CreateTransactionInput = Pick<Transaction, 'description' | 'amount' | 'date' | 'envelopeId' | 'type'>

export const createTransaction: CreateTransaction<CreateTransactionInput, Transaction> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const budgetProfileId = await getCurrentBudgetProfileId(context);

  // Ensure user has permission to create transactions in this profile (MEMBER+)
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
      envelope: { connect: { id: args.envelopeId } },
      budgetProfile: { connect: { id: budgetProfileId } },
      createdBy: { connect: { id: context.user.id } }
    }
  });

  // 2. Update the envelope's spent amount (sequentially)
  const spentAdjustment = args.type === 'EXPENSE' ? args.amount :
                          args.type === 'INCOME' ? -args.amount : 0;

  await context.entities.Envelope.update({
    where: { id: args.envelopeId },
    data: {
      spent: { increment: spentAdjustment }
    }
  });

  return newTransaction;
}

type UpdateTransactionInput = Partial<Pick<Transaction, 'description' | 'amount' | 'date' | 'envelopeId' | 'type' | 'isArchived'>> & { id: number }

export const updateTransaction: UpdateTransaction<UpdateTransactionInput, Transaction> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const { id, ...updateData } = args;

  // 1. Fetch the original transaction to get its budgetProfileId
  const originalTransaction = await context.entities.Transaction.findUnique({
    where: { id: id },
    select: { id: true, amount: true, type: true, envelopeId: true, budgetProfileId: true }
  });

  if (!originalTransaction) {
    throw new HttpError(404, 'Transaction not found.');
  }

  // 2. Ensure user has permission to modify transactions in this profile (MEMBER+)
  await ensureUserRole(context, originalTransaction.budgetProfileId, ['MEMBER', 'ADMIN', 'OWNER']);

  // Determine if envelope is changing and verify access to the new envelope if needed
  const newEnvelopeId = updateData.envelopeId !== undefined ? updateData.envelopeId : originalTransaction.envelopeId;
  if (newEnvelopeId !== originalTransaction.envelopeId) {
    // Verify access to the *new* envelope (also redundant if role check above is sufficient)
    // await verifyEnvelopeAccess(context, newEnvelopeId, originalTransaction.budgetProfileId);
  }

  // Cannot change type to/from TRANSFER using this action
  const newType = updateData.type !== undefined ? updateData.type : originalTransaction.type;
  if ((newType === 'TRANSFER' && originalTransaction.type !== 'TRANSFER') || 
      (newType !== 'TRANSFER' && originalTransaction.type === 'TRANSFER')) {
    throw new HttpError(400, 'Cannot change transaction type to/from TRANSFER...');
  }
  if (newType === 'TRANSFER') {
     return context.entities.Transaction.update({ where: { id: id }, data: updateData });
  }

  // 3. Calculate adjustments needed for envelope balances
  const originalAmount = originalTransaction.amount;
  const newAmount = updateData.amount !== undefined ? updateData.amount : originalAmount;

  const originalSpentAdjustment = originalTransaction.type === 'EXPENSE' ? originalAmount :
                                  originalTransaction.type === 'INCOME' ? -originalAmount : 0;
                                  
  const newSpentAdjustment = newType === 'EXPENSE' ? newAmount :
                           newType === 'INCOME' ? -newAmount : 0;

  // 4. Update transaction and envelope(s) sequentially

  // 4a. Revert effect on original envelope
  await context.entities.Envelope.update({
    where: { id: originalTransaction.envelopeId },
    data: {
      spent: { decrement: originalSpentAdjustment }
    }
  });

  // 4b. Update the transaction itself
  const updatedTransaction = await context.entities.Transaction.update({
    where: { id: id },
    data: updateData, 
  });

  // 4c. Apply new effect on the target envelope (might be same as original)
  await context.entities.Envelope.update({
    where: { id: newEnvelopeId }, 
    data: {
      spent: { increment: newSpentAdjustment }
    }
  });

  return updatedTransaction;
}

type DeleteTransactionInput = { id: number }

export const deleteTransaction: DeleteTransaction<DeleteTransactionInput, Transaction> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const { id } = args;

  // 1. Fetch the transaction to verify existence and get budgetProfileId
  const transaction = await context.entities.Transaction.findUnique({
    where: { id: id },
    select: { id: true, amount: true, type: true, envelopeId: true, budgetProfileId: true }
  });

  if (!transaction) {
    throw new HttpError(404, 'Transaction not found.');
  }

  // 2. Ensure user has permission to delete transactions in this profile (MEMBER+)
  await ensureUserRole(context, transaction.budgetProfileId, ['MEMBER', 'ADMIN', 'OWNER']);

  // Prevent deleting TRANSFER transactions for now
  if (transaction.type === 'TRANSFER') {
      throw new HttpError(400, 'Deleting transfer transactions is not supported yet...');
  }

  // 3. Calculate the effect to reverse on the envelope
  const spentAdjustment = transaction.type === 'EXPENSE' ? transaction.amount :
                          transaction.type === 'INCOME' ? -transaction.amount : 0;

  // 4. Update envelope first (revert effect)
  await context.entities.Envelope.update({
      where: { id: transaction.envelopeId },
      data: {
        spent: { decrement: spentAdjustment }
      }
  });

  // 5. Delete the transaction
  const deletedTransaction = await context.entities.Transaction.delete({
      where: { id: id },
  });

  return deletedTransaction; 
} 