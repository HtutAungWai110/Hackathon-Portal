import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SponsorTier } from '../../generated/prisma/enums.js';

/**
 * The sponsor's company, sent inline so one request covers the usual case:
 * a company that has never sponsored anything is created as it is attached.
 * An existing company is matched by name and reused.
 */
export class SponsorCompanyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  readonly name: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(300)
  readonly website?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(300)
  readonly logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly industry?: string;
}

export class CreateSponsorDto {
  @ValidateNested()
  @Type(() => SponsorCompanyDto)
  readonly company: SponsorCompanyDto;

  @IsOptional()
  @IsEnum(SponsorTier)
  readonly tier?: SponsorTier;

  /** Free text for what they put in, for example "Cloud credits". */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  readonly contribution?: string;
}
