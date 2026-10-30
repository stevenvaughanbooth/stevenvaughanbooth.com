import type { Role } from '@/content/profile';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Months of headroom after today, so the current step ends inside the chart. */
const HEADROOM = 6;

export interface Step {
  key: string;
  displayTitle: string;
  title: string;
  start: string;
  end: string;
  focus?: string;
  current: boolean;
  /** 1 for the first role, rising by one per role. */
  level: number;
  /** Left edge and width as fractions of the time axis. */
  x: number;
  width: number;
  /** "2 years, 6 months" for past roles, "Current role" for the present one. */
  tenure: string;
}

export interface YearTick {
  year: number;
  x: number;
}

/** Converts "Aug 2018" (or "Present") to a month count. */
export function monthIndex(label: string, now: Date): number {
  if (label.toLowerCase() === 'present') return now.getFullYear() * 12 + now.getMonth();
  const [month = '', year = ''] = label.split(' ');
  const m = MONTHS.indexOf(month);
  const y = Number(year);
  if (m < 0 || !Number.isInteger(y)) throw new Error(`Unrecognised date: ${label}`);
  return y * 12 + m;
}

export function formatTenure(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (rest) parts.push(`${rest} ${rest === 1 ? 'month' : 'months'}`);
  return parts.join(', ');
}

const round = (value: number) => Math.round(value * 10000) / 10000;

/** Lays roles out as a rising step chart on a time axis from January of the start year to now. */
export function buildTimeline(roles: readonly Role[], startYear: number, now: Date = new Date()) {
  const origin = startYear * 12;
  const today = monthIndex('Present', now);
  const span = today + HEADROOM - origin;
  const x = (month: number) => round((month - origin) / span);

  const steps: Step[] = [...roles]
    .sort((a, b) => monthIndex(a.start, now) - monthIndex(b.start, now))
    .map((role, index) => {
      const start = monthIndex(role.start, now);
      const end = monthIndex(role.end, now);
      const current = role.end.toLowerCase() === 'present';
      return {
        key: `${role.title}-${role.start}`,
        displayTitle: role.displayTitle,
        title: role.title,
        start: role.start,
        end: role.end,
        focus: role.focus,
        current,
        level: index + 1,
        x: x(start),
        width: round((end - start) / span),
        tenure: current ? 'Current role' : formatTenure(end - start),
      };
    });

  const years: YearTick[] = [];
  for (let year = startYear; year * 12 <= today; year++) years.push({ year, x: x(year * 12) });

  return { steps, years };
}
