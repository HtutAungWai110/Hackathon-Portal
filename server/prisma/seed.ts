import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Demo sponsors for a fresh database, so the admin dashboard and the event
 * composer have something real to attach. Companies are deliberately separate
 * from events: the same company can back several events at different tiers.
 * Names and domains are invented; `.example` is the reserved documentation
 * domain and never resolves to someone else's site.
 */
const SAMPLE_COMPANIES = [
  {
    name: 'Blue Harbor Systems',
    website: 'https://blueharbor.example',
    industry: 'Cloud infrastructure',
  },
  {
    name: 'Cinder Studio',
    website: 'https://cinderstudio.example',
    industry: 'Creative software',
  },
  {
    name: 'Copperline Media',
    website: 'https://copperlinemedia.example',
    industry: 'Media',
  },
  {
    name: 'Halcyon Robotics',
    website: 'https://halcyonrobotics.example',
    industry: 'Robotics',
  },
  {
    name: 'Kestrel Analytics',
    website: 'https://kestrelanalytics.example',
    industry: 'Data and analytics',
  },
  {
    name: 'Lumen Forge',
    website: 'https://lumenforge.example',
    industry: 'Hardware',
  },
  {
    name: 'Northwind Labs',
    website: 'https://northwindlabs.example',
    industry: 'Developer tools',
  },
  {
    name: 'Orchard AI',
    website: 'https://orchardai.example',
    industry: 'Machine learning',
  },
  {
    name: 'Pine & Pixel',
    website: 'https://pineandpixel.example',
    industry: 'Education',
  },
  {
    name: 'Quarry & Co.',
    website: 'https://quarryandco.example',
    industry: 'Manufacturing',
  },
  {
    name: 'Sable Interactive',
    website: 'https://sableinteractive.example',
    industry: 'Games',
  },
  {
    name: 'Skyline Freight',
    website: 'https://skylinefreight.example',
    industry: 'Logistics',
  },
  {
    name: 'Tidepool Health',
    website: 'https://tidepoolhealth.example',
    industry: 'Health tech',
  },
  {
    name: 'Trailhead Security',
    website: 'https://trailheadsecurity.example',
    industry: 'Cybersecurity',
  },
  {
    name: 'Vantage Grid',
    website: 'https://vantagegrid.example',
    industry: 'Energy',
  },
] as const;

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

/**
 * Upsert by the unique name, so running the seed twice is safe. An existing
 * row is left untouched: an organiser may have corrected its details, and
 * sample data must never overwrite real data.
 */
async function seedSampleCompanies(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    console.log('Skipping sample companies in production.');
    return;
  }

  for (const company of SAMPLE_COMPANIES) {
    await prisma.company.upsert({
      where: { name: company.name },
      update: {},
      create: company,
    });
  }

  console.log(`Ensured ${SAMPLE_COMPANIES.length} sample companies exist.`);
}

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

  await seedSampleCompanies();
} finally {
  await prisma.$disconnect();
}
