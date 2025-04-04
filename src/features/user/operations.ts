import type { UpdateUserProfileInput } from './types.ts'
import { User } from 'wasp/entities'
import { HttpError } from 'wasp/server'
import type { UpdateUserProfile } from 'wasp/server/operations' // Assuming this type will be generated



export const updateUserProfile: UpdateUserProfile<UpdateUserProfileInput, User> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated')
  }

  // Update non-auth fields here if any are added later
  const updatedUser = await context.entities.User.update({
    where: { id: context.user.id },
    data: {
      // ...(args.displayName && { displayName: args.displayName }),
    },
  })

  // Return user data without password (already excluded by Prisma model)
  return updatedUser;
} 