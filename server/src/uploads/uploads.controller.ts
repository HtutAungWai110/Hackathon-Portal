import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Roles } from '@thallesp/nestjs-better-auth';
import { eventImageMulterOptions, MAX_EVENT_IMAGES } from './uploads.multer.js';
import { UploadsService } from './uploads.service.js';

/**
 * Uploading is part of preparing an event, so it is admin only like the rest
 * of the console. It is a separate request from creating the event: the form
 * uploads first and then sends the returned URLs in the event body, which
 * keeps the JSON DTOs free of multipart special cases.
 */
@Controller('admin/uploads')
@Roles(['admin'])
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /**
   * `multipart/form-data` with one or more files under the `images` field.
   * Answers `{ urls }`, ready to be stored on an event's `imageUrls`.
   */
  @Post('event-images')
  @UseInterceptors(
    FilesInterceptor('images', MAX_EVENT_IMAGES, eventImageMulterOptions()),
  )
  uploadEventImages(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): { urls: string[] } {
    if (files === undefined || files.length === 0) {
      throw new BadRequestException('Attach at least one image.');
    }
    return { urls: files.map((file) => this.uploads.publicUrl(file.filename)) };
  }
}
