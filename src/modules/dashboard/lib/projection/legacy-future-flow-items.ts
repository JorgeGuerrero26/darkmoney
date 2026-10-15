// Mobile legacy one-occurrence ledger, used only to preserve scenario band widths.
// Actual commitments and the displayed close continue to use cashflow-calendar.
import { addDays } from "date-fns";
import { convertParityAmount } from "@darkmoney/shared/currency";
import { isoToDateStr } from "@darkmoney/shared/dates";
import { obligationViewerDirection } from "./projection-perspective";
function parseDisplayDate(value: string) {
  const day = isoToDateStr(value); const [y,m,d] = day.split("-").map(Number); return new Date(y,m-1,d);
}
function convertDashboardCurrency(amount: number, currencyCode: string, displayCurrency: string, exchangeRateMap: Map<string,number>, baseCurrency: string) {
  return convertParityAmount({amount,currencyCode,targetCurrencyCode:displayCurrency,exchangeRateMap,baseCurrencyCode:baseCurrency});
}
export type FutureFlowItem = {
  /** `card` y `planned` solo los produce la proyección: el pago de una tarjeta y lo anotado a futuro. */
  source: "obligation" | "subscription" | "recurring-income" | "card" | "planned";
  id: number;
  title: string;
  date: Date;
  direction: "inflow" | "outflow";
  amount: number | null;
};
export function buildFutureFlowItems(
  obligations: Array<{ id?: number; title?: string; direction: string; pendingAmount: number; installmentAmount?: number | null; currencyCode: string; dueDate: string | null; status: string }>,
  subscriptions: Array<{ id?: number; name?: string; amount: number; currencyCode: string; nextDueDate: string; status: string }>,
  recurringIncome: Array<{ id?: number; name?: string; amount: number; currencyCode: string; nextExpectedDate: string; status: string }>,
  displayCurrency: string,
  exchangeRateMap: Map<string, number>,
  baseCurrency: string,
  now: Date = new Date(),
): FutureFlowItem[] {
  const horizon = addDays(now, 30);
  const inWindow = (date: Date) => date >= now && date <= horizon;
  const items: FutureFlowItem[] = [];
  for (const obligation of obligations) {
    if (!obligation.dueDate || obligation.pendingAmount <= 0.009 || obligation.status === "paid") continue;
    const date = parseDisplayDate(obligation.dueDate);
    if (!inWindow(date)) continue;
    const amount = obligation.installmentAmount && obligation.installmentAmount > 0
      ? Math.min(obligation.pendingAmount, obligation.installmentAmount) : obligation.pendingAmount;
    items.push({ source: "obligation", id: obligation.id ?? 0, title: obligation.title || "Crédito o deuda", date,
      direction: obligationViewerDirection(obligation) === "receivable" ? "inflow" : "outflow",
      amount: convertDashboardCurrency(amount, obligation.currencyCode, displayCurrency, exchangeRateMap, baseCurrency) });
  }
  for (const subscription of subscriptions) {
    if (subscription.status !== "active") continue;
    const date = parseDisplayDate(subscription.nextDueDate);
    if (!inWindow(date)) continue;
    items.push({ source: "subscription", id: subscription.id ?? 0, title: subscription.name || "Suscripción", date,
      direction: "outflow", amount: convertDashboardCurrency(subscription.amount, subscription.currencyCode, displayCurrency, exchangeRateMap, baseCurrency) });
  }
  for (const income of recurringIncome) {
    if (income.status !== "active") continue;
    const date = parseDisplayDate(income.nextExpectedDate);
    if (!inWindow(date)) continue;
    items.push({ source: "recurring-income", id: income.id ?? 0, title: income.name || "Ingreso fijo", date,
      direction: "inflow", amount: convertDashboardCurrency(income.amount, income.currencyCode, displayCurrency, exchangeRateMap, baseCurrency) });
  }
  return items.sort((a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title));
}
