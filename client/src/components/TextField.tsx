import { useId } from 'react';
import type { ComponentPropsWithRef } from 'react';
import './TextField.css';

type TextFieldProps = Omit<ComponentPropsWithRef<'input'>, 'id'> & {
  label: string;
  hint?: string;
  error?: string;
};

/**
 * A labelled input that takes whatever `register()` spreads onto it, so
 * react-hook-form owns the value, the ref, and validation. `id` is generated
 * here to keep the label and the error message wired together.
 */
export function TextField({
  label,
  hint,
  error,
  ...inputProps
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [
    hint !== undefined ? hintId : null,
    error !== undefined ? errorId : null,
  ]
    .filter((value): value is string => value !== null)
    .join(' ');

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        {...inputProps}
        id={id}
        className="field__input"
        aria-invalid={error !== undefined}
        aria-describedby={describedBy.length > 0 ? describedBy : undefined}
      />
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
