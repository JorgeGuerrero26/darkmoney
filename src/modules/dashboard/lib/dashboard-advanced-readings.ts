import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { isExpense, isIncome } from "@darkmoney/shared/aggregations";
import { convertParityAmount } from "@darkmoney/shared/currency";
import { movementDisplayAccountId, movementDisplayAmount } from "@darkmoney/shared/movement-amounts";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import { isHistoryBalanceCorrection } from "./dashboard-health";

/** Full paginated history, native money and explicit missing FX; never chart-preconverted rows. */
export function buildAdvancedReadings(snapshot: WorkspaceSnapshot, ctx: ParityConversionCtx, now = new Date()) {
  const movements = snapshot.movements.map(m => ({ ...m, categoryId: m.categoryId ?? null, counterpartyId: m.counterpartyId ?? null }));
  const convert = (m: typeof movements[number]) => convertParityAmount({
    amount: movementDisplayAmount(m), currencyCode: ctx.accountCurrencyMap.get(movementDisplayAccountId(m) ?? 0),
    baseCurrencyCode: ctx.baseCurrency, targetCurrencyCode: ctx.displayCurrency, exchangeRateMap: ctx.exchangeRateMap,
  });
  const currentStart = startOfMonth(now);
  // Mobile visits days in chronological order, preserving source order inside each day.
  const current = movements.filter(m => new Date(m.occurredAt) >= currentStart && new Date(m.occurredAt) <= now)
    .sort((a, b) => format(new Date(a.occurredAt), "yyyy-MM-dd").localeCompare(format(new Date(b.occurredAt), "yyyy-MM-dd")));
  const totals = new Map<number | null, number>();
  let unconvertedCategories = 0;
  for (const m of current) {
    if (!isExpense(m)) continue;
    const amount = convert(m);
    if (amount === null) { unconvertedCategories++; continue; }
    totals.set(m.categoryId, (totals.get(m.categoryId) ?? 0) + amount);
  }
  const total = [...totals.values()].reduce((sum, amount) => sum + amount, 0);
  const rawHhi = total > 0 && unconvertedCategories === 0 ? [...totals.values()].reduce((sum, amount) => sum + (amount / total) ** 2, 0) : null;
  let topCategoryId: number | null = null, topAmount = 0;
  for (const [id, amount] of totals) if (amount > topAmount) { topCategoryId = id; topAmount = amount; }
  const concentration = {
    hhi: rawHhi === null ? null : Math.round(rawHhi * 1000) / 1000,
    label: rawHhi === null ? unconvertedCategories ? "Sin conversión completa" : "Sin datos" : rawHhi > 0.25 ? "Concentrado" : rawHhi > 0.15 ? "Moderado" : "Diversificado",
    topCategoryId: rawHhi === null ? null : topCategoryId,
    topCategory: rawHhi === null ? null : snapshot.catalogs.categories.find(c => c.id === topCategoryId)?.name ?? "Sin categoría",
    topShare: rawHhi === null ? null : Math.round(topAmount / total * 100),
    unconvertedCount: unconvertedCategories,
    totals: [...totals].map(([categoryId, amount]) => ({ categoryId, amount })),
    from: format(currentStart, "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd"),
  };
  const previousStart = startOfMonth(subMonths(now, 12)), previousEnd = endOfMonth(subMonths(now, 12));
  const sumWindow = (start: Date, end: Date) => {
    const rows = movements.filter(m => !isHistoryBalanceCorrection(m) && m.status === "posted" &&
      new Date(m.occurredAt) >= start && new Date(m.occurredAt) <= end && (isIncome(m) || isExpense(m)));
    let income = 0, expense = 0, unconverted = 0;
    for (const m of rows) {
      const amount = convert(m);
      if (amount === null) unconverted++;
      else if (isIncome(m)) income += amount;
      else expense += amount;
    }
    return { income, expense, unconverted, count: rows.length };
  };
  const cur = sumWindow(currentStart, now), prev = sumWindow(previousStart, previousEnd);
  const complete = cur.unconverted === 0 && prev.unconverted === 0;
  const hasHistory = prev.count >= 3;
  return { concentration, seasonal: {
    curIncome: cur.income, curExpense: cur.expense, prevIncome: prev.income, prevExpense: prev.expense,
    incomeDelta: hasHistory && complete && prev.income > 0 ? (cur.income - prev.income) / prev.income * 100 : null,
    expenseDelta: hasHistory && complete && prev.expense > 0 ? (cur.expense - prev.expense) / prev.expense * 100 : null,
    hasHistory, complete, unconvertedCount: cur.unconverted + prev.unconverted,
    currentFrom: format(currentStart, "yyyy-MM-dd"), currentTo: format(now, "yyyy-MM-dd"),
    previousFrom: format(previousStart, "yyyy-MM-dd"), previousTo: format(previousEnd, "yyyy-MM-dd"),
  } };
}
