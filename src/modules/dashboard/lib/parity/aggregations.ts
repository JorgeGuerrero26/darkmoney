/**
 * PARITY PORT de DarkMoneyApp/features/dashboard/lib/aggregations.ts.
 * Clasificación de movimientos, períodos y montos convertidos — mantener en sincronía.
 */

import { convertParityAmount } from "./currency";
import {
  startOfDay,
  startOfMonth,
  startOfWeekMonday,
  subDays,
  subMonths,
} from "./date-utils";
import {
  movementActsAsExpense,
  movementActsAsIncome,
  movementDisplayAccountId,
  movementDisplayAmount,
} from "./movement-amounts";
import type { ParityConversionCtx, ParityMovement, Period } from "./types";

export function isIncome(m: ParityMovement) {
  if (m.status !== "posted") return false;
  if (m.movementType === "obligation_opening") return false;
  return movementActsAsIncome(m);
}

export function isExpense(m: ParityMovement) {
  if (m.status !== "posted") return false;
  if (m.movementType === "obligation_opening") return false;
  return movementActsAsExpense(m);
}

export function isTransfer(m: ParityMovement) {
  return m.status === "posted" && m.movementType === "transfer";
}

export function isCategorizedCashflow(m: ParityMovement) {
  if (m.status !== "posted") return false;
  return (
    m.movementType === "income" ||
    m.movementType === "refund" ||
    m.movementType === "expense" ||
    m.movementType === "subscription_payment" ||
    m.movementType === "obligation_payment"
  );
}

export function inRange(m: ParityMovement, start: Date, end: Date) {
  const d = new Date(m.occurredAt);
  return d >= start && d <= end;
}

export function getPeriodBounds(
  period: Period,
  now: Date,
): { curStart: Date; curEnd: Date; prevStart: Date; prevEnd: Date } {
  if (period === "today") {
    const curStart = startOfDay(now);
    const curEnd = now;
    const yesterday = subDays(now, 1);
    const prevStart = startOfDay(yesterday);
    const prevEnd = yesterday;
    return { curStart, curEnd, prevStart, prevEnd };
  }
  if (period === "week") {
    const curStart = startOfWeekMonday(now);
    const curEnd = now;
    const prevStart = subDays(curStart, 7);
    const prevEnd = subDays(now, 7);
    return { curStart, curEnd, prevStart, prevEnd };
  }
  if (period === "month") {
    const curStart = startOfMonth(now);
    const curEnd = now;
    const prevMonthDate = subMonths(now, 1);
    const prevStart = startOfMonth(prevMonthDate);
    const dayOfMonth = now.getDate();
    const prevEnd = new Date(
      prevMonthDate.getFullYear(),
      prevMonthDate.getMonth(),
      dayOfMonth,
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
    );
    return { curStart, curEnd, prevStart, prevEnd };
  }
  // last_30
  const curStart = subDays(now, 29);
  const curEnd = now;
  const prevStart = subDays(now, 59);
  const prevEnd = subDays(now, 30);
  return { curStart, curEnd, prevStart, prevEnd };
}

function convertedMovementAmount(m: ParityMovement, ctx: ParityConversionCtx): number {
  const raw = movementDisplayAmount(m);
  const accountId = movementDisplayAccountId(m);
  const currency = accountId ? ctx.accountCurrencyMap.get(accountId) : undefined;
  return (
    convertParityAmount({
      amount: raw,
      currencyCode: currency,
      baseCurrencyCode: ctx.baseCurrency,
      targetCurrencyCode: ctx.displayCurrency,
      exchangeRateMap: ctx.exchangeRateMap,
    }) ?? 0
  );
}

export function incomeAmt(m: ParityMovement, ctx: ParityConversionCtx): number {
  return convertedMovementAmount(m, ctx);
}

export function expenseAmt(m: ParityMovement, ctx: ParityConversionCtx): number {
  return convertedMovementAmount(m, ctx);
}

export function transferAmt(m: ParityMovement, ctx: ParityConversionCtx): number {
  return convertedMovementAmount(m, ctx);
}

export type PeriodTotalsParity = { income: number; expense: number; net: number };

export function selectPeriodTotals(
  movements: ParityMovement[],
  start: Date,
  end: Date,
  ctx: ParityConversionCtx,
): PeriodTotalsParity {
  let income = 0;
  let expense = 0;
  for (const movement of movements) {
    if (!inRange(movement, start, end)) continue;
    if (isIncome(movement)) income += incomeAmt(movement, ctx);
    else if (isExpense(movement)) expense += expenseAmt(movement, ctx);
  }
  return { income, expense, net: income - expense };
}
