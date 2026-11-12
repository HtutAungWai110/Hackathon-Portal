import { useId, useState } from 'react';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import './Combobox.css';

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
};

type ComboboxProps = {
  label: string;
  value: string;
  options: readonly ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
};

/**
 * A real listbox-style picker rather than a native select: the same trigger
 * skin as `TextField`, a search field, and descriptions for options whose
 * names are not enough on their own.
 *
 * shadcn's `Command` does the filtering; this component only owns the value
 * and the open state. The caller decides where the value lives, which keeps it
 * usable from `react-hook-form` through `Controller`.
 */
export function Combobox({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose one',
  searchPlaceholder,
  hint,
  error,
  disabled = false,
}: ComboboxProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [open, setOpen] = useState(false);
  const describedBy = [
    hint !== undefined ? hintId : null,
    error !== undefined ? errorId : null,
  ]
    .filter((entry): entry is string => entry !== null)
    .join(' ');
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <div className="field">
      <span className="field__label" id={labelId}>
        {label}
      </span>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="field__input combobox__trigger"
            aria-labelledby={labelId}
            aria-describedby={describedBy.length > 0 ? describedBy : undefined}
            aria-invalid={error !== undefined}
            aria-expanded={open}
            disabled={disabled}
          >
            <span
              className={
                selected === null
                  ? 'combobox__placeholder'
                  : 'combobox__value'
              }
            >
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDownIcon
              className="combobox__chevron"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput
              placeholder={searchPlaceholder ?? 'Search…'}
              aria-label={`Search ${label.toLowerCase()}`}
            />
            <CommandList>
              <CommandEmpty>No match.</CommandEmpty>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.description ?? ''}`}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="combobox__option">
                    <span className="combobox__option-label">
                      {option.label}
                    </span>
                    {option.description !== undefined ? (
                      <span className="combobox__option-description">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {option.value === value ? (
                    <CheckIcon className="combobox__check" aria-hidden="true" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {hint !== undefined ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error !== undefined ? (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
