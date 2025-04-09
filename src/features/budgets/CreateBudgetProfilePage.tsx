import React, { useState } from 'react';
import { createBudgetProfile } from 'wasp/client/operations';
import { useNavigate } from 'react-router-dom';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { ThemeSwitch } from '../../components/theme-switch';
import { Search } from '../../components/search';
import { Header } from '../../components/layout/header';

export function CreateBudgetProfilePage() {
  const navigate = useNavigate();
  const { data: user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      alert('You must be logged in to create a profile.');
      return;
    }
    setIsExecuting(true);
    setError(null);
    try {
      await createBudgetProfile({ name, description, currency });
      navigate(routes.DashboardRoute.to);
    } catch (err: any) {
      setError(err);
      alert(`Error creating profile: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  if (!user) {
    navigate(routes.LoginRoute.to);
    return null;
  }

  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center gap-4'>
          <ThemeSwitch />
        </div>
      </Header>
      <div className='flex items-center justify-center min-h-screen p-4'>
        <Card className='w-full max-w-md'>
          <CardHeader>
            <CardTitle>Create Your Budget Profile</CardTitle>
            <CardDescription>Set up your main budget profile to start managing your finances.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className='space-y-4'>
              <div className='space-y-1.5'>
                <Label htmlFor='name'>Profile Name</Label>
                <Input id='name' type='text' value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required placeholder='e.g., Household Budget' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='description'>Description (Optional)</Label>
                <Textarea id='description' value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} placeholder='A short description of this budget' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='currency'>Currency</Label>
                <Input id='currency' type='text' value={currency} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrency(e.target.value.toUpperCase())} required maxLength={3} placeholder='e.g., USD' />
                <p className='text-sm text-muted-foreground'>Enter the 3-letter currency code (e.g., USD, EUR).</p>
              </div>
              {error && <div className='text-red-500 text-sm'>Error: {error.message || 'Failed to create profile.'}</div>}
            </CardContent>
            <CardFooter>
              <Button type='submit' disabled={isExecuting} className='w-full'>
                {isExecuting ? 'Creating...' : 'Create Profile'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </>
  );
}
