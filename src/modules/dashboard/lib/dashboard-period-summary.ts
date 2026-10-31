import { isExpense, isIncome } from "@darkmoney/shared/aggregations";
import { convertParityAmount } from "@darkmoney/shared/currency";
import { movementDisplayAccountId, movementDisplayAmount } from "@darkmoney/shared/movement-amounts";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { MovementRecord } from "../../../types/domain";
import { isHistoryBalanceCorrection } from "./dashboard-health";

/** Los importes de un período solo son un total si todas las conversiones están disponibles. */
export function buildDashboardPeriodSummary(movements: MovementRecord[], ctx: ParityConversionCtx) {
  let income = 0, expense = 0, unconvertedCount = 0;
  for (const raw of movements) {
    const movement = { ...raw, categoryId: raw.categoryId ?? null, counterpartyId: raw.counterpartyId ?? null };
    if (isHistoryBalanceCorrection(movement) || (!isIncome(movement) && !isExpense(movement))) continue;
    const incoming = isIncome(movement);
    const account = movementDisplayAccountId(movement);
    const currency = ctx.accountCurrencyMap.get(account ?? 0) ?? (incoming
      ? movement.destinationCurrencyCode ?? movement.sourceCurrencyCode
      : movement.sourceCurrencyCode ?? movement.destinationCurrencyCode);
    const nativeAmount = movementDisplayAmount(movement);
    const converted = currency && Number.isFinite(nativeAmount) ? convertParityAmount({
      amount: nativeAmount, currencyCode: currency, baseCurrencyCode: ctx.baseCurrency,
      targetCurrencyCode: ctx.displayCurrency, exchangeRateMap: ctx.exchangeRateMap,
    }) : null;
    if (converted === null || !Number.isFinite(converted)) { unconvertedCount++; continue; }
    if (incoming) income += converted; else expense += converted;
  }
  return { income, expense, unconvertedCount };
}
