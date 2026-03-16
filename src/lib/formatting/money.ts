export function formatCurrency(amount: number, currencyCode: string, locale = "es-PE") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function resolveCommonCurrencyCode(
  currencyCodes: Array<string | null | undefined>,
  fallbackCurrencyCode: string,
) {
  const normalizedCodes = Array.from(
    new Set(
      currencyCodes
        .map((currencyCode) => currencyCode?.trim().toUpperCase() ?? "")
        .filter(Boolean),
    ),
  );

  return normalizedCodes.length === 1
    ? normalizedCodes[0]
    : fallbackCurrencyCode.trim().toUpperCase();
}

type BalanceLike = {
  currencyCode: string;
  currentBalance: number;
  currentBalanceInBaseCurrency?: number | null;
};

export function resolveAggregateBalanceDisplay<T extends BalanceLike>(
  items: T[],
  baseCurrencyCode: string,
) {
  const normalizedBaseCurrencyCode = baseCurrencyCode.trim().toUpperCase();
  const currencyCode = resolveCommonCurrencyCode(
    items.map((item) => item.currencyCode),
    normalizedBaseCurrencyCode,
  );

  const amount = items.reduce((total, item) => {
    const normalizedItemCurrencyCode = item.currencyCode.trim().toUpperCase();

    if (currencyCode === normalizedBaseCurrencyCode && normalizedItemCurrencyCode !== normalizedBaseCurrencyCode) {
      return total + (item.currentBalanceInBaseCurrency ?? item.currentBalance);
    }

    return total + item.currentBalance;
  }, 0);

  return {
    amount,
    currencyCode,
  };
}
