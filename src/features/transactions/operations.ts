import { HttpError } from 'wasp/server'
import type { Transaction, BudgetProfile, Envelope } from 'wasp/entities'
import type {
  GetTransactions,
  CreateTransaction,
  UpdateTransaction,
  DeleteTransaction
} from 'wasp/server/operations'

// Helper function to get the user's budget profile ID (consider moving to shared location later)
async function getUserBudgetProfileId(context: any): Promise<number> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const budgetProfile = await context.entities.BudgetProfile.findUnique({
    where: { ownerId: context.user.id },
    select: { id: true },
  });
  if (!budgetProfile) {
    throw new HttpError(404, 'Budget profile not found for the user.');
  }
  return budgetProfile.id;
}

// Helper function to verify envelope belongs to budget profile
async function verifyEnvelopeAccess(context: any, envelopeId: number, budgetProfileId: number): Promise<void> {
  const envelope = await context.entities.Envelope.findFirst({
    where: { id: envelopeId, budgetProfileId: budgetProfileId },
  });
  if (!envelope) {
    throw new HttpError(403, 'Access denied: Envelope does not belong to this budget profile.');
  }
}

// ========= Queries =========

type GetTransactionsInput = { 
  envelopeId?: number;
  // Add pagination, date range filters later
}

// Basic implementation - fetches all transactions for the budget profile
// TODO: Implement filtering by envelopeId, pagination, date ranges
export const getTransactions: GetTransactions<GetTransactionsInput, Transaction[]> = async (args, context) => {
  const budgetProfileId = await getUserBudgetProfileId(context);

  return context.entities.Transaction.findMany({
    where: {
      budgetProfileId: budgetProfileId,
      // ...(args.envelopeId && { envelopeId: args.envelopeId }) // Add filtering later
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
  const budgetProfileId = await getUserBudgetProfileId(context);
  await verifyEnvelopeAccess(context, args.envelopeId, budgetProfileId);

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

  // Return the created transaction
  // Note: Envelope update happens after, so this returned transaction 
  // might not reflect the *final* state immediately if queried right after,
  // but the envelope balance *will* be updated in the DB.
  return newTransaction;
}

type UpdateTransactionInput = Partial<Pick<Transaction, 'description' | 'amount' | 'date' | 'envelopeId' | 'type' | 'isArchived'>> & { id: number }

export const updateTransaction: UpdateTransaction<UpdateTransactionInput, Transaction> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const budgetProfileId = await getUserBudgetProfileId(context);
  const { id, ...updateData } = args;

  // 1. Fetch the original transaction
  const originalTransaction = await context.entities.Transaction.findFirst({
    where: { id: id, budgetProfileId: budgetProfileId },
  });

  if (!originalTransaction) {
    throw new HttpError(404, 'Transaction not found or access denied.');
  }

  // Determine if envelope is changing and verify access to the new envelope if needed
  const newEnvelopeId = updateData.envelopeId !== undefined ? updateData.envelopeId : originalTransaction.envelopeId;
  if (newEnvelopeId !== originalTransaction.envelopeId) {
    await verifyEnvelopeAccess(context, newEnvelopeId, budgetProfileId);
  }

  // Cannot change type to/from TRANSFER using this action
  const newType = updateData.type !== undefined ? updateData.type : originalTransaction.type;
  if ((newType === 'TRANSFER' && originalTransaction.type !== 'TRANSFER') || 
      (newType !== 'TRANSFER' && originalTransaction.type === 'TRANSFER')) {
    throw new HttpError(400, 'Cannot change transaction type to/from TRANSFER. Use specific transfer operations or delete/recreate.');
  }
  if (newType === 'TRANSFER') { // No balance adjustments for transfers here
     return context.entities.Transaction.update({ where: { id: id }, data: updateData });
  }

  // 2. Calculate adjustments needed for envelope balances
  const originalAmount = originalTransaction.amount;
  const newAmount = updateData.amount !== undefined ? updateData.amount : originalAmount;

  // Calculate spent adjustment for the original state
  const originalSpentAdjustment = originalTransaction.type === 'EXPENSE' ? originalAmount :
                                  originalTransaction.type === 'INCOME' ? -originalAmount : 0;
                                  
  // Calculate spent adjustment for the new state
  const newSpentAdjustment = newType === 'EXPENSE' ? newAmount :
                           newType === 'INCOME' ? -newAmount : 0;

  // 3. Update transaction and envelope(s) sequentially

  // 3a. Revert effect on original envelope
  await context.entities.Envelope.update({
    where: { id: originalTransaction.envelopeId },
    data: {
      spent: { decrement: originalSpentAdjustment } // Decrement reverses the original effect
    }
  });

  // 3b. Update the transaction itself
  const updatedTransaction = await context.entities.Transaction.update({
    where: { id: id },
    data: updateData, 
  });

  // 3c. Apply new effect on the target envelope (might be same as original)
  await context.entities.Envelope.update({
    where: { id: newEnvelopeId }, // Use potentially new envelope ID
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
  const budgetProfileId = await getUserBudgetProfileId(context);
  const { id } = args;

  // 1. Verify the transaction exists and belongs to the user's budget profile
  const transaction = await context.entities.Transaction.findFirst({
    where: { id: id, budgetProfileId: budgetProfileId },
  });

  if (!transaction) {
    throw new HttpError(404, 'Transaction not found or access denied.');
  }

  // Prevent deleting TRANSFER transactions for now - requires more complex handling
  if (transaction.type === 'TRANSFER') {
      throw new HttpError(400, 'Deleting transfer transactions is not supported yet. Please adjust balances manually or delete the corresponding transfer leg.');
  }

  // 2. Calculate the effect to reverse on the envelope
  const spentAdjustment = transaction.type === 'EXPENSE' ? transaction.amount :
                          transaction.type === 'INCOME' ? -transaction.amount : 0;

  // 3. Update envelope first (revert effect)
  await context.entities.Envelope.update({
      where: { id: transaction.envelopeId },
      data: {
        spent: { decrement: spentAdjustment } // Decrement reverses the original effect
      }
  });

  // 4. Delete the transaction
  const deletedTransaction = await context.entities.Transaction.delete({
      where: { id: id },
  });

  return deletedTransaction; // Return the deleted transaction data
} 