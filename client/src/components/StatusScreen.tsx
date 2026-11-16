import type { ReactNode } from 'react';

type StatusScreenProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  busy?: boolean;
};

/**
 * Full page state for the moments when there is no screen to show yet:
 * checking the session, a failed request, or a route that does not exist.
 * Written with utilities as the reference for new UI.
 */
export function StatusScreen({
  title,
  description,
  action,
  busy = false,
}: StatusScreenProps) {
  return (
    <main
      className="grid min-h-svh place-items-center px-6 py-8"
      aria-busy={busy}
    >
      <div className="w-full max-w-[440px]">
        {busy ? (
          <span
            className="mb-5 block h-1.5 w-10 origin-left bg-signal motion-safe:animate-pulse"
            aria-hidden="true"
          />
        ) : null}
        <h1 className="text-[28px]">{title}</h1>
        {description !== undefined ? (
          <p className="mt-2.5 max-w-[48ch] text-muted">{description}</p>
        ) : null}
        {action !== undefined ? <div className="mt-6">{action}</div> : null}
      </div>
    </main>
  );
}
