import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { EventStatus } from '../../generated/prisma/enums.js';

/**
 * What an admin sends to replace an event through `PUT /admin/events/:id`.
 *
 * Every column the editor owns is required, because a PUT states the whole
 * resource rather than a change to it: a field the body omits is a mistake, not
 * "keep what was there". The optional columns are declared nullable instead, so
 * clearing one is an explicit `null`.
 *
 * Address the event's sponsors through their own routes; they are not part of
 * this body. Neither is `createdById`, which the server records at creation.
 */
export class ReplaceEventDto {
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

  /** `null` keeps registration open until the event starts. */
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsISO8601()
  readonly registrationDeadline: string | null;

  /** `null` means the event runs online and has no venue. */
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @MaxLength(200)
  readonly location: string | null;

  /** The whole list, in the order to show it. `[]` removes every image. */
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  readonly imageUrls: string[];

  /** `null` leaves the event header without a background image. */
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @MaxLength(500)
  readonly backgroundUrl: string | null;

  @IsEnum(EventStatus)
  readonly status: EventStatus;
}
