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
  switch (income.frequency) {
    case "daily": return amount * 30;
    case "weekly": return amount * 52 / 12;
    case "quarterly": return amount / 3;
    case "yearly": return amount / 12;
    default: return amount;
  }
}
