/**
 * Date copy shared by the admin ledger and the public event page. Times are
 * the visitor's local time; the API stores UTC.
 */
const DAY = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const TIME = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * One readable line for the schedule: times when the event starts and ends the
 * same day, dates otherwise.
 */
export function formatEventRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Schedule pending';
  }
  if (sameDay(start, end)) {
    return `${DAY.format(start)}, ${TIME.format(start)}–${TIME.format(end)}`;
  }
  return `${DAY.format(start)} – ${DAY.format(end)}`;
}

export function formatDeadline(deadline: string | null): string | null {
  if (deadline === null) {
    return null;
  }
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `Closes ${DAY.format(date)} at ${TIME.format(date)}`;
}

/**
 * A stored moment as one line, for a registration that was taken at a specific
 * time rather than for an event's schedule.
 */
export function formatMoment(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${DAY.format(date)}, ${TIME.format(date)}`;
}
