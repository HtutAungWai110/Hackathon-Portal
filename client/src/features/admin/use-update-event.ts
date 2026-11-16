import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authErrorMessage } from '../../lib/auth-error';
import { hackathonKeys } from '../hackathon/hackathon-api';
import {
  adminEventKeys,
  attachEventSponsor,
  removeEventSponsor,
  replaceAdminEvent,
  updateEventSponsorTier,
} from './events-api';
import type {
  AdminEvent,
  EventSponsor,
  FailedSponsor,
  ReplaceEventPayload,
  SponsorSelection,
} from './events-api';

export type UpdateEventInput = {
  id: string;
  event: ReplaceEventPayload;
  /** The sponsorships the server held when the form opened. */
  existing: EventSponsor[];
  /** What the form ended up with. */
  sponsors: SponsorSelection[];
};

export type UpdateEventResult = {
  event: AdminEvent;
  failedSponsors: FailedSponsor[];
};

function keyOf(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Saving an edit is the one PUT plus the sponsor calls the form implies:
 * dropped rows are deleted, new ones attached, changed tiers patched. The event
 * itself is saved first, so a sponsor that fails is reported without undoing
 * the rest, exactly like creation.
 *
 * PUT because the form holds every column: a field it sends blank means clear,
 * which PATCH could not express without a second meaning for an empty string.
 * The ledger's publish button still uses PATCH through `publishAdminEvent`.
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateEventInput): Promise<UpdateEventResult> => {
      const event = await replaceAdminEvent(input.id, input.event);

      const wanted = new Map(
        input.sponsors.map((sponsor) => [keyOf(sponsor.companyName), sponsor]),
      );
      const existing = new Map(
        input.existing.map((sponsor) => [keyOf(sponsor.company.name), sponsor]),
      );
      const failedSponsors: FailedSponsor[] = [];

      for (const [name, sponsor] of existing) {
        if (wanted.has(name)) {
          continue;
        }
        try {
          await removeEventSponsor(input.id, sponsor.id);
        } catch (error) {
          failedSponsors.push({
            companyName: sponsor.company.name,
            message: authErrorMessage(error),
          });
        }
      }

      for (const [name, sponsor] of wanted) {
        const current = existing.get(name);
        try {
          if (current === undefined) {
            await attachEventSponsor(input.id, {
              company: { name: sponsor.companyName },
              tier: sponsor.tier,
            });
          } else if (current.tier !== sponsor.tier) {
            await updateEventSponsorTier(input.id, current.id, sponsor.tier);
          }
        } catch (error) {
          failedSponsors.push({
            companyName: sponsor.companyName,
            message: authErrorMessage(error),
          });
        }
      }

      return { event, failedSponsors };
    },
    onSuccess: async (result) => {
      // The ledger row, the console read, and any open public page all move.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminEventKeys.all }),
        queryClient.invalidateQueries({ queryKey: hackathonKeys.all }),
      ]);
      queryClient.setQueryData(adminEventKeys.detail(result.event.id), result.event);
    },
  });
}
