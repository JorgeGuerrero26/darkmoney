/**
 * PARITY PORT de DarkMoneyApp/app/(app)/dashboard.tsx (netWorth).
 * Patrimonio = cuentas con includeInNetWorth && !isArchived, monto
 * (currentBalanceInBaseCurrency ?? currentBalance) convertido base→display.
 */

import { convertParityAmount } from "./currency";
import type { ParityConversionCtx } from "./types";

export type ParityNetWorthAccount = {
  currencyCode: string;
  currentBalance: number;
  currentBalanceInBaseCurrency?: number | null;
  isArchived: boolean;
  includeInNetWorth: boolean;
};

export type ParityNetWorthResult = {
  amount: number;
  unconvertedCount: number;
};

export function buildParityNetWorth(
  accounts: ParityNetWorthAccount[],
  ctx: ParityConversionCtx,
): ParityNetWorthResult {
  let amount = 0;
  let unconvertedCount = 0;

  for (const account of accounts) {
    if (!account.includeInNetWorth || account.isArchived) continue;
    const raw = account.currentBalanceInBaseCurrency ?? account.currentBalance;
    // El móvil convierte desde la moneda base (el saldo ya viene en base).
    const converted = convertParityAmount({
      amount: raw,
      currencyCode: ctx.baseCurrency,
      baseCurrencyCode: ctx.baseCurrency,
      targetCurrencyCode: ctx.displayCurrency,
      exchangeRateMap: ctx.exchangeRateMap,
    });
    if (converted === null) {
      unconvertedCount += 1;
      continue;
    }
    amount += converted;
  }

  return { amount, unconvertedCount };
}
