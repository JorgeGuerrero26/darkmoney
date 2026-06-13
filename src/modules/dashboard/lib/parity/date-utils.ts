/**
 * PARITY PORT — réplica de los helpers de date-fns que usa el dashboard móvil
 * (DarkMoneyApp). Mantener semántica idéntica; Perú no tiene DST así que el
 * truncado por milisegundos es equivalente al de date-fns.
 */

const DAY_MS = 86_400_000;

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function subDays(date: Date, amount: number) {
  return addDays(date, -amount);
}

export function subMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() - amount);
  return next;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Lunes como inicio de semana (weekStartsOn: 1), igual que el móvil. */
export function startOfWeekMonday(date: Date) {
  const next = startOfDay(date);
  const currentDay = next.getDay();
  const diff = currentDay === 0 ? -6 : 1 - currentDay;
  next.setDate(next.getDate() + diff);
  return next;
}

/** date-fns differenceInDays: días completos entre fechas, truncando hacia 0. */
export function differenceInDays(later: Date, earlier: Date) {
  return Math.trunc((later.getTime() - earlier.getTime()) / DAY_MS);
}

/** date-fns getDay: 0 = domingo … 6 = sábado. */
export function getDay(date: Date) {
  return date.getDay();
}
