/** Plain local date / time wording for upcoming events ("Tomorrow · 10:00 AM"). Pure; `now` is injectable. */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "Today", "Tomorrow", otherwise "Oct 14". */
export function dayLabel(ms: number, now = Date.now()): string {
  const days = Math.round((startOfDay(new Date(ms)) - startOfDay(new Date(now))) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "Oct 14" (the calendar always shows the real date). */
export const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const whenLabel = (ms: number, now = Date.now()) => `${dayLabel(ms, now)} · ${timeLabel(ms)}`;

/** "October" (with the year when it is not the current one). */
export function monthLabel(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: "long" } : { month: "long", year: "numeric" });
}
