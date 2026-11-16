import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EventStatus } from '../../generated/prisma/enums.js';

/** What an admin sends to open a new event. Dates are ISO 8601 strings. */
export class CreateEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  readonly title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5_000)
  readonly description: string;

  @IsISO8601()
  readonly startsAt: string;

  @IsISO8601()
  readonly endsAt: string;

  @IsOptional()
  @IsISO8601()
  readonly registrationDeadline?: string;

  /** Omitted or empty means the event runs online. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly location?: string;

  /**
   * URLs returned by `POST /admin/uploads/event-images`. Omitted means no
   * images; the column defaults to an empty list.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  readonly imageUrls?: string[];

  /**
   * The URL returned by `POST /admin/uploads/event-background`. Omitted or
   * empty means the event header stays plain.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly backgroundUrl?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  readonly status?: EventStatus;
}
