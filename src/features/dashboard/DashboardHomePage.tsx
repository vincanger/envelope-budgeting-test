import React, { useEffect, useMemo } from 'react';
import { getEnvelopes, getUserBudgetProfiles, getTransactions } from 'wasp/client/operations';
import { useQuery } from 'wasp/client/operations';
import { type Transaction } from 'wasp/entities';
import { TransactionType } from '@prisma/client';
import { Link } from 'wasp/client/router';
import { useNavigate } from 'react-router-dom';
import { routes } from 'wasp/client/router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Header } from '../../components/layout/header';
import { Main } from '../../components/layout/main';
import { ProfileDropdown } from '../../components/profile-dropdown';
import { Search } from '../../components/search';
import { ThemeSwitch } from '../../components/theme-switch';
import { DollarSign, ListChecks, PiggyBank, Wallet } from 'lucide-react';

// Import the chart components
import { SpendingPieChart } from './components/SpendingPieChart';
import { EnvelopeBudgetStatusChart } from './components/EnvelopeBudgetStatusChart';
import { MonthlySummaryChart } from './components/MonthlySummaryChart';

const formatCurrency = (value: number) => {
  return `$${value.toFixed(2)}`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: envelopes, isLoading: isLoadingEnvelopes, error: errorEnvelopes } = useQuery(getEnvelopes);
  const { data: budgetProfiles, isLoading: isLoadingProfiles, error: errorProfiles } = useQuery(getUserBudgetProfiles);

  // Fetch ALL transactions - will filter client-side for now
  const { data: transactions, isLoading: isLoadingTransactions, error: errorTransactions } = useQuery(getTransactions); // Reverted to getTransactions

  useEffect(() => {
    if (!isLoadingProfiles && budgetProfiles && budgetProfiles.length === 0) {
      console.log('No budget profiles found, redirecting to create profile...');
      navigate(routes.CreateBudgetProfileRoute.to);
    }
  }, [isLoadingProfiles, budgetProfiles]);

  // --- Calculate Summaries and Chart Data ---
  const { summary, envelopeBudgetData, monthlyIncome, monthlySummaryData } = useMemo(() => {
    // Define current month boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const defaultSummary = { totalBudgeted: 0, totalSpent: 0, totalRemaining: 0, count: 0 };
    const defaultResult = { summary: defaultSummary, envelopeBudgetData: [], monthlyIncome: 0, monthlySummaryData: [] };

    // Ensure essential data is loaded
    if (!envelopes) {
      return defaultResult;
    }

    // Overall Summary (remains the same)
    const totalBudgeted = envelopes.reduce((sum, env) => sum + env.amount, 0);
    const totalSpent = envelopes.reduce((sum, env) => sum + env.spent, 0);
    const overallSummary = {
      totalBudgeted,
      totalSpent,
      totalRemaining: totalBudgeted - totalSpent,
      count: envelopes.length,
    };

    // Monthly Calculations
    let incomeThisMonth = 0;
    const spentPerEnvelopeThisMonth: { [key: number]: number } = {};

    // Check if transactions exist and is an array before filtering/iterating
    if (transactions && Array.isArray(transactions)) {
      // Filter transactions for the current month first
      const monthlyTransactions = transactions.filter((tx) => {
        const txDate = new Date(tx.date);
        return txDate >= startOfMonth && txDate <= endOfMonth;
      });

      monthlyTransactions.forEach((tx: Transaction) => {
        // Add explicit type to tx
        if (tx.type === TransactionType.INCOME) {
          incomeThisMonth += tx.amount;
        } else if (tx.type === TransactionType.EXPENSE && tx.envelopeId !== null) {
          spentPerEnvelopeThisMonth[tx.envelopeId] = (spentPerEnvelopeThisMonth[tx.envelopeId] || 0) + tx.amount;
        }
      });
    }

    // Format data for the EnvelopeBudgetStatusChart (remains the same logic)
    const budgetDataForChart = envelopes.map((env) => {
      const spentThisMonth = spentPerEnvelopeThisMonth[env.id] || 0;
      const remainingThisMonth = env.amount - spentThisMonth;
      return {
        name: env.name,
        spent: spentThisMonth,
        remaining: Math.max(0, remainingThisMonth),
        budgeted: env.amount,
      };
    });

    // --- Calculate Totals for Monthly Summary Chart ---
    const totalSpentThisMonth = budgetDataForChart.reduce((sum, data) => sum + data.spent, 0);
    // Calculate remaining based on income and spent this month
    const totalRemainingThisMonth = Math.max(0, incomeThisMonth - totalSpentThisMonth);

    // --- Format data for Monthly Summary Chart ---
    const summaryChartData = [
      { name: 'Spent' as const, value: totalSpentThisMonth },
      { name: 'Remaining' as const, value: totalRemainingThisMonth },
      { name: 'Income' as const, value: incomeThisMonth },
    ];

    return {
      summary: overallSummary,
      envelopeBudgetData: budgetDataForChart,
      monthlyIncome: incomeThisMonth,
      monthlySummaryData: summaryChartData,
    };
    // Depend on transactions now instead of monthlyTransactions
  }, [envelopes, transactions]);

  // --- Loading / Error States ---
  const isLoading = isLoadingProfiles || isLoadingEnvelopes || isLoadingTransactions;
  const error = errorProfiles || errorEnvelopes || errorTransactions;

  if (isLoading) {
    return <div>Loading dashboard data...</div>; // Single loading state
  }

  if (error) {
    return <div className='p-4 text-red-500'>Error loading data: {error.message}</div>;
  }

  // --- Render Component ---
  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold'>Budget Dashboard</h2>
        <div className='ml-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className='mb-4 flex items-center justify-between space-y-2'>
          <h1 className='text-2xl font-bold tracking-tight'>Overview</h1>
        </div>

        {/* Summary Cards */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6'>
          <Card className='hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Total Budgeted</CardTitle>
              <PiggyBank className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{formatCurrency(summary.totalBudgeted)}</div>
            </CardContent>
          </Card>
          <Card className='hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Total Spent</CardTitle>
              <DollarSign className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{formatCurrency(summary.totalSpent)}</div>
            </CardContent>
          </Card>
          <Card className='hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Total Remaining</CardTitle>
              <Wallet className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{formatCurrency(summary.totalRemaining)}</div>
            </CardContent>
          </Card>
          <Card className='hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Envelopes</CardTitle>
              <ListChecks className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{summary.count}</div>
              <p className='text-xs text-muted-foreground'>
                <Link to={routes.EnvelopesRoute.to} className='underline'>
                  Manage
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Area */}
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-7 mb-6'>
          {/* Pie Chart Card */}
          <Card className='col-span-1 lg:col-span-1 xl:col-span-3 hover:shadow-md'>
            <CardHeader>
              <CardTitle>Spending by Envelope</CardTitle>
              <CardDescription>Current month's spending distribution.</CardDescription>
            </CardHeader>
            <CardContent className='pl-2'>
              {/* Check filtered monthly transactions *before* rendering PieChart */}
              {!transactions ||
              transactions.filter((tx) => {
                const txDate = new Date(tx.date);
                const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);
                return txDate >= startOfMonth && txDate <= endOfMonth && tx.type === TransactionType.EXPENSE && tx.envelopeId;
              }).length === 0 ? (
                <div className='text-center text-gray-500 py-8'>No spending data for this month.</div>
              ) : (
                <SpendingPieChart />
              )}
            </CardContent>
          </Card>

          {/* Bar Chart Card */}
          <Card className='col-span-1 lg:col-span-1 xl:col-span-4 hover:shadow-md'>
            <CardHeader>
              <CardTitle>Envelope Budget Status</CardTitle>
              <CardDescription>Current month's spent vs. remaining budget.</CardDescription>
            </CardHeader>
            <CardContent className='pl-0 pr-4 pb-4'>
              <EnvelopeBudgetStatusChart data={envelopeBudgetData} />
            </CardContent>
          </Card>
        </div>
        {/* End of Charts Area grid */}

        {/* Monthly Summary Chart Area */}
        <div className='mb-6'>
          <Card className='hover:shadow-md'>
            <CardHeader>
              <CardTitle>Monthly Financial Summary</CardTitle>
              <CardDescription>Total income vs. total spent and remaining for the current month.</CardDescription>
            </CardHeader>
            <CardContent className='pl-2 pr-4 pb-4'>
              {' '}
              {/* Adjust padding */}
              <MonthlySummaryChart data={monthlySummaryData} />
            </CardContent>
          </Card>
        </div>
      </Main>
      {/* End of Main */}
    </>
    // End of Fragment
  );
}
