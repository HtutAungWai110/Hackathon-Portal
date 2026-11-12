import { BadRequestException } from '@nestjs/common';
import { Readable } from 'node:stream';
import {
  eventImageMulterOptions,
  MAX_EVENT_IMAGES,
  MAX_IMAGE_BYTES,
} from './uploads.multer.js';

function fileOf(mimetype: string): Express.Multer.File {
  return {
    fieldname: 'images',
    originalname: 'photo.bin',
    encoding: '7bit',
    mimetype,
    size: 128,
    destination: '',
    filename: '',
    path: '',
    buffer: Buffer.alloc(0),
    stream: Readable.from([]),
  };
}

describe('eventImageMulterOptions', () => {
  it('caps the file size and the number of images', () => {
    expect(eventImageMulterOptions().limits).toEqual({
      fileSize: MAX_IMAGE_BYTES,
      files: MAX_EVENT_IMAGES,
    });
  });

  it('accepts the image types it can name an extension for', () => {
    const callback = vi.fn();

    eventImageMulterOptions().fileFilter(
      undefined,
      fileOf('image/webp'),
      callback,
    );

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('rejects a file that is not an image', () => {
    const callback = vi.fn();

    eventImageMulterOptions().fileFilter(
      undefined,
      fileOf('text/html'),
      callback,
    );

    const [error, accepted] = callback.mock.calls[0] as [unknown, boolean];
    expect(error).toBeInstanceOf(BadRequestException);
    expect(accepted).toBe(false);
  });
});
