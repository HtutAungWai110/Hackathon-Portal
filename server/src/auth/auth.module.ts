import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../prisma/prisma.service.js';
import { createAuth } from './auth.config.js';
import { AUTH_MAIL, AuthMailModule } from './auth.mail.js';
import type { AuthMail } from './auth.mail.js';

@Module({
  imports: [
    BetterAuthModule.forRootAsync({
      // AppModule registers this guard explicitly, after Arcjet, so the
      // order of the two global guards is visible in one place.
      disableGlobalAuthGuard: true,
      imports: [AuthMailModule],
      inject: [PrismaService, ConfigService, AUTH_MAIL],
      useFactory: async (
        prisma: PrismaService,
        config: ConfigService,
        mail: AuthMail,
      ) => ({
        auth: createAuth(prisma, config, mail),
      }),
    }),
  ],
  // SessionModule turns a Better Auth session into this API's JWTs.
  exports: [BetterAuthModule],
})
export class AuthModule {}
