/**
 * PARITY PORT de DarkMoneyApp/features/dashboard/lib/advanced-builders.ts
 * (buildMonthProjectionModel) — mantener en sincronía. SIN Monte Carlo ni
 * escenarios conservador/optimista (la web no los muestra).
 *
 * expectedBalance = patrimonio visible + comprometido a 30 días (obligaciones
 * con lógica de cuota, suscripciones activas e ingresos fijos activos) +
 * proyección variable (income/refund y expense) con ajuste por día de semana.
 */

import { expenseAmt, inRange, incomeAmt } from "./aggregations";
import {
  addDays,
  differenceInDays,
  endOfDay,
  endOfMonth,
  getDay,
  startOfDay,
  startOfMonth,
  subDays,
} from "./date-utils";
import { buildFutureFlowWindows } from "./future-flow";
import type {
  ParityConversionCtx,
  ParityMovement,
  ParityObligation,
  ParityRecurringIncome,
  ParitySubscription,
} from "./types";

export type ParityMonthProjection = {
  expectedBalance: number;
  committedInflow: number;
  committedOutflow: number;
  variableIncomeProjection: number;
  variableExpenseProjection: number;
  variableIncomeObserved: number;
  variableExpenseObserved: number;
  daysElapsed: number;
  remainingDays: number;
  unconvertedCount: number;
};

export function buildMonthProjection(
  movements: ParityMovement[],
  obligations: ParityObligation[],
  subscriptions: ParitySubscription[],
  recurringIncome: ParityRecurringIncome[],
  currentVisibleBalance: number,
  ctx: ParityConversionCtx,
  now: Date = new Date(),
): ParityMonthProjection {
  const today = now;
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const remainingDays = Math.max(0, differenceInDays(monthEnd, today));
  const daysElapsed = Math.max(1, differenceInDays(today, monthStart) + 1);
  const futureWindows = buildFutureFlowWindows(
    obligations,
    subscriptions,
    recurringIncome,
    ctx.displayCurrency,
    ctx.exchangeRateMap,
    currentVisibleBalance,
    ctx.baseCurrency,
    now,
  );
  const monthWindow = futureWindows[2];

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

  const incomeDailyAvg = variableIncomeObserved / daysElapsed;
  const expenseDailyAvg = variableExpenseObserved / daysElapsed;

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
    monthWindow.expectedInflow -
    monthWindow.expectedOutflow +
    variableIncomeProjection -
    variableExpenseProjection;

  return {
    expectedBalance,
    committedInflow: monthWindow.expectedInflow,
    committedOutflow: monthWindow.expectedOutflow,
    variableIncomeProjection,
    variableExpenseProjection,
    variableIncomeObserved,
    variableExpenseObserved,
    daysElapsed,
    remainingDays,
    unconvertedCount: monthWindow.unconvertedCount,
  };
}

/**
 * Serie de los últimos 30 días (paridad con lastThirtyDays del móvil) —
 * exportada por si la web quiere mostrar actividad reciente con el mismo corte.
 */
export function buildLastThirtyDaysVariableSeries(
  movements: ParityMovement[],
  ctx: ParityConversionCtx,
  now: Date = new Date(),
) {
  return Array.from({ length: 30 }, (_, index) => {
    const day = subDays(now, 29 - index);
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
}
