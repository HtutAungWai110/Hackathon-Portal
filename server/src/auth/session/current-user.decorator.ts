import { UnauthorizedException, createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { PublicUser } from './public-user.js';
import type { AuthenticatedRequest } from './request.types.js';

/**
 * The user the JWT guard loaded for this request. A guarded route always has
 * one; the check covers a handler that asks on a public or optional route,
 * where the guard deliberately attaches null.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user === null || request.user === undefined) {
      throw new UnauthorizedException('Sign in to continue.');
    }
    return request.user;
  },
);
