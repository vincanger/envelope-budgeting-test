import { HttpError } from 'wasp/server'
import type { Envelope, BudgetProfile } from 'wasp/entities'
import type {
  GetEnvelopes,
  CreateEnvelope,
  UpdateEnvelope,
  DeleteEnvelope
} from 'wasp/server/operations'
import { ensureUserRole, getCurrentBudgetProfileId } from '../../lib/server/permissions'

// ========= Queries =========

// GET should generally be allowed for any member (or based on future fine-grained permissions)
export const getEnvelopes: GetEnvelopes<void, Envelope[]> = async (_args, context) => {
  // Use the revised helper
  const budgetProfileId = await getCurrentBudgetProfileId(context); 

  // Ensure the user is at least a MEMBER of this profile
  await ensureUserRole(context, budgetProfileId, ['MEMBER', 'ADMIN', 'OWNER']);

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

// Creating might require ADMIN or OWNER role
export const createEnvelope: CreateEnvelope<CreateEnvelopeInput, Envelope> = async (args, context) => {
  // Use the revised helper
  const budgetProfileId = await getCurrentBudgetProfileId(context);

  // Ensure the user has permission to create envelopes in this profile (e.g., ADMIN, OWNER)
  await ensureUserRole(context, budgetProfileId, ['ADMIN', 'OWNER']);

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

// Updating requires ADMIN or OWNER role
export const updateEnvelope: UpdateEnvelope<UpdateEnvelopeInput, Envelope> = async (args, context) => {
  const { id, ...updateData } = args;

  // Find the envelope first to get its budgetProfileId
  const envelope = await context.entities.Envelope.findUnique({
    where: { id: id },
    select: { budgetProfileId: true } // Select only the profile ID
  });

  if (!envelope) {
    throw new HttpError(404, 'Envelope not found.');
  }

  // Ensure the user has permission to update envelopes in this profile (e.g., ADMIN, OWNER)
  await ensureUserRole(context, envelope.budgetProfileId, ['ADMIN', 'OWNER']);

  // Now that permission is verified, perform the update
  return context.entities.Envelope.update({
    where: { id: id },
    data: updateData,
  });
}

type DeleteEnvelopeInput = { id: number }

// Deleting requires ADMIN or OWNER role
export const deleteEnvelope: DeleteEnvelope<DeleteEnvelopeInput, Envelope> = async (args, context) => {
  const { id } = args;

  // Find the envelope to get its profile ID and transaction count
  const envelope = await context.entities.Envelope.findUnique({
    where: { id: id },
    select: { 
      budgetProfileId: true, 
      _count: { select: { transactions: true } } // Check for transactions
    }
  });

  if (!envelope) {
    throw new HttpError(404, 'Envelope not found.');
  }

  // Ensure the user has permission to delete envelopes in this profile (e.g., ADMIN, OWNER)
  await ensureUserRole(context, envelope.budgetProfileId, ['ADMIN', 'OWNER']);

  // Check for transactions before deleting
  if (envelope._count.transactions > 0) {
     throw new HttpError(400, 'Cannot delete envelope with existing transactions. Archive it instead or reassign transactions.');
  }

  // If permission is granted and no transactions exist, proceed with deletion
  return context.entities.Envelope.delete({
    where: { id: id },
  });
} 