import { useId } from 'react';
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
import { CompanyPicker } from './CompanyPicker';
import { EventImageField } from './EventImageField';
import { SponsorRow } from './SponsorRow';
import { countLabel } from './event-format';
import type { Company, EventStatus, SponsorTier } from './events-api';
import { useAdminCompanies } from './use-admin-companies';
import { useCreateEvent } from './use-create-event';
import { useUploadEventImages } from './use-upload-event-images';

type SponsorDraft = {
  companyName: string;
  tier: SponsorTier;
};

type EventFormProps = {
  /** Rendered inside the success banner, usually the way back to the list. */
  successAction?: ReactNode;
};

type FormValues = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline: string;
  location: string;
  imageUrls: string[];
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
  status: 'DRAFT',
  sponsors: [],
};

const VISIBILITY_OPTIONS: readonly ComboboxOption[] = [
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

function toIso(value: string): string {
  return new Date(value).toISOString();
}

function trimOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * The creation form follows the server's own rules: a title long enough to
 * read, a real end after the start, and registration that does not outlive
 * the opening. Anything the server rejects still lands in the banner instead
 * of being guessed into a field.
 *
 * Sponsors are part of the same submission. The event is created first, then
 * each sponsor is attached; a failure on one does not pretend the event was
 * lost, and the success banner says exactly which company did not attach.
 *
 * The form knows nothing about routes: `successAction` is how the hosting
 * screen puts its way back inside the success banner.
 */
export function EventForm({ successAction }: EventFormProps) {
  const {
    control,
    register,
    handleSubmit,
    getValues,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: DEFAULT_VALUES });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'sponsors',
  });
  const sponsors = useWatch({ control, name: 'sponsors' }) ?? [];
  const imageUrls = useWatch({ control, name: 'imageUrls' }) ?? [];
  const companies = useAdminCompanies();
  const create = useCreateEvent();
  const upload = useUploadEventImages();
  const sponsorGroupId = useId();

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

  async function onSubmit(values: FormValues) {
    // An upload still in flight would save the event without its last images.
    if (upload.isPending) {
      return;
    }

    const deadline = trimOptional(values.registrationDeadline);
    const location = trimOptional(values.location);
    create.reset();

    try {
      await create.mutateAsync({
        event: {
          title: values.title.trim(),
          description: values.description.trim(),
          startsAt: toIso(values.startsAt),
          endsAt: toIso(values.endsAt),
          ...(deadline !== undefined
            ? { registrationDeadline: toIso(deadline) }
            : {}),
          ...(location !== undefined ? { location } : {}),
          imageUrls: values.imageUrls,
          status: values.status,
        },
        sponsors: values.sponsors.map((sponsor) => ({
          companyName: sponsor.companyName,
          tier: sponsor.tier,
        })),
      });
      reset();
    } catch {
      // The mutation's error renders in the banner above the fields.
    }
  }

  const result = create.isSuccess ? create.data : undefined;

  return (
    <form className="event-form" noValidate onSubmit={handleSubmit(onSubmit)}>
      {create.error !== null ? (
        <p className="alert" role="alert">
          {authErrorMessage(create.error)}
        </p>
      ) : null}

      {result !== undefined ? (
        <>
          <p className="alert alert--success" role="status">
            {result.event.status === 'DRAFT'
              ? `Saved. ${result.event.title} is on the calendar as a draft.`
              : `Saved. ${result.event.title} is live.`}
            {result.attachedSponsors.length > 0
              ? ` ${countLabel(result.attachedSponsors.length, 'sponsor')} attached.`
              : ''}
          </p>

          {result.failedSponsors.length > 0 ? (
            <div className="alert event-form__failures" role="alert">
              <p>
                The event is saved, but{' '}
                {countLabel(result.failedSponsors.length, 'sponsor')} could not
                be attached:
              </p>
              <ul>
                {result.failedSponsors.map((failure) => (
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
        hint="What someone reads before they register."
        error={errors.description?.message}
        {...register('description', {
          required: 'Describe the event in a sentence or two.',
          minLength: {
            value: 10,
            message: 'Use at least 10 characters for the description.',
          },
          maxLength: {
            value: 5000,
            message: 'Keep the description under 5,000 characters.',
          },
        })}
      />

      <div className="event-form__dates">
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
      </div>

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

      <EventImageField
        urls={imageUrls}
        uploading={upload.isPending}
        error={
          upload.error !== null ? authErrorMessage(upload.error) : null
        }
        onUpload={(files) => void addImages(files)}
        onRemove={removeImage}
      />

      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <Combobox
            label="Visibility"
            value={field.value}
            options={VISIBILITY_OPTIONS}
            onChange={(value) => field.onChange(value)}
            placeholder="Choose visibility"
            searchPlaceholder="Search visibility…"
            hint="Drafts stay off the public calendar until you publish them."
            error={errors.status?.message}
          />
        )}
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
        disabled={isSubmitting || upload.isPending}
      >
        {isSubmitting
          ? 'Saving event'
          : upload.isPending
            ? 'Uploading images'
            : 'Create event'}
      </button>
      <p className="event-form__note">
        Images upload as you pick them. Sponsors attach as the event is created.
        You can edit the schedule after it is saved.
      </p>
    </form>
  );
}
