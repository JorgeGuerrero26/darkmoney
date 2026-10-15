import { isoToDateStr } from "@darkmoney/shared/dates";
import { isExpense, isIncome } from "@darkmoney/shared/aggregations";
import { convertParityAmount } from "@darkmoney/shared/currency";
import { movementDisplayAccountId, movementDisplayAmount } from "@darkmoney/shared/movement-amounts";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import { isHistoryBalanceCorrection } from "./dashboard-health";
import { buildHistoryFactorAnalysis } from "./history-factor-analysis";
import { historyYearTotals, recentNetComparison } from "./history-view";

export function buildDashboardHistory(snapshot: WorkspaceSnapshot, ctx: ParityConversionCtx, year: number, now = new Date()) {
  if (!Number.isSafeInteger(year) || year < 1 || year > 9998) throw new Error("Elige un año válido.");
  const today = isoToDateStr(now.toISOString());
  const categories = new Map(snapshot.catalogs.categories.map(row => [row.id, row.name]));
  const months = Array.from({ length: 12 }, (_, index) => {
    const dateFrom = `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}-01`;
    const monthEnd = new Date(`${dateFrom}T12:00:00Z`); monthEnd.setUTCMonth(index + 1, 0);
    const isFuture = dateFrom > today;
    const dateTo = dateFrom.slice(0, 7) === today.slice(0, 7) ? today : monthEnd.toISOString().slice(0, 10);
    return { label: new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "UTC" }).format(new Date(`${dateFrom}T12:00:00Z`)), dateFrom, dateTo, isFuture,
      income: 0, expense: 0, net: 0, cumulativeNet: 0, unconvertedCount: 0, totalCount: 0, correctionIds: [] as number[], categories: [] as Array<{ categoryId: number | null; name: string; amount: number }>,
      movements: [] as Array<{ id: number; title: string; amount: number | null; income: boolean; correction: boolean; accountId: number | null }> };
  });
  for (const raw of snapshot.movements) {
    if (raw.status !== "posted" || new Date(raw.occurredAt) > now || !Number.isFinite(new Date(raw.occurredAt).getTime())) continue;
    const movement = { ...raw, categoryId: raw.categoryId ?? null, counterpartyId: raw.counterpartyId ?? null };
    const day = isoToDateStr(movement.occurredAt), month = months.find(row => day >= row.dateFrom && day <= row.dateTo && !row.isFuture);
    if (!month) continue;
    month.totalCount++;
    if (isHistoryBalanceCorrection(movement)) month.correctionIds.push(movement.id);
    if (!isIncome(movement) && !isExpense(movement)) continue;
    const accountId = movementDisplayAccountId(movement), income = isIncome(movement), correction = isHistoryBalanceCorrection(movement);
    const amount = convertParityAmount({ amount: movementDisplayAmount(movement), currencyCode: ctx.accountCurrencyMap.get(accountId ?? 0), baseCurrencyCode: ctx.baseCurrency, targetCurrencyCode: ctx.displayCurrency, exchangeRateMap: ctx.exchangeRateMap });
    month.movements.push({ id: movement.id, title: movement.description.trim() || (income ? "Ingreso" : "Gasto"), amount, income, correction, accountId });
    if (correction) continue;
    if (amount === null) { month.unconvertedCount++; continue; }
    if (income) month.income += amount;
    else {
      month.expense += amount;
      const existing = month.categories.find(row => row.categoryId === movement.categoryId);
      if (existing) existing.amount += amount;
      else month.categories.push({ categoryId: movement.categoryId, name: movement.categoryId === null ? "Sin categoría" : categories.get(movement.categoryId) ?? "Categoría", amount });
    }
  }
  let cumulative = 0;
  for (const month of months) { month.net = month.income - month.expense; if (!month.isFuture) cumulative += month.net; month.cumulativeNet = cumulative; month.movements.sort((a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0)); }
  const unconvertedCount = months.reduce((sum, month) => sum + month.unconvertedCount, 0);
  return { year, today, months, unconvertedCount, complete: unconvertedCount === 0,
    totals: unconvertedCount === 0 ? historyYearTotals(months) : null,
    comparison: unconvertedCount === 0 ? recentNetComparison(months) : null,
    factors: unconvertedCount === 0 ? buildHistoryFactorAnalysis({ months }) : null };
}

export function dashboardHistoryYears(snapshot: WorkspaceSnapshot, now = new Date()) {
  const year = Number(isoToDateStr(now.toISOString()).slice(0, 4));
  const years = new Set([year, year - 1]);
  for (const movement of snapshot.movements) { if (!Number.isFinite(new Date(movement.occurredAt).getTime())) continue; years.add(Number(isoToDateStr(movement.occurredAt).slice(0, 4))); }
  return [...years].sort((a, b) => b - a);
}
