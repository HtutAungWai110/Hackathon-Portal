import { useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from './auth-store';
import { useSession } from './session';

/**
 * Keeps the local user store aligned with the session query. Runs before paint
 * so a hard refresh never shows a screen that is missing the user it already
 * fetched. A failed query leaves the store alone: a dead API is not a sign out.
 */
export function SessionBridge({ children }: { children: ReactNode }) {
  const session = useSession();
  const setSession = useAuthStore((state) => state.setSession);
  const clear = useAuthStore((state) => state.clear);

  useLayoutEffect(() => {
    if (session.isPending) {
      return;
    }

    if (session.data !== null && session.data !== undefined) {
      setSession(session.data);
      return;
    }

    if (session.error === null) {
      clear();
    }
  }, [session.isPending, session.data, session.error, setSession, clear]);

  return <>{children}</>;
}
