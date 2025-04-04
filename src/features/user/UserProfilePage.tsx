import type { UpdateUserProfileInput } from './types.ts';

import React, { useState, useEffect } from 'react';
import { updateUserProfile } from 'wasp/client/operations';
import { useAuth } from 'wasp/client/auth';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { useNavigate } from 'react-router-dom';
import { routes } from 'wasp/client/router';

export function UserProfilePage() {
  const navigate = useNavigate();
  const { data: user, isLoading: isUserLoading } = useAuth();

  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const payload = {};

    setIsExecuting(true);
    setError(null);
    try {
      await updateUserProfile(payload);
      alert('Profile checked (no updates performed yet).');
    } catch (err: any) {
      setError(err);
      alert(`Error interacting with profile: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  if (isUserLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    navigate(routes.LoginRoute.to);
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
       <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>User Profile</CardTitle>
          <CardDescription>Your user profile details.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Email and password managed via Auth settings/flows.
            </p>
             {error && (
              <div className="text-red-500 text-sm">
                Error: {error.message || 'Failed to interact with profile.'}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isExecuting} className="w-full">
              {isExecuting ? 'Processing...' : 'Refresh/Check Profile'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 