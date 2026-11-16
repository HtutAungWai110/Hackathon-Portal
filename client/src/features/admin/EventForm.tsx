import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
} from 'react-hook-form';
import { Combobox } from '../../components/Combobox';
import type { ComboboxOption } from '../../components/Combobox';
import { TextAreaField } from '../../components/TextAreaField';
import { TextField } from '../../components/TextField';
import { authErrorMessage } from '../../lib/auth-error';
import { applyListMarkers } from '../../lib/description';
import type { ListKind } from '../../lib/description';
import { CompanyPicker } from './CompanyPicker';
import { DescriptionToolbar } from './DescriptionToolbar';
import { EventBackgroundField } from './EventBackgroundField';
import { EventImageField } from './EventImageField';
import { SponsorRow } from './SponsorRow';
import { countLabel } from './event-format';
import type {
  AdminEvent,
  Company,
  EventStatus,
  SponsorTier,
} from './events-api';
import { useAdminCompanies } from './use-admin-companies';
import { useCreateEvent } from './use-create-event';
import { useUpdateEvent } from './use-update-event';
import { useUploadEventBackground } from './use-upload-event-background';
import { useUploadEventImages } from './use-upload-event-images';

type SponsorDraft = {
  companyName: string;
  tier: SponsorTier;
};

type EventFormProps = {
  /**
   * Present when editing. The form then saves that event and reconciles its
   * sponsors instead of creating anything.
   */
  event?: AdminEvent;
  /** Rendered inside the success banner, usually the way back to the list. */
  successAction?: ReactNode;
  /**
   * Called after a save that finished cleanly, so the host can return to the
   * screen the form was opened from. A save where a sponsor failed does not
   * call it: that list is the reason to stay.
   */
  onSaved?: () => void;
};

type FormValues = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline: string;
  location: string;
  imageUrls: string[];
  /** Empty string means the header stays plain. */
  backgroundUrl: string;
  status: EventStatus;
  sponsors: SponsorDraft[];
};

const DEFAULT_VALUES: FormValues = {
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  registrationDeadline: '',
  location: '',
  imageUrls: [],
  backgroundUrl: '',
  status: 'DRAFT',
  sponsors: [],
};

const CREATE_VISIBILITY_OPTIONS: readonly ComboboxOption[] = [
  {
    value: 'DRAFT',
    label: 'Save as a draft',
    description: 'Only organisers can see it until you publish.',
  },
  {
    value: 'PUBLISHED',
    label: 'Publish now',
    description: 'Goes straight onto the public calendar.',
  },
];

/**
 * An edit can land anywhere in the lifecycle, including closing an event out
 * or cancelling it, so every status is offered once the event exists.
 */
const EDIT_VISIBILITY_OPTIONS: readonly ComboboxOption[] = [
  {
    value: 'DRAFT',
    label: 'Draft',
    description: 'Off the public calendar until you publish it.',
  },
  {
    value: 'PUBLISHED',
    label: 'Published',
    description: 'Visible on the public calendar.',
  },
  {
    value: 'COMPLETED',
    label: 'Completed',
    description: 'Finished. Still readable on the public calendar.',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
    description: 'Called off. Only organisers can open it.',
  },
];

function toIso(value: string): string {
  return new Date(value).toISOString();
}

/** `datetime-local` wants local wall time without a zone or seconds. */
function toDateTimeInput(iso: string | null): string {
  if (iso === null) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (part: number) => String(part).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function valuesFor(event: AdminEvent): FormValues {
  return {
    title: event.title,
    description: event.description,
    startsAt: toDateTimeInput(event.startsAt),
    endsAt: toDateTimeInput(event.endsAt),
    registrationDeadline: toDateTimeInput(event.registrationDeadline),
    location: event.location ?? '',
    imageUrls: event.imageUrls,
    backgroundUrl: event.backgroundUrl ?? '',
    status: event.status,
    sponsors: event.sponsors.map((sponsor) => ({
      companyName: sponsor.company.name,
      tier: sponsor.tier,
    })),
  };
}

function trimOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * The event form follows the server's own rules: a title long enough to read,
 * a real end after the start, and registration that does not outlive the
 * opening. Anything the server rejects still lands in the banner instead of
 * being guessed into a field.
 *
 * One component serves creation and editing. Creating saves the event and then
 * attaches each sponsor; editing replaces the event and reconciles the sponsor
 * list, reporting any company that would not move. A failure on one sponsor
 * never pretends the event itself was lost.
 *
 * The form knows nothing about routes: `onSaved` says a save finished cleanly
 * and lets the hosting screen decide where to go, and `successAction` is how it
 * puts a way back inside a success banner that a failed sponsor keeps open.
 */
export function EventForm({ event, successAction, onSaved }: EventFormProps) {
  const editing = event !== undefined;

  const {
    control,
    register,
    handleSubmit,
    getValues,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: event === undefined ? DEFAULT_VALUES : valuesFor(event),
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'sponsors',
  });
  const sponsors = useWatch({ control, name: 'sponsors' }) ?? [];
  const imageUrls = useWatch({ control, name: 'imageUrls' }) ?? [];
  const backgroundUrl = useWatch({ control, name: 'backgroundUrl' }) ?? '';
  const companies = useAdminCompanies();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const upload = useUploadEventImages();
  const uploadBackground = useUploadEventBackground();
  const sponsorGroupId = useId();
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const description = register('description', {
    required: 'Describe the event in a sentence or two.',
    minLength: {
      value: 10,
      message: 'Use at least 10 characters for the description.',
    },
    maxLength: {
      value: 5000,
      message: 'Keep the description under 5,000 characters.',
    },
  });
  const visibilityOptions = editing
    ? EDIT_VISIBILITY_OPTIONS
    : CREATE_VISIBILITY_OPTIONS;

  const companyByName = new Map(
    (companies.data ?? []).map((company) => [
      company.name.trim().toLowerCase(),
      company,
    ]),
  );

  async function addSponsor(company: Company) {
    append({ companyName: company.name, tier: 'CO_SPONSOR' });
  }

  function changeTier(index: number, tier: SponsorTier) {
    setValue(`sponsors.${index}.tier`, tier, { shouldDirty: true });
  }

  async function addImages(files: readonly File[]) {
    upload.reset();
    try {
      const { urls } = await upload.mutateAsync(files);
      setValue('imageUrls', [...getValues('imageUrls'), ...urls], {
        shouldDirty: true,
      });
    } catch {
      // The field renders the mutation's message below the picker.
    }
  }

  function removeImage(url: string) {
    setValue(
      'imageUrls',
      getValues('imageUrls').filter((candidate) => candidate !== url),
      { shouldDirty: true },
    );
  }

  async function setBackground(file: File) {
    uploadBackground.reset();
    try {
      const { url } = await uploadBackground.mutateAsync(file);
      setValue('backgroundUrl', url, { shouldDirty: true });
    } catch {
      // The field renders the mutation's message below the trigger.
    }
  }

  function removeBackground() {
    setValue('backgroundUrl', '', { shouldDirty: true });
  }

  /**
   * The list buttons edit the text the same way typing would, then put the
   * selection back over the lines they changed so the button can be pressed
   * again to undo it.
   */
  function formatList(kind: ListKind) {
    const box = descriptionRef.current;
    if (box === null) {
      return;
    }

    const edit = applyListMarkers(
      box.value,
      box.selectionStart,
      box.selectionEnd,
      kind,
    );
    setValue('description', edit.value, {
      shouldDirty: true,
      shouldValidate: true,
    });

    // The textarea takes the new value on the next render, so the selection
    // has to wait for it.
    requestAnimationFrame(() => {
      box.focus();
      box.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  }

  async function onSubmit(values: FormValues) {
    // An upload still in flight would save the event without its last image.
    if (upload.isPending || uploadBackground.isPending) {
      return;
    }

    const deadline = trimOptional(values.registrationDeadline);
    const location = trimOptional(values.location);
    const background = trimOptional(values.backgroundUrl);
    const sponsors = values.sponsors.map((sponsor) => ({
      companyName: sponsor.companyName,
      tier: sponsor.tier,
    }));
    const shared = {
      title: values.title.trim(),
      description: values.description.trim(),
      startsAt: toIso(values.startsAt),
      endsAt: toIso(values.endsAt),
      imageUrls: values.imageUrls,
      status: values.status,
    };

    if (event === undefined) {
      create.reset();

      try {
        const result = await create.mutateAsync({
          event: {
            ...shared,
            ...(deadline !== undefined
              ? { registrationDeadline: toIso(deadline) }
              : {}),
            ...(location !== undefined ? { location } : {}),
            ...(background !== undefined ? { backgroundUrl: background } : {}),
          },
          sponsors,
        });
        reset();

        // A clean save leaves the screen; the message queue confirms it on the
        // page the reader returns to. A failed sponsor keeps them here to read
        // the list.
        if (result.failedSponsors.length === 0) {
          onSaved?.();
        }
      } catch {
        // The mutation's error renders in the banner above the fields.
      }
      return;
    }

    update.reset();

    try {
      const result = await update.mutateAsync({
        id: event.id,
        event: {
          ...shared,
          // An emptied field is a deliberate clear, not "leave it alone".
          registrationDeadline: deadline === undefined ? null : toIso(deadline),
          location: location ?? null,
          backgroundUrl: background ?? null,
        },
        existing: event.sponsors,
        sponsors,
      });

      if (result.failedSponsors.length === 0) {
        onSaved?.();
      }
    } catch {
      // As above.
    }
  }

  const actionError = editing ? update.error : create.error;
  const created = editing ? undefined : create.data;
  const saved = editing ? update.data : undefined;
  const failedSponsors = created?.failedSponsors ?? saved?.failedSponsors ?? [];

  return (
    <form className="event-form" noValidate onSubmit={handleSubmit(onSubmit)}>
      {actionError !== null ? (
        <p className="alert" role="alert">
          {authErrorMessage(actionError)}
        </p>
      ) : null}

      {created !== undefined ? (
        <p className="alert alert--success" role="status">
          {created.event.status === 'DRAFT'
            ? `Saved. ${created.event.title} is on the calendar as a draft.`
            : `Saved. ${created.event.title} is live.`}
          {created.attachedSponsors.length > 0
            ? ` ${countLabel(created.attachedSponsors.length, 'sponsor')} attached.`
            : ''}
        </p>
      ) : null}

      {saved !== undefined ? (
        <p className="alert alert--success" role="status">
          Saved. {saved.event.title} is updated.
        </p>
      ) : null}

      {created !== undefined || saved !== undefined ? (
        <>
          {failedSponsors.length > 0 ? (
            <div className="alert event-form__failures" role="alert">
              <p>
                The event is saved, but{' '}
                {countLabel(failedSponsors.length, 'sponsor')} could not be
                updated:
              </p>
              <ul>
                {failedSponsors.map((failure) => (
                  <li key={failure.companyName}>
                    {failure.companyName}: {failure.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {successAction !== undefined ? (
            <div className="event-form__next">{successAction}</div>
          ) : null}
        </>
      ) : null}

      <TextField
        label="Event name"
        placeholder="Winter Jam"
        autoComplete="off"
        error={errors.title?.message}
        {...register('title', {
          required: 'Give the event a name.',
          minLength: {
            value: 3,
            message: 'Use at least 3 characters for the name.',
          },
          maxLength: {
            value: 120,
            message: 'Keep the name under 120 characters.',
          },
        })}
      />

      <TextAreaField
        label="Description"
        placeholder="Two days, one theme, teams of four."
        rows={5}
        hint="What someone reads before they register. Use the buttons to start a list, then press them again to take it back out."
        error={errors.description?.message}
        toolbar={<DescriptionToolbar onInsert={formatList} />}
        {...description}
        ref={(node) => {
          description.ref(node);
          descriptionRef.current = node;
        }}
      />

      <div className="event-form__row">
        <TextField
          label="Starts"
          type="datetime-local"
          error={errors.startsAt?.message}
          {...register('startsAt', {
            required: 'Choose when the event starts.',
          })}
        />
        <TextField
          label="Ends"
          type="datetime-local"
          error={errors.endsAt?.message}
          {...register('endsAt', {
            required: 'Choose when the event ends.',
            validate: (value) => {
              const start = getValues('startsAt');
              if (value.length === 0 || start.length === 0) {
                return true;
              }
              return (
                new Date(value).getTime() > new Date(start).getTime() ||
                'The event has to end after it starts.'
              );
            },
          })}
        />
        <TextField
          label="Registration closes"
          type="datetime-local"
          hint="Optional. It cannot be after the start. Leave empty to keep registration open until then."
          error={errors.registrationDeadline?.message}
          {...register('registrationDeadline', {
            validate: (value) => {
              const start = getValues('startsAt');
              if (value.length === 0 || start.length === 0) {
                return true;
              }
              return (
                new Date(value).getTime() <= new Date(start).getTime() ||
                'Registration has to close on or before the start.'
              );
            },
          })}
        />
      </div>

      <div className="event-form__row">
        <TextField
          label="Venue or link"
          placeholder="Online, or a place people can find"
          hint="Leave empty if the event runs online."
          error={errors.location?.message}
          {...register('location', {
            maxLength: {
              value: 200,
              message: 'Keep the venue under 200 characters.',
            },
          })}
        />

        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Combobox
              label="Visibility"
              value={field.value}
              options={visibilityOptions}
              onChange={(value) => field.onChange(value)}
              placeholder="Choose visibility"
              searchPlaceholder="Search visibility…"
              hint="Drafts stay off the public calendar until you publish them."
              error={errors.status?.message}
            />
          )}
        />
      </div>

      <EventBackgroundField
        url={backgroundUrl}
        uploading={uploadBackground.isPending}
        error={
          uploadBackground.error !== null
            ? authErrorMessage(uploadBackground.error)
            : null
        }
        onUpload={(file) => void setBackground(file)}
        onRemove={removeBackground}
      />

      <EventImageField
        urls={imageUrls}
        uploading={upload.isPending}
        error={
          upload.error !== null ? authErrorMessage(upload.error) : null
        }
        onUpload={(files) => void addImages(files)}
        onRemove={removeImage}
      />

      <div
        className="sponsor-field"
        role="group"
        aria-labelledby={sponsorGroupId}
      >
        <span className="field__label" id={sponsorGroupId}>
          Sponsors
        </span>

        {fields.length > 0 ? (
          <ul className="sponsor-rows">
            {fields.map((field, index) => {
              const sponsor = sponsors[index] ?? field;
              const company = companyByName.get(
                sponsor.companyName.trim().toLowerCase(),
              );
              return (
                <SponsorRow
                  key={field.id}
                  companyName={sponsor.companyName}
                  industry={company?.industry ?? null}
                  tier={sponsor.tier}
                  onTierChange={(tier) => changeTier(index, tier)}
                  onRemove={() => remove(index)}
                />
              );
            })}
          </ul>
        ) : null}

        {companies.isPending ? (
          <p className="sponsor-field__status" role="status">
            Loading companies…
          </p>
        ) : null}

        {companies.error !== null ? (
          <div className="sponsor-field__error" role="alert">
            <p>{authErrorMessage(companies.error)}</p>
            <button
              className="text-link"
              type="button"
              onClick={() => void companies.refetch()}
            >
              Try again
            </button>
          </div>
        ) : null}

        {companies.data !== undefined ? (
          <CompanyPicker
            companies={companies.data}
            selectedNames={sponsors.map((sponsor) => sponsor.companyName)}
            onSelect={addSponsor}
          />
        ) : null}

        <p className="field__hint">
          Optional. Each company is either the main sponsor or a co-sponsor.
        </p>
      </div>

      <button
        className="button button--primary button--block"
        type="submit"
        disabled={
          isSubmitting || upload.isPending || uploadBackground.isPending
        }
      >
        {isSubmitting
          ? 'Saving event'
          : upload.isPending || uploadBackground.isPending
            ? 'Uploading image'
            : editing
              ? 'Save changes'
              : 'Create event'}
      </button>
      <p className="event-form__note">
        {editing
          ? 'Images upload as you pick them. A removed sponsor is removed when you save.'
          : 'Images upload as you pick them. Sponsors attach as the event is created. You can edit the schedule after it is saved.'}
      </p>
    </form>
  );
}
