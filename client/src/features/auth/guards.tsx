import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { StatusScreen } from '../../components/StatusScreen';
import { authErrorMessage } from '../../lib/auth-error';
import { useSession } from './session';

/**
 * Protected routes wait for the session query before deciding. A failed query
 * is shown as an error, not treated as "signed out": a dead API must not look
 * like a wrong password.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return <StatusScreen busy title="Checking your session" />;
  }

  if (session.error !== null) {
    return (
      <StatusScreen
        title="Cannot check your session"
        description={authErrorMessage(session.error)}
        action={
          <button
            className="button button--primary"
            type="button"
            onClick={() => void session.refetch()}
          >
            Try again
          </button>
        }
      />
    );
  }

  if (session.data === null || session.data === undefined) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <>{children}</>;
}

/** Keeps a signed in user off the auth screens. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const session = useSession();

  if (session.isPending) {
    return <StatusScreen busy title="Checking your session" />;
  }

  if (session.data !== null && session.data !== undefined) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
