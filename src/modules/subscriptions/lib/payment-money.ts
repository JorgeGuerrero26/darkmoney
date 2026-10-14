import type { ExchangeRateSummary, MovementRecord } from "../../../types/domain";
import { buildSubscriptionPaymentReceipts } from "./payment-receipts";

/** Mirrors mobile convertAmountToWorkspaceBase: direct rate, then inverse, never a guessed rate. */
export function subscriptionReceiptHistory(movements: MovementRecord[], workspaceId: number, baseCurrencyCode: string, rates: ExchangeRateSummary[]) {
  return buildSubscriptionPaymentReceipts(movements,workspaceId,(head,total)=>{
    const from=head.sourceCurrencyCode?.toUpperCase(), to=baseCurrencyCode.toUpperCase();
    if (!from) return null;
    if (from===to) return total;
    const direct=rates.find(rate=>rate.fromCurrencyCode.toUpperCase()===from && rate.toCurrencyCode.toUpperCase()===to && Number.isFinite(rate.rate) && rate.rate>0);
    if (direct) return total*direct.rate;
    const inverse=rates.find(rate=>rate.fromCurrencyCode.toUpperCase()===to && rate.toCurrencyCode.toUpperCase()===from && Number.isFinite(rate.rate) && rate.rate>0);
    return inverse ? total/inverse.rate : null;
  });
}

/** Same source/destination and positive-conversion rules as mobile subscription analytics. */
export function subscriptionPaymentMoney(payment: MovementRecord, baseCurrencyCode: string, fallbackCurrencyCode: string) {
  const source = payment.sourceAmount;
  const useSource = source != null && Number.isFinite(source) && source !== 0;
  const amount = Math.abs((useSource ? source : payment.destinationAmount) ?? 0);
  const currencyCode = ((useSource ? payment.sourceCurrencyCode : payment.destinationCurrencyCode) ?? fallbackCurrencyCode).toUpperCase();
  const conversion = useSource ? payment.sourceAmountInBaseCurrency : payment.destinationAmountInBaseCurrency;
  const comparable = conversion != null && Number.isFinite(conversion) && Math.abs(conversion) > 0
    ? Math.abs(conversion) : currencyCode === baseCurrencyCode.toUpperCase() ? amount : null;
  return { amount, currencyCode, comparable };
}
