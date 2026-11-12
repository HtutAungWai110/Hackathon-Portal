import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs';
import { diskStorage } from 'multer';
import { eventImagesDirectory } from './uploads.config.js';

/** One event cannot carry more than this many images. */
export const MAX_EVENT_IMAGES = 8;

/** 5 MB per image: enough for a photograph, not for a disc image. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Accepted types, and the extension each one is written with. The extension
 * comes from the declared MIME type rather than the uploaded filename, so a
 * request cannot choose what lands on disk. SVG is deliberately absent: it is
 * a script container, and these files are served from the API's own origin.
 */
const IMAGE_EXTENSIONS: ReadonlyMap<string, string> = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
  ['image/gif', '.gif'],
]);

const UNSUPPORTED_TYPE =
  'Unsupported image type. Use JPEG, PNG, WebP, AVIF, or GIF.';

/**
 * The multer configuration for event images: disk storage inside the bucket,
 * images only, and a hard size and count limit.
 *
 * It is a plain function, not a provider method, because decorators are
 * evaluated before the container exists. Nothing here reads configuration:
 * the bucket location is derived from the working directory by
 * `eventImagesDirectory`, which is the same function the static handler uses.
 */
export function eventImageMulterOptions() {
  return {
    storage: diskStorage({
      destination: (_request, _file, callback) => {
        const directory = eventImagesDirectory();
        mkdir(directory, { recursive: true }, (error) => {
          callback(error, directory);
        });
      },
      filename: (_request, file, callback) => {
        const extension = IMAGE_EXTENSIONS.get(file.mimetype);
        if (extension === undefined) {
          callback(new BadRequestException(UNSUPPORTED_TYPE), '');
          return;
        }
        // A collision is not possible in practice, but a unique name also
        // means two uploads of the same photo never overwrite each other.
        callback(null, `${Date.now()}-${randomUUID()}${extension}`);
      },
    }),
    limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_EVENT_IMAGES },
    fileFilter: (
      _request: unknown,
      file: Express.Multer.File,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (!IMAGE_EXTENSIONS.has(file.mimetype)) {
        callback(new BadRequestException(UNSUPPORTED_TYPE), false);
        return;
      }
      callback(null, true);
    },
  };
}
