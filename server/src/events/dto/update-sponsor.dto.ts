import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SponsorTier } from '../../generated/prisma/enums.js';

/** Moving a sponsor between tiers, or correcting what they contribute. */
export class UpdateSponsorDto {
  @IsOptional()
  @IsEnum(SponsorTier)
  readonly tier?: SponsorTier;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  readonly contribution?: string;
}
