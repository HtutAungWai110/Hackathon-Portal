import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { PasswordField } from '../../components/PasswordField';
import { TextField } from '../../components/TextField';
import { authErrorMessage } from '../../lib/auth-error';
import { emailRules } from '../../lib/validation';
import { useAuthStore } from './auth-store';
import { AuthLayout } from './AuthLayout';
import { useGoogleSignIn, useResendVerification, useSignUp } from './session';

type SignupValues = {
  name: string;
  email: string;
  password: string;
  /** Typed twice so a typo cannot lock someone out of the account they just made. */
  confirmPassword: string;
};

export function SignupPage() {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const signUp = useSignUp();
  const googleSignIn = useGoogleSignIn();
  const resend = useResendVerification();
  // The store holds the account the server just created, so the confirmation
  // screen survives a re-render without reading the form again. The form value
  // is the fallback for the instant before the mutation resolves.
  const createdEmail = useAuthStore((state) => state.user?.email);
  const email = createdEmail ?? getValues('email');

  const submit = handleSubmit(async (values) => {
    try {
      await signUp.mutateAsync(values);
    } catch {
      // Rendered from `signUp.error` above the form.
    }
  });

  if (signUp.isSuccess) {
    return (
      <AuthLayout
        headline="One click left before you build."
        title="Confirm your email"
        intro="Your account exists, but signing in waits on the verification link."
        footer={
          <>
            Already confirmed?{' '}
            <Link className="text-link" to="/login">
              Sign in
            </Link>
          </>
        }
      >
        <div className="auth-check">
          <p>We sent the link to</p>
          <p className="auth-check__address">{email}</p>
          <ul className="auth-check__list">
            <li>Open the message and follow the link.</li>
            <li>It brings you back here once the address is confirmed.</li>
            <li>Check the spam folder before asking for another link.</li>
          </ul>
          <p className="auth-hint">
            {resend.isSuccess
              ? 'A new link is on its way.'
              : 'Nothing arrived? Send the link again.'}
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
          {resend.error !== null ? (
            <p className="alert auth-error" role="alert">
              {authErrorMessage(resend.error)}
            </p>
          ) : null}
          <p className="auth-hint">
            Locally, the verification link is printed in the API log.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      headline="Build something worth submitting."
      title="Create your account"
      intro="New accounts start as participants. You confirm your email before you can sign in."
      footer={
        <>
          Already have an account?{' '}
          <Link className="text-link" to="/login">
            Sign in
          </Link>
        </>
      }
    >
      {signUp.error !== null ? (
        <p className="alert auth-error" role="alert">
          {authErrorMessage(signUp.error)}
        </p>
      ) : null}

      <form className="auth-form" onSubmit={submit} noValidate>
        <TextField
          label="Full name"
          autoComplete="name"
          required
          error={errors.name?.message}
          {...register('name', {
            required: 'Enter your name.',
            minLength: {
              value: 2,
              message: 'Use at least 2 characters.',
            },
          })}
        />
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
          autoComplete="new-password"
          hint="At least 8 characters."
          required
          error={errors.password?.message}
          {...register('password', {
            required: 'Choose a password.',
            minLength: {
              value: 8,
              message: 'Use at least 8 characters for your password.',
            },
          })}
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword', {
            required: 'Repeat your password.',
            // Checked again on submit, so changing the first password after
            // this one is filled in is still caught before anything is sent.
            validate: (value, values) =>
              value === values.password || 'The two passwords do not match.',
          })}
        />

        <div className="auth-actions">
          <button
            className="button button--primary button--block"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account' : 'Create account'}
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
