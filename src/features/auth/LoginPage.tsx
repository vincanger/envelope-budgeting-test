import { LoginForm } from 'wasp/client/auth';
import { Card, CardContent } from '../../components/ui/card';
import { useTheme } from '../../hooks/use-theme';
import { Link } from 'wasp/client/router';

export function Login() {
  const { colors } = useTheme();

  return (
    <div className='flex items-center justify-center min-h-screen bg-primary-foreground'>
      <Card className='w-full max-w-md'>
        <CardContent>
          <LoginForm
            appearance={{
              colors,
            }}
          />
          <div className="mt-4 text-center text-sm">
            Don't have an account?{' '}
            <Link to="/sign-up" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
