import type { EventStatus } from './events-api';

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

/** "1 event", "4 events". */
export function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
