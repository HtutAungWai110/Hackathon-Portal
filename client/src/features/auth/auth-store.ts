import { create } from 'zustand';
import type { AuthSession, AuthUser } from '../../lib/session-api';

export type AuthStatus = 'anonymous' | 'pending-verification' | 'authenticated';

type AuthState = {
  user: AuthUser | null;
  session: AuthSession['session'] | null;
  status: AuthStatus;
  /**
   * Sign in proved the identity, but only the user is in hand (for example
   * while the token exchange is still in flight). The session record arrives
   * with the store write that follows the exchange.
   */
  setAuthenticated: (user: AuthUser) => void;
  /**
   * Sign up created the account but no session, because the email is not
   * confirmed yet. The user is remembered so the confirmation screen can show
   * it; it grants nothing.
   */
  setPendingVerification: (user: AuthUser) => void;
  /** Hydration with the full session record, from the session query. */
  setSession: (session: AuthSession) => void;
  clear: () => void;
};

/**
 * A client side mirror of the signed in identity. It is never the authority on
 * access: the session query and the server decide that. The store exists so
 * components can read the current user without threading props, and so the
 * header updates the moment a sign in resolves.
 *
 * Deliberately not persisted. The session query rehydrates it on load, and a
 * cached user in localStorage would outlive the session it describes.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  status: 'anonymous',

  setAuthenticated: (user) =>
    set({ user, session: null, status: 'authenticated' }),

  setPendingVerification: (user) =>
    set({ user, session: null, status: 'pending-verification' }),

  setSession: (session) =>
    set({
      user: session.user,
      session: session.session,
      status: 'authenticated',
    }),

  clear: () => set({ user: null, session: null, status: 'anonymous' }),
}));

export const useCurrentUser = () => useAuthStore((state) => state.user);
export const useAuthStatus = () => useAuthStore((state) => state.status);
