import { join } from 'node:path';

/** The folder uploaded files are written to, beside `src/`. */
export const BUCKET_FOLDER = 'bucket';

/** Where event images live inside the bucket. */
export const EVENT_IMAGES_FOLDER = 'event_images';

/** The prefix `useStaticAssets` serves the bucket under. */
export const BUCKET_URL_PREFIX = '/bucket';

/**
 * The bucket, resolved from the process working directory: `server/bucket`
 * when the API is started from the package, which is how both `npm run
 * start:dev` and `node dist/main` run it. The static handler in `main.ts` and
 * the upload writer both resolve through here, so they cannot drift apart and
 * leave the API writing files no URL serves.
 */
export function resolveBucketRoot(): string {
  return join(process.cwd(), BUCKET_FOLDER);
}

/** `<bucket>/event_images`, absolute. */
export function eventImagesDirectory(): string {
  return join(resolveBucketRoot(), EVENT_IMAGES_FOLDER);
}

/** The value an event stores in `imageUrls` for an uploaded file. */
export function eventImageUrl(filename: string): string {
  return `${BUCKET_URL_PREFIX}/${EVENT_IMAGES_FOLDER}/${filename}`;
}
