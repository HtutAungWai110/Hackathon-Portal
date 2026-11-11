import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '../../lib/auth-client';
import { toAuthError } from '../../lib/auth-error';
import {
  exchangeSession,
  fetchSession,
  logoutSession,
} from '../../lib/session-api';
import type { AuthSession, AuthUser } from '../../lib/session-api';
import { useAuthStore } from './auth-store';

export const sessionKeys = {
  all: ['session'] as const,
};

/**
 * Session is server state like any other, so it lives in the query cache: one
 * cached truth for the whole app, refreshed after every auth mutation.
 *
 * The query reads the API's access token cookie and trades the Better Auth
 * cookie for a token pair when there is none, so it answers "who is signed in"
 * without the component knowing which credential survived.
 */
export function useSession() {
  return useQuery({
    queryKey: sessionKeys.all,
    queryFn: fetchSession,
    staleTime: 60_000,
    retry: false,
  });
}

export type SignInInput = {
  email: string;
  password: string;
};

export function useSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    // Better Auth proves the password, then the exchange mints this API's
    // access and refresh tokens. Both steps live in the mutation so a failed
    // exchange rejects `mutateAsync` instead of surfacing as an unhandled
    // error in `onSuccess`.
    mutationFn: async (input: SignInInput): Promise<AuthSession> => {
      const { error } = await authClient.signIn.email(input);
      if (error) {
        throw toAuthError(error);
      }
      return exchangeSession();
    },
    onSuccess: (session) => {
      // The exchange already returned the session record, so there is nothing
      // to wait for: write the cache and the store, then let the route render.
      queryClient.setQueryData<AuthSession | null>(sessionKeys.all, session);
      useAuthStore.getState().setSession(session);
    },
  });
}

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
};

export function useSignUp() {
  return useMutation({
    mutationFn: async ({ name, email, password }: SignUpInput) => {
      const { data, error } = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: `${window.location.origin}/login?verified=true`,
      });
      if (error) {
        throw toAuthError(error);
      }
      return data;
    },
    onSuccess: (data) => {
      // The account exists but there is no session yet: the email has to be
      // confirmed first, so no token pair is minted. Remember the user for the
      // confirmation screen, and do not touch the session query: a refetch
      // returns null and the bridge would clear the account that was just
      // created.
      //
      // Better Auth returns its own user shape (Date objects, optional image,
      // no session). Map it to the API's user type so the store has one shape,
      // and rely on the server's `role = participant` sign up default.
      const created: AuthUser = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        emailVerified: data.user.emailVerified,
        image: data.user.image ?? null,
        role: 'participant',
        createdAt: new Date(data.user.createdAt).toISOString(),
        updatedAt: new Date(data.user.updatedAt).toISOString(),
      };
      useAuthStore.getState().setPendingVerification(created);
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    // One call ends both halves: Better Auth's session and this API's tokens.
    mutationFn: async () => {
      await logoutSession();
    },
    onSuccess: () => {
      queryClient.setQueryData<AuthSession | null>(sessionKeys.all, null);
      useAuthStore.getState().clear();
    },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/login?verified=true`,
      });
      if (error) {
        throw toAuthError(error);
      }
    },
  });
}

export function useGoogleSignIn() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}/`,
        newUserCallbackURL: `${window.location.origin}/`,
      });
      if (error) {
        throw toAuthError(error);
      }
    },
  });
}
