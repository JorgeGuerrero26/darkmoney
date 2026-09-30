import type { MovementRecord } from "../types/domain";
import { movementActsAsIncome } from "../modules/movements/lib/movement-form";

export type CurrencyAmount = { amount: number; currencyCode: string; amountInBaseCurrency?: number | null };

/** Never relabel an unconverted native amount as workspace currency. */
export function comparableAmount(item: CurrencyAmount, baseCurrencyCode: string): number | null {
  if (item.amountInBaseCurrency != null && Number.isFinite(item.amountInBaseCurrency)) return item.amountInBaseCurrency;
  return item.currencyCode.toUpperCase() === baseCurrencyCode.toUpperCase() && Number.isFinite(item.amount) ? item.amount : null;
}

export function currencyTotals(items: CurrencyAmount[], baseCurrencyCode: string): CurrencyAmount[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!Number.isFinite(item.amount)) continue;
    const converted = comparableAmount(item, baseCurrencyCode);
    const code = (converted == null ? item.currencyCode : baseCurrencyCode).toUpperCase();
    totals.set(code, (totals.get(code) ?? 0) + (converted ?? item.amount));
  }
  if (!totals.size) totals.set(baseCurrencyCode.toUpperCase(), 0);
  return [...totals].map(([currencyCode, amount]) => ({ currencyCode, amount }));
}

export function movementAnalyticsAmount(item: MovementRecord, baseCurrencyCode: string): CurrencyAmount {
  const income = movementActsAsIncome(item);
  return {
    amount: Math.abs((income ? item.destinationAmount : item.sourceAmount) ?? 0),
    currencyCode: (income ? item.destinationCurrencyCode : item.sourceCurrencyCode) ?? baseCurrencyCode,
    amountInBaseCurrency: income ? item.destinationAmountInBaseCurrency : item.sourceAmountInBaseCurrency,
  };
}

export function analyticsMonthKey(value: string | Date): string {
  // Date-only values are already local calendar dates, not midnight UTC.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit" }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

export function analyticsMonthKeys(now = new Date(), count = 12): string[] {
  const [year, month] = analyticsMonthKey(now).split("-").map(Number);
  return Array.from({ length: count }, (_, index) => new Date(Date.UTC(year, month - count + index, 1)).toISOString().slice(0, 7));
}
