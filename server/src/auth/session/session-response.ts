import type { PublicUser } from './public-user.js';

/**
 * The JSON contract the SPA reads. It mirrors `SessionResponse` in
 * `client/src/lib/session-api.ts`; change both together.
 */
export type SessionResponse = {
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly emailVerified: boolean;
    readonly image: string | null;
    readonly role: string;
    readonly createdAt: string;
    readonly updatedAt: string;
  };
  readonly session: {
    readonly expiresAt: string;
  };
};

export function toSessionResponse(
  user: PublicUser,
  expiresAt: Date,
): SessionResponse {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    session: { expiresAt: expiresAt.toISOString() },
  };
}
