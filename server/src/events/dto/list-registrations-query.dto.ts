import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** The page sizes the console offers. Anything else is a bad request. */
export const REGISTRATION_PAGE_SIZES = [10, 20, 40, 60, 80, 100] as const;
export type RegistrationPageSize = (typeof REGISTRATION_PAGE_SIZES)[number];

/**
 * How the console asks for one page of an event's applications.
 *
 * `registrationId` is a deep link: when it is present the server returns the
 * page that holds that application and ignores `page`, so a client that only
 * knows the row id still lands on the right screen.
 */
export class ListRegistrationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn(REGISTRATION_PAGE_SIZES)
  readonly limit?: RegistrationPageSize;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly registrationId?: string;
}
