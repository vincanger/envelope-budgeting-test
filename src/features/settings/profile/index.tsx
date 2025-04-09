import type { UpdateUserProfileInput } from '../../user/types.js';

import React, { useState, useEffect } from 'react';
import { updateUserProfile } from 'wasp/client/operations';
import { useAuth } from 'wasp/client/auth';
import { useToast } from '../../../hooks/use-toast.js';
import { useNavigate } from 'react-router-dom';
import { routes } from 'wasp/client/router';

// Import react-hook-form and zod
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Import Shadcn Form components
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../../../components/ui/form.jsx';

import ContentSection from '../components/content-section.jsx';

// Define Zod schema for profile form
const profileFormSchema = z.object({
  displayName: z.string().max(50, 'Display name must be 50 characters or less.').optional().nullable(), // Allow empty string to become null
  avatarUrl: z.string().url({ message: 'Please enter a valid URL.' }).max(2048, 'URL too long').optional().nullable(), // Allow empty string to become null
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function UserProfilePage() {
  const navigate = useNavigate();
  const { data: user, isLoading: isUserLoading, refetch: refetchUser } = useAuth(); // Get refetch
  const { toast } = useToast();

  // State for execution/error (can potentially be managed by react-hook-form)
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null); // Store error message string

  // Initialize react-hook-form
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: '', // Initialize
      avatarUrl: '', // Initialize
    },
    mode: 'onChange', // Validate on change
  });

  // Effect to set default values once user data is loaded
  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName || '',
        avatarUrl: user.avatarUrl || '',
      });
    }
  }, [user, form]);

  // Updated submit handler for react-hook-form
  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;

    // Prepare payload, ensuring empty strings become null
    const payload: UpdateUserProfileInput = {
      displayName: data.displayName || null,
      avatarUrl: data.avatarUrl || null,
    };

    setIsExecuting(true);
    setError(null);
    try {
      await updateUserProfile(payload);
      await refetchUser(); // Refetch user data to update UI
      toast({ title: 'Success', description: 'Profile updated successfully.' });
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update profile';
      setError(errorMessage);
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
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
    <ContentSection title='Profile' desc='This is how others will see you on the site.'>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          {/* Display Name Field */}
          <FormField
            control={form.control}
            name='displayName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder='Your display name'
                    {...field}
                    // Handle null value from schema if necessary
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormDescription>This name will be shown publicly alongside your contributions.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Avatar URL Field */}
          <FormField
            control={form.control}
            name='avatarUrl'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Avatar URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder='https://example.com/avatar.png'
                    type='url'
                    {...field}
                    // Handle null value from schema if necessary
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormDescription>Enter a URL for your profile picture.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <p className='text-sm text-muted-foreground pt-2'>Email and password changes are handled through authentication settings.</p>

          {/* General form error display (optional) */}
          {error && <div className='text-red-500 text-sm'>Error: {error}</div>}

          <Button type='submit' disabled={isExecuting || !form.formState.isDirty}>
            {isExecuting ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Form>
    </ContentSection>
  );
}
