/**
 * The user fields this API exposes. Deliberately smaller than the database
 * row: password hashes, ban reasons, and provider accounts never leave the
 * server.
 */
export type PublicUser = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly image: string | null;
  readonly role: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

type UserRecord = PublicUser & {
  readonly banned?: boolean;
  readonly banExpires?: Date | null;
};

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** A ban with no expiry is permanent. An expired ban is history. */
export function isBanned(user: {
  readonly banned?: boolean;
  readonly banExpires?: Date | null;
}): boolean {
  if (user.banned !== true) {
    return false;
  }
  if (user.banExpires === null || user.banExpires === undefined) {
    return true;
  }
  return user.banExpires.getTime() > Date.now();
}
