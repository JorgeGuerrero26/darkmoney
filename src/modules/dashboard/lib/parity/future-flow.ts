/**
 * PARITY PORT de DarkMoneyApp/features/dashboard/lib/dashboard-builders.ts
 * (buildFutureFlowWindows) — mantener en sincronía. Bordes de fecha EXACTOS al
 * móvil: dueDate ∈ [today, addDays(today, N)] sin startOfDay/endOfDay.
 */

import { convertParityAmount } from "./currency";
import { addDays } from "./date-utils";
import { parseDisplayDate } from "./dates";
import type {
  ParityObligation,
  ParityRecurringIncome,
  ParitySubscription,
} from "./types";

export type FutureFlowWindow = {
  days: number;
  expectedInflow: number;
  expectedOutflow: number;
  estimatedBalance: number;
  scheduledCount: number;
  receivableCount: number;
  payableCount: number;
  /** Ítems cuyo monto no pudo convertirse a la moneda activa (sumaron 0). */
  unconvertedCount: number;
};

export function buildFutureFlowWindows(
  obligations: ParityObligation[],
  subscriptions: ParitySubscription[],
  recurringIncome: ParityRecurringIncome[],
  displayCurrency: string,
  exchangeRateMap: Map<string, number>,
  currentVisibleBalance: number,
  baseCurrency: string = displayCurrency,
  now: Date = new Date(),
): FutureFlowWindow[] {
  const today = now;

  function convert(amount: number, currencyCode: string) {
    return convertParityAmount({
      amount,
      currencyCode,
      baseCurrencyCode: baseCurrency,
      targetCurrencyCode: displayCurrency,
      exchangeRateMap,
    });
  }

  function obligationDueAmount(obligation: { pendingAmount: number; installmentAmount?: number | null }) {
    if (obligation.installmentAmount && obligation.installmentAmount > 0) {
      return Math.min(obligation.pendingAmount, obligation.installmentAmount);
    }
    return obligation.pendingAmount;
  }

  return [7, 15, 30].map((days) => {
    const horizon = addDays(today, days);
    let expectedInflow = 0;
    let expectedOutflow = 0;
    let receivableCount = 0;
    let payableCount = 0;
    let scheduledCount = 0;
    let unconvertedCount = 0;

    for (const obligation of obligations) {
      if (!obligation.dueDate || obligation.pendingAmount <= 0.009 || obligation.status === "paid") continue;
      const dueDate = parseDisplayDate(obligation.dueDate);
      if (dueDate < today || dueDate > horizon) continue;
      const convertedAmount = convert(obligationDueAmount(obligation), obligation.currencyCode);
      if (convertedAmount === null) unconvertedCount += 1;
      scheduledCount += 1;
      if (obligation.direction === "receivable") {
        receivableCount += 1;
        expectedInflow += convertedAmount ?? 0;
      } else {
        payableCount += 1;
        expectedOutflow += convertedAmount ?? 0;
      }
    }

    for (const subscription of subscriptions) {
      if (subscription.status !== "active") continue;
      const dueDate = parseDisplayDate(subscription.nextDueDate);
      if (dueDate < today || dueDate > horizon) continue;
      scheduledCount += 1;
      const convertedAmount = convert(subscription.amount, subscription.currencyCode);
      if (convertedAmount === null) unconvertedCount += 1;
      expectedOutflow += convertedAmount ?? 0;
    }

    for (const income of recurringIncome) {
      if (income.status !== "active") continue;
      const expectedDate = parseDisplayDate(income.nextExpectedDate);
      if (expectedDate < today || expectedDate > horizon) continue;
      scheduledCount += 1;
      const convertedAmount = convert(income.amount, income.currencyCode);
      if (convertedAmount === null) unconvertedCount += 1;
      expectedInflow += convertedAmount ?? 0;
    }

    return {
      days,
      estimatedBalance: currentVisibleBalance + expectedInflow - expectedOutflow,
      expectedInflow,
      expectedOutflow,
      payableCount,
      receivableCount,
      scheduledCount,
      unconvertedCount,
    };
  });
}
