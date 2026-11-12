import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
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

/**
 * Runs inside `RequireSession`, so a session already exists by the time this
 * renders. A participant gets a real screen explaining the boundary rather
 * than a redirect that looks like a broken link; the server still refuses
 * every admin route they might call directly.
 */
function AdminGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const user = session.data?.user;

  if (user === undefined) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return (
      <StatusScreen
        title="This desk is for organisers"
        description="Only accounts with the admin role can open or publish events. Your workspace is still here."
        action={
          <Link className="button button--ghost" to="/">
            Back to your workspace
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}

/** The admin dashboard entry gate: signed in, then role checked. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <AdminGate>{children}</AdminGate>
    </RequireSession>
  );
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
