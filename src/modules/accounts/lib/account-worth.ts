import type { AccountSummary, ExchangeRateSummary } from "../../../types/domain";

const code = (value: string) => value.trim().toUpperCase();
const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Same direct/inverse contract as the mobile display selector, without a 1:1 fallback. */
export function accountDisplayRate(rates: readonly ExchangeRateSummary[], from: string, to: string): number | null {
  if (code(from) === code(to)) return 1;
  const direct = rates.find(rate => code(rate.fromCurrencyCode) === code(from) && code(rate.toCurrencyCode) === code(to) && valid(rate.rate) && rate.rate > 0)?.rate;
  if (direct != null) return direct;
  const inverse = rates.find(rate => code(rate.fromCurrencyCode) === code(to) && code(rate.toCurrencyCode) === code(from) && valid(rate.rate) && rate.rate > 0)?.rate;
  return inverse == null ? null : 1 / inverse;
}

export function computeAccountWorth(accounts: readonly AccountSummary[], baseCurrency: string, displayCurrency: string, rates: readonly ExchangeRateSummary[]) {
  const factor = accountDisplayRate(rates, baseCurrency, displayCurrency);
  const buckets = new Map<string, number>();
  const missingAccountIds: number[] = [];
  let signedNetWorth = 0;
  for (const account of accounts) {
    if (account.isArchived || !account.includeInNetWorth) continue;
    const nativeRate = accountDisplayRate(rates, account.currencyCode, baseCurrency);
    const inBase = code(account.currencyCode) === code(baseCurrency) ? account.currentBalance
      : valid(account.currentBalanceInBaseCurrency) ? account.currentBalanceInBaseCurrency
      : nativeRate == null ? null : account.currentBalance * nativeRate;
    // Zero needs no FX rate; an invalid balance is never treated as zero.
    const amount = account.currentBalance === 0 ? 0 : inBase == null || factor == null ? null : inBase * factor;
    if (!valid(account.currentBalance) || !valid(amount)) { missingAccountIds.push(account.id); continue; }
    signedNetWorth += amount;
    buckets.set(account.type, (buckets.get(account.type) ?? 0) + amount);
  }
  let debts = 0;
  const assets: { type: string; value: number; pct: number }[] = [];
  // Mobile groups signed balances by type before separating assets from debts.
  for (const [type, value] of buckets) {
    if (type === "loan" || type === "loan_wallet" || value < 0) debts += Math.abs(value);
    else assets.push({ type, value, pct: 0 });
  }
  assets.sort((left, right) => right.value - left.value);
  const totalAssets = assets.reduce((sum, item) => sum + item.value, 0);
  for (const item of assets) item.pct = totalAssets > 0 ? item.value / totalAssets * 100 : 0;
  const available = missingAccountIds.length === 0;
  const netWorth = totalAssets - debts;
  return {
    available, missingAccountIds,
    // Never expose a partial subtotal as the total if any included account is unverified.
    signedNetWorth: available ? signedNetWorth : null,
    netWorth: available ? netWorth : null,
    totalAssets: available ? totalAssets : null,
    debts: available ? debts : null,
    assets: available ? assets : [],
    hasLoanSignDifference: available && Math.abs(signedNetWorth - netWorth) > 0.005,
  };
}
