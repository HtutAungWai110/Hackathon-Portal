import { useLocation, useNavigate } from 'react-router';
import { ADMIN_DASHBOARD_PATH } from './paths';

/**
 * Leaving the form after a save. It goes back to whatever opened the form,
 * which is the season most of the time and the public event page when an admin
 * came through "Manage event" there, so the reader lands where they started
 * rather than on a screen they never asked for.
 *
 * A form opened straight from a link has no screen behind it inside the app;
 * React Router marks that first entry with the key `default`. In that case the
 * season is the safe place to land, and `replace` keeps the form out of the
 * history so the back button cannot return to a form that was just saved.
 */
export function useReturnAfterSave() {
  const navigate = useNavigate();
  const location = useLocation();

  return () => {
    if (location.key !== 'default') {
      navigate(-1);
      return;
    }

    navigate(ADMIN_DASHBOARD_PATH, { replace: true });
  };
}
