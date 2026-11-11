import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const email = process.env['ADMIN_EMAIL']?.trim();
const connectionString = process.env['DATABASE_URL'];

if (email === undefined || email.length === 0) {
  throw new Error(
    'ADMIN_EMAIL is not set. Set it to the email of the user who should become admin, then run the seed again.',
  );
}

if (connectionString === undefined || connectionString.length === 0) {
  throw new Error('DATABASE_URL is not set. Add it to your .env file.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  const result = await prisma.user.updateMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    data: { role: 'admin' },
  });

  if (result.count === 0) {
    console.warn(`No user matches ${email}. Nothing changed.`);
  } else {
    console.log(
      `Promoted ${result.count} user(s) matching ${email} to admin.`,
    );
  }
} finally {
  await prisma.$disconnect();
}
