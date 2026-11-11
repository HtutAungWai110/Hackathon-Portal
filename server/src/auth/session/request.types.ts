import type { Request } from 'express';
import type { PublicUser } from './public-user.js';

/**
 * Request augmentation the JWT guard performs. It matches the shape the
 * `@Session()` decorator reads, so controllers written against the package
 * keep working.
 */
export type AuthenticatedSession = {
  readonly user: PublicUser;
  readonly session: {
    readonly expiresAt: Date;
  };
};

export type AuthenticatedRequest = Request & {
  user?: PublicUser | null;
  session?: AuthenticatedSession | null;
};
