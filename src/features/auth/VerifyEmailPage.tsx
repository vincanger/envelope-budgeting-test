import React from 'react';
import { VerifyEmailForm } from 'wasp/client/auth';
import { Card, CardContent } from '../../components/ui/card';
import { useTheme } from '../../hooks/use-theme';
import { Link } from 'wasp/client/router';
export function VerifyEmailPage() {
  const { colors } = useTheme();

  return (
    <div className='flex items-center justify-center min-h-screen bg-primary-foreground'>
      <Card className='w-full max-w-md'>
        <CardContent className="pt-6">
          <VerifyEmailForm 
            appearance={{
              colors,
            }}
          />
          <div className="mt-4 text-center text-sm">
            <Link to="/sign-in" className="text-primary hover:underline">
              Go to Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 