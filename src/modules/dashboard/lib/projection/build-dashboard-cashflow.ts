import { format, startOfMonth } from "date-fns";
import { convertParityAmount } from "@darkmoney/shared/currency";
import { expenseAmt, isExpense, selectPeriodTotals } from "@darkmoney/shared/aggregations";
import { movementDisplayAccountId, movementDisplayAmount } from "@darkmoney/shared/movement-amounts";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { WorkspaceSnapshot } from "../../../../services/queries/workspace-data";
import type { SharedObligationSummary } from "../../../../types/domain";
import { buildCashflowCalendar, typicalMonthlySpend } from "./cashflow-calendar";
import { isOneOffSpend, monthlyDiscretionarySpend } from "./discretionary-history";
import { liquidBalance } from "./liquid-balance";
import { plannedCashEffect } from "./planned-cash-effect";
import { projectionFlowItems, windowsFromFlowItems } from "./flow-windows";

export type ProjectionSupplement = {
  workspaceId: number;
  oneOffTypeIds: number[];
  scheduledChanges: Array<{ id: number; changes: Array<{ effectiveDate: string; amount: number }> }>;
};

/** Pure counterpart of mobile useCashflowProjection. Snapshot history is fully paginated. */
export function buildDashboardCashflow(
  snapshot: WorkspaceSnapshot,
  shared: SharedObligationSummary[],
  supplement: ProjectionSupplement,
  ctx: ParityConversionCtx,
  now = new Date(),
  months = 2,
) {
  if (snapshot.workspace.id !== supplement.workspaceId) throw new Error("La proyección pertenece a otro espacio.");
  const convert = (amount: number, currency: string) => convertParityAmount({
    amount, currencyCode: currency, baseCurrencyCode: ctx.baseCurrency,
    targetCurrencyCode: ctx.displayCurrency, exchangeRateMap: ctx.exchangeRateMap,
  });
  const liquid = liquidBalance(snapshot.accounts, convert);
  const cards = snapshot.accounts.filter(a => !a.isArchived && a.type === "credit_card");
  const cardIds = new Set(cards.map(a => a.id));
  const oneOffTypeIds = new Set(supplement.oneOffTypeIds);
  const categoryDefaults = new Map(snapshot.catalogs.categories.map(c => [c.id, c.defaultSpendTypeId ?? null]));
  const coveredFrom = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const movements = snapshot.movements.map(m => ({ ...m, categoryId: m.categoryId ?? null, counterpartyId: m.counterpartyId ?? null }));
  const history = (cardId?: number) => monthlyDiscretionarySpend({
    movements, months: 6, earliestCoveredDate: coveredFrom, now,
    expenseAmountOf: movement => {
      if (!isExpense(movement) || isOneOffSpend(movement, oneOffTypeIds, categoryDefaults)) return 0;
      const accountId = movementDisplayAccountId(movement);
      // Calendar converts the card line from its native currency. Do not convert twice.
      if (cardId !== undefined) return accountId === cardId ? movementDisplayAmount(movement) : 0;
      return accountId !== null && cardIds.has(accountId) ? 0 : expenseAmt(movement, ctx);
    },
  });
  const totals = history();
  const typicalSpend = {
    typical: typicalMonthlySpend(totals), monthsUsed: totals.length,
    months: totals.map((total, i) => ({
      monthKey: format(new Date(now.getFullYear(), now.getMonth() - totals.length + i, 1), "yyyy-MM"), total,
    })),
  };
  const accountTypes = new Map(snapshot.accounts.map(a => [a.id, a.type]));
  const plannedMovements = snapshot.movements.flatMap(movement => {
    if (movement.status !== "planned" || new Date(movement.occurredAt) <= now) return [];
    const effect = plannedCashEffect(movement, accountTypes);
    if (!effect) return [];
    return [{
      id: movement.id, description: movement.description || (effect.signedAmount > 0 ? "Ingreso planificado" : "Gasto planificado"),
      signedAmount: effect.signedAmount,
      currencyCode: (effect.accountId ? ctx.accountCurrencyMap.get(effect.accountId) : undefined) ?? ctx.baseCurrency,
      occurredAt: movement.occurredAt,
    }];
  });
  // Same merge rule as mobile: an owned obligation wins over a duplicate shared entry.
  const byId = new Map(snapshot.obligations.map(o => [o.id, o]));
  for (const obligation of shared) if (!byId.has(obligation.id)) byId.set(obligation.id, obligation);
  const changes = new Map(supplement.scheduledChanges.map(row => [row.id, row.changes]));
  const projection = buildCashflowCalendar({
    startingBalance: liquid.total, fromDate: format(now, "yyyy-MM-dd"), months,
    typicalDiscretionarySpend: typicalSpend.typical, convert,
    subscriptions: snapshot.subscriptions,
    recurringIncome: snapshot.recurringIncome.map(income => ({ ...income, scheduledChanges: changes.get(income.id) ?? [] })),
    obligations: [...byId.values()].map(o => ({
      ...o, paymentPlan: o.paymentPlan ?? null, principalCurrentAmount: o.currentPrincipalAmount ?? o.principalAmount,
      openingPrincipal: o.principalAmount,
      payments: o.events.filter(e => e.eventType === "payment").map(e => ({ amount: e.amount, date: e.eventDate })),
    })),
    plannedMovements,
    creditCards: cards.map(card => ({
      id: card.id, name: card.name, currencyCode: card.currencyCode,
      currentDebt: Math.max(0, -Number(card.currentBalance)), paymentDay: card.paymentDay ?? null,
      typicalMonthlySpend: typicalMonthlySpend(history(card.id)),
    })),
  });
  const firstMonth = projection.months[0];
  const sum = (rows: typeof firstMonth.inflows) => rows.reduce((total, line) => total + line.amount, 0);
  const monthToDate = selectPeriodTotals(movements, startOfMonth(now), now, ctx);
  return {
    projection, liquid, typicalSpend,
    windows: windowsFromFlowItems(projectionFlowItems(projection.months, now), liquid.total, now),
    monthEnd: {
      expectedBalance: firstMonth.closingBalance,
      committedInflow: sum(firstMonth.inflows.filter(line => line.kind !== "typical_spend")),
      committedOutflow: sum(firstMonth.outflows.filter(line => line.kind !== "typical_spend")),
      variableIncomeProjection: 0,
      variableExpenseProjection: sum(firstMonth.outflows.filter(line => line.kind === "typical_spend")),
      variableIncomeObserved: monthToDate.income,
      variableExpenseObserved: monthToDate.expense,
      daysElapsed: now.getDate(),
      remainingDays: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate(),
    },
  };
}
