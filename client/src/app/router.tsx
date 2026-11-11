import { Link, createBrowserRouter } from 'react-router';
import { StatusScreen } from '../components/StatusScreen';
import { LoginPage } from '../features/auth/LoginPage';
import { SignupPage } from '../features/auth/SignupPage';
import {
  RedirectIfAuthenticated,
  RequireSession,
} from '../features/auth/guards';
import { HomePage } from '../features/home/HomePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <RequireSession>
        <HomePage />
      </RequireSession>
    ),
  },
  {
    path: '/login',
    element: (
      <RedirectIfAuthenticated>
        <LoginPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: '/signup',
    element: (
      <RedirectIfAuthenticated>
        <SignupPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: '*',
    element: (
      <StatusScreen
        title="Page not found"
        description="There is nothing at that address."
        action={
          <Link className="button button--primary" to="/">
            Go to your account
          </Link>
        }
      />
    ),
  },
]);
