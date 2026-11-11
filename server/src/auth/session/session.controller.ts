import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { readCookie } from './cookies.js';
import { isBanned, toPublicUser } from './public-user.js';
import type { PublicUser } from './public-user.js';
import type { AuthenticatedRequest } from './request.types.js';
import { REFRESH_TOKEN_COOKIE } from './session.constants.js';
import { toSessionResponse } from './session-response.js';
import type { SessionResponse } from './session-response.js';
import { SessionService } from './session.service.js';

const SIGN_IN_MESSAGE = 'Sign in to continue.';
const NO_REFRESH_MESSAGE = 'There is no session to refresh.';
const SUSPENDED_MESSAGE = 'This account is suspended.';
const MISSING_ACCOUNT_MESSAGE = 'The account no longer exists.';

/**
 * The token half of authentication.
 *
 * Better Auth owns `/auth/*` as middleware, so it cannot be reached from a Nest
 * controller. These routes sit beside it at `/session` and turn a Better Auth
 * session into this API's short lived bearer tokens.
 */
@Controller('session')
export class SessionController {
  constructor(
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Exchanges the Better Auth session cookie for a token pair. The SPA calls
   * this after a password sign in, and on load after the Google callback.
   */
  @AllowAnonymous()
  @HttpCode(200)
  @Post('exchange')
  async exchange(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (session === null) {
      throw new UnauthorizedException(SIGN_IN_MESSAGE);
    }

    const user = await this.requireUser(session.user.id);
    const pair = await this.sessions.issue({ id: user.id, role: user.role });
    this.sessions.writeCookies(response, pair);

    return toSessionResponse(user, pair.refreshExpiresAt);
  }

  /**
   * Rotates both tokens. The refresh cookie is httpOnly, so it is read here,
   * never by the browser. An invalid refresh token clears the cookies so the
   * client stops retrying with a dead credential.
   */
  @AllowAnonymous()
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const token = readCookie(request.headers.cookie, REFRESH_TOKEN_COOKIE);
    if (token === null) {
      throw new UnauthorizedException(NO_REFRESH_MESSAGE);
    }

    let userId: string;
    try {
      userId = (await this.sessions.verifyRefresh(token)).userId;
    } catch (error) {
      this.sessions.clearCookies(response);
      throw error;
    }

    let user: PublicUser;
    try {
      user = await this.requireUser(userId);
    } catch (error) {
      this.sessions.clearCookies(response);
      throw error;
    }

    // The role comes from the row, so a promotion reaches the next access
    // token without waiting for the current one to expire.
    const pair = await this.sessions.issue({ id: user.id, role: user.role });
    this.sessions.writeCookies(response, pair);

    return toSessionResponse(user, pair.refreshExpiresAt);
  }

  /**
   * Ends both halves of the session. Better Auth's own sign out runs first so
   * `/session/exchange` cannot mint a new pair from a still valid cookie.
   */
  @AllowAnonymous()
  @HttpCode(200)
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true }> {
    try {
      const { headers } = await this.auth.api.signOut({
        headers: fromNodeHeaders(request.headers),
        returnHeaders: true,
      });
      const expired = headers.getSetCookie();
      if (expired.length > 0) {
        // Express appends what res.cookie writes after this.
        response.setHeader('Set-Cookie', expired);
      }
    } catch {
      // No Better Auth session to end; clearing the tokens is still correct.
    }

    this.sessions.clearCookies(response);
    return { ok: true };
  }

  /**
   * The SPA's session read. The JWT guard has already verified the bearer
   * token and loaded the user; the refresh cookie, when present, supplies the
   * real end of the session for display.
   */
  @Get()
  async getSession(
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionResponse> {
    if (
      request.user === null ||
      request.user === undefined ||
      request.session === null ||
      request.session === undefined
    ) {
      throw new UnauthorizedException(SIGN_IN_MESSAGE);
    }

    let expiresAt = request.session.session.expiresAt;

    const refreshToken = readCookie(
      request.headers.cookie,
      REFRESH_TOKEN_COOKIE,
    );
    if (refreshToken !== null) {
      try {
        expiresAt = (await this.sessions.verifyRefresh(refreshToken)).expiresAt;
      } catch {
        // The access token is still valid, so report its shorter lifetime.
      }
    }

    return toSessionResponse(request.user, expiresAt);
  }

  private async requireUser(id: string): Promise<PublicUser> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    if (record === null) {
      throw new UnauthorizedException(MISSING_ACCOUNT_MESSAGE);
    }
    if (isBanned(record)) {
      throw new ForbiddenException(SUSPENDED_MESSAGE);
    }
    return toPublicUser(record);
  }
}
