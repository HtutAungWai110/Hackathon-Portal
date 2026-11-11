import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ObserveInstrument } from './observe.js';

const DEFAULT_CLIENT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5137',
];

/**
 * The browser origins allowed to call this API. Better Auth authenticates with
 * cookies, so credentials have to travel with every cross origin request and
 * the origin list must stay explicit: a wildcard cannot be combined with
 * `credentials: true`.
 */
function clientOrigins(): string[] {
  const configured = process.env.CLIENT_URL;
  if (configured === undefined) {
    return DEFAULT_CLIENT_ORIGINS;
  }
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : DEFAULT_CLIENT_ORIGINS;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
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

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
