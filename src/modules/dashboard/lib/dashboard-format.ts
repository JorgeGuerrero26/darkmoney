import { formatCurrency } from "../../../lib/formatting/money";
import type { ExchangeRateSummary } from "../../../types/domain";

export const shortDateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
});

export const fullDateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export const monthLabelFormatter = new Intl.DateTimeFormat("es-PE", {
  month: "short",
});

export function normalizeCurrencyCode(currencyCode: string) {
  return currencyCode.trim().toUpperCase();
}

export function buildExchangeRateKey(fromCurrencyCode: string, toCurrencyCode: string) {
  return `${normalizeCurrencyCode(fromCurrencyCode)}:${normalizeCurrencyCode(toCurrencyCode)}`;
}

export function buildDashboardExchangeRateMap(exchangeRates: ExchangeRateSummary[]) {
  const exchangeRateMap = new Map<string, number>();

  for (const exchangeRate of exchangeRates) {
    const key = buildExchangeRateKey(
      exchangeRate.fromCurrencyCode,
      exchangeRate.toCurrencyCode,
    );

    if (exchangeRateMap.has(key) || exchangeRate.rate <= 0) {
      continue;
    }

    exchangeRateMap.set(key, exchangeRate.rate);
  }

  return exchangeRateMap;
}

export function resolveDashboardExchangeRate(
  exchangeRateMap: Map<string, number>,
  fromCurrencyCode: string,
  toCurrencyCode: string,
) {
  const normalizedFromCurrency = normalizeCurrencyCode(fromCurrencyCode);
  const normalizedToCurrency = normalizeCurrencyCode(toCurrencyCode);

  if (normalizedFromCurrency === normalizedToCurrency) {
    return 1;
  }

  const directRate = exchangeRateMap.get(
    buildExchangeRateKey(normalizedFromCurrency, normalizedToCurrency),
  );

  if (directRate && directRate > 0) {
    return directRate;
  }

  const inverseRate = exchangeRateMap.get(
    buildExchangeRateKey(normalizedToCurrency, normalizedFromCurrency),
  );

  if (inverseRate && inverseRate > 0) {
    return 1 / inverseRate;
  }

  return null;
}

export function convertDashboardAmount({
  amount,
  currencyCode,
  amountInBaseCurrency,
  baseCurrencyCode,
  targetCurrencyCode,
  exchangeRateMap,
}: {
  amount: number;
  currencyCode?: string | null;
  amountInBaseCurrency?: number | null;
  baseCurrencyCode: string;
  targetCurrencyCode: string;
  exchangeRateMap: Map<string, number>;
}) {
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrencyCode);
  const normalizedTargetCurrency = normalizeCurrencyCode(targetCurrencyCode);
  const normalizedSourceCurrency = normalizeCurrencyCode(currencyCode ?? normalizedBaseCurrency);

  if (normalizedSourceCurrency === normalizedTargetCurrency) {
    return amount;
  }

  const directRate = resolveDashboardExchangeRate(
    exchangeRateMap,
    normalizedSourceCurrency,
    normalizedTargetCurrency,
  );

  if (directRate !== null) {
    return amount * directRate;
  }

  if (amountInBaseCurrency !== null && amountInBaseCurrency !== undefined) {
    if (normalizedTargetCurrency === normalizedBaseCurrency) {
      return amountInBaseCurrency;
    }

    const baseToTargetRate = resolveDashboardExchangeRate(
      exchangeRateMap,
      normalizedBaseCurrency,
      normalizedTargetCurrency,
    );

    if (baseToTargetRate !== null) {
      return amountInBaseCurrency * baseToTargetRate;
    }
  }

  return null;
}


export function formatPercentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatDeltaCurrency(amount: number, currencyCode: string) {
  const prefix = amount > 0 ? "+" : "";
  return `${prefix}${formatCurrency(amount, currencyCode)}`;
}

export function formatVsPreviousPeriodLabel(current: number, previous: number, previousPeriodLabel: string) {
  if (previous === 0) {
    return current === 0 ? `Sin cambio vs ${previousPeriodLabel}` : `Sin referencia en ${previousPeriodLabel}`;
  }

  const deltaPct = ((current - previous) / previous) * 100;
  const arrow = deltaPct > 0 ? "↑" : deltaPct < 0 ? "↓" : "→";
  const prefix = deltaPct > 0 ? "+" : deltaPct < 0 ? "−" : "";
  const abs = Math.round(Math.abs(deltaPct));
  return `${arrow} ${prefix}${abs}% vs ${previousPeriodLabel}`;
}
