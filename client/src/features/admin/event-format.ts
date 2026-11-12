import type { EventStatus } from './events-api';

const DAY = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const TIME = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});
const MONTH = new Intl.DateTimeFormat(undefined, { month: 'short' });
const DAY_ONLY = new Intl.DateTimeFormat(undefined, { day: '2-digit' });
const YEAR = new Intl.DateTimeFormat(undefined, { year: 'numeric' });

export const STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/** The three lines of the date tab: MAR / 14 / 2027. */
export type DateTab = {
  month: string;
  day: string;
  year: string;
};

export function dateTab(startsAt: string): DateTab {
  const date = new Date(startsAt);
  return {
    month: MONTH.format(date).toUpperCase(),
    day: DAY_ONLY.format(date),
    year: YEAR.format(date),
  };
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * One readable line for the schedule: times when the event starts and ends the
 * same day, dates otherwise. Times are the visitor's local time; the API
 * stores UTC.
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

/** "1 event", "4 events". */
export function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
