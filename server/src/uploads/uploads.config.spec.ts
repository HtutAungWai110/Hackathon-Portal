import { join } from 'node:path';
import {
  eventImagesDirectory,
  eventImageUrl,
  resolveBucketRoot,
} from './uploads.config.js';

describe('bucket paths', () => {
  it('sits in the package the API runs from', () => {
    expect(resolveBucketRoot()).toBe(join(process.cwd(), 'bucket'));
  });

  it('keeps event images in their own folder', () => {
    expect(eventImagesDirectory()).toBe(
      join(process.cwd(), 'bucket', 'event_images'),
    );
  });

  it('builds the URL the static handler serves', () => {
    expect(eventImageUrl('one.png')).toBe('/bucket/event_images/one.png');
  });
});
