import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isBanned, toPublicUser } from './public-user.js';
import type { AuthenticatedRequest } from './request.types.js';
import { SessionService } from './session.service.js';

/**
 * Metadata keys published by `@thallesp/nestjs-better-auth` decorators.
 * Reading the same keys means `@AllowAnonymous()`, `@Optional()`, and
 * `@Roles()` keep their documented behavior even though this guard replaces
 * the package's session based one.
 */
const PUBLIC_METADATA = 'PUBLIC';
const OPTIONAL_METADATA = 'OPTIONAL';
const ROLES_METADATA = 'ROLES';

const SIGN_IN_MESSAGE = 'Sign in to continue.';
const SUSPENDED_MESSAGE = 'This account is suspended.';
const ROLE_MESSAGE = 'Your role cannot access this route.';

function bearerToken(header: string | undefined): string | null {
  if (header === undefined) {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * Authenticates application routes with the access JWT only. Better Auth still
 * owns `/auth/*` (it runs as middleware, before any guard) and authenticates
 * its own endpoints with its session cookie.
 *
 * A malformed or expired token is treated as anonymous on a route marked
 * public or optional, so the SPA can probe `/session` while signed out without
 * a 401 storm. Everywhere else it is a 401.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const controller = context.getClass();
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(PUBLIC_METADATA, [
        handler,
        controller,
      ]) === true;
    const isOptional =
      this.reflector.getAllAndOverride<boolean>(OPTIONAL_METADATA, [
        handler,
        controller,
      ]) === true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request.headers.authorization);

    if (token === null) {
      return this.anonymous(isPublic, isOptional, request);
    }

    let claims;
    try {
      claims = await this.sessions.verifyAccess(token);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return this.anonymous(isPublic, isOptional, request);
      }
      throw error;
    }

    // The token proves identity; the row decides whether that identity still
    // exists and is allowed in. A 15 minute window is short, but a role change
    // or a ban should not wait for it.
    const record = await this.prisma.user.findUnique({
      where: { id: claims.userId },
    });
    if (record === null) {
      throw new UnauthorizedException(SIGN_IN_MESSAGE);
    }
    if (isBanned(record)) {
      throw new ForbiddenException(SUSPENDED_MESSAGE);
    }

    const user = toPublicUser(record);
    request.user = user;
    request.session = {
      user,
      session: { expiresAt: claims.expiresAt },
    };

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_METADATA, [
      handler,
      controller,
    ]);
    if (
      roles !== undefined &&
      roles.length > 0 &&
      !roles.includes(record.role)
    ) {
      throw new ForbiddenException(ROLE_MESSAGE);
    }

    return true;
  }

  private anonymous(
    isPublic: boolean,
    isOptional: boolean,
    request: AuthenticatedRequest,
  ): true {
    if (isPublic || isOptional) {
      request.user = null;
      request.session = null;
      return true;
    }
    throw new UnauthorizedException(SIGN_IN_MESSAGE);
  }
}
