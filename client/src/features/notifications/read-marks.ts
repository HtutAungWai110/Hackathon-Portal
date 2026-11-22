/**
 * Read marks kept in localStorage so the inbox stays honest even before the
 * server catches up: the REST list is unread-only, so anything saved here is
 * filtered out of it, and the socket's new rows arrive as already read when
 * their id was saved earlier. Storage failures lose the saved reads only;
 * the server stays the authority on what is read.
 */

const STORAGE_KEY = 'notifications:read';

/** The ids this device has already read, oldest first appended. */
export function readNotificationIds(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw === null ? [] : JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    // Storage disabled or holding a broken value: nothing was read, and the
    // server still knows.
    return new Set();
  }
}

/**
 * Appends ids to the saved set right away: the moment a notification is read
 * it is recorded, not when the page next refetches.
 */
export function saveReadIds(ids: string[]): void {
  if (typeof window === 'undefined' || ids.length === 0) {
    return;
  }
  try {
    const existing = readNotificationIds();
    for (const id of ids) {
      if (id.length > 0) {
        existing.add(id);
      }
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing]));
  } catch {
    // See readNotificationIds: a lost mark costs only a refetch.
  }
}
