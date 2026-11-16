import { useState } from 'react';
import type { ComponentPropsWithRef } from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { TextField } from './TextField';

type PasswordFieldProps = Omit<ComponentPropsWithRef<'input'>, 'id' | 'type'> & {
  label: string;
  hint?: string;
  error?: string;
};

/**
 * A password input with a reveal toggle. The toggle is a real button inside the
 * box, so it is reachable by keyboard, and its name says what pressing it does
 * rather than relying on the icon.
 *
 * `type` is not a prop on purpose: the component owns it, because that is the
 * one thing the toggle changes.
 */
export function PasswordField({
  label,
  hint,
  error,
  ...inputProps
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? 'Hide password' : 'Show password';

  return (
    <TextField
      {...inputProps}
      label={label}
      hint={hint}
      error={error}
      type={visible ? 'text' : 'password'}
      // A revealed password is still a password: no spellcheck, no
      // capitalisation, no autocorrect rewriting what was typed.
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect="off"
      action={
        <button
          className="field__action"
          type="button"
          title={toggleLabel}
          aria-label={toggleLabel}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? (
            <EyeOffIcon aria-hidden="true" />
          ) : (
            <EyeIcon aria-hidden="true" />
          )}
        </button>
      }
    />
  );
}
