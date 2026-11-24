import { Link, createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
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
import { EditHackathonRoute } from '../features/admin/EditHackathonRoute';
import { RegistrationsRoute } from '../features/admin/RegistrationsRoute';
import {
  ADMIN_DASHBOARD_PATH,
  CREATE_HACKATHON_PATH,
  EDIT_HACKATHON_PATH,
  REGISTRATIONS_PATH,
} from '../features/admin/paths';
import { HACKATHON_PATH, YOUR_APPLICATION_PATH } from '../features/hackathon/paths';
import { HackathonDetailPage } from '../features/hackathon/HackathonDetailPage';
import { YourApplicationPage } from '../features/hackathon/YourApplicationPage';
import { HomePage } from '../features/home/HomePage';

export const router = createBrowserRouter([
  {
    // One frame for every screen: it owns the notification socket and the
    // arrival stack, so both outlive a change of route.
    element: <AppShell />,
    children: [
      {
        path: '/',
        element: (
          <RequireSession>
            <HomePage />
          </RequireSession>
        ),
      },
      {
        path: HACKATHON_PATH,
        element: <HackathonDetailPage />,
      },
      {
        path: YOUR_APPLICATION_PATH,
        element: (
          <RequireSession>
            <YourApplicationPage />
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
        path: EDIT_HACKATHON_PATH,
        element: (
          <RequireAdmin>
            <EditHackathonRoute />
          </RequireAdmin>
        ),
      },
      {
        path: REGISTRATIONS_PATH,
        element: (
          <RequireAdmin>
            <RegistrationsRoute />
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
    ],
  },
]);
