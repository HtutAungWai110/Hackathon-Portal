import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** The two decisions an admin can make on one application. */
export const REGISTRATION_DECISIONS = ['accept', 'reject'] as const;
export type RegistrationDecision = (typeof REGISTRATION_DECISIONS)[number];

/**
 * The body of the one decision route. `reason` is only read for a rejection;
 * it is optional and is stored on the application for the applicant to see.
 */
export class DecideRegistrationDto {
  @IsIn(REGISTRATION_DECISIONS)
  readonly action: RegistrationDecision;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly reason?: string;
}
