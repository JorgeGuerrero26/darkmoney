import type { RecurringIncomeSummary } from "../../../types/domain";

function addMonthsClamped(date: Date, months: number) {
  const day = date.getUTCDate();
  const result = new Date(date.getTime());
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}

export function advanceNextExpectedDate(income: RecurringIncomeSummary): string {
  const [year, month, day] = income.nextExpectedDate.split("-").map(Number);
  let date = new Date(Date.UTC(year, month - 1, day, 12));
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
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(income.dayOfMonth, last));
  }
  return date.toISOString().slice(0, 10);
}

export function pendingArrivalDates(income: RecurringIncomeSummary, today: string): string[] {
  if (income.status !== "active") return [];
  const dates: string[] = [];
  let cursor = income.nextExpectedDate;
  while (cursor < today && dates.length < 400) {
    dates.push(cursor);
    const next = advanceNextExpectedDate({ ...income, nextExpectedDate: cursor });
    if (next <= cursor) break;
    cursor = next;
  }
  return dates;
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
