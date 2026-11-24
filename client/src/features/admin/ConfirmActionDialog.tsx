import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { TextAreaField } from '../../components/TextAreaField';

/** An optional note the admin writes before the decision is sent. */
type ReasonField = {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  maxLength?: number;
  onChange: (value: string) => void;
};

type ConfirmActionDialogProps = {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  cancelLabel?: string;
  /** `danger` is reserved for the irreversible action. */
  tone?: 'primary' | 'danger';
  pending?: boolean;
  error?: string | null;
  reasonField?: ReasonField;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * The warning that stands between an admin and an application decision. It is
 * drawn in the page's own console language — ink panel, signal edge, hard
 * shadow — rather than the browser's default confirm, and it holds focus until
 * Confirm or Cancel is chosen. Nothing is sent while it is open.
 */
export function ConfirmActionDialog({
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  pending = false,
  error = null,
  reasonField,
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // The page behind the overlay must not scroll, and Cancel starts focused so
  // a stray Enter decides nothing.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  // Escape cancels; Tab cycles inside the panel instead of reaching the ledger.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!pending) {
          onCancel();
        }
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const panel = panelRef.current;
      if (panel === null) {
        return;
      }
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel, pending]);

  return createPortal(
    <div
      className="confirm-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) {
          onCancel();
        }
      }}
    >
      <div
        ref={panelRef}
        className="confirm-dialog"
        data-tone={tone}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        <p className="admin-eyebrow">Confirm action</p>
        <h2 className="confirm-dialog__title" id={titleId}>
          {title}
        </h2>
        <div className="confirm-dialog__body" id={bodyId}>
          {description}
        </div>

        {reasonField === undefined ? null : (
          <div className="confirm-dialog__reason">
            <TextAreaField
              label={reasonField.label}
              hint={reasonField.hint}
              placeholder={reasonField.placeholder}
              maxLength={reasonField.maxLength}
              rows={3}
              value={reasonField.value}
              disabled={pending}
              onChange={(event) => reasonField.onChange(event.target.value)}
            />
          </div>
        )}

        {error === null ? null : (
          <p className="confirm-dialog__error" role="alert">
            {error}
          </p>
        )}

        <div className="confirm-dialog__actions">
          <button
            ref={cancelRef}
            className="button button--quiet"
            type="button"
            disabled={pending}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={
              tone === 'danger'
                ? 'button button--danger'
                : 'button button--primary'
            }
            type="button"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
