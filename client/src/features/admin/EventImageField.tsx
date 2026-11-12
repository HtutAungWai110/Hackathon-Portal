import { useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ImagePlusIcon, XIcon } from 'lucide-react';
import {
  EVENT_IMAGE_ACCEPT,
  EVENT_IMAGE_TYPES,
  MAX_EVENT_IMAGES,
  MAX_EVENT_IMAGE_BYTES,
  eventImageSrc,
} from './events-api';

type EventImageFieldProps = {
  /** Stored URLs, in the order they will be saved with the event. */
  urls: readonly string[];
  uploading: boolean;
  /** The upload request's message, if the last one failed. */
  error: string | null;
  onUpload: (files: readonly File[]) => void;
  onRemove: (url: string) => void;
};

function filesLabel(count: number): string {
  return count === 1 ? '1 file' : `${count} files`;
}

/**
 * Picks the files this field can actually upload and explains the rest. The
 * server enforces the same limits; this only avoids a pointless round trip and
 * a message the organiser would otherwise read after waiting for it.
 */
function reviewSelection(
  files: readonly File[],
  room: number,
): { accepted: File[]; message: string | null } {
  const supported = new Set<string>(EVENT_IMAGE_TYPES);
  const usable: File[] = [];
  let unsupported = 0;
  let oversized = 0;

  for (const file of files) {
    if (!supported.has(file.type)) {
      unsupported += 1;
    } else if (file.size > MAX_EVENT_IMAGE_BYTES) {
      oversized += 1;
    } else {
      usable.push(file);
    }
  }

  const accepted = usable.slice(0, Math.max(room, 0));
  const dropped = usable.length - accepted.length;
  const problems: string[] = [];

  if (unsupported > 0) {
    problems.push(
      `${filesLabel(unsupported)} skipped: only JPEG, PNG, WebP, AVIF, and GIF are accepted.`,
    );
  }
  if (oversized > 0) {
    problems.push(
      `${filesLabel(oversized)} skipped: each image has to be 5 MB or smaller.`,
    );
  }
  if (dropped > 0) {
    problems.push(
      `${filesLabel(dropped)} skipped: an event holds at most ${MAX_EVENT_IMAGES} images.`,
    );
  }

  return {
    accepted,
    message: problems.length > 0 ? problems.join(' ') : null,
  };
}

/**
 * The event's image list. Files are uploaded the moment they are picked, so
 * the form only has to submit URLs that already exist; the thumbnails are the
 * proof the upload landed. Rejections are announced rather than swallowed, and
 * the remove button names which picture it takes away.
 */
export function EventImageField({
  urls,
  uploading,
  error,
  onUpload,
  onRemove,
}: EventImageFieldProps) {
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const room = MAX_EVENT_IMAGES - urls.length;
  const disabled = uploading || room <= 0;
  const message = notice ?? error;

  function select(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Clearing the value lets the same photo be picked again after a removal.
    event.target.value = '';
    if (files.length === 0) {
      return;
    }

    const selection = reviewSelection(files, room);
    setNotice(selection.message);
    if (selection.accepted.length > 0) {
      onUpload(selection.accepted);
    }
  }

  return (
    <div className="event-images">
      <div className="event-images__head">
        <span className="field__label" id={labelId}>
          Images
        </span>
        <span className="event-images__count">
          {urls.length} / {MAX_EVENT_IMAGES}
        </span>
      </div>

      {urls.length > 0 ? (
        <ul className="event-images__grid" aria-labelledby={labelId}>
          {urls.map((url, index) => (
            <li className="event-image" key={url}>
              <img
                className="event-image__img"
                src={eventImageSrc(url)}
                alt={`Event image ${index + 1}`}
                loading="lazy"
                decoding="async"
              />
              <button
                className="event-image__remove"
                type="button"
                aria-label={`Remove image ${index + 1}`}
                title="Remove image"
                onClick={() => onRemove(url)}
              >
                <XIcon aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        className="event-images__input"
        type="file"
        accept={EVENT_IMAGE_ACCEPT}
        multiple
        tabIndex={-1}
        onChange={select}
      />

      <button
        className="event-images__trigger"
        type="button"
        disabled={disabled}
        aria-describedby={message !== null ? `${hintId} ${errorId}` : hintId}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlusIcon className="event-images__icon" aria-hidden="true" />
        {uploading
          ? 'Uploading images…'
          : room <= 0
            ? 'Image limit reached'
            : 'Add images'}
      </button>

      <p className="field__hint" id={hintId}>
        Optional. Up to {MAX_EVENT_IMAGES} images, 5 MB each. JPEG, PNG, WebP,
        AVIF, or GIF.
      </p>

      {message !== null ? (
        <p className="event-images__error" id={errorId} role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
