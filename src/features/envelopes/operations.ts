import { HttpError } from 'wasp/server'
import type { Envelope, BudgetProfile } from 'wasp/entities'
import type {
  GetEnvelopes,
  CreateEnvelope,
  UpdateEnvelope,
  DeleteEnvelope
} from 'wasp/server/operations'

// Helper function to get the user's budget profile ID
async function getUserBudgetProfileId(context: any): Promise<number> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const budgetProfile = await context.entities.BudgetProfile.findUnique({
    where: { ownerId: context.user.id },
    select: { id: true },
  });

  if (!budgetProfile) {
    // This might happen if the user hasn't created a profile yet
    // Or if somehow the user context exists but profile doesn't - should be rare
    throw new HttpError(404, 'Budget profile not found for the user.');
  }
  return budgetProfile.id;
}

// ========= Queries =========

export const getEnvelopes: GetEnvelopes<void, Envelope[]> = async (_args, context) => {
  const budgetProfileId = await getUserBudgetProfileId(context);

  return context.entities.Envelope.findMany({
    where: {
      budgetProfileId: budgetProfileId,
      isArchived: false, // Typically only show active envelopes by default
    },
    orderBy: { name: 'asc' },
  });
}

// ========= Actions =========

type CreateEnvelopeInput = Pick<Envelope, 'name' | 'amount' | 'category' | 'color' | 'icon'>

export const createEnvelope: CreateEnvelope<CreateEnvelopeInput, Envelope> = async (args, context) => {
  const budgetProfileId = await getUserBudgetProfileId(context);

  return context.entities.Envelope.create({
    data: {
      name: args.name,
      amount: args.amount || 0,
      category: args.category,
      color: args.color,
      icon: args.icon,
      budgetProfile: {
        connect: { id: budgetProfileId }
      }
    }
  });
}

type UpdateEnvelopeInput = Partial<Pick<Envelope, 'name' | 'amount' | 'category' | 'color' | 'icon' | 'isArchived'>> & { id: number }

export const updateEnvelope: UpdateEnvelope<UpdateEnvelopeInput, Envelope> = async (args, context) => {
  const budgetProfileId = await getUserBudgetProfileId(context);
  const { id, ...updateData } = args;

  // Verify the envelope belongs to the user's budget profile
  const envelope = await context.entities.Envelope.findFirst({
    where: {
      id: id,
      budgetProfileId: budgetProfileId,
    }
  });

  if (!envelope) {
    throw new HttpError(404, 'Envelope not found or access denied.');
  }

  return context.entities.Envelope.update({
    where: { id: id },
    data: updateData,
  });
}

type DeleteEnvelopeInput = { id: number }

export const deleteEnvelope: DeleteEnvelope<DeleteEnvelopeInput, Envelope> = async (args, context) => {
  const budgetProfileId = await getUserBudgetProfileId(context);
  const { id } = args;

  // Verify the envelope belongs to the user's budget profile
  const envelope = await context.entities.Envelope.findFirst({
    where: {
      id: id,
      budgetProfileId: budgetProfileId,
    },
    include: { _count: { select: { transactions: true } } } // Check for transactions
  });

  if (!envelope) {
    throw new HttpError(404, 'Envelope not found or access denied.');
  }

  // Prevent deleting envelopes with transactions based on schema's onDelete: Restrict
  // Although Prisma prevents this at DB level, check here for a cleaner error
  if (envelope._count.transactions > 0) {
     throw new HttpError(400, 'Cannot delete envelope with existing transactions. Archive it instead or reassign transactions.');
  }

  // If no transactions, proceed with deletion
  return context.entities.Envelope.delete({
    where: { id: id },
  });
} 