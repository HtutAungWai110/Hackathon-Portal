import { useNavigate } from 'react-router';
import { StatusScreen } from '../../components/StatusScreen';
import { authErrorMessage } from '../../lib/auth-error';
import { useAuthStore } from '../auth/auth-store';
import { useSignOut } from '../auth/session';
import './home.css';

function roleLabel(role: string | null | undefined): string {
  if (role === 'admin') {
    return 'Admin';
  }
  return 'Participant';
}

export function HomePage() {
  // The store is a mirror of the session query, kept in step by SessionBridge.
  // Reading it here is what makes the header update the moment sign in lands.
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const signOut = useSignOut();
  const navigate = useNavigate();

  if (user === null) {
    return <StatusScreen busy title="Loading your account" />;
  }

  const expiresAt = session !== null ? new Date(session.expiresAt) : null;
  const role = roleLabel(user.role);

  async function handleSignOut() {
    try {
      await signOut.mutateAsync();
      navigate('/login', { replace: true });
    } catch {
      // Rendered from `signOut.error` under the header.
    }
  }

  return (
    <div className="home">
      <header className="home-header">
        <span className="home-brand">
          <span className="home-brand__dot" aria-hidden="true" />
          Hackathon Portal
        </span>
        <button
          className="button button--quiet"
          type="button"
          disabled={signOut.isPending}
          onClick={handleSignOut}
        >
          {signOut.isPending ? 'Signing out' : 'Sign out'}
        </button>
      </header>

      <main className="home-main">
        <h1 className="home-greeting">Welcome, {user.name}.</h1>
        <p className="home-lede">
          You are signed in. Everything tied to your account starts from here.
        </p>

        {signOut.error !== null ? (
          <p className="alert home-alert" role="alert">
            {authErrorMessage(signOut.error)}
          </p>
        ) : null}

        <dl className="home-facts">
          <div className="home-fact">
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="home-fact">
            <dt>Role</dt>
            <dd>
              <span
                className={
                  role === 'Admin' ? 'home-role home-role--admin' : 'home-role'
                }
              >
                {role}
              </span>
            </dd>
          </div>
          <div className="home-fact">
            <dt>Email status</dt>
            <dd>{user.emailVerified ? 'Verified' : 'Not verified'}</dd>
          </div>
          <div className="home-fact">
            <dt>Session ends</dt>
            <dd>
              {expiresAt !== null ? expiresAt.toLocaleDateString() : 'Active'}
            </dd>
          </div>
        </dl>

        <section className="home-next">
          <h2 className="home-next__title">What this account can do</h2>
          <p>
            {role === 'Admin'
              ? 'You can reach the admin routes on the API. Participant features are open to you as well.'
              : 'You can sign in, keep your session, and use the participant routes. Admin routes stay closed to this role.'}
          </p>
        </section>
      </main>
    </div>
  );
}
