import type { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins/admin';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthMail, AuthMailMessage } from './auth.mail.js';

const SESSION_SECONDS = 60 * 60 * 24 * 7;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const DEFAULT_CLIENT_URL = 'http://localhost:5173';

function required(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}.`);
  }
  return value;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * Browser origins that may start an auth flow. A verification or sign in
 * redirect back to an origin that is not listed here is rejected by Better
 * Auth before it ever reaches the route.
 */
function clientOrigins(config: ConfigService): string[] {
  const configured = config.get<string>('CLIENT_URL') ?? DEFAULT_CLIENT_URL;
  const origins = configured
    .split(',')
    .map((origin) => trimTrailingSlash(origin.trim()))
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : [DEFAULT_CLIENT_URL];
}

function mailMessage(
  user: { readonly email: string },
  url: string,
  token: string,
): AuthMailMessage {
  return { to: user.email, url, token };
}

/**
 * Sign up sends its own default `callbackURL` of "/", which overrides the
 * static `emailVerification.callbackURL` option. Rewrite it so every
 * verification link lands on the page that shows the verified state.
 */
function withVerifiedReturn(url: string, target: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('callbackURL', target);
  return parsed.toString();
}

export function createAuth(
  prisma: PrismaService,
  config: ConfigService,
  mail: AuthMail,
) {
  const baseURL = required(config, 'BETTER_AUTH_URL');
  const frontendOrigins = clientOrigins(config);
  // Verification links land on the SPA login page, which shows the confirmed
  // state and then sends the user to the form.
  const verifiedReturn = `${frontendOrigins[0]}/login?verified=true`;

  return betterAuth({
    baseURL,
    basePath: '/auth',
    secret: required(config, 'BETTER_AUTH_SECRET'),
    trustedOrigins: [baseURL, ...frontendOrigins],
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
      transaction: true,
    }),

    session: {
      expiresIn: SESSION_SECONDS,
      // No sliding window: expiresAt is fixed at creation, so the stated
      // seven day lifetime is what the database actually holds.
      updateAge: 0,
    },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      sendResetPassword: async ({ user, url, token }) => {
        await mail.sendResetPassword(mailMessage(user, url, token));
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      callbackURL: verifiedReturn,
      sendVerificationEmail: async ({ user, url, token }) => {
        await mail.sendVerificationEmail(
          mailMessage(user, withVerifiedReturn(url, verifiedReturn), token),
        );
      },
    },

    socialProviders: {
      google: {
        clientId: required(config, 'GOOGLE_CLIENT_ID'),
        clientSecret: required(config, 'GOOGLE_CLIENT_SECRET'),
      },
    },

    account: {
      accountLinking: {
        enabled: true,
        // Only Google, because Google verifies the address it returns.
        trustedProviders: ['google'],
      },
    },

    rateLimit: {
      // Better Auth disables this in development by default. Turn it on
      // explicitly so the limits are the same in every environment.
      enabled: true,
      window: 60,
      max: 100,
      storage: 'memory',
      customRules: {
        '/sign-in/email': { window: 10, max: 3 },
        '/sign-up/email': { window: 10, max: 3 },
        '/forget-password': { window: 60, max: 3 },
        '/reset-password': { window: 60, max: 3 },
      },
    },

    databaseHooks: {
      user: {
        create: {
          // The role is never a client input, whatever the request body says.
          before: async (user) => ({
            data: { ...user, role: 'participant' },
          }),
        },
      },
    },

    plugins: [
      admin({
        defaultRole: 'participant',
        adminRoles: ['admin'],
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
