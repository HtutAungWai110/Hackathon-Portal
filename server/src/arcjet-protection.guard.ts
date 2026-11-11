import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ARCJET, type ArcjetNest } from '@arcjet/nest';
import { isSpoofedBot } from '@arcjet/inspect';

@Injectable()
export class ArcjetProtectionGuard implements CanActivate {
  private readonly logger = new Logger(ArcjetProtectionGuard.name);

  constructor(@Inject(ARCJET) private readonly arcjet: ArcjetNest) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const decision = await this.arcjet.protect(request);

    // Arcjet never throws: on failure it returns an ERROR decision. Fail open.
    if (decision.isErrored()) {
      this.logger.warn(`Arcjet failed open: ${decision.reason.message}`);
      return true;
    }

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        // A JSON body with a stable code, so callers can tell this apart
        // from Better Auth's own 429 on the credential endpoints.
        const response = context.switchToHttp().getResponse<Response>();
        response.setHeader('Retry-After', '60');
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            code: 'ARCJET_RATE_LIMIT',
            message: 'Too many requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (decision.reason.isBot()) {
        throw new ForbiddenException('Automated traffic is not allowed');
      }

      throw new ForbiddenException();
    }

    // Requests from hosting or proxied IPs are often automated.
    if (decision.ip.isHosting()) {
      throw new ForbiddenException();
    }

    // Trusted crawlers are verified by IP. A failed check means spoofing.
    if (decision.results.some(isSpoofedBot)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
