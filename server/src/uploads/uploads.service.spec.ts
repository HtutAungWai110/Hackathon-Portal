import { Test } from '@nestjs/testing';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { UploadsService } from './uploads.service.js';

describe('UploadsService', () => {
  let service: UploadsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UploadsService],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
  });

  it('creates the images folder before the first upload needs it', async () => {
    await service.onModuleInit();

    const stats = await stat(service.eventImagesDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('points at the folder the static handler serves under /bucket', () => {
    expect(service.eventImagesDir).toBe(
      join(process.cwd(), 'bucket', 'event_images'),
    );
    expect(service.publicUrl('123-photo.png')).toBe(
      '/bucket/event_images/123-photo.png',
    );
  });
});
