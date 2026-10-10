import { addDays, addWeeks, format, parseISO, startOfWeek } from "date-fns";
import type { Launch } from "@workspace/api-client-react";

const FMT = "yyyy-MM-dd";

export interface DayTotals {
  date: string;
  label: string;
  booked: number;
  available: number;
  total: number;
  outings: number;
}

/** Today's calendar date in Los Angeles as yyyy-MM-dd (no timestamp math on date-only strings). */
export function laToday(now: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/** Monday (yyyy-MM-dd) of the calendar week containing the date. */
export function weekStartOf(date: string): string {
  return format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), FMT);
}

export function currentLaWeekStart(now: Date = new Date()): string {
  return weekStartOf(laToday(now));
}

export function shiftWeek(weekStart: string, weeks: number): string {
  return format(addWeeks(parseISO(weekStart), weeks), FMT);
}

/** Seven yyyy-MM-dd dates, Monday through Sunday. */
export function weekDates(weekStart: string): string[] {
  const s = parseISO(weekStartOf(weekStart));
  return Array.from({ length: 7 }, (_, i) => format(addDays(s, i), FMT));
}

/** Sum seats over all launches (all shifts, all boats) per date; missing dates are zero. */
export function aggregateWeek(launches: readonly Launch[], weekStart: string): DayTotals[] {
  return weekDates(weekStart).map((date) => {
    let booked = 0, available = 0, outings = 0;
    for (const l of launches) {
      if (l.date === date) { booked += l.bookedSeats; available += l.availableSeats; outings += 1; }
    }
    return { date, label: format(parseISO(date), "EEE d"), booked, available, total: booked + available, outings };
  });
}

/** Exact-day filter; null returns every launch unchanged. */
export function filterByDay<T extends { date: string }>(launches: readonly T[], day: string | null): T[] {
  return day ? launches.filter((l) => l.date === day) : [...launches];
}
