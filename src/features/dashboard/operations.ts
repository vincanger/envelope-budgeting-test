import { HttpError } from 'wasp/server';
import type { Transaction, BudgetProfile, UserBudgetProfile, Envelope } from 'wasp/entities';
import { TransactionType } from '@prisma/client'; // Import enum for value comparison
import type { GetIncomeExpenseSummary, GetSpendingByEnvelope } from 'wasp/server/operations';
import { startOfMonth, subMonths, format, endOfMonth } from 'date-fns';

type MonthlySummary = {
  name: string; // Format 'YYYY-MM'
  income: number;
  expense: number;
};

// Type for the spending summary data
type SpendingSummary = {
  name: string; // Envelope name
  value: number; // Total spent in this envelope this month
};

export const getIncomeExpenseSummary: GetIncomeExpenseSummary<void, MonthlySummary[]> = async (
  _args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const userId = context.user.id;
  const { Transaction, BudgetProfile, UserBudgetProfile } = context.entities;

  // Find the UserBudgetProfile link for the current user
  const userBudgetProfile = await UserBudgetProfile.findFirst({
    where: { userId: userId },
    // Optionally include BudgetProfile if needed elsewhere, but just the ID is required for filtering transactions
    // include: { budgetProfile: true }
  });

  // If user is not linked to any budget profile, return empty data
  if (!userBudgetProfile) {
    console.log('User not associated with any budget profile.');
    return [];
  }

  const budgetProfileId = userBudgetProfile.budgetProfileId;

  // Calculate the date range: from 12 months ago to the end of the current month
  const endDate = endOfMonth(new Date());
  const startDate = startOfMonth(subMonths(endDate, 11));

  // Fetch transactions within the date range FOR THE USER'S BUDGET PROFILE
  const transactions = await Transaction.findMany({
    where: {
      // Filter by the budgetProfileId obtained from UserBudgetProfile
      budgetProfileId: budgetProfileId, 
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  // Initialize monthly summaries (Ensure all 12 months are represented)
  const monthlySummaries: Record<string, { income: number; expense: number }> = {};
  for (let i = 0; i < 12; i++) {
    const monthDate = subMonths(endDate, i);
    const monthKey = format(monthDate, 'yyyy-MM');
    monthlySummaries[monthKey] = { income: 0, expense: 0 };
  }

  // Process transactions and aggregate income/expense by month
  transactions.forEach((tx) => {
    const monthKey = format(tx.date, 'yyyy-MM');
    // Check if the month key exists (it should, due to initialization)
    if (monthlySummaries[monthKey]) { 
      if (tx.type === TransactionType.INCOME) {
        monthlySummaries[monthKey].income += tx.amount;
      } else if (tx.type === TransactionType.EXPENSE) {
        // Expenses are usually stored as positive numbers, representing outflow
        monthlySummaries[monthKey].expense += Math.abs(tx.amount);
      }
    }
  });

  // Convert to the array format expected by the chart, sorting chronologically by month key
  const sortedResult = Object.keys(monthlySummaries)
    .sort() // Sorts keys chronologically ('2023-12', '2024-01', etc.)
    .map(monthKey => {
      const totals = monthlySummaries[monthKey];
      return {
        name: format(new Date(monthKey + '-01T00:00:00'), 'MMM yy'), // Use ISO format with time to avoid timezone issues
        income: totals.income,
        expense: totals.expense,
      };
    });

  return sortedResult;
};

export const getSpendingByEnvelope: GetSpendingByEnvelope<void, SpendingSummary[]> = async (
  _args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const userId = context.user.id;
  const { Transaction, Envelope, BudgetProfile, UserBudgetProfile } = context.entities;

  // Find the UserBudgetProfile link
  const userBudgetProfile = await UserBudgetProfile.findFirst({
    where: { userId: userId },
  });

  if (!userBudgetProfile) {
    console.log('User not associated with any budget profile.');
    return [];
  }
  const budgetProfileId = userBudgetProfile.budgetProfileId;

  // Get current month's start and end dates
  const now = new Date();
  const startDate = startOfMonth(now);
  const endDate = endOfMonth(now);

  // --- BEGIN DEBUG LOGGING ---
  console.log(`[getSpendingByEnvelope] Query Params: budgetProfileId=${budgetProfileId}, startDate=${startDate.toISOString()}, endDate=${endDate.toISOString()}`);
  // --- END DEBUG LOGGING ---

  // Fetch expense transactions for the current month within the user's budget profile
  const transactions = await Transaction.findMany({
    where: {
      budgetProfileId: budgetProfileId,
      type: TransactionType.EXPENSE, // Only expenses
      date: { 
        gte: startDate,
        lte: endDate,
      },
      envelopeId: { not: null }, // Only transactions linked to an envelope
    },
    include: {
      envelope: true, // Include envelope data to get the name
    },
  });

  // --- BEGIN DEBUG LOGGING ---
  console.log(`[getSpendingByEnvelope] Fetched ${transactions.length} transactions for the current month.`);
  // Log details of each transaction fetched
  transactions.forEach((tx, index) => {
      console.log(`[getSpendingByEnvelope] TX ${index}: ID=${tx.id}, Amount=${tx.amount}, Date=${tx.date}, EnvelopeID=${tx.envelopeId}, EnvelopeName=${tx.envelope?.name}`);
  });
  // --- END DEBUG LOGGING ---

  // Aggregate spending by envelope
  const spendingMap: Record<string, number> = {};
  transactions.forEach((tx) => {
    // Ensure envelope exists and has a name
    if (tx.envelope && tx.envelope.name) { 
      const name = tx.envelope.name;
      spendingMap[name] = (spendingMap[name] || 0) + Math.abs(tx.amount);
    } else {
       const unassigned = 'Unassigned';
       spendingMap[unassigned] = (spendingMap[unassigned] || 0) + Math.abs(tx.amount);
       // --- BEGIN DEBUG LOGGING ---
       console.log(`[getSpendingByEnvelope] Aggregating TX ${tx.id} under 'Unassigned'`);
       // --- END DEBUG LOGGING ---
    }
  });

  // --- BEGIN DEBUG LOGGING ---
  console.log('[getSpendingByEnvelope] Final spendingMap:', JSON.stringify(spendingMap));
  // --- END DEBUG LOGGING ---

  // Convert map to array format for the chart
  const result: SpendingSummary[] = Object.entries(spendingMap)
    .map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)), // Ensure 2 decimal places
    }))
    // Optional: Sort by value descending
    .sort((a, b) => b.value - a.value);

  return result;
};

// Helper function if needed for sorting by month name (less reliable than sorting by key)
// function getMonthIndex(monthAbbr: string): number {
//   return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(monthAbbr);
// } 