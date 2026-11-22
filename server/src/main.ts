import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { ObserveInstrument } from './observe.js';
import { BUCKET_URL_PREFIX, resolveBucketRoot } from './uploads/uploads.config.js';
import { clientOrigins } from './config/client-origins.js';

/**
 * The browser origins allowed to call this API. Better Auth authenticates with
 * cookies, so credentials have to travel with every cross origin request and
 * the origin list must stay explicit: a wildcard cannot be combined with
 * `credentials: true`. The websocket gateway reads the same list.
 */

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
    // Better Auth mounts its own JSON and urlencoded parsers through
    // AuthModule.forRoot. This flag is required for that to work and is
    // global: any future raw or multipart route must add its own parser.
    bodyParser: false,
  });

  app.enableCors({
    origin: clientOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // DTOs are the boundary: anything not declared on one is rejected rather
  // than silently ignored, and query/param strings are converted to their
  // declared types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Event images are public: the URL stored on an event has to work in a plain
  // <img> with no token. Serving the same root the uploads writer resolves
  // keeps a saved URL from pointing at nothing.
  app.useStaticAssets(resolveBucketRoot(), {
    prefix: `${BUCKET_URL_PREFIX}/`,
    index: false,
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
