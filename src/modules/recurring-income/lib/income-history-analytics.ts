import { analyticsMonthKeys } from "../../../lib/analytics-money";
import { accountDisplayRate } from "../../accounts/lib/account-worth";
import type { ExchangeRateSummary, RecurringIncomeOccurrence } from "../../../types/domain";

/** Dates in occurrences are Lima calendar dates, never local-machine midnight instants. */
export function buildIncomeHistoryAnalytics(occurrences: RecurringIncomeOccurrence[], baseCurrency: string, rates: ExchangeRateSummary[], today: string) {
  const rows = occurrences.filter(row => row.status !== "missed" && row.actualDate !== null).map(row => {
    const rate = accountDisplayRate(rates, row.currencyCode, baseCurrency);
    const converted = rate === null ? null : row.amount * rate;
    return { ...row, actualDate: row.actualDate!, amountInBaseCurrency: converted !== null && Number.isFinite(converted) ? converted : null,
      latenessDays: Math.max(0, Math.round((Date.parse(`${row.actualDate}T12:00:00Z`) - Date.parse(`${row.expectedDate}T12:00:00Z`)) / 86_400_000)) };
  }).sort((a, b) => b.actualDate.localeCompare(a.actualDate) || b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  const months = analyticsMonthKeys(new Date(`${today}T12:00:00Z`)).map(key => ({ key,
    label: new Intl.DateTimeFormat("es-PE", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${key}-01T12:00:00Z`)), amount: 0, count: 0, excludedCount: 0 }));
  const byMonth = new Map(months.map(month => [month.key, month]));
  let comparableTotal = 0, comparableCount = 0;
  const currencies = new Map<string, number>();
  for (const row of rows) {
    currencies.set(row.currencyCode, (currencies.get(row.currencyCode) ?? 0) + row.amount);
    const month = byMonth.get(row.actualDate.slice(0, 7));
    if (row.amountInBaseCurrency === null) { if (month) month.excludedCount++; continue; }
    comparableTotal += row.amountInBaseCurrency; comparableCount++;
    if (month) { month.amount += row.amountInBaseCurrency; month.count++; }
  }
  const onTimeCount = rows.filter(row => row.status === "on_time").length;
  const lateRows = rows.filter(row => row.status === "late"), positiveDelays = lateRows.filter(row => row.latenessDays > 0);
  return { rows, months, currencies: [...currencies].map(([currencyCode, amount]) => ({ currencyCode, amount })), comparableTotal, comparableCount,
    excludedCount: rows.length - comparableCount, averageBase: comparableCount ? comparableTotal / comparableCount : 0,
    maximumBase: rows.reduce((maximum, row) => Math.max(maximum, row.amountInBaseCurrency ?? 0), 0),
    onTimeCount, lateCount: lateRows.length, averageLateDays: positiveDelays.length ? positiveDelays.reduce((sum, row) => sum + row.latenessDays, 0) / positiveDelays.length : 0,
    punctualityPct: rows.length ? onTimeCount / rows.length * 100 : 0, latest: rows[0] ?? null };
}

export function incomeArrivalDelay(expected: string, actual: string | null) {
  if (!actual) return "No llegó";
  const days = Math.round((Date.parse(`${actual}T12:00:00Z`) - Date.parse(`${expected}T12:00:00Z`)) / 86_400_000);
  return days === 0 ? "A tiempo" : `Llegó ${Math.abs(days)} ${Math.abs(days) === 1 ? "día" : "días"} ${days > 0 ? "después" : "antes"}`;
}
