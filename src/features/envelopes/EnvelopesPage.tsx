import React, { useState } from 'react';
import { useQuery } from 'wasp/client/operations';
import { getEnvelopes, createEnvelope } from 'wasp/client/operations';
import { type Envelope } from 'wasp/entities';

// Shadcn components via relative paths
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'; // Removed DialogClose

export function EnvelopesPage() {
  const { data: envelopes, isLoading, error: queryError } = useQuery(getEnvelopes);

  // State for the 'Add New Envelope' dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false); // State to control dialog
  const [newEnvelopeName, setNewEnvelopeName] = useState('');
  const [newEnvelopeAmount, setNewEnvelopeAmount] = useState('0');
  const [newEnvelopeCategory, setNewEnvelopeCategory] = useState('');
  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<Error | null>(null);

  const handleCreateEnvelope = async () => {
    setIsCreateLoading(true);
    setCreateError(null);
    try {
      const amount = parseFloat(newEnvelopeAmount);
      if (isNaN(amount)) {
        throw new Error('Invalid amount provided.');
      }
      await createEnvelope({ 
        name: newEnvelopeName, 
        amount: amount,
        category: newEnvelopeCategory || 'Uncategorized',
        color: null,
        icon: null  
      });
      // Reset form 
      setNewEnvelopeName('');
      setNewEnvelopeAmount('0');
      setNewEnvelopeCategory('');
      setIsAddDialogOpen(false); // Close dialog on success
    } catch (err: any) {
      setCreateError(err);
      // Don't close dialog on error, let user see message
    } finally {
      setIsCreateLoading(false);
    }
  };

  const resetAddForm = () => {
      setNewEnvelopeName('');
      setNewEnvelopeAmount('0');
      setNewEnvelopeCategory('');
      setCreateError(null);
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
         <h1 className="text-2xl font-semibold">Envelopes</h1>
        {/* Manually control Dialog open state */}
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { 
            setIsAddDialogOpen(open);
            if (!open) resetAddForm(); // Reset form when closing
          }}>
          {/* Button now just opens the dialog */}
          <Button onClick={() => setIsAddDialogOpen(true)}>Add New Envelope</Button>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Envelope</DialogTitle>
              <DialogDescription>
                Create a new budget category to track your spending.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Name Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" value={newEnvelopeName} onChange={(e) => setNewEnvelopeName(e.target.value)} className="col-span-3" required />
              </div>
              {/* Category Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">Category</Label>
                <Input id="category" value={newEnvelopeCategory} onChange={(e) => setNewEnvelopeCategory(e.target.value)} className="col-span-3" placeholder="(Optional)" />
              </div>
              {/* Amount Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">Budget Amount</Label>
                <Input id="amount" type="number" step="0.01" value={newEnvelopeAmount} onChange={(e) => setNewEnvelopeAmount(e.target.value)} className="col-span-3" required />
              </div>
              {/* Error Display */}
              {createError && (
                <p className="col-span-4 text-red-500 text-sm text-center">Error: {createError.message || 'Failed to create.'}</p>
              )}
            </div>
            <DialogFooter>
              {/* Cancel button now relies on onOpenChange to close */}
              <Button type="button" variant="secondary" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateEnvelope} disabled={isCreateLoading}>
                {isCreateLoading ? 'Saving...' : 'Save Envelope'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Display Envelopes */}
      <div className="mt-6">
        {isLoading && <p>Loading envelopes...</p>}
        {queryError && <p className="text-red-500">Error loading envelopes: {queryError.message}</p>}
        {envelopes && envelopes.length === 0 && <p>No envelopes created yet. Click 'Add New Envelope' to get started.</p>}
        {envelopes && envelopes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {envelopes.map((envelope) => (
              <Card key={envelope.id}>
                <CardHeader>
                  <CardTitle>{envelope.name}</CardTitle>
                  <CardDescription>{envelope.category || 'Uncategorized'}</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Consider using Intl.NumberFormat for currency formatting */}
                  <p>Budgeted: ${envelope.amount.toFixed(2)}</p>
                  <p>Spent: ${envelope.spent.toFixed(2)}</p>
                  <p>Remaining: ${(envelope.amount - envelope.spent).toFixed(2)}</p>
                  {/* TODO: Add Progress Bar (using shadcn/ui Progress component) */}
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                  {/* TODO: Implement Edit Dialog functionality */}
                  {/* TODO: Implement Delete Confirmation functionality */}
                   <Button variant="outline" size="sm" disabled>Edit</Button>
                   <Button variant="destructive" size="sm" disabled>Delete</Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 