import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import { buildHealthScore } from "@darkmoney/shared/health";
import { convertParityAmount } from "@darkmoney/shared/currency";
import { isExpense, isIncome } from "@darkmoney/shared/aggregations";
import { movementDisplayAccountId, movementDisplayAmount } from "@darkmoney/shared/movement-amounts";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import type { SharedObligationSummary } from "../../../types/domain";
import { obligationViewerDirection } from "./projection/projection-perspective";

/** Same history contract as mobile health-view/history-view; not the selected chart period. */
export function healthBaselineFromMonths(months: readonly { income: number; expense: number }[]) {
  const active = months.filter(month => month.income > 0.009 || month.expense > 0.009);
  const monthsUsed = active.length;
  const income = active.reduce((sum, month) => sum + month.income, 0);
  const expense = active.reduce((sum, month) => sum + month.expense, 0);
  const averageIncome = monthsUsed > 0 ? income / monthsUsed : 0;
  const averageExpense = monthsUsed > 0 ? expense / monthsUsed : 0;
  return { averageIncome, averageExpense, averageNet: averageIncome - averageExpense, monthsUsed };
}

export function isHistoryBalanceCorrection(movement: { movementType: string; description: string }) {
  return movement.movementType === "adjustment" || /^correcci[oó]n\s*[·:—-]\s*\S/i.test(movement.description.trim());
}

export function periodSavingsRate(months: readonly { income: number; expense: number }[]) {
  const income = months.reduce((sum, month) => sum + month.income, 0);
  const expense = months.reduce((sum, month) => sum + month.expense, 0);
  return income > 0 ? (income - expense) / income * 100 : null;
}

export function reserveDays(liquidBalance: number, monthlyExpense: number) {
  return monthlyExpense > 0 ? Math.round(liquidBalance / monthlyExpense * 30) : 0;
}

export function buildDashboardHealth(input: {
  snapshot: WorkspaceSnapshot; shared: SharedObligationSummary[]; ctx: ParityConversionCtx;
  liquid: { total: number; unconvertedCount: number }; commitmentsOutflow: number | null;
  obligationsReady: boolean; historyAvailable?: boolean; now?: Date;
}) {
  const { snapshot, ctx, liquid, commitmentsOutflow, obligationsReady, historyAvailable = true, now = new Date() } = input;
  const convert = (amount: number, currencyCode?: string | null) => convertParityAmount({
    amount, currencyCode, baseCurrencyCode: ctx.baseCurrency, targetCurrencyCode: ctx.displayCurrency,
    exchangeRateMap: ctx.exchangeRateMap,
  });
  const movements = snapshot.movements.map(m => ({ ...m, categoryId: m.categoryId ?? null, counterpartyId: m.counterpartyId ?? null }));
  const historical = movements.filter(m => !isHistoryBalanceCorrection(m) && (isIncome(m) || isExpense(m))).map(m => ({
    movement: m, date: new Date(m.occurredAt),
    amount: convert(movementDisplayAmount(m), ctx.accountCurrencyMap.get(movementDisplayAccountId(m) ?? 0)),
  }));
  const months = Array.from({ length: 7 }, (_, i) => {
    const date = subMonths(now, 6 - i), start = startOfMonth(date), end = i === 6 ? now : endOfMonth(date);
    const rows = historical.filter(row => row.date >= start && row.date <= end);
    const income = rows.filter(row => isIncome(row.movement)).reduce((sum, row) => sum + (row.amount ?? 0), 0);
    const expense = rows.filter(row => isExpense(row.movement)).reduce((sum, row) => sum + (row.amount ?? 0), 0);
    return { monthKey: format(date, "yyyy-MM"), income, expense, rate: income > 0 ? (income - expense) / income * 100 : null,
      unconvertedCount: rows.filter(row => row.amount === null).length };
  });
  const complete = months.slice(0, -1), current = months[6];
  const baseline = healthBaselineFromMonths(complete);
  const unconvertedHistory = complete.reduce((sum, month) => sum + month.unconvertedCount, 0);
  const historyReady = historyAvailable && unconvertedHistory === 0;
  const validRates = complete.flatMap(month => month.rate === null ? [] : [month.rate]);
  const difference = (validRates[validRates.length - 1] ?? 0) - (validRates[0] ?? 0);
  const savings = {
    months, averagePct: historyReady ? periodSavingsRate(complete) : null,
    currentPct: current.unconvertedCount === 0 ? current.rate : null,
    trend: !historyReady || validRates.length < 3 ? "insuficiente" : difference > 3 ? "mejorando" : difference < -3 ? "empeorando" : "estable",
  };
  const incomes = complete.map(month => month.income);
  const enoughIncome = historyReady && incomes.filter(amount => amount > 0).length >= 3;
  const mean = incomes.reduce((sum, value) => sum + value, 0) / incomes.length;
  const variance = incomes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / incomes.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
  const stabilityScore = enoughIncome ? Math.round(Math.max(0, Math.min(100, (1 - cv) * 100))) : null;
  const incomeStability = {
    score: stabilityScore, cvPct: enoughIncome ? Math.round(cv * 100) : null,
    label: !historyReady ? "Sin historial completo" : stabilityScore === null ? "Historial insuficiente" : stabilityScore >= 75 ? "Muy estable" : stabilityScore >= 50 ? "Moderado" : "Variable",
  };
  const recent = historical.filter(row => row.date >= subDays(now, 29) && row.date <= now && isExpense(row.movement));
  const last30Expense = recent.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const monthlyExpense = baseline.averageExpense > 0 ? baseline.averageExpense : last30Expense;
  const reserveReady = historyReady && liquid.unconvertedCount === 0 && monthlyExpense > 0 &&
    (baseline.averageExpense > 0 || recent.every(row => row.amount !== null));
  const days = reserveReady ? reserveDays(liquid.total, monthlyExpense) : null;
  const cashCushion = {
    days, daysWithCommitments: reserveReady && commitmentsOutflow !== null ? reserveDays(liquid.total, monthlyExpense + commitmentsOutflow) : null,
    monthlyExpense, label: days === null ? "Sin referencia" : days >= 90 ? "Sólido" : days >= 30 ? "Adecuado" : "Corto",
    coverageMonths: reserveReady ? liquid.total / monthlyExpense : null,
  };

  const byId = new Map(snapshot.obligations.map(o => [o.id, o]));
  for (const o of input.shared) if (!byId.has(o.id)) byId.set(o.id, o);
  const obligations = [...byId.values()];
  let totalPayable = 0, overdueCount = 0, unconvertedPayables = 0;
  for (const o of obligations) {
    // A shared receivable is a payment from the invitee's side, as in the projection.
    if (obligationViewerDirection(o) !== "payable" || o.status !== "active") continue;
    const amount = convert(o.pendingAmount, o.currencyCode);
    if (amount === null) unconvertedPayables++;
    else totalPayable += amount;
    if (o.dueDate && new Date(o.dueDate) < now) overdueCount++;
  }
  const receivable = obligations.filter(o => obligationViewerDirection(o) === "receivable");
  const due = receivable.filter(o => o.dueDate && new Date(o.dueDate) >= subDays(now, 30) && new Date(o.dueDate) <= now);
  const resolved = due.filter(o => o.status === "paid").length;
  const collectionRate = obligationsReady && due.length > 0 ? Math.round(resolved / due.length * 100) : null;
  const collection = {
    rate: collectionRate, resolved: obligationsReady ? resolved : 0, total: obligationsReady ? due.length : 0,
    label: !obligationsReady ? "Sin comprobar" : receivable.length === 0 ? "Sin cobros" : due.length === 0 ? "Nada vencido" : collectionRate! >= 80 ? "Eficiente" : collectionRate! >= 50 ? "Parcial" : "Bajo",
  };
  const healthInputs = {
    liquidMoney: liquid.total, averageMonthlyExpense: monthlyExpense,
    periodIncome: baseline.averageIncome, periodNet: baseline.averageNet, totalPayable, overdueCount,
  };
  const scoreReady = historyReady && baseline.monthsUsed > 0 && baseline.averageIncome > 0 && monthlyExpense > 0 &&
    liquid.unconvertedCount === 0 && unconvertedPayables === 0 && obligationsReady;
  const result = buildHealthScore(healthInputs);
  const indicators = result.indicators.map(indicator => {
    if (indicator.key === "savings") return { ...indicator, interpret: result.savingsRate === null ? "Faltan ingresos para calcular la tasa." :
      result.savingsRate >= 0.2 ? "Retienes al menos el 20% del ingreso." : result.savingsRate >= 0.1 ? "Retienes entre el 10% y el 20% del ingreso." : result.savingsRate >= 0 ? "Retienes menos del 10% del ingreso." : "Los gastos superan los ingresos del período histórico." };
    if (indicator.key === "coverage") return { ...indicator, interpret: cashCushion.coverageMonths === null ? "Falta una referencia de gasto." :
      cashCushion.coverageMonths >= 6 ? "La reserva cubre al menos seis meses." : cashCushion.coverageMonths >= 3 ? "La reserva cubre entre tres y seis meses." : cashCushion.coverageMonths >= 1 ? "La reserva cubre entre uno y tres meses." : "La reserva cubre menos de un mes." };
    return indicator;
  });
  const health = {
    ...result, score: scoreReady ? result.score : null, tone: scoreReady ? result.tone : "warning" as const,
    savingsRate: savings.averagePct === null ? null : savings.averagePct / 100,
    coverageMonths: cashCushion.coverageMonths,
    debtToIncomeRatio: historyReady && obligationsReady && unconvertedPayables === 0 ? result.debtToIncomeRatio : null,
    headline: scoreReady ? result.headline : "Faltan datos completos para valorar tu salud financiera.",
    indicators: scoreReady ? indicators : [],
  };
  return { health, healthInputs, scoreReady, baseline, savings, incomeStability, cashCushion, collection,
    obligationsReady, unconvertedHistory, unconvertedCurrent: current.unconvertedCount, unconvertedPayables, unconvertedLiquid: liquid.unconvertedCount };
}
