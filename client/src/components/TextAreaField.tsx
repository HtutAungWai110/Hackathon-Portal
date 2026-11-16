import { useId } from 'react';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import './TextField.css';

type TextAreaFieldProps = Omit<ComponentPropsWithRef<'textarea'>, 'id'> & {
  label: string;
  hint?: string;
  error?: string;
  /**
   * Controls that belong to this field, such as the description's list
   * buttons. Rendered under the label and above the box, so they read as part
   * of the field rather than as page actions.
   */
  toolbar?: ReactNode;
};

/**
 * The multiline sibling of `TextField`. It shares the field styles on purpose,
 * so a form never has two slightly different input skins.
 */
export function TextAreaField({
  label,
  hint,
  error,
  toolbar,
  ...inputProps
}: TextAreaFieldProps) {
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
      {toolbar !== undefined ? toolbar : null}
      <textarea
        {...inputProps}
        id={id}
        className="field__input field__textarea"
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
