// Mobile month model retained to derive scenario widths, never used as the calendar close.
import {addDays,differenceInCalendarDays,differenceInDays,endOfDay,endOfMonth,getDay,startOfDay,startOfMonth,subDays} from "date-fns";
import {incomeAmt,expenseAmt,inRange} from "@darkmoney/shared/aggregations";
import type {ParityConversionCtx as ConversionCtx} from "@darkmoney/shared/types";
import type {MovementRecord} from "../../../../types/domain";
import {buildFutureFlowItems} from "./legacy-future-flow-items";
import {simulateMonthEndCashflow} from "./cashflow-forecast";
type ScenarioMovement = MovementRecord & {categoryId:number|null;counterpartyId:number|null};
export type DashboardProjectionModel = {
  expectedBalance: number;
  conservativeBalance: number;
  optimisticBalance: number;
  monteCarloLowBalance: number;
  monteCarloMedianBalance: number;
  monteCarloHighBalance: number;
  pressureThreshold: number;
  pressureProbability: number;
  committedInflow: number;
  committedOutflow: number;
  variableIncomeProjection: number;
  variableExpenseProjection: number;
  confidence: number;
  confidenceLabel: string;
  remainingDays: number;
};
export function buildLegacyMonthProjection(
  movements: ScenarioMovement[],
  obligations: Array<{
    direction: string;
    pendingAmount: number;
    installmentAmount?: number | null;
    currencyCode: string;
    dueDate: string | null;
    status: string;
  }>,
  subscriptions: Array<{
    amount: number;
    currencyCode: string;
    nextDueDate: string;
    status: string;
  }>,
  recurringIncome: Array<{
    amount: number;
    currencyCode: string;
    nextExpectedDate: string;
    status: string;
  }>,
  currentVisibleBalance: number,
  ctx: ConversionCtx,
  now: Date = new Date(),
  simulationBalanceShift = 0,
): DashboardProjectionModel {
  const today = now;
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const remainingDays = Math.max(0, differenceInCalendarDays(monthEnd, today));
  const daysElapsed = Math.max(1, differenceInDays(today, monthStart) + 1);
  const monthItems = buildFutureFlowItems(
    obligations,
    subscriptions,
    recurringIncome,
    ctx.displayCurrency,
    ctx.exchangeRateMap,
    ctx.baseCurrency,
    now,
  ).filter((item) => item.date <= monthEnd);
  const committedInflow = monthItems.filter((item) => item.direction === "inflow").reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const committedOutflow = monthItems.filter((item) => item.direction === "outflow").reduce((sum, item) => sum + (item.amount ?? 0), 0);

  const variableIncomeObserved = movements
    .filter((movement) => inRange(movement, monthStart, today))
    .filter((movement) => movement.status === "posted")
    .filter((movement) => movement.movementType === "income" || movement.movementType === "refund")
    .reduce((sum, movement) => sum + incomeAmt(movement, ctx), 0);

  const variableExpenseObserved = movements
    .filter((movement) => inRange(movement, monthStart, today))
    .filter((movement) => movement.status === "posted")
    .filter((movement) => movement.movementType === "expense")
    .reduce((sum, movement) => sum + expenseAmt(movement, ctx), 0);

  const lastThirtyDays = Array.from({ length: 30 }, (_, index) => {
    const day = subDays(today, 29 - index);
    const start = startOfDay(day);
    const end = endOfDay(day);
    const income = movements
      .filter((movement) => inRange(movement, start, end))
      .filter((movement) => movement.status === "posted")
      .filter((movement) => movement.movementType === "income" || movement.movementType === "refund")
      .reduce((sum, movement) => sum + incomeAmt(movement, ctx), 0);
    const expense = movements
      .filter((movement) => inRange(movement, start, end))
      .filter((movement) => movement.status === "posted")
      .filter((movement) => movement.movementType === "expense")
      .reduce((sum, movement) => sum + expenseAmt(movement, ctx), 0);
    return { income, expense };
  });

  const incomeDailyAvg = variableIncomeObserved / daysElapsed;
  const expenseDailyAvg = variableExpenseObserved / daysElapsed;
  const incomeVarianceBase =
    lastThirtyDays.reduce((sum, day) => sum + Math.pow(day.income - incomeDailyAvg, 2), 0) /
    Math.max(lastThirtyDays.length, 1);
  const expenseVarianceBase =
    lastThirtyDays.reduce((sum, day) => sum + Math.pow(day.expense - expenseDailyAvg, 2), 0) /
    Math.max(lastThirtyDays.length, 1);
  const incomeVolatility =
    incomeDailyAvg > 0.009 ? Math.min(0.35, Math.sqrt(incomeVarianceBase) / Math.max(incomeDailyAvg, 1)) : 0.28;
  const expenseVolatility =
    expenseDailyAvg > 0.009 ? Math.min(0.35, Math.sqrt(expenseVarianceBase) / Math.max(expenseDailyAvg, 1)) : 0.18;

  const variableIncomeProjection = incomeDailyAvg * remainingDays;

  const weeklyExpenseTotals = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  for (const movement of movements.filter((m) => m.status === "posted" && m.movementType === "expense")) {
    const d = getDay(new Date(movement.occurredAt));
    const idx = d === 0 ? 6 : d - 1;
    weeklyExpenseTotals[idx].sum += expenseAmt(movement, ctx);
    weeklyExpenseTotals[idx].count += 1;
  }
  const weeksOfHistory = Math.floor(daysElapsed / 7);
  let variableExpenseProjection = expenseDailyAvg * remainingDays;
  if (weeksOfHistory >= 3 && expenseDailyAvg > 0.009) {
    const avgByDay = weeklyExpenseTotals.map((d) => (d.count > 0 ? d.sum / d.count : expenseDailyAvg));
    const meanDayAvg = avgByDay.reduce((s, v) => s + v, 0) / 7;
    if (meanDayAvg > 0.009) {
      const weights = avgByDay.map((v) => v / meanDayAvg);
      let remainingWeightedDays = 0;
      for (let i = 0; i < remainingDays; i++) {
        const d = addDays(today, i + 1);
        const dow = getDay(d);
        const idx = dow === 0 ? 6 : dow - 1;
        remainingWeightedDays += weights[idx];
      }
      variableExpenseProjection = expenseDailyAvg * remainingWeightedDays;
    }
  }

  const expectedBalance =
    currentVisibleBalance +
    committedInflow -
    committedOutflow +
    variableIncomeProjection -
    variableExpenseProjection;
  const conservativeBalance =
    currentVisibleBalance +
    committedInflow * 0.9 -
    committedOutflow * 1.03 +
    variableIncomeProjection * Math.max(0.45, 0.78 - incomeVolatility) -
    variableExpenseProjection * (1.04 + expenseVolatility);
  const optimisticBalance =
    currentVisibleBalance +
    committedInflow * 1.02 -
    committedOutflow +
    variableIncomeProjection * (1.05 + incomeVolatility * 0.35) -
    variableExpenseProjection * Math.max(0.72, 0.92 - expenseVolatility * 0.25);
  const monteCarlo = simulateMonthEndCashflow({
    currentBalance: currentVisibleBalance,
    committedInflow,
    committedOutflow,
    dailySamples: lastThirtyDays,
    incomeDailyAverage: incomeDailyAvg,
    expenseDailyAverage: expenseDailyAvg,
    remainingDays,
    balanceShift: simulationBalanceShift,
  });

  const activeDays = lastThirtyDays.filter((day) => day.income > 0.009 || day.expense > 0.009).length;
  const confidence = Math.round(
    Math.min(
      92,
      Math.max(
        34,
        Math.min(1, activeDays / 18) * 40 +
          Math.min(1, daysElapsed / 12) * 20 +
          Math.min(1, (30 - (incomeVolatility + expenseVolatility) * 32) / 30) * 32,
      ),
    ),
  );
  const confidenceLabel = confidence >= 78 ? "Alta" : confidence >= 60 ? "Media" : "Base corta";

  return {
    expectedBalance,
    conservativeBalance,
    optimisticBalance,
    monteCarloLowBalance: monteCarlo.lowBalance,
    monteCarloMedianBalance: monteCarlo.medianBalance,
    monteCarloHighBalance: monteCarlo.highBalance,
    pressureThreshold: monteCarlo.pressureThreshold,
    pressureProbability: monteCarlo.pressureProbability,
    committedInflow,
    committedOutflow,
    variableIncomeProjection,
    variableExpenseProjection,
    confidence,
    confidenceLabel,
    remainingDays,
  };
}
