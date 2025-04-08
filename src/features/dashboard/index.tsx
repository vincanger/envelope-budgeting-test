import React, { useEffect } from 'react';
import { getEnvelopes, getUserBudgetProfiles } from 'wasp/client/operations';
import { useQuery } from 'wasp/client/operations';
import { type Envelope, type UserBudgetProfile } from 'wasp/entities';
import { Link } from 'wasp/client/router';
import { useNavigate } from 'react-router-dom';
import { Routes, routes } from 'wasp/client/router';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '../../components/ui/card';
import { Header } from '../../components/layout/header';
import { Main } from '../../components/layout/main';
import { TopNav } from '../../components/layout/top-nav';
import { ProfileDropdown } from '../../components/profile-dropdown';
import { Search } from '../../components/search';
import { ThemeSwitch } from '../../components/theme-switch';
import { DollarSign, ListChecks, PiggyBank, Wallet } from 'lucide-react';

const formatCurrency = (value: number) => {
  return `$${value.toFixed(2)}`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: envelopes, isLoading: isLoadingEnvelopes, error: errorEnvelopes } = useQuery(getEnvelopes);
  const { data: budgetProfiles, isLoading: isLoadingProfiles, error: errorProfiles } = useQuery(getUserBudgetProfiles);

  useEffect(() => {
    if (!isLoadingProfiles && budgetProfiles && budgetProfiles.length === 0) {
      console.log('No budget profiles found, redirecting to create profile...');
      navigate(routes.CreateBudgetProfileRoute.to);
    }
  }, [isLoadingProfiles, budgetProfiles]);

  const summary = React.useMemo(() => {
    if (!envelopes) return { totalBudgeted: 0, totalSpent: 0, totalRemaining: 0, count: 0 };
    const totalBudgeted = envelopes.reduce((sum, env) => sum + env.amount, 0);
    const totalSpent = envelopes.reduce((sum, env) => sum + env.spent, 0);
    return {
      totalBudgeted,
      totalSpent,
      totalRemaining: totalBudgeted - totalSpent,
      count: envelopes.length,
    };
  }, [envelopes]);

  if (isLoadingProfiles) {
    return <div>Loading user data...</div>;
  }

  if (errorProfiles) {
    return <div className="p-4 text-red-500">Error checking user profile: {errorProfiles.message}</div>;
  }

  return (
    <>
      <Header>
        <h2 className="text-lg font-semibold">Budget Dashboard</h2>
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
        
        {isLoadingEnvelopes && <p>Loading dashboard data...</p>}
        {errorEnvelopes && <p className="text-red-500">Error loading data: {errorEnvelopes.message}</p>}

        {!isLoadingEnvelopes && !errorEnvelopes && (
          <>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Total Budgeted
                  </CardTitle>
                  <PiggyBank className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{formatCurrency(summary.totalBudgeted)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Total Spent</CardTitle>
                  <DollarSign className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{formatCurrency(summary.totalSpent)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Total Remaining</CardTitle>
                   <Wallet className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{formatCurrency(summary.totalRemaining)}</div>
                </CardContent>
              </Card>
               <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Envelopes</CardTitle>
                  <ListChecks className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{summary.count}</div>
                  <p className='text-xs text-muted-foreground'><Link to={routes.EnvelopesRoute.to} className="underline">Manage Envelopes</Link></p>
                </CardContent>
              </Card>
            </div>

            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='col-span-1 lg:col-span-7'>
                <CardHeader>
                  <CardTitle>Envelope Status</CardTitle>
                  <CardDescription>
                    Overview of your budget categories.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  {!envelopes || envelopes.length === 0 ? (
                     <p>No envelopes created yet. <Link to={routes.EnvelopesRoute.to} className="underline">Create one now</Link>.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {envelopes.map((envelope) => (
                        <Card key={envelope.id}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">{envelope.name}</CardTitle>
                            <CardDescription>{envelope.category || 'Uncategorized'}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xs text-muted-foreground">Budgeted: {formatCurrency(envelope.amount)}</p>
                            <p className="text-xs text-muted-foreground">Spent: {formatCurrency(envelope.spent)}</p>
                            <p className="text-sm font-semibold">Remaining: {formatCurrency(envelope.amount - envelope.spent)}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </Main>
    </>
  );
}
