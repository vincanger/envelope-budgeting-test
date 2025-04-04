import React, { useState } from 'react';
import { useQuery } from 'wasp/client/operations';
import { getTransactions, createTransaction, getEnvelopes } from 'wasp/client/operations';
import { type Transaction, type Envelope } from 'wasp/entities';
// Assuming shadcn components are available via relative paths
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'; // For Envelope/Type selection
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'; // For displaying transactions
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Calendar } from '../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
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
  // Fetch Transactions
  const { data: transactions, isLoading: isLoadingTransactions, error: transactionsError } = useQuery(getTransactions);
  // Fetch Envelopes for the dropdown
  const { data: envelopes, isLoading: isLoadingEnvelopes, error: envelopesError } = useQuery(getEnvelopes);

  // State for the 'Add Transaction' dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('0');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string>('');
  const [transactionType, setTransactionType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE');
  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<Error | null>(null);

  const handleCreateTransaction = async () => {
    setIsCreateLoading(true);
    setCreateError(null);
    try {
      const numericAmount = parseFloat(amount);
      const envelopeId = parseInt(selectedEnvelopeId, 10);

      if (!description) throw new Error('Description is required.');
      if (isNaN(numericAmount)) throw new Error('Invalid amount.');
      if (isNaN(envelopeId)) throw new Error('Please select an envelope.');
      if (!date) throw new Error('Please select a date.');
      if (transactionType === 'TRANSFER') throw new Error('Transfer type not handled here yet.');

      await createTransaction({
        description,
        amount: numericAmount,
        date: date,
        envelopeId: envelopeId,
        type: transactionType
      });

      // Reset form and close dialog
      setDescription('');
      setAmount('0');
      setDate(new Date());
      setSelectedEnvelopeId('');
      setTransactionType('EXPENSE');
      setIsAddDialogOpen(false);

    } catch (err: any) {
      setCreateError(err);
      alert(`Error creating transaction: ${err.message || 'Unknown error'}`);
    } finally {
      setIsCreateLoading(false);
    }
  };

  const resetAddForm = () => {
      setDescription('');
      setAmount('0');
      setDate(new Date());
      setSelectedEnvelopeId('');
      setTransactionType('EXPENSE');
      setCreateError(null);
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        {/* Add Transaction Dialog Trigger */}
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { 
            setIsAddDialogOpen(open);
            if (!open) resetAddForm(); // Reset form when closing
          }}>
          <Button onClick={() => setIsAddDialogOpen(true)} disabled={isLoadingEnvelopes}>Add Transaction</Button>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Transaction</DialogTitle>
              <DialogDescription>Record an expense or income.</DialogDescription>
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
                        {envelopesError && <SelectItem value="error" disabled>Error loading</SelectItem>}
                        {envelopes?.map((env) => (
                            <SelectItem key={env.id} value={String(env.id)}>{env.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
               {/* Type */}
               <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">Type</Label>
                  <Select value={transactionType} onValueChange={(value: 'EXPENSE' | 'INCOME') => setTransactionType(value)}>
                      <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="EXPENSE">Expense</SelectItem>
                          <SelectItem value="INCOME">Income</SelectItem>
                          {/* <SelectItem value="TRANSFER">Transfer</SelectItem> */}
                      </SelectContent>
                  </Select>
              </div>
              {/* Error Display */}
              {createError && (
                <p className="col-span-4 text-red-500 text-sm text-center">Error: {createError.message || 'Failed to create.'}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateTransaction} disabled={isCreateLoading}>
                {isCreateLoading ? 'Saving...' : 'Save Transaction'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
            {transactionsError && <TableRow><TableCell colSpan={6} className="text-red-500">Error loading transactions: {transactionsError.message}</TableCell></TableRow>}
            {transactions && transactions.length === 0 && <TableRow><TableCell colSpan={6}>No transactions recorded yet.</TableCell></TableRow>}
            {transactions?.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{formatDate(tx.date)}</TableCell>
                <TableCell>{tx.description}</TableCell>
                {/* Find envelope name - might be slow for large lists, consider joining in query later */}
                <TableCell>{envelopes?.find(env => env.id === tx.envelopeId)?.name || 'N/A'}</TableCell>
                <TableCell>{tx.type}</TableCell>
                <TableCell className="text-right">${tx.amount.toFixed(2)}</TableCell>
                <TableCell className="text-right space-x-1">
                    {/* TODO: Add Edit/Delete buttons */}
                   <Button variant="outline" size="sm" disabled>Edit</Button>
                   <Button variant="destructive" size="sm" disabled>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 