import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * What a participant sends when applying for a place at an event. The message
 * is the only required field: it is what an organiser reads before accepting
 * someone, so it cannot be skipped. A company is optional because most people
 * apply on their own.
 */
export class CreateRegistrationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  readonly additionalMessage: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly companyName?: string;

  /**
   * Blank means "no company email". The service trims it to null, so a form
   * that submits its empty field is not an error.
   */
  @IsOptional()
  @ValidateIf((_dto, value: unknown) => value !== '')
  @IsEmail()
  @MaxLength(200)
  readonly companyEmail?: string;
}
