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

/**
 * Every field is optional: only what is sent is changed, and the service
 * re-checks the schedule against the stored values.
 */
export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  readonly title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5_000)
  readonly description?: string;

  @IsOptional()
  @IsISO8601()
  readonly startsAt?: string;

  @IsOptional()
  @IsISO8601()
  readonly endsAt?: string;

  @IsOptional()
  @IsISO8601()
  readonly registrationDeadline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly location?: string;

  /** Replaces the whole list. Send `[]` to remove every image. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  readonly imageUrls?: string[];

  /** `null` removes the header image; omission leaves it alone. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly backgroundUrl?: string | null;

  @IsOptional()
  @IsEnum(EventStatus)
  readonly status?: EventStatus;
}
