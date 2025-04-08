import React, { useState, ChangeEvent, useMemo, useCallback } from 'react';
import { useQuery, useAction, getEnvelopes, bulkImportTransactions } from 'wasp/client/operations';
import { Link } from 'wasp/client/router';
import type { Envelope } from 'wasp/entities';
// Import enum from @prisma/client for client-side use as well
import { TransactionType } from '@prisma/client';
import Papa from 'papaparse';
// Import Shadcn UI components
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Checkbox } from '../../../components/ui/checkbox'; // Import Checkbox
import { format, parse, isValid } from 'date-fns';
import { cn } from '../../../lib/client/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react'; // Icons for status

// Interface for parsed data row with selection state
interface ParsedRowData {
  id: number; // Unique ID for row tracking
  originalIndex: number; // Original row index from CSV for error reporting
  Date: string;
  Description: string;
  Amount: string; // Keep as string for editing
  isSelected: boolean;
  validationError?: string; // To display row-specific validation errors
}

// Update type for the data sent to the backend action
type TransactionImportDataClient = {
  description: string;
  amount: number;
  date: Date;
  type: TransactionType; // Use the enum
}

// Type for header mapping state
type HeaderMapping = {
    Date: string;
    Description: string;
    Amount: string;
}

// Type for number format selection
type NumberFormat = 'usd' | 'eur';

// Define supported date formats
type DateFormat = 'dd/MM/yyyy' | 'dd.MM.yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd';
const dateFormats: DateFormat[] = ['dd/MM/yyyy', 'dd.MM.yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'];

// Helper to find likely header matches (case-insensitive)
const findHeaderMatch = (headers: string[], keywords: string[]): string => {
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    return headers.find(h => lowerKeywords.includes(h.toLowerCase())) || '';
}

export function BulkImportPage() {
  const { data: envelopes, isLoading: isLoadingEnvelopes, error: errorEnvelopes } = useQuery(getEnvelopes);
  const bulkImportAction = useAction(bulkImportTransactions);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRowData[]>([]);
  const [importResult, setImportResult] = useState<{ successCount: number; errorCount: number; errors: string[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // New state for header mapping
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [rawParsedCsvData, setRawParsedCsvData] = useState<Record<string, string>[]>([]);
  const [headerMappings, setHeaderMappings] = useState<HeaderMapping>({ Date: '', Description: '', Amount: '' });
  const [showMapping, setShowMapping] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // Add state for number format
  const [numberFormat, setNumberFormat] = useState<NumberFormat>('eur'); // Default to Euro format
  // Add state for selected date format
  const [dateFormat, setDateFormat] = useState<DateFormat>('dd/MM/yyyy'); // Default to common EU format

  // NEW: Helper function to parse date string based on selected format
  const parseDateString = useCallback((dateStr: string): Date | null => {
    if (!dateStr) return null;
    try {
      const parsedDate = parse(dateStr, dateFormat, new Date());
      return isValid(parsedDate) ? parsedDate : null;
    } catch (e) {
      console.error('Error parsing date:', e);
      return null;
    }
  }, [dateFormat]); // Depends on the selected dateFormat

  // Function to validate a single row after parsing/editing
  const validateRow = useCallback((row: Pick<ParsedRowData, 'Date' | 'Description' | 'Amount'>): string | undefined => {
    if (!row.Date || !row.Description || !row.Amount) {
      return 'Missing required fields.';
    }
    // Use the robust parsing function
    const date = parseDateString(row.Date); 
    if (!date) { // Check if parsing was successful
      return `Invalid Date for format ${dateFormat}.`; // Informative error
    }
    // Conditional amount normalization based on selected format
    let normalizedAmountString: string;
    if (numberFormat === 'eur') {
       normalizedAmountString = row.Amount.replace(/\./g, '').replace(',', '.'); // EUR: remove '.', replace ',' with '.'
    } else { // Assume 'usd' or default
       normalizedAmountString = row.Amount.replace(/,/g, ''); // USD/UK: remove ','
    }
    
    const amount = parseFloat(normalizedAmountString);
    if (isNaN(amount)) {
      return 'Invalid Amount.';
    }
    if (amount === 0) {
      return 'Amount cannot be zero.';
    }
    return undefined; // No error
  }, [numberFormat, dateFormat, parseDateString]); // Add dateFormat and parseDateString to dependencies

  const resetState = () => {
      setImportResult(null);
      setFileError(null);
      setParsedData([]);
      setDetectedHeaders([]);
      setRawParsedCsvData([]);
      setHeaderMappings({ Date: '', Description: '', Amount: '' });
      setShowMapping(false);
      setShowPreview(false);
      setNumberFormat('eur'); // Reset to default
      setDateFormat('dd/MM/yyyy'); // Reset to default
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    resetState(); // Reset everything on new file selection
    const file = event.target.files?.[0];
    setSelectedFile(file || null);

    if (file) {
      if (file.type !== 'text/csv') {
        setFileError('Invalid file type. Please upload a CSV file.');
        return;
      }

      // Parse headers first to allow mapping
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        preview: 1, // Only parse the header row + first data row initially
        complete: (results) => {
            const headers = results.meta.fields;
            if (!headers || headers.length === 0) {
                setFileError('Could not detect headers in the CSV file.');
                return;
            }
            // Filter out empty string headers
            const validHeaders = headers.filter(h => h !== '');
            if (validHeaders.length === 0) {
                setFileError('No valid (non-empty) headers detected in the CSV file.');
                return;
            }
            setDetectedHeaders(validHeaders); // Set the filtered headers

            // Attempt auto-mapping using validHeaders
            const initialMappings: HeaderMapping = {
                Date: findHeaderMatch(validHeaders, ['date', 'datum', 'buchungstag', 'valuedate']),
                Description: findHeaderMatch(validHeaders, ['description', 'verwendungszweck', 'text', 'beschreibung', 'payee', 'memo']),
                Amount: findHeaderMatch(validHeaders, ['amount', 'betrag', 'value']),
            };
            setHeaderMappings(initialMappings);
            setShowMapping(true); // Show mapping UI

            // Now parse the full file content
             Papa.parse<Record<string, string>>(file, {
                header: true,
                skipEmptyLines: true,
                complete: (fullResults) => {
                   if (fullResults.errors.length > 0) {
                       // Show parsing errors, but allow mapping to proceed if headers were found
                       setFileError(`CSV Parsing Errors: ${fullResults.errors.map(e => e.message).join(', ')}`);
                   }
                   setRawParsedCsvData(fullResults.data);
                },
                error: (error) => {
                   setFileError(`Error reading file content: ${error.message}`);
                   resetState(); // Reset if full parse fails
                },
             });
        },
        error: (error) => {
          setFileError(`Error reading file headers: ${error.message}`);
        },
      });
    }
  };

  const handleMappingChange = (field: keyof HeaderMapping, value: string) => {
      setHeaderMappings(prev => ({ ...prev, [field]: value }));
      // If changing mapping, reset preview table as data needs reprocessing
      setShowPreview(false);
      setParsedData([]);
  };

  // Function to process raw data based on current mappings
  const processDataWithMappings = useCallback(() => {
      if (rawParsedCsvData.length === 0 || !headerMappings.Date || !headerMappings.Description || !headerMappings.Amount) {
          setFileError("Please map all required fields (Date, Description, Amount).");
          setShowPreview(false);
          setParsedData([]);
          return;
      }
      setFileError(null); // Clear previous mapping errors

      const processed: ParsedRowData[] = rawParsedCsvData.map((rawRow, index) => {
          const rowData = {
              Date: rawRow[headerMappings.Date] || '',
              Description: rawRow[headerMappings.Description] || '',
              Amount: rawRow[headerMappings.Amount] || '',
          };
          console.log(`Row ${index + 2} Raw Date String:`, JSON.stringify(rowData.Date)); // Keep logging raw date
          console.log(`Row ${index + 2} Raw Amount String:`, JSON.stringify(rowData.Amount));

          // Validation now uses the correct dateFormat via validateRow dependency
          const validationError = validateRow(rowData); 
          return {
              id: index,
              originalIndex: index + 2,
              ...rowData,
              isSelected: !validationError,
              validationError,
          };
      });

      setParsedData(processed);
      setShowPreview(true);
  }, [rawParsedCsvData, headerMappings, validateRow]); // validateRow dependency ensures correct date format is used

  // Handle individual row selection
  const handleRowSelectionChange = (id: number, checked: boolean) => {
    setParsedData(prevData =>
      prevData.map(row => (row.id === id ? { ...row, isSelected: checked } : row))
    );
  };

  // Handle "Select All" checkbox
  const handleSelectAllChange = (checked: boolean) => {
    setParsedData(prevData => prevData.map(row => row.validationError ? row : { ...row, isSelected: checked }));
  };

  // Handle cell editing
  const handleCellEdit = (id: number, field: keyof Pick<ParsedRowData, 'Date' | 'Description' | 'Amount'>, value: string) => {
    setParsedData(prevData =>
      prevData.map(row => {
        if (row.id === id) {
          const updatedRow = { ...row, [field]: value };
          // Re-validate on edit
          const validationError = validateRow(updatedRow);
          return { ...updatedRow, validationError };
        }
        return row;
      })
    );
  };

  const selectedRows = useMemo(() => parsedData.filter(row => row.isSelected), [parsedData]);
  const validSelectedRows = useMemo(() => selectedRows.filter(row => !row.validationError), [selectedRows]);

  const handleImport = async () => {
    if (validSelectedRows.length === 0) {
      setImportResult({
        successCount: 0,
        errorCount: selectedRows.length,
        errors: [
          'No valid transactions selected.'
        ],
      });
      return;
    }
    setIsImporting(true);
    setImportResult(null);

    const transactionsToImport: TransactionImportDataClient[] = [];
    const errorsProcessing: string[] = [];

    validSelectedRows.forEach(row => {
      // Use the robust parsing function HERE before sending to backend
      const parsedDate = parseDateString(row.Date);
      if (!parsedDate) {
        errorsProcessing.push(`Row ${row.originalIndex}: Could not parse date '${row.Date}' with format ${dateFormat}. Skipped.`);
        return; // Skip this row
      }

      // Amount normalization (existing logic)
      let normalizedAmountString: string;
      if (numberFormat === 'eur') {
         normalizedAmountString = row.Amount.replace(/\./g, '').replace(',', '.');
      } else {
         normalizedAmountString = row.Amount.replace(/,/g, '');
      }
      const parsedAmount = parseFloat(normalizedAmountString);
      // Basic check, refined validation is in validateRow
      if (isNaN(parsedAmount)) { 
          errorsProcessing.push(`Row ${row.originalIndex}: Invalid amount '${row.Amount}'. Skipped.`);
          return; 
      }

      transactionsToImport.push({
        description: row.Description,
        amount: parsedAmount, // Amount is already handled by backend now
        date: parsedDate,      // Use the correctly parsed date object
        // Type is determined by backend based on amount sign
        type: parsedAmount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME,
      });
    });

    if (transactionsToImport.length === 0) {
        setImportResult({ successCount: 0, errorCount: selectedRows.length, errors: [...errorsProcessing, 'No valid rows to import after final parsing.'] });
        setIsImporting(false);
        return;
    }

    try {
      const result = await bulkImportAction({
        transactions: transactionsToImport,
      });
      // Combine processing errors with import errors
      setImportResult({ ...result, errors: [...errorsProcessing, ...result.errors] });
    } catch (error: any) {
      setImportResult({ successCount: 0, errorCount: transactionsToImport.length + errorsProcessing.length, errors: [...errorsProcessing, error?.message || 'Unexpected error during import.'], });
    } finally {
      setIsImporting(false);
    }
  };

  // Calculate state for UI elements
  const isMappingComplete = !!headerMappings.Date && !!headerMappings.Description && !!headerMappings.Amount;
  const isAllSelected = useMemo(() => parsedData.length > 0 && validSelectedRows.length === parsedData.filter(r => !r.validationError).length, [parsedData, validSelectedRows]);
  const canSubmit = validSelectedRows.length > 0 && !isImporting;

  return (
    <div className='container mx-auto p-4 space-y-6'>
      <h1 className='text-2xl font-bold mb-4'>Bulk Import Transactions</h1>

      {/* Step 1: File Upload, Format, and Envelope Selection */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 border-b pb-6'>
        <div>
          <Label htmlFor='csvFile' className='block text-sm font-medium text-gray-700 mb-1'>
            Upload CSV File
          </Label>
          <Input
            type='file'
            id='csvFile'
            accept='.csv'
            onChange={handleFileChange}
            className='block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100 disabled:opacity-50'
            disabled={isImporting}
          />
          {fileError && <p className='mt-1 text-sm text-red-600'>{fileError}</p>}
        </div>

        {/* ADD Date Format Selector */}
        <div>
          <Label htmlFor='dateFormat' className='block text-sm font-medium text-gray-700 mb-1'>
            Date Format in File
          </Label>
          <Select
            value={dateFormat}
            onValueChange={(value: DateFormat) => {
               setDateFormat(value);
               // Re-process data if preview is shown, as validation changes
               if (showPreview) {
                   processDataWithMappings();
               }
            }}
            disabled={isImporting}
          >
            <SelectTrigger id='dateFormat' className="w-full">
              <SelectValue placeholder="Select date format..." />
            </SelectTrigger>
            <SelectContent>
               {dateFormats.map(format => (
                 <SelectItem key={format} value={format}>{format}</SelectItem>
               ))}
            </SelectContent>
          </Select>
          <p className='mt-1 text-xs text-gray-500'>Select the format used in your file's date column.</p>
        </div>

        {/* Number Format Selector */}
        <div>
          <Label htmlFor='numberFormat' className='block text-sm font-medium text-gray-700 mb-1'>
            Amount Format
          </Label>
          <Select
            value={numberFormat}
            onValueChange={(value: NumberFormat) => {
                setNumberFormat(value);
                 // Re-process data if preview is shown, as validation changes
                if (showPreview) {
                    processDataWithMappings();
                }
            }}
            disabled={isImporting}
          >
            <SelectTrigger id='numberFormat' className="w-full">
              <SelectValue placeholder="Select amount format..." />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="eur">Euro (€1.234,56)</SelectItem>
               <SelectItem value="usd">USD/UK ($1,234.56)</SelectItem>
            </SelectContent>
          </Select>
          <p className='mt-1 text-xs text-gray-500'>Select the decimal/thousands separator style used in your file's amount column.</p>
        </div>

      </div>

      {/* Step 2: Header Mapping */}
      {showMapping && (
          <div className='mt-6 p-4 border rounded-lg bg-gray-50 space-y-4'>
               <h2 className="text-lg font-semibold text-gray-800">Map CSV Columns</h2>
               <p className="text-sm text-gray-600">Select which column from your CSV file corresponds to each required field.</p>
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {( ['Date', 'Description', 'Amount'] as const).map((field) => (
                     <div key={field}>
                        <Label htmlFor={`map-${field}`} className='block text-sm font-medium text-gray-700 mb-1'> {field} <span className="text-red-500">*</span> </Label>
                         <Select value={headerMappings[field]} onValueChange={(value) => handleMappingChange(field, value)} >
                           <SelectTrigger id={`map-${field}`} className="w-full bg-white"> <SelectValue placeholder="Select CSV column..." /> </SelectTrigger>
                           <SelectContent>
                              {detectedHeaders.map(header => ( <SelectItem key={header} value={header}>{header}</SelectItem> ))}
                           </SelectContent>
                        </Select>
                     </div>
                  ))}
               </div>
                {/* Button to confirm mapping and process data */}
                <Button onClick={processDataWithMappings} disabled={!isMappingComplete || rawParsedCsvData.length === 0} >
                  Preview Transactions
                </Button>
           </div>
       )}

      {/* Step 3: Preview and Edit Table */}
      {showPreview && parsedData.length > 0 && (
          <div className='mt-6 space-y-4'>
              <h2 className="text-xl font-semibold">Preview & Edit Transactions</h2>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[50px]">
                            <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAllChange} aria-label="Select all rows" />
                        </TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {parsedData.map((row) => (
                        <TableRow key={row.id} data-state={row.isSelected ? 'selected' : ''} className={cn(row.validationError ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-gray-50')}>
                            <TableCell> <Checkbox checked={row.isSelected} onCheckedChange={(checked) => handleRowSelectionChange(row.id, !!checked)} aria-label={`Select row ${row.originalIndex}`} /> </TableCell>
                            <TableCell> <Input type="text" value={row.Date} onChange={(e) => handleCellEdit(row.id, 'Date', e.target.value)} className="h-8 text-sm" placeholder="YYYY-MM-DD" /> </TableCell>
                            <TableCell> <Input value={row.Description} onChange={(e) => handleCellEdit(row.id, 'Description', e.target.value)} className="h-8 text-sm" /> </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="text"
                                value={row.Amount}
                                onChange={(e) => handleCellEdit(row.id, 'Amount', e.target.value)}
                                className="h-8 text-sm text-right"
                                placeholder='e.g. 1234.56 or 1234,56'
                              />
                            </TableCell>
                            <TableCell className="text-xs">
                                {row.validationError ? ( <span className="flex items-center text-red-600"><AlertCircle className="mr-1 h-4 w-4"/> {row.validationError}</span> ) :
                                                      ( <span className="flex items-center text-green-600"><CheckCircle2 className="mr-1 h-4 w-4"/> Valid</span> )}
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </div>
               <p className="text-sm text-gray-600"> Selected: {selectedRows.length} row(s). Valid for import: {validSelectedRows.length} row(s). </p>
               {/* Import Button - now appears after preview */}
               <Button 
                 onClick={handleImport} 
                 disabled={!canSubmit} 
                 className='mt-4' 
                 title={!canSubmit ? 'Select valid rows to import' : 'Import selected transactions'}
               >
                   {isImporting ? 'Importing...' : `Import ${validSelectedRows.length} Valid Transaction(s)`}
               </Button>
          </div>
      )}

      {/* Step 4: Import Results */}
      {importResult && (
          <div className={`mt-4 p-4 rounded-md ${importResult.errorCount > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
               <h3 className={`text-lg font-medium ${importResult.errorCount > 0 ? 'text-red-800' : 'text-green-800'}`}>Import Complete</h3>
               <div className={`mt-2 text-sm ${importResult.errorCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  <p>Successfully imported: {importResult.successCount} transaction(s).</p>
                  <p>Failed/Skipped: {importResult.errorCount} transaction(s).</p>
                  {importResult.errors.length > 0 && (
                     <div className='mt-2'>
                        <p className='font-semibold'>Messages:</p>
                        <ul className='list-disc list-inside pl-4'> {importResult.errors.map((error, index) => ( <li key={index}>{error}</li> ))} </ul>
                     </div>
                  )}
               </div>
          </div>
      )}

      {/* Navigation */}
      <div className='mt-6'> <Link to='/transactions' className='text-sm text-indigo-600 hover:text-indigo-800'> &larr; Back to Transactions </Link> </div>
    </div>
  );
}
