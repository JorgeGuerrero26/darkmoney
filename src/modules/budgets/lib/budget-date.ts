/** Presupuestos y movimientos usan días de calendario de Perú, no días UTC. */
export function validBudgetDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function budgetLimaDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return iso.slice(0, 10);
  return new Date(timestamp - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function budgetDateFrom(ymd: string): string {
  return `${ymd}T05:00:00.000Z`;
}

export function budgetDateTo(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 5) - 1).toISOString();
}

export function budgetTodayLima(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
