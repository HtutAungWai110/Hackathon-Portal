import type { Notification } from './notifications-api';

const STORAGE_KEY = 'notifications:history';
const MAX_ITEMS = 100;

/** Read cached notifications (newest first). */
export function readCachedNotifications(): Notification[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw === null ? [] : (JSON.parse(raw) as unknown);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Notification => {
      return (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Notification).id === 'string' &&
        typeof (item as Notification).message === 'string'
      );
    });
  } catch {
    return [];
  }
}

function writeCachedNotifications(items: Notification[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // ignore
  }
}

/** Save or update notifications in the local cache (merge by id, newest first). */
export function saveNotificationsToCache(rows: Notification[]): void {
  if (rows.length === 0) return;
  const existing = readCachedNotifications();
  const map = new Map(existing.map((n) => [n.id, n]));
  for (const row of rows) {
    map.set(row.id, row);
  }
  const merged = [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  writeCachedNotifications(merged);
}

/** Mark cached notifications as read by id. */
export function markCachedNotificationsRead(ids: string[]): void {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const existing = readCachedNotifications();
  const updated = existing.map((n) => (idSet.has(n.id) ? { ...n, read: true } : n));
  writeCachedNotifications(updated);
}
