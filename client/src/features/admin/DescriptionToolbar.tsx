import { ListIcon, ListOrderedIcon } from 'lucide-react';
import type { ListKind } from '../../lib/description';

type DescriptionToolbarProps = {
  /** Writes the list markers for the selected lines into the textarea. */
  onInsert: (kind: ListKind) => void;
  disabled?: boolean;
};

/**
 * The two things an event description usually needs and nobody wants to
 * remember the syntax for. Each button writes the marker into the text, and
 * pressing it again on the same lines takes the marker back out, so it behaves
 * like a toggle rather than a one way insert.
 */
export function DescriptionToolbar({
  onInsert,
  disabled = false,
}: DescriptionToolbarProps) {
  return (
    <div className="description-toolbar" role="group" aria-label="Format as">
      <button
        className="description-toolbar__button"
        type="button"
        disabled={disabled}
        aria-label="Turn the selected lines into a bullet list"
        onClick={() => onInsert('bullets')}
      >
        <ListIcon className="description-toolbar__icon" aria-hidden="true" />
        Bullet list
      </button>
      <button
        className="description-toolbar__button"
        type="button"
        disabled={disabled}
        aria-label="Turn the selected lines into a numbered list"
        onClick={() => onInsert('steps')}
      >
        <ListOrderedIcon
          className="description-toolbar__icon"
          aria-hidden="true"
        />
        Numbered list
      </button>
    </div>
  );
}
