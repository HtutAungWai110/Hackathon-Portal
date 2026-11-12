import { Link, createBrowserRouter } from 'react-router';
import { StatusScreen } from '../components/StatusScreen';
import { LoginPage } from '../features/auth/LoginPage';
import { SignupPage } from '../features/auth/SignupPage';
import {
  RedirectIfAuthenticated,
  RequireAdmin,
  RequireSession,
} from '../features/auth/guards';
import { AdminDashboardRoute } from '../features/admin/AdminDashboardRoute';
import { CreateHackathonRoute } from '../features/admin/CreateHackathonRoute';
import { ADMIN_DASHBOARD_PATH, CREATE_HACKATHON_PATH } from '../features/admin/paths';
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
    path: ADMIN_DASHBOARD_PATH,
    element: (
      <RequireAdmin>
        <AdminDashboardRoute />
      </RequireAdmin>
    ),
  },
  {
    path: CREATE_HACKATHON_PATH,
    element: (
      <RequireAdmin>
        <CreateHackathonRoute />
      </RequireAdmin>
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
