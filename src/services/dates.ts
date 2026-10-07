export const DAY_MS = 86_400_000;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_LONG = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function startOfDay(date: Date): Date {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** Whole calendar days from `earlier` to `later`, in local time. DST-safe. */
export function diffCalendarDays(later: Date, earlier: Date): number {
  return Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / DAY_MS);
}

export function msUntilNextDay(now: Date): number {
  return startOfDay(addDays(now, 1)).getTime() - now.getTime();
}

/** "OCT 04" */
export function formatStamp(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}`;
}

/** "OCT 04", or "OCT 04 2025" when the year differs from `now`'s. */
export function formatStampFor(date: Date, now: Date): string {
  const stamp = formatStamp(date);
  return date.getFullYear() === now.getFullYear() ? stamp : `${stamp} ${date.getFullYear()}`;
}

/** "TUE 07 OCT" */
export function formatDayHeader(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]}`;
}

/** "OCTOBER 2026" */
export function formatMonthYear(date: Date): string {
  return `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

/** Local "YYYY-MM-DD", the format of <input type="date">. */
export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses "YYYY-MM-DD" as local noon, so the calendar day never shifts. */
export function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getMonth() !== Number(match[2]) - 1) return null;
  return date;
}

/** Same calendar day as `day`, carrying the current wall-clock time when it is today. */
export function atDay(day: Date, now: Date): Date {
  if (diffCalendarDays(now, day) === 0) return new Date(now.getTime());
  const d = startOfDay(day);
  d.setHours(12);
  return d;
}
