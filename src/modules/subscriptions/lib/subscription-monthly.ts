import type { SubscriptionSummary } from "../../../types/domain";

type Monthly = Pick<SubscriptionSummary, "status" | "amount" | "currencyCode" | "amountInBaseCurrency" | "frequency" | "intervalCount">;

/** Cuántos "meses" cubre un cobro; la cadencia personalizada avanza por días, como el calendario. */
export function subscriptionMonthlyFactor(frequency: SubscriptionSummary["frequency"], intervalCount: number | null | undefined) {
  const n = Math.max(1, Math.floor(intervalCount ?? 1) || 1);
  switch (frequency) {
    case "daily": return 365 / 12 / n;
    case "weekly": return 52 / 12 / n;
    case "quarterly": return 1 / (3 * n);
    case "yearly": return 1 / (12 * n);
    case "monthly": return 1 / n;
    default: return 365 / 12 / n;
  }
}

/** Solo entran las activas con conversión válida o ya en moneda base; el resto se cuenta aparte. */
export function summarizeSubscriptionsMonthly(subscriptions: Monthly[], baseCurrencyCode: string) {
  const base = baseCurrencyCode.toUpperCase();
  const summary = { total: 0, comparableCount: 0, unconvertedCount: 0 };
  for (const subscription of subscriptions) {
    if (subscription.status !== "active") continue;
    const converted = subscription.amountInBaseCurrency;
    const amount = converted != null && Number.isFinite(converted) && converted > 0
      ? converted
      : subscription.currencyCode.toUpperCase() === base ? subscription.amount : null;
    if (amount == null) { summary.unconvertedCount += 1; continue; }
    summary.total += amount * subscriptionMonthlyFactor(subscription.frequency, subscription.intervalCount);
    summary.comparableCount += 1;
  }
  return summary;
}
