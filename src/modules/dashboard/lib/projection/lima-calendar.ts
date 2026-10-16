import { isoToDateStr } from "@darkmoney/shared/dates";

export function limaCalendarDay(value: string | null | undefined) {
  if (!value) return null;
  try {
    const day = isoToDateStr(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day ? day : null;
  } catch { return null; }
}

/** Date-fns works on local wall clocks. Projection dates must stay in Lima, not the browser's zone. */
export function limaClock(date: Date) {
  const peru = new Date(date.getTime() - 5 * 3600000);
  return new Date(peru.getUTCFullYear(), peru.getUTCMonth(), peru.getUTCDate(), peru.getUTCHours(), peru.getUTCMinutes(), peru.getUTCSeconds(), peru.getUTCMilliseconds());
}

/** Analysis-only timestamp; never send this wall-clock representation back to the server. */
export function limaCalendarTimestamp(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T12:00:00`;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? limaClock(date).toISOString() : value;
}
