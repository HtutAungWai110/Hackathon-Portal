import { Link, NavLink, useNavigate } from 'react-router';
import { authErrorMessage } from '../lib/auth-error';
import { useSession, useSignOut } from '../features/auth/session';
import './AppNav.css';

function linkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'app-nav__link app-nav__link--active' : 'app-nav__link';
}

/**
 * The one navigation bar. It sits on the dark stage on every screen that has
 * one, so the light above the page reads the same from the participant
 * workspace and from the operations desk.
 *
 * The Admin link is a convenience, not a permission: the route guard and the
 * API both decide whether that account may read or write.
 */
export function AppNav() {
  const session = useSession();
  const user = session.data?.user ?? null;
  const signOut = useSignOut();
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      await signOut.mutateAsync();
      navigate('/login', { replace: true });
    } catch {
      // Rendered from `signOut.error` below the row.
    }
  }

  return (
    <header className="app-nav">
      <div className="app-nav__row">
        <Link className="app-nav__brand" to="/">
          <span className="app-nav__dot" aria-hidden="true" />
          <span>Hackathon Portal</span>
        </Link>

        <nav className="app-nav__links" aria-label="Main">
          <NavLink className={linkClass} to="/" end>
            Workspace
          </NavLink>
          {user?.role === 'admin' ? (
            <NavLink className={linkClass} to="/admin/dashboard">
              Admin
            </NavLink>
          ) : null}
        </nav>

        <div className="app-nav__account">
          {user !== null ? <span className="app-nav__user">{user.name}</span> : null}
          <button
            className="button button--quiet button--inverse"
            type="button"
            disabled={signOut.isPending}
            onClick={handleSignOut}
          >
            {signOut.isPending ? 'Signing out' : 'Sign out'}
          </button>
        </div>
      </div>

      {signOut.error !== null ? (
        <p className="app-nav__error" role="alert">
          {authErrorMessage(signOut.error)}
        </p>
      ) : null}
    </header>
  );
}
