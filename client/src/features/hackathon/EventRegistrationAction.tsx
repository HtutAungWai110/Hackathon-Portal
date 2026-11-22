import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { TextAreaField } from '../../components/TextAreaField';
import { TextField } from '../../components/TextField';
import { authErrorMessage } from '../../lib/auth-error';
import { formatMoment } from '../../lib/event-display';
import { EMAIL_PATTERN } from '../../lib/validation';
import { useRegisterForEvent, useRegistrationStatus } from './use-registration';

type EventRegistrationActionProps = {
  eventId: string;
  eventTitle: string;
};

type RegistrationFormValues = {
  additionalMessage: string;
  companyName: string;
  companyEmail: string;
};

/**
 * The public page's registration control. Registration is an application, so
 * the form asks for the introduction an organiser reads before accepting
 * someone; the company fields are optional because most people apply alone.
 */
export function EventRegistrationAction({
  eventId,
  eventTitle,
}: EventRegistrationActionProps) {
  const status = useRegistrationStatus(eventId, true);
  const register = useRegisterForEvent(eventId, eventTitle);
  const [formOpen, setFormOpen] = useState(false);
  const form = useForm<RegistrationFormValues>({
    defaultValues: {
      additionalMessage: '',
      companyName: '',
      companyEmail: '',
    },
  });

  function closeForm() {
    form.reset();
    setFormOpen(false);
  }

  async function submit(values: RegistrationFormValues) {
    const companyName = values.companyName.trim();
    const companyEmail = values.companyEmail.trim();
    try {
      await register.mutateAsync({
        additionalMessage: values.additionalMessage.trim(),
        ...(companyName.length > 0 ? { companyName } : {}),
        ...(companyEmail.length > 0 ? { companyEmail } : {}),
      });
      closeForm();
    } catch {
      // The mutation reports through the message queue; the banner in the form
      // keeps the reason next to the fields so it can be corrected.
    }
  }

  if (status.isPending) {
    return (
      <p className="hackathon-registration-note" role="status">
        Checking your registration…
      </p>
    );
  }

  if (status.error !== null) {
    return (
      <div
        className="hackathon-registration-note hackathon-registration-note--error"
        role="alert"
      >
        <span>We could not check your registration.</span>
        <button
          className="text-link"
          type="button"
          onClick={() => void status.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  const registeredAt = status.data.registeredAt;
  if (status.data.registered) {
    const when = registeredAt === null ? null : formatMoment(registeredAt);
    return (
      <p className="hackathon-registration-note hackathon-registration-note--done">
        Your application is with the organiser
        {when === null ? '.' : ` since ${when}.`}
      </p>
    );
  }

  if (!status.data.open) {
    return (
      <p className="hackathon-registration-note">Registration is closed.</p>
    );
  }

  if (!formOpen) {
    return (
      <div className="hackathon-registration-action">
        <button
          className="button button--primary"
          type="button"
          onClick={() => setFormOpen(true)}
        >
          Register
        </button>
        <p className="hackathon-registration-hint">
          Registration is an application: the organiser reads your introduction
          before accepting you onto a team.
        </p>
      </div>
    );
  }

  return (
    <form
      className="hackathon-registration-form"
      noValidate
      onSubmit={form.handleSubmit(submit)}
    >
      <p className="hackathon-registration-form__intro">
        Describe yourself as a capable member for the team. Say what you have
        built, what you are good at, and what you want to work on. This is what
        the organiser reads first.
      </p>

      <TextAreaField
        label="Why you belong on a team"
        hint="Required. This is your application, not a one line note."
        error={form.formState.errors.additionalMessage?.message}
        rows={6}
        autoFocus
        placeholder="I have shipped…"
        {...form.register('additionalMessage', {
          required: 'Write a short introduction for the organiser.',
          validate: (value) =>
            value.trim().length > 0 ||
            'Write a short introduction for the organiser.',
          maxLength: {
            value: 2_000,
            message: 'Keep it under 2,000 characters.',
          },
        })}
      />

      <div className="hackathon-registration-form__row">
        <TextField
          label="Company or team (optional)"
          hint="Leave blank when you are applying on your own."
          error={form.formState.errors.companyName?.message}
          autoComplete="organization"
          {...form.register('companyName', {
            maxLength: {
              value: 120,
              message: 'Use 120 characters or fewer.',
            },
          })}
        />

        <TextField
          label="Company email (optional)"
          hint="Only if the organiser should reach a team address."
          error={form.formState.errors.companyEmail?.message}
          type="email"
          autoComplete="email"
          {...form.register('companyEmail', {
            validate: (value) =>
              value.trim().length === 0 ||
              EMAIL_PATTERN.test(value.trim()) ||
              'Enter a valid email address.',
          })}
        />
      </div>

      <div className="hackathon-registration-form__actions">
        <button
          className="button button--primary"
          type="submit"
          disabled={register.isPending}
        >
          {register.isPending ? 'Sending…' : 'Send application'}
        </button>
        <button
          className="button button--quiet"
          type="button"
          disabled={register.isPending}
          onClick={closeForm}
        >
          Cancel
        </button>
      </div>

      {register.error !== null ? (
        <p
          className="hackathon-registration-note hackathon-registration-note--error"
          role="alert"
        >
          {authErrorMessage(register.error)}
        </p>
      ) : null}
    </form>
  );
}
