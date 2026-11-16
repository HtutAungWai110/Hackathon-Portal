import { useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { apiAssetUrl } from '../../lib/api-config';

type HackathonLightboxProps = {
  /** Every image of the event, in stored order. */
  images: string[];
  /** The image being shown. Always a valid index. */
  index: number;
  /** Used in the accessible name and the image alt text. */
  title: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

/**
 * The event's images at full size. It is a modal dialog, not a new route, so
 * opening one does not lose the scroll position or the event behind it.
 *
 * Escape closes it, arrows move between images, and Tab stays inside it. The
 * caller owns which image is open; this component only reports intent.
 */
export function HackathonLightbox({
  images,
  index,
  title,
  onClose,
  onNavigate,
}: HackathonLightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = images.length;

  // Focus moves into the dialog when it opens. The caller puts it back on the
  // thumbnail that opened it, because that element still exists behind this.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // The page behind must not scroll while the dialog owns the screen.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>(
          'button:not([disabled])',
        );
        if (buttons === undefined || buttons.length === 0) {
          return;
        }
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      if (count < 2) {
        return;
      }
      if (event.key === 'ArrowRight' && index < count - 1) {
        event.preventDefault();
        onNavigate(index + 1);
      } else if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        onNavigate(index - 1);
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [count, index, onClose, onNavigate]);

  return (
    <div
      className="lightbox"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} images`}
      onClick={(event) => {
        // Only the backdrop closes it; a click on the image or a control must
        // not fall through and dismiss what the visitor is looking at.
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="lightbox__bar">
        <p className="lightbox__count" aria-live="polite">
          {index + 1} / {count}
        </p>
        <button
          className="lightbox__control"
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
        >
          <XIcon aria-hidden="true" size={20} />
        </button>
      </div>

      <figure className="lightbox__stage">
        <div
          className="lightbox__track"
          style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
        >
          {images.map((url, imageIndex) => (
            <div
              className="lightbox__slide"
              key={url}
              aria-hidden={imageIndex !== index}
            >
              <img
                src={apiAssetUrl(url)}
                alt={`${title}, image ${imageIndex + 1} of ${count}`}
                decoding="async"
              />
            </div>
          ))}
        </div>
      </figure>

      {count > 1 ? (
        <>
          <button
            className="lightbox__control lightbox__control--prev"
            type="button"
            disabled={index === 0}
            onClick={() => onNavigate(index - 1)}
            aria-label="Previous image"
          >
            <ChevronLeftIcon aria-hidden="true" size={24} />
          </button>
          <button
            className="lightbox__control lightbox__control--next"
            type="button"
            disabled={index === count - 1}
            onClick={() => onNavigate(index + 1)}
            aria-label="Next image"
          >
            <ChevronRightIcon aria-hidden="true" size={24} />
          </button>
        </>
      ) : null}
    </div>
  );
}
