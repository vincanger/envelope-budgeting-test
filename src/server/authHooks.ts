import type { PrismaClient } from '@prisma/client'
import type { AuthUser } from 'wasp/auth'
// Import hook types and User entity for CreateUserResult
import type { OnAfterSignupHook, OnBeforeSignupHook, CreateUserResult } from 'wasp/server/auth'
import { type User } from 'wasp/entities' // Import User for type checks
import { HttpError } from 'wasp/server' // For throwing errors

interface OnAfterSignupArgs {
  user: CreateUserResult;
  prisma: PrismaClient;
  // req is not reliably passed here
}

/**
 * Wasp Hook: onBeforeSignup
 * 
 * Validates invitation token before user creation.
 */
export const onBeforeSignup: OnBeforeSignupHook = async ({ providerId, prisma, req }) => {
  // Only process if signing up with email method
  if (providerId.providerName !== 'email') {
    return; 
  }
  const signupEmail = providerId.providerUserId;

  // Extract inviteToken from query parameters
  // req.query might not be typed correctly, handle potential array/undefined
  const queryToken = req?.query?.inviteToken;
  const inviteToken = Array.isArray(queryToken) ? queryToken[0] : queryToken;

  // If no token is present, proceed with normal signup
  if (!inviteToken || typeof inviteToken !== 'string') {
    console.log('No valid invite token found in signup request.');
    return; 
  }

  console.log(`Found invite token ${inviteToken} in signup request for ${signupEmail}. Validating...`);

  // Find the PENDING invitation matching the token
  const invitation = await prisma.invitation.findUnique({
    where: { token: inviteToken, status: 'PENDING' },
  });

  // Validate Invitation
  if (!invitation) {
    throw new HttpError(400, 'Invalid invitation token.');
  }
  if (new Date() > invitation.expiresAt) {
    // Optionally update status to EXPIRED here
    // await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
    throw new HttpError(400, 'Invitation token has expired.');
  }
  if (invitation.email.toLowerCase() !== signupEmail.toLowerCase()) {
    throw new HttpError(400, 'Invitation email does not match signup email.');
  }

  console.log(`Invite token ${inviteToken} validated successfully for ${signupEmail}.`);
  // If validation passes, signup proceeds
};

/**
 * Wasp Auth Hook: onAfterSignup
 * 
 * Populates User.email and handles invitation acceptance.
 */
export const updateInvitationStatus: OnAfterSignupHook = async (args: OnAfterSignupArgs): Promise<void> => {
  const { user, prisma } = args;

  const signupEmail = user?.email; 

  if (!signupEmail || typeof signupEmail !== 'string') {
    return; 
  }

  console.log(`Checking for invitation acceptance post-signup for email ${signupEmail} and user ${user.id}`);

  // Use transaction to accept invitation and add user to profile
  try {
    await prisma.$transaction(async (tx) => {
      // Find the PENDING invitation matching the signup email (token was validated in onBeforeSignup)
      // We might get multiple if user was invited to different profiles; process the first valid one?
      // Or better: find one specifically linked to the token if we could pass it (we can't easily)
      // Let's assume for now only one PENDING invite per email is expected or the first one found is okay.
      const invitation = await tx.invitation.findFirst({
        where: {
          email: signupEmail, 
          status: 'PENDING',
          expiresAt: { gt: new Date() } 
        },
      });

      if (!invitation) {
        console.log(`No valid pending invitation found for email ${signupEmail} during onAfterSignup.`);
        return; // Exit transaction silently
      }

      // 1. Update Invitation Status
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedByUserId: user.id, 
        },
      });

      // 2. Create UserBudgetProfile link
      const existingLink = await tx.userBudgetProfile.findUnique({
          where: { userId_budgetProfileId: { userId: user.id, budgetProfileId: invitation.budgetProfileId } }
      });
      if (!existingLink) {
          await tx.userBudgetProfile.create({
            data: {
              userId: user.id,
              budgetProfileId: invitation.budgetProfileId,
              role: invitation.role, 
            },
          });
          console.log(`User ${user.id} successfully added to budget profile ${invitation.budgetProfileId} via invitation ${invitation.id}.`);
      } else {
          console.warn(`User ${user.id} was already linked to budget profile ${invitation.budgetProfileId}. Invitation ${invitation.id} accepted but link skipped.`);
      }
    });
  } catch (error) {
    console.error(`Error processing invitation acceptance for email ${signupEmail} / user ${user.id}:`, error);
  }
};