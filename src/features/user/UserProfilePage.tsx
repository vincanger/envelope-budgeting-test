import type { UpdateUserProfileInput } from './types.ts';

import React, { useState, useEffect } from 'react';
import { updateUserProfile } from 'wasp/client/operations';
import { useAuth } from 'wasp/client/auth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { useNavigate } from 'react-router-dom';
import { routes } from 'wasp/client/router';

export function UserProfilePage() {
  const navigate = useNavigate();
  const { data: user, isLoading: isUserLoading } = useAuth();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const payload: UpdateUserProfileInput = {};
    if (displayName) {
      payload.displayName = displayName;
    }
    if (avatarUrl) {
      payload.avatarUrl = avatarUrl;
    }
    if ('displayName' in payload && !displayName) payload.displayName = null;
    if ('avatarUrl' in payload && !avatarUrl) payload.avatarUrl = null;

    setIsExecuting(true);
    setError(null);
    try {
      await updateUserProfile(payload);
      toast({ title: 'Success', description: 'Profile updated successfully.' });
    } catch (err: any) {
      setError(err);
      toast({ title: 'Error', description: `Failed to update profile: ${err.message || 'Unknown error'}`, variant: 'destructive' });
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
          <CardDescription>Update your display name and avatar.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input
                id="avatarUrl"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.png"
                type="url"
              />
            </div>
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
              {isExecuting ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 