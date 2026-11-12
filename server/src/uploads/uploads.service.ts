import { Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { mkdir } from 'node:fs/promises';
import {
  eventImagesDirectory,
  eventImageUrl,
} from './uploads.config.js';

/**
 * Owns the bucket's layout: the folder uploads land in and the URL an event
 * stores for one. Controllers never build a path themselves, so the static
 * handler in `main.ts` and the writer here cannot disagree.
 */
@Injectable()
export class UploadsService implements OnModuleInit {
  /** `<bucket>/event_images`, absolute. */
  get eventImagesDir(): string {
    return eventImagesDirectory();
  }

  /** The folder ships empty in git, so make sure it exists before the first write. */
  async onModuleInit(): Promise<void> {
    await mkdir(this.eventImagesDir, { recursive: true });
  }

  /** The value an event stores in `imageUrls` for a file this service wrote. */
  publicUrl(filename: string): string {
    return eventImageUrl(filename);
  }
}
