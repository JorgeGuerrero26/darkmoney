import { format } from "date-fns";
import { isExpense, isIncome } from "@darkmoney/shared/aggregations";
import { isoToDateStr } from "@darkmoney/shared/dates";
import { convertParityAmount } from "@darkmoney/shared/currency";
import { movementDisplayAccountId, movementDisplayAmount } from "@darkmoney/shared/movement-amounts";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { WorkspaceSnapshot } from "../../../../services/queries/workspace-data";
import type { SharedObligationSummary } from "../../../../types/domain";
import { isHistoryBalanceCorrection } from "../dashboard-health";
import type { buildDashboardCashflow } from "./build-dashboard-cashflow";
import { buildLegacyMonthProjection } from "./legacy-month-scenarios";
import { buildPaymentOptimizationPlan } from "./payment-optimization";
import { obligationViewerDirection } from "./projection-perspective";
import { limaClock, limaCalendarTimestamp } from "./lima-calendar";
function calendarDay(value: string | null | undefined) {
  if (!value) return null;
  try {
    const day = isoToDateStr(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(`${day}T12:00:00Z`).toISOString().slice(0,10) === day ? day : null;
  } catch { return null; }
}

/** Display bands use the mobile widths, anchored to the actual calendar, not a second expected close. */
export function buildDashboardScenarios(snapshot: WorkspaceSnapshot, shared: SharedObligationSummary[], cashflow: ReturnType<typeof buildDashboardCashflow>, ctx: ParityConversionCtx, now = new Date()) {
  const localNow = limaClock(now), monthKey = format(localNow, "yyyy-MM"), firstMonth = cashflow.projection.months[0];
  const convert = (amount: number, currencyCode?: string | null) => convertParityAmount({ amount, currencyCode, baseCurrencyCode: ctx.baseCurrency, targetCurrencyCode: ctx.displayCurrency, exchangeRateMap: ctx.exchangeRateMap });
  const rows = snapshot.movements.filter(row => row.workspaceId === snapshot.workspace.id && row.status === "posted" && new Date(row.occurredAt) <= now
    && new Date(row.occurredAt).getTime() >= now.getTime() - 90 * 86400000 && !isHistoryBalanceCorrection(row))
    .map(row => ({ ...row, categoryId: row.categoryId ?? null, counterpartyId: row.counterpartyId ?? null }));
  const historyMissing = rows.filter(row => (isExpense(row) || isIncome(row)) && (() => {
    const amount = convert(movementDisplayAmount(row), ctx.accountCurrencyMap.get(movementDisplayAccountId(row) ?? 0));
    return amount === null || !Number.isFinite(amount);
  })()).length;
  const obligations = new Map(snapshot.obligations.filter(row => row.workspaceId === snapshot.workspace.id).map(row => [row.id, row]));
  // The shared reader already checks access. Its owner's workspace differs intentionally.
  for (const row of shared) if (!obligations.has(row.id)) obligations.set(row.id, row);
  const active = [...obligations.values()].filter(row => ["active", "defaulted"].includes(row.status) && row.pendingAmount > 0.009);
  let obligationMissing = 0;
  const priorities = active.flatMap(row => {
    const amount = convert(row.installmentAmount && row.installmentAmount > 0 ? Math.min(row.pendingAmount, row.installmentAmount) : row.pendingAmount, row.currencyCode);
    if (amount === null || !Number.isFinite(amount)) { obligationMissing++; return []; }
    const direction = obligationViewerDirection(row);
    const lines = cashflow.projection.months.flatMap(month => direction === "receivable" ? month.inflows : month.outflows)
      .filter(line => line.refId === row.id && line.kind === (direction === "receivable" ? "obligation_receivable" : "obligation_payable"))
      .sort((a,b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
    const next = lines[0], dueDate = calendarDay(next?.dueDate ?? row.dueDate);
    if (row.paymentPlan && !next) return []; // No guessed installment outside the loaded calendar.
    return [{ id: row.id, title: row.title, direction, amount: next?.amount ?? amount,
      // Date-only strings otherwise parse as UTC and become yesterday in Peru inside the mobile scorer.
      dueDate: dueDate ? `${dueDate}T12:00:00` : null, status: row.status, counterparty: row.counterparty }];
  });
  const missing = historyMissing + obligationMissing + cashflow.liquid.unconvertedCount + cashflow.projection.unconvertedCount + (cashflow.typicalSpend.unconvertedCount ?? 0);
  const reasons = [
    ...(!firstMonth || firstMonth.monthKey !== monthKey ? ["El calendario todavía no corresponde al mes actual de Lima."] : []),
    ...(missing ? ["Faltan conversiones o importes válidos en el historial, las cuentas o los compromisos. No mostramos escenarios ni prioridades sobre totales parciales."] : []),
    ...(!Number.isFinite(cashflow.liquid.total) || cashflow.projection.months.some(month => !Number.isFinite(month.closingBalance)) ? ["Hay saldos no válidos en el calendario."] : []),
  ];
  if (reasons.length) return { available: false as const, monthKey, reasons, model: null, recommendations: [] };
  const normalizeObligation = (row: typeof active[number]) => ({ direction: obligationViewerDirection(row), pendingAmount: row.pendingAmount, installmentAmount: row.installmentAmount, currencyCode: row.currencyCode, dueDate: calendarDay(row.dueDate), status: row.status });
  const normalizedRows = rows.map(row => ({ ...row, occurredAt: limaCalendarTimestamp(row.occurredAt) }));
  const subscriptions = snapshot.subscriptions.filter(row => row.workspaceId === snapshot.workspace.id && calendarDay(row.nextDueDate)).map(row => ({ ...row, nextDueDate: calendarDay(row.nextDueDate)! }));
  const incomes = snapshot.recurringIncome.filter(row => row.workspaceId === snapshot.workspace.id && calendarDay(row.nextExpectedDate)).map(row => ({ ...row, nextExpectedDate: calendarDay(row.nextExpectedDate)! }));
  const args = [normalizedRows, active.map(normalizeObligation), subscriptions, incomes, cashflow.liquid.total, ctx, localNow] as const;
  const legacy = buildLegacyMonthProjection(...args);
  const shift = firstMonth.closingBalance - legacy.expectedBalance;
  // Same random samples/seed, translated BEFORE counting pressure; mobile only translates the displayed quantiles.
  const calibrated = shift === 0 ? legacy : buildLegacyMonthProjection(...args, shift);
  const model = { ...calibrated, expectedBalance: firstMonth.closingBalance,
    conservativeBalance: legacy.conservativeBalance + shift, optimisticBalance: legacy.optimisticBalance + shift,
    committedInflow: cashflow.monthEnd.committedInflow, committedOutflow: cashflow.monthEnd.committedOutflow,
    variableIncomeProjection: 0, variableExpenseProjection: cashflow.monthEnd.variableExpenseProjection };
  const week = cashflow.windows.find(row => row.days === 7)!;
  const recommendations = buildPaymentOptimizationPlan({ obligations: priorities, currentBalance: cashflow.liquid.total,
    weekExpectedInflow: week.expectedInflow, weekExpectedOutflow: week.expectedOutflow, pressureProbability: model.pressureProbability, today: localNow });
  return { available: true as const, monthKey, reasons: [], model, recommendations };
}
