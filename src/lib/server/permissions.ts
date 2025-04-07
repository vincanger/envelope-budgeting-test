import { HttpError } from 'wasp/server';
import { Prisma } from '@prisma/client'; // Import Prisma types
import type { User, UserBudgetProfile } from 'wasp/entities';

// Define Role hierarchy (higher value means more permissions)
const roleHierarchy: Record<string, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

/**
 * NOTE: Temporary function assuming user belongs to only one profile.
 * Needs refactoring when multi-profile access / profile switching is implemented.
 * Gets the budgetProfileId associated with the current authenticated user.
 * 
 * @param context Wasp operation context
 * @returns The budgetProfileId
 * @throws {HttpError} (401) if user not authenticated
 * @throws {HttpError} (404) if user is not associated with any budget profile
 */
export async function getCurrentBudgetProfileId(context: { user?: User; entities: { UserBudgetProfile: Prisma.UserBudgetProfileDelegate } }): Promise<number> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  // Find the first profile the user is associated with
  const userBudgetProfile = await context.entities.UserBudgetProfile.findFirst({
    where: { userId: context.user.id },
    select: { budgetProfileId: true },
    // TODO: Add ordering or selection logic if user can belong to multiple profiles
  });

  if (!userBudgetProfile) {
    throw new HttpError(404, 'User is not associated with any budget profile.');
  }

  return userBudgetProfile.budgetProfileId;
}

/**
 * Checks if a user has the required role within a specific budget profile.
 * Throws HttpError(403) if the user does not have sufficient permissions.
 * 
 * @param context The Wasp operation context.
 * @param budgetProfileId The ID of the budget profile to check permissions against.
 * @param requiredRoles An array of roles, any of which grants permission. Hierarchy is considered.
 * @returns The UserBudgetProfile record if permission check passes.
 * @throws {HttpError} (401) if user is not authenticated.
 * @throws {HttpError} (403) if user does not have the required role.
 * @throws {HttpError} (404) if the budget profile doesn't exist or user isn't a member (optional, could be 403).
 */
export async function ensureUserRole(
  context: { user?: User; entities: { UserBudgetProfile: Prisma.UserBudgetProfileDelegate } },
  budgetProfileId: number,
  requiredRoles: string[]
): Promise<UserBudgetProfile> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const userBudgetProfile = await context.entities.UserBudgetProfile.findUnique({
    where: {
      userId_budgetProfileId: {
        userId: context.user.id,
        budgetProfileId: budgetProfileId,
      },
    },
  });

  if (!userBudgetProfile) {
    // Or 403? Depends if you want to reveal existence vs. membership
    throw new HttpError(404, 'Budget profile not found or user is not a member.'); 
  }

  const userRoleLevel = roleHierarchy[userBudgetProfile.role] ?? 0; // Get user's level
  const requiredMinLevel = Math.min(
    ...requiredRoles.map(role => roleHierarchy[role] ?? 0) // Find minimum required level
  );

  if (requiredMinLevel === 0) {
      console.error(`Invalid role(s) required: ${requiredRoles.join(', ')} for profile ${budgetProfileId}`);
      throw new HttpError(500, 'Internal server error: Invalid role configuration.');
  }

  // Check if user's role level meets or exceeds the minimum required level
  if (userRoleLevel < requiredMinLevel) {
    throw new HttpError(403, 'Forbidden: Insufficient permissions.');
  }

  // User has sufficient permissions, return their profile link
  return userBudgetProfile;
} 