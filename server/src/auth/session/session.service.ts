import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';
import { errors as joseErrors, SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import {
  ACCESS_COOKIE_PATH,
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_AUDIENCE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  TOKEN_ISSUER,
} from './session.constants.js';

export type SessionUserInput = {
  readonly id: string;
  readonly role: string;
};

export type TokenPair = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: Date;
  readonly refreshExpiresAt: Date;
};

export type VerifiedAccessToken = {
  readonly userId: string;
  readonly role: string;
  readonly expiresAt: Date;
};

export type VerifiedRefreshToken = {
  readonly userId: string;
  readonly tokenId: string;
  readonly expiresAt: Date;
};

/**
 * The only part of an Express response cookie writing touches, so the service
 * is testable with a plain object.
 */
export type CookieStore = {
  cookie(name: string, value: string, options: CookieOptions): unknown;
  clearCookie(name: string, options?: CookieOptions): unknown;
};

type TokenType = 'access' | 'refresh';

type VerifiedPayload = {
  readonly subject: string;
  readonly expiresAt: number;
  readonly role: string | null;
  readonly tokenId: string | null;
};

const INVALID_TOKEN_MESSAGE = 'The session token is invalid or expired.';

function encodeSecret(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/**
 * Signs and verifies the two tokens this API hands out. The access token is a
 * short lived bearer credential; the refresh token can only be used on the
 * refresh route, and its audience makes it useless as an access token.
 */
@Injectable()
export class SessionService {
  private readonly accessSecret: Uint8Array;
  private readonly refreshSecret: Uint8Array;
  private readonly secureCookies: boolean;

  constructor(config: ConfigService) {
    this.accessSecret = encodeSecret(
      config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    );
    this.refreshSecret = encodeSecret(
      config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    );
    // Cookies over plain http are dropped by browsers when Secure is set, so
    // the flag only applies where the deployment terminates TLS.
    this.secureCookies = config.get<string>('NODE_ENV') === 'production';
  }

  async issue(user: SessionUserInput): Promise<TokenPair> {
    const issuedAt = Math.floor(Date.now() / 1000);

    const [accessToken, refreshToken] = await Promise.all([
      this.sign(
        user,
        'access',
        ACCESS_TOKEN_AUDIENCE,
        this.accessSecret,
        ACCESS_TOKEN_TTL_SECONDS,
        issuedAt,
      ),
      this.sign(
        user,
        'refresh',
        REFRESH_TOKEN_AUDIENCE,
        this.refreshSecret,
        REFRESH_TOKEN_TTL_SECONDS,
        issuedAt,
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      accessExpiresAt: new Date(
        (issuedAt + ACCESS_TOKEN_TTL_SECONDS) * 1000,
      ),
      refreshExpiresAt: new Date(
        (issuedAt + REFRESH_TOKEN_TTL_SECONDS) * 1000,
      ),
    };
  }

  async verifyAccess(token: string): Promise<VerifiedAccessToken> {
    const payload = await this.verify(
      token,
      this.accessSecret,
      ACCESS_TOKEN_AUDIENCE,
      'access',
    );
    if (payload.role === null) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }
    return {
      userId: payload.subject,
      role: payload.role,
      expiresAt: new Date(payload.expiresAt * 1000),
    };
  }

  async verifyRefresh(token: string): Promise<VerifiedRefreshToken> {
    const payload = await this.verify(
      token,
      this.refreshSecret,
      REFRESH_TOKEN_AUDIENCE,
      'refresh',
    );
    return {
      userId: payload.subject,
      tokenId: payload.tokenId ?? '',
      expiresAt: new Date(payload.expiresAt * 1000),
    };
  }

  writeCookies(store: CookieStore, pair: TokenPair): void {
    store.cookie(ACCESS_TOKEN_COOKIE, pair.accessToken, {
      // Readable on purpose: the SPA copies it into the Authorization header.
      httpOnly: false,
      sameSite: 'lax',
      secure: this.secureCookies,
      path: ACCESS_COOKIE_PATH,
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    });
    store.cookie(REFRESH_TOKEN_COOKIE, pair.refreshToken, {
      // Never readable by script; only this API's refresh route needs it.
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secureCookies,
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
  }

  clearCookies(store: CookieStore): void {
    store.clearCookie(ACCESS_TOKEN_COOKIE, {
      httpOnly: false,
      sameSite: 'lax',
      secure: this.secureCookies,
      path: ACCESS_COOKIE_PATH,
    });
    store.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secureCookies,
      path: REFRESH_COOKIE_PATH,
    });
  }

  private async sign(
    user: SessionUserInput,
    type: TokenType,
    audience: string,
    secret: Uint8Array,
    ttlSeconds: number,
    issuedAt: number,
  ): Promise<string> {
    return new SignJWT({ role: user.role, typ: type })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(audience)
      .setIssuedAt(issuedAt)
      .setJti(randomUUID())
      .setExpirationTime(issuedAt + ttlSeconds)
      .sign(secret);
  }

  private async verify(
    token: string,
    secret: Uint8Array,
    audience: string,
    expectedType: TokenType,
  ): Promise<VerifiedPayload> {
    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      ({ payload } = await jwtVerify(token, secret, {
        issuer: TOKEN_ISSUER,
        audience,
        algorithms: ['HS256'],
      }));
    } catch (error) {
      if (error instanceof joseErrors.JOSEError) {
        throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
      }
      throw error;
    }

    if (
      payload.typ !== expectedType ||
      typeof payload.sub !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }

    return {
      subject: payload.sub,
      expiresAt: payload.exp,
      role: typeof payload.role === 'string' ? payload.role : null,
      tokenId: typeof payload.jti === 'string' ? payload.jti : null,
    };
  }
}
