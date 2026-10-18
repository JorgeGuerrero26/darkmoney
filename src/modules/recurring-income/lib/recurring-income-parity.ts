import type { RecurringIncomeSummary } from "../../../types/domain";

export const INCOME_PENDING_DATE_LIMIT = 400;

export function validIncomeCalendarDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validIncomeCadence(income: RecurringIncomeSummary) {
  return validIncomeCalendarDay(income.nextExpectedDate) && Number.isSafeInteger(income.intervalCount) && income.intervalCount > 0 &&
    ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"].includes(income.frequency) &&
    (income.dayOfMonth == null || (Number.isSafeInteger(income.dayOfMonth) && income.dayOfMonth >= 1 && income.dayOfMonth <= 31));
}

function addMonthsClamped(date: Date, months: number) {
  const day = date.getUTCDate();
  const result = new Date(date.getTime());
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const end = new Date(result); end.setUTCMonth(end.getUTCMonth() + 1, 0);
  const last = end.getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}

export function advanceNextExpectedDate(income: RecurringIncomeSummary): string {
  if (!validIncomeCadence(income)) throw new Error("El calendario del ingreso está por comprobar. Revisa fecha, frecuencia, intervalo y día del mes.");
  let date = new Date(`${income.nextExpectedDate}T12:00:00Z`);
  const { frequency, intervalCount } = income;
  switch (frequency) {
    case "daily": date.setUTCDate(date.getUTCDate() + intervalCount); break;
    case "weekly": date.setUTCDate(date.getUTCDate() + 7 * intervalCount); break;
    case "monthly": date = addMonthsClamped(date, intervalCount); break;
    case "quarterly": date = addMonthsClamped(date, 3 * intervalCount); break;
    case "yearly": date = addMonthsClamped(date, 12 * intervalCount); break;
    default: date.setUTCDate(date.getUTCDate() + intervalCount);
  }
  if (["monthly", "quarterly", "yearly"].includes(frequency) && income.dayOfMonth) {
    const end = new Date(date); end.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1, 0);
    const last = end.getUTCDate();
    date.setUTCDate(Math.min(income.dayOfMonth, last));
  }
  const next = Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "";
  if (!validIncomeCalendarDay(next) || next <= income.nextExpectedDate) throw new Error("El calendario del ingreso no puede avanzar a una fecha válida.");
  return next;
}

export function pendingArrivalCalendar(income: RecurringIncomeSummary, today: string) {
  const empty = { dates: [] as string[], hasMore: false, unavailable: false };
  if (income.status === "paused" || income.status === "cancelled") return empty;
  if (income.status !== "active" || !validIncomeCadence(income) || !validIncomeCalendarDay(today)) return { ...empty, unavailable: true };
  const dates: string[] = [];
  let cursor = income.nextExpectedDate;
  while (cursor < today && dates.length < INCOME_PENDING_DATE_LIMIT) {
    dates.push(cursor);
    try { cursor = advanceNextExpectedDate({ ...income, nextExpectedDate: cursor }); }
    catch { return { ...empty, unavailable: true }; }
  }
  return { dates, hasMore: cursor < today, unavailable: false };
}

/** Compatibility for date-only consumers; UI counts must also inspect hasMore/unavailable. */
export function pendingArrivalDates(income: RecurringIncomeSummary, today: string): string[] {
  return pendingArrivalCalendar(income, today).dates;
}

export function summarizePendingIncome(items: RecurringIncomeSummary[], today: string) {
  return items.reduce((result, item) => {
    const calendar = pendingArrivalCalendar(item, today);
    result.count += calendar.dates.length;
    if (calendar.dates.length) result.incomeCount++;
    if (calendar.unavailable) result.unavailableCount++;
    result.hasMore ||= calendar.hasMore;
    return result;
  }, { count: 0, incomeCount: 0, unavailableCount: 0, hasMore: false });
}

export function monthlyEquivalent(income: RecurringIncomeSummary): number {
  const amount = income.amountInBaseCurrency;
  if (amount == null) return 0;
  return monthlyRecurringIncomeEquivalent(amount, income.frequency, income.intervalCount);
}

/** Same annualized cadence as mobile; custom is an interval measured in days. */
export function monthlyRecurringIncomeEquivalent(amount: number, frequency: RecurringIncomeSummary["frequency"], intervalCount: number) {
  const interval = Math.max(1, Math.floor(intervalCount) || 1);
  switch (frequency) {
    case "daily":
    case "custom": return amount * 365 / (12 * interval);
    case "weekly": return amount * 52 / (12 * interval);
    case "quarterly": return amount / (3 * interval);
    case "yearly": return amount / (12 * interval);
    case "monthly": return amount / interval;
    default: return amount;
  }
}

export function summarizeRecurringIncomeMonthly(items: RecurringIncomeSummary[], baseCurrencyCode: string) {
  const summary = { monthlyTotal: 0, activeCount: 0, pausedCount: 0, comparableActiveCount: 0, excludedActiveCount: 0 };
  const base = baseCurrencyCode.toUpperCase();
  for (const item of items) {
    if (item.status === "paused") summary.pausedCount += 1;
    if (item.status !== "active") continue;
    summary.activeCount += 1;
    const converted = item.amountInBaseCurrency;
    const amount = item.currencyCode.toUpperCase() === base ? item.amount
      : converted != null && Number.isFinite(converted) && (converted > 0 || (converted === 0 && item.amount === 0)) ? converted : null;
    if (amount === null || !Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(amount * 100)) ||
      !Number.isFinite(item.intervalCount) || !["daily", "weekly", "monthly", "quarterly", "yearly", "custom"].includes(item.frequency)) {
      summary.excludedActiveCount += 1; continue;
    }
    summary.monthlyTotal += monthlyRecurringIncomeEquivalent(amount, item.frequency, item.intervalCount);
    summary.comparableActiveCount += 1;
  }
  return summary;
}
