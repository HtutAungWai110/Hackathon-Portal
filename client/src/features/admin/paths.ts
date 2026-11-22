/**
 * The console's routes in one place. The router, the navigation and the
 * ledger's empty state all point at the same strings, so a path only ever
 * changes here.
 */
export const ADMIN_DASHBOARD_PATH = '/admin/dashboard';
export const CREATE_HACKATHON_PATH = '/admin/dashboard/hackathon/create';
export const EDIT_HACKATHON_PATH = '/admin/dashboard/hackathon/edit';
export const REGISTRATIONS_PATH = '/admin/dashboard/hackathon/registrations';

/**
 * The edit screen's address. The event id is a query parameter, the same shape
 * as the public page, so one path serves every event.
 */
export function editHackathonPath(id: string): string {
  return `${EDIT_HACKATHON_PATH}?id=${encodeURIComponent(id)}`;
}

/** The registrations page for one event, addressed the same way as edit. */
export function registrationsPath(id: string): string {
  return `${REGISTRATIONS_PATH}?id=${encodeURIComponent(id)}`;
}

