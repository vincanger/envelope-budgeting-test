import React, { useState } from 'react';
import { useQuery } from 'wasp/client/operations';
import { getCurrentUserProfile, getBudgetProfileMembers, getUsers, inviteUser, getPendingInvitations, revokeInvitation, updateMemberRole, removeMember } from 'wasp/client/operations';
import { useToast } from '../../../hooks/use-toast';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { PlusCircle, Mail, Clock, XCircle, Trash2, ChevronDown } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../../components/ui/alert-dialog';

// Import ContentSection
import ContentSection from '../components/content-section';

// Define combined type for display
type MemberDisplayInfo = {
  userId: number;
  email: string | null;
  role: string;
};

export function MembersSettings() {
  // Get the toast function from our custom hook
  const { toast } = useToast();

  // 1. Check current user's role
  const { data: currentUserProfile, isLoading: isLoadingCurrentUser, error: errorCurrentUser } = useQuery(getCurrentUserProfile);

  // 2. Fetch member links (userId, role)
  const { data: memberLinks, isLoading: isLoadingMembers, error: errorMembers } = useQuery(getBudgetProfileMembers);

  // 3. Extract user IDs for the next query
  const userIds = React.useMemo(() => {
    return memberLinks?.map((link) => link.userId) ?? [];
  }, [memberLinks]);

  // 4. Fetch user details (id, email) based on extracted IDs
  // Enable query only when userIds array is not empty
  const { data: users, isLoading: isLoadingUsers, error: errorUsers } = useQuery(getUsers, { userIds }, { enabled: userIds.length > 0 });

  // 5. Combine member links and user details
  const membersDisplayList: MemberDisplayInfo[] = React.useMemo(() => {
    if (!memberLinks || !users) return [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return memberLinks.map((link) => ({
      userId: link.userId,
      email: userMap.get(link.userId)?.email ?? 'N/A',
      role: link.role,
    }));
  }, [memberLinks, users]);

  // Fetch Pending Invitations
  const {
    data: pendingInvites,
    isLoading: isLoadingInvites,
    error: errorInvites,
  } = useQuery(
    getPendingInvitations,
    undefined, // No args for this query
    { enabled: !!currentUserProfile && ['ADMIN', 'OWNER'].includes(currentUserProfile.role) } // Only fetch if user is Admin/Owner
  );

  // State for revoke button loading
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null);

  // State for Invite Dialog
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER'); // Default to MEMBER
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // State for Member Actions (Role Update / Remove)
  const [isUpdatingRoleId, setIsUpdatingRoleId] = useState<number | null>(null);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<MemberDisplayInfo | null>(null);

  // Check if current user can manage members (for showing invite button)
  const canManageMembers = currentUserProfile && ['ADMIN', 'OWNER'].includes(currentUserProfile.role);
  const isOwner = currentUserProfile?.role === 'OWNER';

  // --- Handlers ---
  const handleInviteUser = async () => {
    if (!inviteEmail) return;
    setInviteError(null);
    setIsInviting(true);
    try {
      await inviteUser({ email: inviteEmail, role: inviteRole });
      setIsInviteDialogOpen(false); // Close dialog on success
      setInviteEmail(''); // Reset form
      setInviteRole('MEMBER');
      // Use custom toast for success
      toast({
        title: 'Invitation Sent',
        description: `Invitation sent to ${inviteEmail}.`,
        variant: 'default', // Or your desired success variant
      });
    } catch (err: any) {
      // Use custom toast for error
      toast({
        title: 'Invitation Failed',
        description: err.message || 'Failed to invite user',
        variant: 'destructive',
      });
      // Keep setting local error state if needed for inline display
      setInviteError(err.message || 'Failed to invite user');
    } finally {
      setIsInviting(false);
    }
  };

  // --- Handler for Revoke ---
  const handleRevokeInvite = async (invitationId: string) => {
    if (isRevokingId) return; // Prevent double clicks
    setIsRevokingId(invitationId);
    try {
      await revokeInvitation({ invitationId });
      // Use custom toast for success
      toast({
        title: 'Invitation Revoked',
        variant: 'default', // Or your success variant
      });
    } catch (error: any) {
      // Use custom toast for error
      toast({
        title: 'Revoke Failed',
        description: error.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsRevokingId(null); // Reset loading state
    }
  };

  const handleRoleChange = async (targetUserId: number, newRole: string) => {
    if (isUpdatingRoleId) return;
    setIsUpdatingRoleId(targetUserId);
    try {
      await updateMemberRole({ userId: targetUserId, newRole });
      toast({ title: 'Role Updated', description: `Role updated to ${newRole}.` });
      // Data will refetch via useQuery
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message || 'Could not update role.', variant: 'destructive' });
    } finally {
      setIsUpdatingRoleId(null);
    }
  };

  const handleOpenRemoveConfirm = (member: MemberDisplayInfo) => {
    setMemberToRemove(member);
    setIsRemoveConfirmOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove || isUpdatingRoleId) return; // Use isUpdatingRoleId as general action lock for now
    setIsRemoveConfirmOpen(false);
    setIsUpdatingRoleId(memberToRemove.userId); // Indicate loading state for this user
    try {
      await removeMember({ userId: memberToRemove.userId });
      toast({ title: 'Member Removed', description: `${memberToRemove.email} removed from profile.` });
    } catch (error: any) {
      toast({ title: 'Remove Failed', description: error.message || 'Could not remove member.', variant: 'destructive' });
    } finally {
      setMemberToRemove(null);
      setIsUpdatingRoleId(null); // Reset loading state
    }
  };

  // --- Loading and Error Handling ---
  const isLoading = isLoadingCurrentUser || isLoadingMembers || (userIds.length > 0 && isLoadingUsers) || (canManageMembers && isLoadingInvites);
  if (isLoading) return <div className='p-4'>Loading data...</div>;

  const queryError = errorCurrentUser || errorMembers || errorUsers || errorInvites;
  if (queryError) return <div className='p-4 text-red-500'>Error loading data: {queryError.message}</div>;

  // --- Authorization Check ---
  // Redirect if user is not loaded or not an Admin/Owner
  if (!currentUserProfile || !['ADMIN', 'OWNER'].includes(currentUserProfile.role)) {
    // Redirect to dashboard or show forbidden message
    // Using Redirect might cause flashes, consider showing a message instead
    // return <Redirect to={routes.DashboardRoute.to} />;
    return <div className='p-4 text-red-500'>Access Denied: You do not have permission to view this page.</div>;
  }

  // --- Render Page ---
  return (
    <ContentSection title='Manage Members' desc='Invite new members, manage roles, and view pending invitations.'>
      {/* Wrap multiple children in a single fragment */}
      <>
        <Card className='mb-6'>
          <CardHeader>
            <CardTitle>Current Members</CardTitle>
            <CardDescription>Manage roles and access for existing members.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  {/* Add Actions column header only if user can manage */}
                  {canManageMembers && <TableHead className='text-right'>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersDisplayList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManageMembers ? 3 : 2} className='text-center'>
                      No members found (except you).
                    </TableCell>
                  </TableRow>
                ) : (
                  membersDisplayList.map((member) => {
                    const isCurrentUser = currentUserProfile?.userId === member.userId;
                    const isTargetOwner = member.role === 'OWNER';
                    // Determine if actions should be disabled based on complex rules
                    const disableActions =
                      isTargetOwner || // Cannot act on Owner
                      isCurrentUser || // Cannot act on self (except Owner potentially, handled in action)
                      (!isOwner && member.role === 'ADMIN') || // Admin cannot act on other Admins
                      isUpdatingRoleId === member.userId; // Action in progress for this user

                    return (
                      <TableRow key={member.userId}>
                        <TableCell className='font-medium'>
                          {member.email}
                          {isCurrentUser ? ' (You)' : ''}
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.role === 'OWNER' ? 'default' : member.role === 'ADMIN' ? 'secondary' : 'outline'}>{member.role}</Badge>
                        </TableCell>
                        {/* Actions Cell - Render only if user can manage */}
                        {canManageMembers && (
                          <TableCell className='text-right space-x-2'>
                            {/* Role Select Dropdown */}
                            <Select
                              value={member.role}
                              onValueChange={(newRole) => handleRoleChange(member.userId, newRole)}
                              disabled={disableActions} // Disable based on rules
                            >
                              <SelectTrigger className='w-[120px] h-8 inline-flex' disabled={disableActions}>
                                <SelectValue placeholder='Change role' />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value='MEMBER'>Member</SelectItem>
                                <SelectItem value='ADMIN'>Admin</SelectItem>
                              </SelectContent>
                            </Select>

                            {/* Remove Button */}
                            <Button
                              variant='destructive'
                              size='sm'
                              onClick={() => handleOpenRemoveConfirm(member)}
                              disabled={disableActions} // Disable based on rules
                              title={disableActions ? 'Action not permitted' : 'Remove member'}
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className='flex justify-end items-center mb-6'>
          {/* Invite Member Button and Dialog */}
          {canManageMembers && (
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className='mr-2 h-4 w-4' /> Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent className='sm:max-w-[425px]'>
                <DialogHeader>
                  <DialogTitle>Invite New Member</DialogTitle>
                  <DialogDescription>Enter the email address of the user you want to invite and select their role.</DialogDescription>
                </DialogHeader>
                <div className='grid gap-4 py-4'>
                  <div className='grid grid-cols-4 items-center gap-4'>
                    <Label htmlFor='invite-email' className='text-right'>
                      Email
                    </Label>
                    <Input id='invite-email' type='email' value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className='col-span-3' disabled={isInviting} placeholder='user@example.com' />
                  </div>
                  <div className='grid grid-cols-4 items-center gap-4'>
                    <Label htmlFor='invite-role' className='text-right'>
                      Role
                    </Label>
                    <Select value={inviteRole} onValueChange={setInviteRole} disabled={isInviting}>
                      <SelectTrigger className='col-span-3'>
                        <SelectValue placeholder='Select a role' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='MEMBER'>Member</SelectItem>
                        <SelectItem value='ADMIN'>Admin</SelectItem>
                        {/* OWNER role cannot be assigned via invite */}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {inviteError && <p className='text-red-500 text-sm px-6 pb-2 text-center'>Error: {inviteError}</p>}
                <DialogFooter>
                  <Button variant='outline' onClick={() => setIsInviteDialogOpen(false)} disabled={isInviting}>
                    Cancel
                  </Button>
                  <Button onClick={handleInviteUser} disabled={isInviting || !inviteEmail}>
                    {isInviting ? 'Sending Invite...' : 'Invite User'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {/* Pending Invitations Card (Only show if Admin/Owner) */}
        {canManageMembers && (
          <Card className='mb-6'>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>These users have been invited but haven't accepted yet.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Invited Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!pendingInvites || pendingInvites.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className='text-center'>
                        No pending invitations.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingInvites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell className='font-medium flex items-center'>
                          <Mail className='mr-2 h-4 w-4 text-muted-foreground' />
                          {invite.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant={invite.role === 'ADMIN' ? 'secondary' : 'outline'}>{invite.role}</Badge>
                        </TableCell>
                        <TableCell className='text-sm text-muted-foreground'>
                          <Clock className='inline mr-1 h-3 w-3' />
                          {new Date(invite.expiresAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button variant='outline' size='sm' onClick={() => handleRevokeInvite(invite.id)} disabled={isRevokingId === invite.id}>
                            {isRevokingId === invite.id ? (
                              'Revoking...'
                            ) : (
                              <>
                                <XCircle className='mr-1 h-4 w-4' /> Revoke
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Remove Member Confirmation Dialog */}
        <AlertDialog open={isRemoveConfirmOpen} onOpenChange={setIsRemoveConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently remove
                <span className='font-semibold'> {memberToRemove?.email} </span>
                from this budget profile.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setMemberToRemove(null)} disabled={!!isUpdatingRoleId}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmRemove} disabled={!!isUpdatingRoleId} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
                {isUpdatingRoleId === memberToRemove?.userId ? 'Removing...' : 'Confirm Remove'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
      {/* End of fragment */}
    </ContentSection> // Close ContentSection
  );
}
