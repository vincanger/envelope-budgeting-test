import type { UpdateUserProfileInput } from './types.ts'
import { User, UserBudgetProfile } from 'wasp/entities'
import { HttpError } from 'wasp/server'
import type { UpdateUserProfile, GetCurrentUserProfile, GetUsers } from 'wasp/server/operations'
import { getCurrentBudgetProfileId } from './permissions.js'

export const updateUserProfile: UpdateUserProfile<UpdateUserProfileInput, User> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated')
  }

  // Update non-auth fields here if any are added later
  const updatedUser = await context.entities.User.update({
    where: { id: context.user.id },
    data: {
      ...(args.displayName !== undefined && { displayName: args.displayName }),
      ...(args.avatarUrl !== undefined && { avatarUrl: args.avatarUrl }),
    },
  })

  // Return user data without password (already excluded by Prisma model)
  return updatedUser;
}

export const getCurrentUserProfile: GetCurrentUserProfile<void, UserBudgetProfile> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  // Get the ID of the profile the user is currently associated with
  const budgetProfileId = await getCurrentBudgetProfileId(context);

  // Fetch the UserBudgetProfile record which contains the role
  const userProfile = await context.entities.UserBudgetProfile.findUnique({
    where: {
      userId_budgetProfileId: {
        userId: context.user.id,
        budgetProfileId: budgetProfileId
      }
    }
  });

  if (!userProfile) {
    // This should theoretically not happen if getCurrentBudgetProfileId succeeded,
    // but good to have a safeguard.
    throw new HttpError(404, 'User profile link not found for the current budget profile.');
  }

  return userProfile;
}

// Define input and output types for getUsers
type GetUsersInput = { userIds: number[] };
// Define UserInfo using Pick
type UserInfo = Pick<User, 'id' | 'email'>;

// Reverted Query Implementation: getUsers using context.entities.User
export const getUsers: GetUsers<GetUsersInput, UserInfo[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  if (!args || !Array.isArray(args.userIds) || args.userIds.length === 0) {
    return []; 
  }

  // Fetch User objects selecting id and email
  const users = await context.entities.User.findMany({
    where: {
      id: { in: args.userIds }
    },
    select: { 
      id: true, 
      email: true // Relying on Wasp providing this standard field
    } 
  });

  // Return the result directly, assuming the type matches UserInfo[]
  // If linter still errors here, it's a persistent Wasp type generation issue for this context.
  return users as UserInfo[]; 
}; 