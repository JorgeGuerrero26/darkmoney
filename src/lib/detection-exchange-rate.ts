import type { ExchangeRateSummary } from "../types/domain";

export type ResolvedExchangeRate = {
  rate: number;
  effectiveAt: string | null;
  source: "same_currency" | "direct" | "inverse" | "base_cross";
};

export function normalizeCurrencyCode(value?: string | null, fallback = "PEN") {
  const normalized = value?.trim().toUpperCase();
  return normalized && normalized.length > 0 ? normalized : fallback.trim().toUpperCase();
}

function validRate(rate: ExchangeRateSummary) {
  return (
    Boolean(rate.fromCurrencyCode?.trim()) &&
    Boolean(rate.toCurrencyCode?.trim()) &&
    Number.isFinite(rate.rate) &&
    rate.rate > 0
  );
}

function latestRate(left: ExchangeRateSummary, right: ExchangeRateSummary) {
  return new Date(right.effectiveAt).getTime() - new Date(left.effectiveAt).getTime();
}

export function resolveExchangeRate(
  exchangeRates: readonly ExchangeRateSummary[],
  fromCurrencyCode: string,
  toCurrencyCode: string,
  workspaceBaseCurrencyCode = "PEN",
): ResolvedExchangeRate | null {
  const from = normalizeCurrencyCode(fromCurrencyCode);
  const to = normalizeCurrencyCode(toCurrencyCode);
  const base = normalizeCurrencyCode(workspaceBaseCurrencyCode);
  if (from === to) return { rate: 1, effectiveAt: null, source: "same_currency" };

  const candidates = exchangeRates
    .filter(validRate)
    .filter((rate) => {
      const rateFrom = normalizeCurrencyCode(rate.fromCurrencyCode);
      const rateTo = normalizeCurrencyCode(rate.toCurrencyCode);
      return (rateFrom === from && rateTo === to) || (rateFrom === to && rateTo === from);
    })
    .sort(latestRate);

  const best = candidates[0];
  if (best) {
    const direct = normalizeCurrencyCode(best.fromCurrencyCode) === from;
    return {
      rate: direct ? best.rate : 1 / best.rate,
      effectiveAt: best.effectiveAt,
      source: direct ? "direct" : "inverse",
    };
  }

  if (from !== base && to !== base) {
    const toBase = resolveExchangeRate(exchangeRates, from, base, base);
    const baseToTarget = resolveExchangeRate(exchangeRates, base, to, base);
    if (toBase && baseToTarget) {
      return {
        rate: toBase.rate * baseToTarget.rate,
        effectiveAt: toBase.effectiveAt ?? baseToTarget.effectiveAt,
        source: "base_cross",
      };
    }
  }

  return null;
}
