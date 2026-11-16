import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { SessionBridge } from './features/auth/session-bridge';
import { MessageStack } from './features/messages/MessageStack';
import { queryClient } from './lib/query-client';
import './index.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Missing #root element in index.html.');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionBridge>
        <RouterProvider router={router} />
        <MessageStack />
      </SessionBridge>
    </QueryClientProvider>
  </StrictMode>,
);
