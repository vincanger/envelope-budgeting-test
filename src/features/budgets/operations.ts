import { HttpError } from 'wasp/server'
import type { BudgetProfile, User } from 'wasp/entities'
import type { CreateBudgetProfile } from 'wasp/server/operations'

type CreateInput = Pick<BudgetProfile, 'name' | 'description' | 'currency'>

export const createBudgetProfile: CreateBudgetProfile<CreateInput, BudgetProfile> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated')
  }

  // Check if the user already owns a profile (enforce one-to-one)
  const existingProfile = await context.entities.BudgetProfile.findUnique({
    where: { ownerId: context.user.id },
  })

  if (existingProfile) {
    throw new HttpError(400, 'User can only own one budget profile.')
  }

  // Create the new budget profile and link it to the owner
  const newProfile = await context.entities.BudgetProfile.create({
    data: {
      name: args.name,
      description: args.description,
      currency: args.currency || 'USD', // Default currency if not provided
      owner: {
        connect: { id: context.user.id }
      }
    }
  })

  return newProfile
} 