import { useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ImagePlusIcon, RefreshCwIcon, XIcon } from 'lucide-react';
import { apiAssetUrl } from '../../lib/api-config';
import {
  EVENT_IMAGE_ACCEPT,
  EVENT_IMAGE_TYPES,
  MAX_EVENT_IMAGE_BYTES,
} from './events-api';

type EventBackgroundFieldProps = {
  /** The stored URL, or an empty string when the header stays plain. */
  url: string;
  uploading: boolean;
  /** The upload request's message, if the last one failed. */
  error: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
};

/**
 * The one wide image behind the event's header. It is a separate field from the
 * gallery on purpose: a page has one background and many pictures, and
 * replacing it should not mean removing the old one first.
 */
export function EventBackgroundField({
  url,
  uploading,
  error,
  onUpload,
  onRemove,
}: EventBackgroundFieldProps) {
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const message = notice ?? error;

  function select(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    // Clearing the value lets the same image be picked again after a removal.
    event.target.value = '';
    if (file === undefined) {
      return;
    }

    if (!(EVENT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setNotice('That file is not an image. Use JPEG, PNG, WebP, AVIF, or GIF.');
      return;
    }
    if (file.size > MAX_EVENT_IMAGE_BYTES) {
      setNotice('The header image has to be 5 MB or smaller.');
      return;
    }

    setNotice(null);
    onUpload(file);
  }

  return (
    <div className="event-background">
      <div className="event-background__head">
        <span className="field__label" id={labelId}>
          Header image
        </span>
        <span className="event-background__state">
          {url.length === 0 ? 'None' : 'Set'}
        </span>
      </div>

      {url.length > 0 ? (
        <div className="event-background__preview">
          <img
            className="event-background__img"
            src={apiAssetUrl(url)}
            alt="The event header's current background"
            width={1280}
            height={540}
            loading="lazy"
            decoding="async"
          />
          <button
            className="event-background__remove"
            type="button"
            aria-label="Remove the header image"
            title="Remove the header image"
            onClick={onRemove}
          >
            <XIcon aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <input
        ref={inputRef}
        className="event-background__input"
        type="file"
        accept={EVENT_IMAGE_ACCEPT}
        tabIndex={-1}
        onChange={select}
      />

      <button
        className="event-background__trigger"
        type="button"
        disabled={uploading}
        aria-describedby={message !== null ? `${hintId} ${errorId}` : hintId}
        onClick={() => inputRef.current?.click()}
      >
        {url.length > 0 ? (
          <RefreshCwIcon className="event-background__icon" aria-hidden="true" />
        ) : (
          <ImagePlusIcon className="event-background__icon" aria-hidden="true" />
        )}
        {uploading
          ? 'Uploading image…'
          : url.length > 0
            ? 'Replace image'
            : 'Add a header image'}
      </button>

      <p className="field__hint" id={hintId}>
        Optional. One wide image, 5 MB at most. JPEG, PNG, WebP, AVIF, or GIF.
        It sits behind the event title.
      </p>

      {message !== null ? (
        <p className="event-background__error" id={errorId} role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
