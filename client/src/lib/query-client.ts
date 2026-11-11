import { QueryClient } from '@tanstack/react-query';

/**
 * One client for the whole app. Session data is the only server state today,
 * so the defaults are conservative: a short freshness window, and no retry
 * storm when the API is down.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
