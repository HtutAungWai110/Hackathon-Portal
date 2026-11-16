import { useEffect, useId, useRef } from 'react';
import './ConfirmDialog.css';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** What the action does, in plain words. Rendered under the title. */
  description: string;
  /** The action's own label, such as "Delete event". */
  confirmLabel: string;
  /** Label while the action is running, such as "Deleting…". */
  busyLabel: string;
  busy?: boolean;
  /** A failure from the action, shown inside the dialog. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * A yes or no the page cannot undo. It is a native modal dialog, so focus
 * moves in, Tab stays inside, Escape cancels, and focus returns to whatever
 * opened it. The caller owns `open` and the work behind the confirm.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busyLabel,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      className="confirm-dialog"
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        // Escape closes through `open` so the caller stays in charge.
        event.preventDefault();
        if (!busy) {
          onCancel();
        }
      }}
      onClick={(event) => {
        // The backdrop is the dialog itself; the panel inside stops here.
        if (event.target === event.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <div className="confirm-dialog__panel">
        <h2 className="confirm-dialog__title" id={titleId}>
          {title}
        </h2>
        <p className="confirm-dialog__body" id={descriptionId}>
          {description}
        </p>

        {error !== null ? (
          <p className="confirm-dialog__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="confirm-dialog__actions">
          <button
            className="button button--ghost"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="button button--danger"
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
