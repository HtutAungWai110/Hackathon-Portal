import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import type { Company } from './events-api';

type CompanyPickerProps = {
  companies: readonly Company[];
  selectedNames: readonly string[];
  onSelect: (company: Company) => void;
};

/**
 * Adding a sponsor is not choosing one value: the form keeps a list, so the
 * picker closes after each pick and stays open to the next search. Companies
 * already on the event are filtered out instead of being shown disabled.
 */
export function CompanyPicker({
  companies,
  selectedNames,
  onSelect,
}: CompanyPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = new Set(
    selectedNames.map((name) => name.trim().toLowerCase()),
  );
  const available = companies.filter(
    (company) => !selected.has(company.name.trim().toLowerCase()),
  );
  const exhausted = companies.length > 0 && available.length === 0;
  const disabled = companies.length === 0 || exhausted;
  const label =
    companies.length === 0
      ? 'No companies available'
      : exhausted
        ? 'Every company is already attached'
        : 'Add a sponsor';

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="sponsor-picker__trigger"
          type="button"
          disabled={disabled}
        >
          <PlusIcon className="sponsor-picker__icon" aria-hidden="true" />
          {label}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput
            placeholder="Search companies…"
            aria-label="Search companies"
          />
          <CommandList>
            <CommandEmpty>No company matches.</CommandEmpty>
            {available.map((company) => (
              <CommandItem
                key={company.id}
                value={company.name}
                onSelect={() => {
                  onSelect(company);
                  setOpen(false);
                }}
              >
                <span className="sponsor-picker__option">
                  <span className="sponsor-picker__name">{company.name}</span>
                  {company.industry !== null ? (
                    <span className="sponsor-picker__industry">
                      {company.industry}
                    </span>
                  ) : null}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
