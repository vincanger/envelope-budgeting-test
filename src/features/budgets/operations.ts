import { HttpError } from 'wasp/server'
import type { BudgetProfile, User, UserBudgetProfile, Invitation } from 'wasp/entities'
import type { CreateBudgetProfile, GetBudgetProfileMembers, InviteUser, GetPendingInvitations, RevokeInvitation, UpdateMemberRole, RemoveMember, GetUserBudgetProfiles } from 'wasp/server/operations'
import { ensureUserRole, getCurrentBudgetProfileId } from '../../lib/server/permissions'
// Remove prisma import if no longer needed here
// import { prisma } from 'wasp/server' 
// Import crypto for token generation
import crypto from 'crypto';
// Import Wasp email sender
import { emailSender } from 'wasp/server/email';

type CreateInput = Pick<BudgetProfile, 'name' | 'description' | 'currency'>

export const createBudgetProfile: CreateBudgetProfile<CreateInput, BudgetProfile> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated')
  }

  // Check if the user already owns a profile
  const existingProfile = await context.entities.BudgetProfile.findUnique({
    where: { ownerId: context.user.id }, 
  })
  if (existingProfile) {
    throw new HttpError(400, 'User can only own one budget profile.')
  }

  // Create the BudgetProfile and UserBudgetProfile link
  // Email population is now handled by the onAfterSignup hook
  const newProfile = await context.entities.BudgetProfile.create({
    data: {
      name: args.name,
      description: args.description,
      currency: args.currency || 'USD',
      owner: {
        connect: { id: context.user.id }
      },
      members: {
        create: {
          userId: context.user.id,
          role: 'OWNER'
        }
      }
    }
  });

  return newProfile;
}

// ========= Queries =========

// NOTE: This query now ONLY returns the UserBudgetProfile link records.
// The client will need to fetch associated User details separately if needed.
export const getBudgetProfileMembers: GetBudgetProfileMembers<void, UserBudgetProfile[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const budgetProfileId = await getCurrentBudgetProfileId(context);
  await ensureUserRole(context, budgetProfileId, ['MEMBER', 'ADMIN', 'OWNER']);

  // Fetch UserBudgetProfile records for this profile
  const memberLinks = await context.entities.UserBudgetProfile.findMany({
    where: { budgetProfileId: budgetProfileId },
    select: { 
        // Select all necessary fields from UserBudgetProfile itself
        id: true, userId: true, budgetProfileId: true, 
        role: true, createdAt: true, updatedAt: true 
    },
    // Optionally order by role or join date if needed
    // orderBy: { role: 'asc' } 
  });

  return memberLinks;
}; 

// ========= Actions =========

type InviteUserInput = {
  email: string; 
  role: string; 
};

// Return type might be UserBudgetProfile OR Invitation now
export const inviteUser: InviteUser<InviteUserInput, UserBudgetProfile | Invitation> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const { email, role } = args;

  // Basic input validation
  if (!email || !role) {
      throw new HttpError(400, 'Email and role are required.');
  }
  if (role === 'OWNER') {
    throw new HttpError(400, 'Cannot invite user with OWNER role.');
  }
  if (!['ADMIN', 'MEMBER'].includes(role)) {
      throw new HttpError(400, 'Invalid role specified.');
  }

  // 1. Get current profile ID and check inviter's permissions
  const budgetProfileId = await getCurrentBudgetProfileId(context);
  await ensureUserRole(context, budgetProfileId, ['ADMIN', 'OWNER']);
  const inviterUserId = context.user.id; // ID of the user sending the invite

  // 2. Check if target email belongs to the profile owner
  const profile = await context.entities.BudgetProfile.findUnique({
      where: { id: budgetProfileId },
      include: { owner: { select: { email: true, id: true } } } // Include owner's email
  });
  if (!profile) {
       throw new HttpError(404, 'Budget profile not found.'); // Should not happen if getCurrentBudgetProfileId worked
  }
  if (profile.owner.email === email) {
      throw new HttpError(400, 'Cannot invite the profile owner.');
  }

  // 3. Check if a user with this email already exists
  const existingUser = await context.entities.User.findUnique({
    where: { email: email },
  });

  if (existingUser) {
    // USER EXISTS - Add directly to UserBudgetProfile if not already a member
    const existingLink = await context.entities.UserBudgetProfile.findUnique({
      where: { userId_budgetProfileId: { userId: existingUser.id, budgetProfileId: budgetProfileId } },
    });

    if (existingLink) {
      throw new HttpError(409, `User ${email} is already a member of this budget profile.`);
    }

    // Add existing user directly
    const newUserBudgetProfile = await context.entities.UserBudgetProfile.create({
      data: {
        userId: existingUser.id,
        budgetProfileId: budgetProfileId,
        role: role,
        // Note: No need to link invitedBy here as it's a direct add
      },
    });
    console.log(`Added existing user ${email} to profile ${budgetProfileId} as ${role}.`);
    // TODO: Optionally send an email notification about being added
    return newUserBudgetProfile;

  } else {
    // USER DOES NOT EXIST - Create an Invitation record

    // Check for existing PENDING invitation for this email/profile
    const existingPendingInvite = await context.entities.Invitation.findFirst({
        where: {
            email: email,
            budgetProfileId: budgetProfileId,
            status: 'PENDING'
        }
    });

    if (existingPendingInvite) {
        // Optional: Resend email / update expiry? For now, just inform.
        throw new HttpError(409, `An invitation for ${email} to this profile is already pending.`);
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Expires in 7 days

    const newInvitation = await context.entities.Invitation.create({
      data: {
        email: email,
        budgetProfileId: budgetProfileId,
        role: role,
        token: token,
        status: 'PENDING',
        expiresAt: expiresAt,
        invitedByUserId: inviterUserId, // Link to the user sending the invite
      },
    });

    console.log(`Created PENDING invitation for ${email} to profile ${budgetProfileId} with token ${token}.`);

    // Construct the signup link
    // TODO: Use environment variable for base URL in production
    const signupLink = `${process.env.WASP_WEB_CLIENT_URL || 'http://localhost:3000'}/signup?inviteToken=${token}`;

    // Send invitation email
    try {
      await emailSender.send({
        to: email,
        subject: `You're invited to join a budget profile!`, // TODO: Make subject more specific?
        text: `Hello,\n\nYou have been invited to join a budget profile.\n\nClick here to accept and sign up: ${signupLink}\n\nThis invitation expires on ${expiresAt.toLocaleDateString()}\n\nIf you did not expect this invitation, please ignore this email.`,
        html: `<p>Hello,</p><p>You have been invited to join a budget profile.</p><p><a href="${signupLink}">Click here to accept and sign up</a></p><p>This invitation expires on ${expiresAt.toLocaleDateString()}.</p><p>If you did not expect this invitation, please ignore this email.</p>`,
      });
       console.log(`Invitation email sent successfully to ${email}`);
    } catch (emailError) {
        console.error(`Failed to send invitation email to ${email}:`, emailError);
        // Decide if we should throw an error or just log. 
        // For now, log and continue, as the invite record was created.
    }

    return newInvitation;
  }
}; 

// ========= Queries ========= (Add new query here)

export const getPendingInvitations: GetPendingInvitations<void, Invitation[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  // 1. Get current profile ID
  const budgetProfileId = await getCurrentBudgetProfileId(context);

  // 2. Ensure current user has permission to view invitations (ADMIN or OWNER)
  await ensureUserRole(context, budgetProfileId, ['ADMIN', 'OWNER']);

  // 3. Fetch PENDING invitations for this profile
  const pendingInvitations = await context.entities.Invitation.findMany({
    where: {
      budgetProfileId: budgetProfileId,
      status: 'PENDING',
      expiresAt: { gt: new Date() } // Optionally filter out expired ones here too
    },
    orderBy: {
      createdAt: 'desc' // Show newest first
    }
  });

  return pendingInvitations;
}; 

// ========= Actions ========= (Add new action here)

type RevokeInvitationInput = { 
  invitationId: string; // ID of the invitation to revoke
};

export const revokeInvitation: RevokeInvitation<RevokeInvitationInput, Invitation> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const { invitationId } = args;

  // 1. Fetch the invitation to get its budgetProfileId
  const invitation = await context.entities.Invitation.findUnique({
    where: { id: invitationId },
    select: { id: true, budgetProfileId: true, status: true }
  });

  if (!invitation) {
    throw new HttpError(404, 'Invitation not found.');
  }

  // 2. Ensure current user has permission to manage invites (ADMIN or OWNER)
  await ensureUserRole(context, invitation.budgetProfileId, ['ADMIN', 'OWNER']);

  // 3. Check if the invitation is still PENDING
  if (invitation.status !== 'PENDING') {
    throw new HttpError(400, `Cannot revoke invitation with status ${invitation.status}.`);
  }

  // 4. Delete the PENDING invitation
  // Alternatively, could update status to REVOKED
  const revokedInvitation = await context.entities.Invitation.delete({
    where: { id: invitationId }
  });

  console.log(`Revoked invitation ${invitationId} for profile ${invitation.budgetProfileId}.`);
  return revokedInvitation; // Return the deleted data
}; 

type UpdateMemberRoleInput = {
  userId: number; // ID of the user whose role is being changed
  newRole: string; // The new role to assign (e.g., MEMBER, ADMIN)
};

export const updateMemberRole: UpdateMemberRole<UpdateMemberRoleInput, UserBudgetProfile> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const { userId: targetUserId, newRole } = args;
  const currentUserId = context.user.id;

  // Validate new role
  if (!['ADMIN', 'MEMBER'].includes(newRole)) {
      throw new HttpError(400, 'Invalid target role specified. Can only change to ADMIN or MEMBER.');
  }

  // 1. Get current profile ID (needed for permission check and finding target link)
  const budgetProfileId = await getCurrentBudgetProfileId(context);

  // 2. Ensure current user has permission to change roles (ADMIN or OWNER)
  // We also fetch the current user's link to check if they are the owner later
  const currentUserLink = await ensureUserRole(context, budgetProfileId, ['ADMIN', 'OWNER']);

  // 3. Find the target user's link record
  const targetUserLink = await context.entities.UserBudgetProfile.findUnique({
    where: {
      userId_budgetProfileId: { userId: targetUserId, budgetProfileId: budgetProfileId }
    }
  });

  if (!targetUserLink) {
    throw new HttpError(404, 'Target user is not a member of this budget profile.');
  }

  // 4. Prevent changing the OWNER's role
  if (targetUserLink.role === 'OWNER') {
    throw new HttpError(403, 'Cannot change the role of the budget profile owner.');
  }

  // 5. Prevent OWNER from demoting themselves (should transfer ownership instead)
  if (currentUserLink.role === 'OWNER' && currentUserId === targetUserId) {
      throw new HttpError(403, 'Owner cannot change their own role. Transfer ownership first.');
  }
  
  // 6. Prevent ADMIN from changing another ADMIN's role or their own role (only OWNER can)
  if (currentUserLink.role === 'ADMIN' && (targetUserLink.role === 'ADMIN' || currentUserId === targetUserId)) {
      throw new HttpError(403, 'Admins cannot change their own role or other Admins\' roles.')
  }

  // 7. Update the role if all checks pass
  const updatedLink = await context.entities.UserBudgetProfile.update({
    where: {
      userId_budgetProfileId: { userId: targetUserId, budgetProfileId: budgetProfileId }
    },
    data: { role: newRole },
  });

  console.log(`Updated role for user ${targetUserId} in profile ${budgetProfileId} to ${newRole}.`);
  return updatedLink;
}; 

type RemoveMemberInput = {
  userId: number; // ID of the user to remove
};

export const removeMember: RemoveMember<RemoveMemberInput, UserBudgetProfile> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }
  const { userId: targetUserId } = args;
  const currentUserId = context.user.id;

  // Prevent removing self
  if (currentUserId === targetUserId) {
    throw new HttpError(400, 'Cannot remove yourself from the budget profile.');
  }

  // 1. Get current profile ID
  const budgetProfileId = await getCurrentBudgetProfileId(context);

  // 2. Ensure current user has permission to remove members (ADMIN or OWNER)
  const currentUserLink = await ensureUserRole(context, budgetProfileId, ['ADMIN', 'OWNER']);

  // 3. Find the target user's link record
  const targetUserLink = await context.entities.UserBudgetProfile.findUnique({
    where: {
      userId_budgetProfileId: { userId: targetUserId, budgetProfileId: budgetProfileId }
    }
  });

  if (!targetUserLink) {
    throw new HttpError(404, 'Target user is not a member of this budget profile.');
  }

  // 4. Prevent removing the OWNER
  if (targetUserLink.role === 'OWNER') {
    throw new HttpError(403, 'Cannot remove the budget profile owner.');
  }
  
  // 5. Prevent ADMIN from removing another ADMIN (only OWNER can)
  if (currentUserLink.role === 'ADMIN' && targetUserLink.role === 'ADMIN') {
      throw new HttpError(403, 'Admins cannot remove other Admins.')
  }

  // 6. Delete the UserBudgetProfile link if all checks pass
  const removedLink = await context.entities.UserBudgetProfile.delete({
    where: {
      userId_budgetProfileId: { userId: targetUserId, budgetProfileId: budgetProfileId }
    }
  });

  console.log(`Removed user ${targetUserId} from profile ${budgetProfileId}.`);
  return removedLink; // Return the deleted data
}; 

// Implementation for the new query
// Add explicit any types until Wasp generates the correct type
export const getUserBudgetProfiles: GetUserBudgetProfiles<void, UserBudgetProfile[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  // Find all budget profiles the user is associated with
  const profiles = await context.entities.UserBudgetProfile.findMany({
    where: {
      userId: context.user.id
    },
  });

  return profiles;
}; 