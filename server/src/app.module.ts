import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ArcjetModule, detectBot, fixedWindow, shield } from '@arcjet/nest';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ArcjetProtectionGuard } from './arcjet-protection.guard.js';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/session/jwt-auth.guard.js';
import { SessionModule } from './auth/session/session.module.js';
import { validateEnv } from './config/env.validation.js';
import { readRedisConnection } from './config/redis.config.js';
import { EventsModule } from './events/events.module.js';
import { ObserveModule } from './observe.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UploadsModule } from './uploads/uploads.module.js';

@Module({
  imports: [
    // Loads `.env` and makes ConfigService available everywhere. `validate`
    // fails bootstrap naming the missing key instead of failing a request.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    // Redis backs the mail queue and nothing else. Registering the shared
    // connection once here means the worker and the producer cannot drift,
    // and `MailModule` only declares the queue it owns.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: readRedisConnection(config),
      }),
    }),
    // Global Arcjet client. Base rules below run on every protect() call.
    ArcjetModule.forRootAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mode: 'LIVE' | 'DRY_RUN' =
          config.get<string>('ARCJET_MODE') === 'DRY_RUN'
            ? 'DRY_RUN'
            : 'LIVE';

        return {
          // Fail fast at startup when the key is missing.
          key: config.getOrThrow<string>('ARCJET_KEY'),
          rules: [
            // Shield WAF: blocks SQL injection, XSS, and other common attacks.
            shield({ mode }),
            // Bot protection: allow well known crawlers, deny everything else.
            detectBot({
              mode,
              allow: [
                'CATEGORY:SEARCH_ENGINE',
                'CATEGORY:MONITOR',
                'CATEGORY:PREVIEW',
              ],
            }),
            // Fixed window rate limit: 100 requests per 60 second window.
            fixedWindow({
              mode,
              window: '60s',
              max: 100,
            }),
          ],
        };
      },
    }),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY!,
      appSecret: process.env.OBSERVE_APP_SECRET!,
      serviceId: 'hackathon-project',
    }),
    PrismaModule,
    AuthModule,
    SessionModule,
    EventsModule,
    NotificationsModule,
    UploadsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guard order is explicit and deliberate. Arcjet runs first, so a
    // blocked request never reaches the token verification, and the JWT
    // guard runs second. Do not reorder these.
    { provide: APP_GUARD, useClass: ArcjetProtectionGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
