import React, { useState } from 'react';
import { useQuery, useAction } from 'wasp/client/operations';
import {
  getEnvelopes,
  createEnvelope,
  getCurrentUserProfile,
  updateEnvelope,
  deleteEnvelope,
} from 'wasp/client/operations';
import { type Envelope } from 'wasp/entities';

// Shadcn components via relative paths
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'; // Removed DialogClose
import { PlusCircle, Trash2 } from 'lucide-react'; // For button icon
import { ThemeSwitch } from '../../components/theme-switch';
import { Header } from '../../components/layout/header';
import { Search } from '../../components/search';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog"

// Helper for currency formatting (consider moving to utils)
const formatCurrency = (value: number) => {
  return `$${value.toFixed(2)}`;
};

export function EnvelopesPage() {
  const { data: envelopes, isLoading: isLoadingEnvelopes, error: errorEnvelopes } = useQuery(getEnvelopes);
  const { data: userProfile, isLoading: isLoadingProfile, error: errorProfile } = useQuery(getCurrentUserProfile);
  const createEnvelopeAction = useAction(createEnvelope);
  const updateEnvelopeAction = useAction(updateEnvelope);
  const deleteEnvelopeAction = useAction(deleteEnvelope);

  // State for the 'Add New Envelope' dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false); // State to control dialog
  const [addEnvelopeName, setAddEnvelopeName] = useState('');
  const [addEnvelopeAmount, setAddEnvelopeAmount] = useState('0');
  const [addEnvelopeCategory, setAddEnvelopeCategory] = useState('');
  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);
  const [editEnvelopeName, setEditEnvelopeName] = useState('');
  const [editEnvelopeAmount, setEditEnvelopeAmount] = useState('0');
  const [editEnvelopeCategory, setEditEnvelopeCategory] = useState('');
  const [isUpdateLoading, setIsUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Determine if user can create envelopes (ADMIN or OWNER)
  const canModify = userProfile && ['ADMIN', 'OWNER'].includes(userProfile.role);

  const handleCreateEnvelope = async () => {
    setIsCreateLoading(true);
    setCreateError(null);
    try {
      const amount = parseFloat(addEnvelopeAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Amount must be a positive number.');
      await createEnvelopeAction({
        name: addEnvelopeName,
        amount: amount,
        category: addEnvelopeCategory || 'Uncategorized',
        color: null,
        icon: null,
      });
      resetAddForm();
      setIsAddDialogOpen(false);
    } catch (err: any) { setCreateError(err.message || 'Failed to create envelope'); }
    finally { setIsCreateLoading(false); }
  };

  const resetAddForm = () => {
    setAddEnvelopeName('');
    setAddEnvelopeAmount('0');
    setAddEnvelopeCategory('');
    setCreateError(null);
  };

  const handleOpenEditModal = (envelope: Envelope) => {
    setEditingEnvelope(envelope);
    setEditEnvelopeName(envelope.name);
    setEditEnvelopeAmount(String(envelope.amount));
    setEditEnvelopeCategory(envelope.category || '');
    setUpdateError(null);
    setDeleteError(null);
    setIsEditDialogOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!editingEnvelope) return;
    setIsUpdateLoading(true);
    setUpdateError(null);
    try {
      const amount = parseFloat(editEnvelopeAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Amount must be a positive number.');
      await updateEnvelopeAction({
        id: editingEnvelope.id,
        name: editEnvelopeName,
        amount: amount,
        category: editEnvelopeCategory || 'Uncategorized',
      });
      setIsEditDialogOpen(false);
      setEditingEnvelope(null);
    } catch (err: any) { setUpdateError(err.message || 'Failed to update envelope'); }
    finally { setIsUpdateLoading(false); }
  };

  const handleDeleteEnvelope = async () => {
    if (!editingEnvelope) return;
    setIsDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteEnvelopeAction({ id: editingEnvelope.id });
      setIsEditDialogOpen(false);
      setEditingEnvelope(null);
    } catch (err: any) { setDeleteError(err.message || 'Failed to delete envelope'); }
    finally { setIsDeleteLoading(false); }
  };

  // Separate loading and error handling
  if (isLoadingEnvelopes || isLoadingProfile) return 'Loading...';
  if (errorEnvelopes) return 'Error loading envelopes: ' + errorEnvelopes.message;
  if (errorProfile) return 'Error loading user profile: ' + errorProfile.message;
  // If we reach here, both queries succeeded (or have no data yet, handled below)

  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center gap-4'>
          <ThemeSwitch />
        </div>
      </Header>
      <div className='p-4'>
        <div className='flex justify-end items-center mb-6'>
          {/* Disable button if still loading profile or if user doesn't have permission */}
          <Button onClick={() => setIsAddDialogOpen(true)} disabled={isLoadingProfile || !canModify} title={!canModify ? 'Only Admins or Owners can create envelopes' : ''}>
            <PlusCircle className='mr-2 h-4 w-4' /> Add New Envelope
          </Button>
        </div>

        {/* Display Envelopes */}
        {!envelopes ? (
          <p>Loading envelope data...</p> // Show loading specifically for envelopes if profile loaded but env didn't
        ) : envelopes.length === 0 ? (
          <p>No envelopes created yet.</p>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {envelopes.map((envelope) => (
              <Card key={envelope.id} className="hover:shadow-md">
                <CardHeader>
                  <CardTitle>{envelope.name}</CardTitle>
                  <CardDescription>{envelope.category || 'Uncategorized'}</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Consider using Intl.NumberFormat for currency formatting */}
                  <p>Budgeted: {formatCurrency(envelope.amount)}</p>
                  <p>Spent: {formatCurrency(envelope.spent)}</p>
                  <p>Remaining: {formatCurrency(envelope.amount - envelope.spent)}</p>
                  {/* TODO: Add Progress Bar (using shadcn/ui Progress component) */}
                </CardContent>
                <CardFooter className='flex justify-end space-x-2'>
                  {/* Enable Edit button and add handler */}
                  <Button 
                    variant='outline' 
                    size='sm' 
                    onClick={() => handleOpenEditModal(envelope)} 
                    disabled={!canModify}
                    title={!canModify ? 'Only Admins or Owners can edit' : ''}
                  >
                    Edit
                  </Button>
                  {/* Delete button is now inside the Edit modal */}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Add Envelope Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetAddForm();
          }}>
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle>Add New Envelope</DialogTitle>
              <DialogDescription>Create a new budget category.</DialogDescription>
            </DialogHeader>
            <div className='grid gap-4 py-4'>
              {/* Name */}
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='add-name' className='text-right'>Name</Label>
                <Input id='add-name' value={addEnvelopeName} onChange={(e) => setAddEnvelopeName(e.target.value)} className='col-span-3' required disabled={isCreateLoading} />
              </div>
              {/* Category */}
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='add-category' className='text-right'>Category</Label>
                <Input id='add-category' value={addEnvelopeCategory} onChange={(e) => setAddEnvelopeCategory(e.target.value)} className='col-span-3' placeholder='(Optional)' disabled={isCreateLoading} />
              </div>
              {/* Amount */}
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='add-amount' className='text-right'>Budget Amount</Label>
                <Input id='add-amount' type='number' step='0.01' value={addEnvelopeAmount} onChange={(e) => setAddEnvelopeAmount(e.target.value)} className='col-span-3' required disabled={isCreateLoading} />
              </div>
              {/* Correct error display */}
              {createError && <p className='col-span-4 text-red-500 text-sm text-center'>{createError}</p>}
            </div>
            <DialogFooter>
              <Button type='button' variant='secondary' onClick={() => setIsAddDialogOpen(false)} disabled={isCreateLoading}>Cancel</Button>
              <Button onClick={handleCreateEnvelope} disabled={isCreateLoading || !addEnvelopeName}>
                {isCreateLoading ? 'Creating...' : 'Create Envelope'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Envelope Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle>Edit Envelope: {editingEnvelope?.name}</DialogTitle>
              <DialogDescription>Update the details for this envelope.</DialogDescription>
            </DialogHeader>
            <div className='grid gap-4 py-4'>
              {/* Name */}
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='edit-name' className='text-right'>Name</Label>
                <Input id='edit-name' value={editEnvelopeName} onChange={(e) => setEditEnvelopeName(e.target.value)} className='col-span-3' required disabled={isUpdateLoading || isDeleteLoading} />
              </div>
              {/* Category */}
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='edit-category' className='text-right'>Category</Label>
                <Input id='edit-category' value={editEnvelopeCategory} onChange={(e) => setEditEnvelopeCategory(e.target.value)} className='col-span-3' placeholder='(Optional)' disabled={isUpdateLoading || isDeleteLoading} />
              </div>
              {/* Amount */}
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='edit-amount' className='text-right'>Budget Amount</Label>
                <Input id='edit-amount' type='number' step='0.01' value={editEnvelopeAmount} onChange={(e) => setEditEnvelopeAmount(e.target.value)} className='col-span-3' required disabled={isUpdateLoading || isDeleteLoading} />
              </div>
              {updateError && <p className='col-span-4 text-red-500 text-sm text-center'>{updateError}</p>}
              {deleteError && <p className='col-span-4 text-red-500 text-sm text-center'>{deleteError}</p>}
            </div>
            <DialogFooter className="justify-between"> {/* Use justify-between for layout */}
              {/* Delete Button with Confirmation */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    type="button" 
                    variant="destructive" 
                    disabled={isUpdateLoading || isDeleteLoading}
                  >
                    <Trash2 className="mr-2 h-4 w-4"/>
                    {isDeleteLoading ? 'Deleting...' : 'Delete'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the envelope
                      "{editingEnvelope?.name}". Associated transactions will become unassigned.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleteLoading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteEnvelope} disabled={isDeleteLoading}>
                      {isDeleteLoading ? 'Deleting...' : 'Yes, delete envelope'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Save and Cancel Buttons */}
              <div className="space-x-2">
                <Button type='button' variant='secondary' onClick={() => setIsEditDialogOpen(false)} disabled={isUpdateLoading || isDeleteLoading}>Cancel</Button>
                <Button onClick={handleSaveChanges} disabled={isUpdateLoading || isDeleteLoading || !editEnvelopeName}>
                  {isUpdateLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
