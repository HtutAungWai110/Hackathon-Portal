import { XIcon } from 'lucide-react';
import type { SponsorTier } from './events-api';

const TIERS: readonly { value: SponsorTier; label: string }[] = [
  { value: 'MAIN', label: 'Main' },
  { value: 'CO_SPONSOR', label: 'Co-sponsor' },
];

type SponsorRowProps = {
  companyName: string;
  industry: string | null;
  tier: SponsorTier;
  onTierChange: (tier: SponsorTier) => void;
  onRemove: () => void;
};

/**
 * One attached company. The tier is a two-state switch, not a dropdown: there
 * are only two values and both are worth naming at once. `aria-pressed` makes
 * the state readable without relying on colour.
 */
export function SponsorRow({
  companyName,
  industry,
  tier,
  onTierChange,
  onRemove,
}: SponsorRowProps) {
  return (
    <li className="sponsor-row">
      <div className="sponsor-row__main">
        <span className="sponsor-row__name">{companyName}</span>
        {industry !== null ? (
          <span className="sponsor-row__industry">{industry}</span>
        ) : null}
      </div>

      <div className="sponsor-row__controls">
        <div
          className="tier-switch"
          role="group"
          aria-label={`Tier for ${companyName}`}
        >
          {TIERS.map((option) => (
            <button
              className="tier-switch__option"
              key={option.value}
              type="button"
              aria-pressed={tier === option.value}
              onClick={() => onTierChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          className="sponsor-row__remove"
          type="button"
          aria-label={`Remove ${companyName}`}
          onClick={onRemove}
        >
          <XIcon aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
