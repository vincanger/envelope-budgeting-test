import React, { useState, useMemo } from 'react';
import { useQuery } from 'wasp/client/operations';
import {
  getTransactions,
  createTransaction,
  getEnvelopes,
  getCurrentUserProfile,
  updateTransaction
} from 'wasp/client/operations';
import type { Transaction, Envelope } from 'wasp/entities';
// Import enum from @prisma/client
import { TransactionType } from '@prisma/client'; 
import { Link } from 'wasp/client/router';
// Assuming shadcn components are available via relative paths
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'; // For Envelope/Type selection
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'; // For displaying transactions
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Calendar } from '../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { CalendarIcon, PlusCircle, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/client/utils';
import { DayPicker } from 'react-day-picker';
// Helper to format date (consider moving to a utils file later)
const formatDate = (date: Date | string | undefined): string => {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleDateString();
  } catch (e) {
    return 'Invalid Date';
  }
};

export function TransactionsPage() {
  const { data: transactions, isLoading: isLoadingTransactions, error: errorTransactions } = useQuery(getTransactions)
  const { data: envelopes, isLoading: isLoadingEnvelopes, error: errorEnvelopes } = useQuery(getEnvelopes)
  const { data: userProfile, isLoading: isLoadingProfile, error: errorProfile } = useQuery(getCurrentUserProfile);

  // State for the 'Add Transaction' dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('0');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string>('');
  // Use the enum for state type and initial value
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.EXPENSE); 
  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // State for inline editing
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editingEnvelopeId, setEditingEnvelopeId] = useState<string | null>(null); // Store as string for Select compatibility
  const [isSavingEnvelope, setIsSavingEnvelope] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Determine if user can create transactions (MEMBER, ADMIN, or OWNER)
  const canModify = userProfile && ['MEMBER', 'ADMIN', 'OWNER'].includes(userProfile.role);
  const hasEnvelopes = envelopes && envelopes.length > 0;

  const handleCreateTransaction = async () => {
    setCreateError(null);
    setIsCreateLoading(true);
    try {
      const numericAmount = parseFloat(amount);
      const envelopeId = parseInt(selectedEnvelopeId, 10);

      if (!description) throw new Error('Description is required.');
      if (isNaN(numericAmount)) throw new Error('Invalid amount.');
      if (isNaN(envelopeId)) throw new Error('Please select an envelope.');
      if (!date) throw new Error('Please select a date.');
      // Compare using enum
      if (transactionType === TransactionType.TRANSFER) throw new Error('Transfer type not handled here yet.'); 

      await createTransaction({
        description,
        amount: numericAmount,
        date: date,
        envelopeId: envelopeId,
        type: transactionType // Pass enum value directly
      });

      // Reset form and close dialog
      setDescription('');
      setAmount('0');
      setDate(new Date());
      setSelectedEnvelopeId('');
      setTransactionType(TransactionType.EXPENSE); // Reset to enum default
      setIsAddDialogOpen(false);
    } catch (err) {
      if (err instanceof Error) {
        setCreateError(err.message);
      } else if (typeof err === 'string') {
        setCreateError(err);
      } else {
        setCreateError('An unexpected error occurred');
      }
    } finally {
      setIsCreateLoading(false);
    }
  };

  const resetAddForm = () => {
      setDescription('');
      setAmount('0');
      setDate(new Date());
      setSelectedEnvelopeId('');
      setTransactionType(TransactionType.EXPENSE); // Use enum here too
  }

  // --- Inline Editing Handlers ---

  const handleEditClick = (transaction: Transaction) => {
    setEditingRowId(transaction.id);
    setEditingEnvelopeId(transaction.envelopeId ? String(transaction.envelopeId) : null);
    setEditError(null); // Clear previous edit errors
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditingEnvelopeId(null);
    setEditError(null);
  };

  const handleSaveEnvelope = async () => {
    if (editingRowId === null) return;
    setEditError(null);
    setIsSavingEnvelope(true);

    try {
      // Convert string | null to number | null
      const newEnvelopeId = editingEnvelopeId === null || editingEnvelopeId === '' ? null : parseInt(editingEnvelopeId, 10);
      
      if (editingEnvelopeId !== null && editingEnvelopeId !== '' && isNaN(newEnvelopeId as number)) {
        throw new Error("Invalid envelope selected.");
      }

      // Call updateTransaction directly
      await updateTransaction({
        id: editingRowId,
        envelopeId: newEnvelopeId
      });

      handleCancelEdit(); // Exit edit mode on success
    } catch (err: any) {
      console.error("Error updating envelope:", err);
      setEditError(err.message || "Failed to update envelope.");
    } finally {
      setIsSavingEnvelope(false);
    }
  };

  // --- End Inline Editing Handlers ---

  // Separate loading and error handling
  if (isLoadingTransactions || isLoadingEnvelopes || isLoadingProfile) return 'Loading...'
  if (errorTransactions) {
    const message = errorTransactions instanceof Error ? errorTransactions.message : 'Unknown error';
    return `Error loading transactions: ${message}`;
  }
  if (errorEnvelopes) {
    const message = errorEnvelopes instanceof Error ? errorEnvelopes.message : 'Unknown error';
    return `Error loading envelopes: ${message}`;
  }
  if (errorProfile) {
    const message = errorProfile instanceof Error ? errorProfile.message : 'Unknown error';
    return `Error loading user profile: ${message}`;
  }
  // If we reach here, all queries succeeded

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="flex space-x-2">
          <Link to="/transactions/import">
            <Button
              variant="outline"
              disabled={isLoadingProfile || !canModify || !hasEnvelopes}
              title={!canModify ? 'Insufficient permissions' : !hasEnvelopes ? 'Create an envelope first' : 'Import transactions from CSV'}
            >
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
          </Link>
          <Button 
              onClick={() => setIsAddDialogOpen(true)} 
              disabled={isLoadingProfile || !canModify || !hasEnvelopes} 
              title={!canModify ? 'Insufficient permissions' : !hasEnvelopes ? 'Create an envelope first' : 'Add a new transaction'}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Transaction
          </Button>
        </div>
      </div>

      {/* Add Transaction Dialog */} 
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Description */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" required />
            </div>
            {/* Amount */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">Amount</Label>
              <Input id="amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="col-span-3" required />
            </div>
            {/* Date Picker Implementation - Adjusted */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "col-span-3 justify-start text-left font-normal", // Removed fixed width
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>} 
                  </Button>
                </PopoverTrigger>
                {/* Added align="start" */}
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar 
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {/* Envelope */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="envelope" className="text-right">Envelope</Label>
              <Select value={selectedEnvelopeId} onValueChange={setSelectedEnvelopeId}>
                  <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select an envelope..." />
                  </SelectTrigger>
                  <SelectContent>
                      {isLoadingEnvelopes && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                      {errorEnvelopes && <SelectItem value="error" disabled>Error loading</SelectItem>}
                      {envelopes?.map((env) => (
                          <SelectItem key={env.id} value={String(env.id)}>{env.name}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
            {/* Type */}
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Type</Label>
                <Select 
                  value={transactionType} 
                  onValueChange={(value: string) => setTransactionType(value as TransactionType)}
                >
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={TransactionType.EXPENSE}>Expense</SelectItem>
                        <SelectItem value={TransactionType.INCOME}>Income</SelectItem>
                        {/* Keep TRANSFER commented out or add if needed */}
                        {/* <SelectItem value={TransactionType.TRANSFER}>Transfer</SelectItem> */}
                    </SelectContent>
                </Select>
            </div>
          </div>
          {createError && <p className="text-red-500 text-sm px-6 pb-4">Error: {createError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isCreateLoading}>Cancel</Button>
            <Button 
                onClick={handleCreateTransaction} 
                disabled={isCreateLoading || !description || !amount || !date || !selectedEnvelopeId}
            >
              {isCreateLoading ? 'Adding...' : 'Add Transaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Display Transactions Table */}
      <div className="mt-6 border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Envelope</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Actions</TableHead> 
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingTransactions && <TableRow><TableCell colSpan={6}>Loading transactions...</TableCell></TableRow>}
            {errorTransactions && (
              <TableRow><TableCell colSpan={6} className="text-red-500">Error loading transactions: {(errorTransactions as Error)?.message ?? 'Unknown error'}</TableCell></TableRow>
            )}
            {transactions && transactions.length === 0 && <TableRow><TableCell colSpan={6}>No transactions recorded yet.</TableCell></TableRow>}
            {transactions?.map((tx) => {
              const isEditing = editingRowId === tx.id;
              return (
              <TableRow key={tx.id} data-state={isEditing ? 'selected' : ''}>
                <TableCell>{formatDate(tx.date)}</TableCell>
                <TableCell>{tx.description}</TableCell>
                {/* Envelope Cell - Conditionally render Select or Text */}
                <TableCell>
                  {isEditing ? (
                    <Select
                      value={editingEnvelopeId ?? ''} // Use empty string for "None" or placeholder
                      onValueChange={setEditingEnvelopeId}
                      disabled={isSavingEnvelope}
                    >
                      <SelectTrigger className="h-8 text-sm w-[150px]">
                        <SelectValue placeholder="Select Envelope..." />
                      </SelectTrigger>
                      <SelectContent>
                        {envelopes?.map((env) => (
                          <SelectItem key={env.id} value={String(env.id)}>{env.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    // Display envelope name or 'Unassigned'
                    envelopes?.find(env => env.id === tx.envelopeId)?.name || <span className="text-gray-500 italic">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>{tx.type}</TableCell>
                <TableCell className="text-right">${tx.amount.toFixed(2)}</TableCell>
                {/* Actions Cell - Conditionally render Edit or Save/Cancel */}
                <TableCell className="text-right space-x-1">
                    {isEditing ? (
                      <>
                        <Button 
                          variant="default" 
                          size="sm" 
                          onClick={handleSaveEnvelope} 
                          disabled={isSavingEnvelope}
                        >
                          {isSavingEnvelope ? 'Saving...' : 'Save'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleCancelEdit}
                          disabled={isSavingEnvelope}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEditClick(tx)}
                          disabled={!canModify || editingRowId !== null} // Disable if another row is being edited
                          title={!canModify ? 'Insufficient permissions' : editingRowId !== null ? 'Finish editing other row first' : 'Edit envelope'}
                        >
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" disabled>Delete</Button> {/* Keep Delete disabled for now */}
                      </>
                    )}
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
        {editError && <p className="text-red-500 text-sm px-6 py-2">Error: {editError}</p>} {/* Display edit error */}
      </div>
    </div>
  );
} 