import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { PasswordField } from '../../components/PasswordField';
import { TextField } from '../../components/TextField';
import { AuthRequestError, authErrorMessage } from '../../lib/auth-error';
import { emailRules } from '../../lib/validation';
import { AuthLayout } from './AuthLayout';
import { useGoogleSignIn, useResendVerification, useSignIn } from './session';

type LoginValues = {
  email: string;
  password: string;
};

/** Only same-site absolute paths are allowed back in after sign in. */
function nextPathFrom(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const from = (state as { from?: unknown }).from;
    if (
      typeof from === 'string' &&
      from.startsWith('/') &&
      !from.startsWith('//')
    ) {
      return from;
    }
  }
  return '/';
}

export function LoginPage() {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    defaultValues: { email: '', password: '' },
  });

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useSignIn();
  const googleSignIn = useGoogleSignIn();
  const resend = useResendVerification();

  const justVerified = searchParams.get('verified') === 'true';
  const needsVerification =
    signIn.error instanceof AuthRequestError &&
    signIn.error.code === 'EMAIL_NOT_VERIFIED';
  const email = getValues('email');

  const submit = handleSubmit(async (values) => {
    try {
      await signIn.mutateAsync(values);
      navigate(nextPathFrom(location.state), { replace: true });
    } catch {
      // Rendered from `signIn.error` above the form.
    }
  });

  return (
    <AuthLayout
      headline="Pick up the build where you stopped."
      title="Sign in"
      intro="Use the email and password you registered with."
      footer={
        <>
          New here?{' '}
          <Link className="text-link" to="/signup">
            Create an account
          </Link>
        </>
      }
    >
      {justVerified ? (
        <p className="alert alert--success auth-check" role="status">
          Your email is confirmed. Sign in to continue.
        </p>
      ) : null}

      {signIn.error !== null ? (
        <p className="alert auth-error" role="alert">
          {authErrorMessage(signIn.error)}
        </p>
      ) : null}

      <form className="auth-form" onSubmit={submit} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register('email', emailRules)}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          required
          error={errors.password?.message}
          {...register('password', { required: 'Enter your password.' })}
        />

        {needsVerification && email.length > 0 ? (
          <p className="auth-hint">
            {resend.isSuccess
              ? 'A new verification link is on its way.'
              : 'Not in your inbox? You can send it again.'}
            {resend.isSuccess ? null : (
              <button
                className="button button--quiet"
                type="button"
                disabled={resend.isPending}
                onClick={() => resend.mutate(email)}
              >
                {resend.isPending ? 'Sending' : 'Resend link'}
              </button>
            )}
          </p>
        ) : null}

        <div className="auth-actions">
          <button
            className="button button--primary button--block"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in' : 'Sign in'}
          </button>
        </div>
      </form>

      <p className="auth-divider">or</p>

      <button
        className="button button--ghost button--block"
        type="button"
        disabled={googleSignIn.isPending}
        onClick={() => googleSignIn.mutate()}
      >
        Continue with Google
      </button>

      {googleSignIn.error !== null ? (
        <p className="alert auth-error" role="alert">
          {authErrorMessage(googleSignIn.error)}
        </p>
      ) : null}
    </AuthLayout>
  );
}
