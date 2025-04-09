import React, { useState, useMemo } from 'react';
import { useQuery } from 'wasp/client/operations';
import { getTransactions, createTransaction, getEnvelopes, getCurrentUserProfile, updateTransaction } from 'wasp/client/operations';
import type { Transaction } from 'wasp/entities';
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
import { CalendarIcon, PlusCircle, Upload, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../utils/cn';
import { Checkbox } from '../../components/ui/checkbox'; // Import Checkbox
import { Badge } from '../../components/ui/badge';
import {
  ColumnDef,
  CellContext,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
  VisibilityState,
  RowSelectionState,
  getPaginationRowModel,
  RowData, // Needed for TableMeta augmentation
} from '@tanstack/react-table';
// Import DropdownMenu components
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { ThemeSwitch } from '../../components/theme-switch';
import { ProfileDropdown } from '../../components/profile-dropdown';
import { Header } from '../../components/layout/header';
import { Search } from '../../components/search';

// Helper to format date (consider moving to a utils file later)
const formatDate = (date: Date | string | undefined): string => {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleDateString();
  } catch (e) {
    return 'Invalid Date';
  }
};

// Define columns outside the component
export const columns: ColumnDef<Transaction>[] = [
  // Selection Column
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
        className='translate-y-[2px]'
      />
    ),
    cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label='Select row' className='translate-y-[2px]' />,
    enableSorting: false,
    enableHiding: false,
  },
  // Data Columns (Adapt existing ones)
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => formatDate(row.getValue('date')),
  },
  {
    accessorKey: 'description',
    header: 'Description',
  },
  {
    accessorKey: 'envelopeId',
    header: 'Envelope',
    // Cell rendering needs access to envelopes data, handle this within the component
    // We'll define the cell render function dynamically inside the component later
    cell: (info) => info.getValue(), // Placeholder
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => {
      // Use the row directly from context
      const type = row.getValue('type') as TransactionType;
      let variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'success' = 'secondary'; // Default variant
      let className = '';

      switch (type) {
        case TransactionType.EXPENSE:
          // Using destructive variant or specific classes for red
          // variant = "destructive";
          className = 'bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/50 dark:text-red-300'; // More specific styling
          break;
        case TransactionType.INCOME:
          // Define a success variant if available or use specific classes for green
          // variant = "success"; // Or use specific classes if "success" variant doesn't exist
          className = 'bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/50 dark:text-green-300';
          break;
        // Add case for TRANSFER if needed later
        // case TransactionType.TRANSFER:
        //   className = "bg-blue-100 text-blue-800 hover:bg-blue-100/80 dark:bg-blue-900/50 dark:text-blue-300";
        //   break;
        default:
          // Default gray badge for unknown/other types
          className = 'bg-gray-100 text-gray-800 hover:bg-gray-100/80 dark:bg-gray-700 dark:text-gray-300';
          break;
      }

      // Capitalize first letter for display
      const displayType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();

      return (
        <Badge variant='outline' className={cn('capitalize', className)}>
          {displayType}
        </Badge>
      );
    },
    // Add filter function for type later if needed
    filterFn: (row, id, value) => {
      // Basic filter function
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'amount',
    header: () => <div className='text-right'>Amount</div>, // Right-align header
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD', // TODO: Make currency configurable later?
      }).format(amount);
      return <div className='text-right font-medium'>{formatted}</div>;
    },
  },
  // Actions Column with Dropdown
  {
    id: 'actions',
    cell: ({ row, table }: CellContext<Transaction, unknown>) => {
      const transaction = row.original;
      const canUserModify = table.options.meta?.canModify ?? false;
      // Access the function correctly typed via meta
      const openEditModal = table.options.meta?.openEditModal;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' className='h-8 w-8 p-0'>
              <span className='sr-only'>Open menu</span>
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                // Type guard to ensure function exists before calling
                if (typeof openEditModal === 'function') {
                  openEditModal(transaction);
                }
              }}
              disabled={!canUserModify}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!canUserModify} className='text-red-600 focus:text-red-700 focus:bg-red-100'>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
];

// --- Extend TableMeta type ---
// (Ensure this augmentation is placed correctly, typically near imports)
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    canModify?: boolean;
    openEditModal?: (transaction: Transaction) => void;
  }
}

export function TransactionsPage() {
  const { data: transactions, isLoading: isLoadingTransactions, error: errorTransactions } = useQuery(getTransactions);
  const { data: envelopes, isLoading: isLoadingEnvelopes, error: errorEnvelopes } = useQuery(getEnvelopes);
  const { data: userProfile, isLoading: isLoadingProfile, error: errorProfile } = useQuery(getCurrentUserProfile);

  // State for the 'Add Transaction' dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addDescription, setAddDescription] = useState('');
  const [addAmount, setAddAmount] = useState('0');
  const [addDate, setAddDate] = useState<Date | undefined>(new Date());
  const [addSelectedEnvelopeId, setAddSelectedEnvelopeId] = useState<string>('');
  const [addTransactionType, setAddTransactionType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // State for the 'Edit Transaction' dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  // State for the form fields within the edit dialog
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('0');
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editSelectedEnvelopeId, setEditSelectedEnvelopeId] = useState<string>('');
  const [editTransactionType, setEditTransactionType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [isUpdateLoading, setIsUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Tanstack Table State
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]); // Will add sorting controls later
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]); // Now used
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({}); // Will add controls later

  // Memoize transactions data to prevent unnecessary recalculations
  const data = useMemo(() => transactions ?? [], [transactions]);

  // Dynamically create columns definition
  const tableColumns = useMemo<ColumnDef<Transaction>[]>(
    () =>
      [
        // Reuse most columns from the static definition
        // Find the correctly typed actions column
        ...columns.filter((col) => col.id !== 'envelopeId'), // No need to filter actions here
        // Re-define envelope column with access to envelopes
        {
          accessorKey: 'envelopeId',
          header: 'Envelope',
          cell: ({ row }: CellContext<Transaction, unknown>) => {
            // Use CellContext here too for consistency
            const envelopeId = row.getValue('envelopeId') as number | null;
            const envelope = envelopes?.find((env) => env.id === envelopeId);
            return envelope ? envelope.name : <span className='text-gray-500 italic'>Unassigned</span>;
          },
        },
        // Removed the redefinition of actions column as it's now correctly typed in the static definition
        // columns.find(col => col.id === 'actions') as ColumnDef<Transaction>,
      ]
        .filter(Boolean)
        .sort((a, b) => {
          // Add sort to maintain original column order
          const order = ['select', 'date', 'description', 'envelopeId', 'type', 'amount', 'actions'];
          // Safely get the key for sorting
          const getKey = (col: ColumnDef<Transaction>): string => {
            if ('accessorKey' in col && col.accessorKey) {
              // Check if accessorKey is a valid key of Transaction
              return col.accessorKey as string;
            }
            return col.id || ''; // Fallback to id or empty string
          };
          return order.indexOf(getKey(a)) - order.indexOf(getKey(b));
        }),
    [envelopes]
  );

  // Determine if user can create transactions (MEMBER, ADMIN, or OWNER)
  const canModify = userProfile && ['MEMBER', 'ADMIN', 'OWNER'].includes(userProfile.role);
  const hasEnvelopes = envelopes && envelopes.length > 0;

  // Edit Modal Trigger Function
  const handleOpenEditModal = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    // Pre-fill edit form state
    setEditDescription(transaction.description);
    setEditAmount(String(transaction.amount)); // Convert number to string for input
    setEditDate(transaction.date ? new Date(transaction.date) : undefined);
    setEditSelectedEnvelopeId(transaction.envelopeId ? String(transaction.envelopeId) : '');
    setEditTransactionType(transaction.type);
    setUpdateError(null); // Clear previous errors
    setIsEditDialogOpen(true);
  };

  // Initialize the table instance
  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      rowSelection,
      sorting, // Add sorting state
      columnFilters, // Add filters state
      columnVisibility, // Add visibility state
    },
    meta: {
      canModify: canModify,
      openEditModal: handleOpenEditModal, // Pass the function here
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting, // Add sorting handler
    onColumnFiltersChange: setColumnFilters, // Add filters handler
    onColumnVisibilityChange: setColumnVisibility, // Add visibility handler
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(), // Add sorted row model
    getFilteredRowModel: getFilteredRowModel(), // Add filtered row model
    getPaginationRowModel: getPaginationRowModel(), // Add pagination model later
  });

  // Add Transaction Handler
  const handleCreateTransaction = async () => {
    setCreateError(null);
    setIsCreateLoading(true);
    try {
      const numericAmount = parseFloat(addAmount);
      const envelopeId = parseInt(addSelectedEnvelopeId, 10);

      if (!addDescription) throw new Error('Description is required.');
      if (isNaN(numericAmount)) throw new Error('Invalid amount.');
      if (isNaN(envelopeId)) throw new Error('Please select an envelope.');
      if (!addDate) throw new Error('Please select a date.');
      if (addTransactionType === TransactionType.TRANSFER) throw new Error('Transfer type not handled here yet.');

      await createTransaction({
        description: addDescription,
        amount: numericAmount,
        date: addDate,
        envelopeId: envelopeId,
        type: addTransactionType,
      });

      resetAddForm();
      setIsAddDialogOpen(false);
    } catch (err: any) {
      setCreateError(err.message || 'An unexpected error occurred');
    } finally {
      setIsCreateLoading(false);
    }
  };

  // Reset Add Form Helper
  const resetAddForm = () => {
    setAddDescription('');
    setAddAmount('0');
    setAddDate(new Date());
    setAddSelectedEnvelopeId('');
    setAddTransactionType(TransactionType.EXPENSE);
  };

  // Save Edit Changes Handler
  const handleSaveChanges = async () => {
    if (!editingTransaction) return;

    setUpdateError(null);
    setIsUpdateLoading(true);
    try {
      const numericAmount = parseFloat(editAmount);
      const envelopeId = editSelectedEnvelopeId ? parseInt(editSelectedEnvelopeId, 10) : null;

      if (!editDescription) throw new Error('Description is required.');
      if (isNaN(numericAmount)) throw new Error('Invalid amount.');
      if (editSelectedEnvelopeId && isNaN(envelopeId as number)) throw new Error('Invalid envelope selected.');
      if (!editDate) throw new Error('Please select a date.');
      if (editTransactionType === TransactionType.TRANSFER) throw new Error('Transfer type not handled here yet.');

      // Call the update action
      await updateTransaction({
        id: editingTransaction.id,
        description: editDescription,
        amount: numericAmount,
        date: editDate,
        envelopeId: envelopeId,
        type: editTransactionType,
      });

      // Close modal and reset state on success
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
    } catch (err: any) {
      console.error('Error updating transaction:', err);
      setUpdateError(err.message || 'Failed to update transaction.');
    } finally {
      setIsUpdateLoading(false);
    }
  };

  // --- Loading / Error Handling ---
  // Combine loading states for simplicity in the initial return
  if (isLoadingTransactions || isLoadingEnvelopes || isLoadingProfile) return 'Loading...';

  // Individual error handling (more specific messages)
  if (errorTransactions) {
    const message = errorTransactions instanceof Error ? errorTransactions.message : String(errorTransactions);
    return `Error loading transactions: ${message}`;
  }
  if (errorEnvelopes) {
    const message = errorEnvelopes instanceof Error ? errorEnvelopes.message : String(errorEnvelopes);
    return `Error loading envelopes: ${message}`;
  }
  if (errorProfile) {
    const message = errorProfile instanceof Error ? errorProfile.message : String(errorProfile);
    return `Error loading user profile: ${message}`;
  }
  // If we reach here, all essential data queries succeeded
  // Although transactions might be empty, which is handled in the table rendering

  // --- Render Component ---
  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center gap-4'>
          <ThemeSwitch />
        </div>
      </Header>
      <div className='p-4'>
        <div className='flex justify-between items-center mb-6'></div>

        {/* Add Transaction Dialog */}
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(isOpen) => {
            setIsAddDialogOpen(isOpen);
            if (!isOpen) {
              resetAddForm(); // Reset form on close
              setCreateError(null); // Clear errors on close
            }
          }}
        >
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle>Add Transaction</DialogTitle>
            </DialogHeader>
            <div className='grid gap-4 py-4'>
              {/* Description */}
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='add-description' className='text-right'>
                  Description
                </Label>
                <Input id='add-description' value={addDescription} onChange={(e) => setAddDescription(e.target.value)} className='col-span-3' required />
              </div>
              {/* Amount */}
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='add-amount' className='text-right'>
                  Amount
                </Label>
                <Input id='add-amount' type='number' step='0.01' value={addAmount} onChange={(e) => setAddAmount(e.target.value)} className='col-span-3' required />
              </div>
              {/* Date Picker Implementation - Adjusted */}
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label className='text-right'>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'col-span-3 justify-start text-left font-normal', // Removed fixed width
                        !addDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className='mr-2 h-4 w-4' />
                      {addDate ? format(addDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  {/* Added align="start" */}
                  <PopoverContent className='w-auto p-0' align='start'>
                    <Calendar mode='single' selected={addDate} onSelect={setAddDate} />
                  </PopoverContent>
                </Popover>
              </div>
              {/* Envelope */}
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='add-envelope' className='text-right'>
                  Envelope
                </Label>
                <Select value={addSelectedEnvelopeId} onValueChange={setAddSelectedEnvelopeId}>
                  <SelectTrigger className='col-span-3'>
                    <SelectValue placeholder='Select an envelope...' />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingEnvelopes && (
                      <SelectItem value='loading' disabled>
                        Loading...
                      </SelectItem>
                    )}
                    {errorEnvelopes && (
                      <SelectItem value='error' disabled>
                        Error loading
                      </SelectItem>
                    )}
                    {envelopes?.map((env) => (
                      <SelectItem key={env.id} value={String(env.id)}>
                        {env.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Type */}
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='add-type' className='text-right'>
                  Type
                </Label>
                <Select value={addTransactionType} onValueChange={(value: string) => setAddTransactionType(value as TransactionType)}>
                  <SelectTrigger className='col-span-3'>
                    <SelectValue placeholder='Select type...' />
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
            {createError && <p className='text-red-500 text-sm px-6 pb-4'>Error: {createError}</p>}
            <DialogFooter>
              <Button variant='outline' onClick={() => setIsAddDialogOpen(false)} disabled={isCreateLoading}>
                Cancel
              </Button>
              <Button onClick={handleCreateTransaction} disabled={isCreateLoading || !addDescription || !addAmount || !addDate || !addSelectedEnvelopeId}>
                {isCreateLoading ? 'Adding...' : 'Add Transaction'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Transaction Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
              <DialogDescription>Update the details for this transaction.</DialogDescription>
            </DialogHeader>
            <div className='grid gap-4 py-4'>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='edit-description' className='text-right'>
                  Description
                </Label>
                <Input id='edit-description' value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className='col-span-3' required />
              </div>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='edit-amount' className='text-right'>
                  Amount
                </Label>
                <Input id='edit-amount' type='number' step='0.01' value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className='col-span-3' required />
              </div>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label className='text-right'>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={'outline'} className={cn('col-span-3 justify-start text-left font-normal', !editDate && 'text-muted-foreground')}>
                      <CalendarIcon className='mr-2 h-4 w-4' />
                      {editDate ? format(editDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-auto p-0' align='start'>
                    <Calendar mode='single' selected={editDate} onSelect={setEditDate} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='edit-envelope' className='text-right'>
                  Envelope
                </Label>
                <Select value={editSelectedEnvelopeId} onValueChange={setEditSelectedEnvelopeId}>
                  <SelectTrigger className='col-span-3'>
                    <SelectValue placeholder='Select an envelope...' />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingEnvelopes && (
                      <SelectItem value='loading' disabled>
                        Loading...
                      </SelectItem>
                    )}
                    {errorEnvelopes && (
                      <SelectItem value='error' disabled>
                        Error
                      </SelectItem>
                    )}
                    {envelopes?.map((env) => (
                      <SelectItem key={env.id} value={String(env.id)}>
                        {env.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='edit-type' className='text-right'>
                  Type
                </Label>
                <Select value={editTransactionType} onValueChange={(v) => setEditTransactionType(v as TransactionType)}>
                  <SelectTrigger className='col-span-3'>
                    <SelectValue placeholder='Select type...' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TransactionType.EXPENSE}>Expense</SelectItem>
                    <SelectItem value={TransactionType.INCOME}>Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {updateError && <p className='text-red-500 text-sm px-6 pb-4'>Error: {updateError}</p>}
            <DialogFooter>
              <Button variant='outline' onClick={() => setIsEditDialogOpen(false)} disabled={isUpdateLoading}>
                Cancel
              </Button>
              <Button onClick={handleSaveChanges} disabled={isUpdateLoading || !editDescription || !editAmount || !editDate}>
                {isUpdateLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Table Toolbar - Add Filtering Input */}
        <div className='flex justify-between py-4'>
          <Input
            placeholder='Filter by description...'
            value={(table.getColumn('description')?.getFilterValue() as string) ?? ''}
            onChange={(event) => table.getColumn('description')?.setFilterValue(event.target.value)}
            className='max-w-sm'
          />
          {/* Add other filters or column visibility dropdown here later */}

          <div className='flex space-x-2'>
            <Link to='/transactions/import'>
              <Button
                variant='outline'
                disabled={isLoadingProfile || !canModify || !hasEnvelopes}
                title={!canModify ? 'Insufficient permissions' : !hasEnvelopes ? 'Create an envelope first' : 'Import transactions from CSV'}
              >
                <Upload className='mr-2 h-4 w-4' /> Bulk Import (.csv)
              </Button>
            </Link>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              disabled={isLoadingProfile || !canModify || !hasEnvelopes}
              title={!canModify ? 'Insufficient permissions' : !hasEnvelopes ? 'Create an envelope first' : 'Add a new transaction'}
            >
              <PlusCircle className='mr-2 h-4 w-4' /> Add Transaction
            </Button>
          </div>
        </div>

        {/* Display Transactions Table using Tanstack Table */}
        <div className='mt-0 border rounded-lg'>
          {' '}
          {/* Removed mt-6 to align with toolbar */}
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : // Add sorting UI to headers later
                            flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={tableColumns.length} // Use dynamic columns length
                    className='h-24 text-center'
                  >
                    {isLoadingTransactions ? 'Loading...' : 'No transactions recorded yet.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination controls (will add later) */}
        <div className='flex items-center justify-end space-x-2 py-4'>{/* Placeholder for pagination buttons */}</div>

        {/* Selected Row Count */}
        <div className='flex-1 text-sm text-muted-foreground'>
          {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
      </div>
    </>
  );
}
