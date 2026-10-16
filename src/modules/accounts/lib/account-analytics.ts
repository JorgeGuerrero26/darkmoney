import { analyticsMonthKey } from "../../../lib/analytics-money";
import type { AccountSummary, MovementRecord } from "../../../types/domain";

export const ACCOUNT_ANALYTICS_LIMIT = 300;

export function accountMovementAmountsValid(account: AccountSummary, item: MovementRecord) {
  const sideValid = (amount: number | null, currency: string | null | undefined) => amount != null && Number.isFinite(amount) && (currency == null || currency === account.currencyCode);
  return (item.sourceAccountId !== account.id || sideValid(item.sourceAmount, item.sourceCurrencyCode)) &&
    (item.destinationAccountId !== account.id || sideValid(item.destinationAmount, item.destinationCurrencyCode));
}

export function accountBalanceHistoryReady(account: AccountSummary, movements: readonly MovementRecord[], now = Date.now()) {
  return Number.isFinite(account.currentBalance) && movements.filter(item => item.workspaceId === account.workspaceId && item.status === "posted" && (item.sourceAccountId === account.id || item.destinationAccountId === account.id)).every(item => {
    const timestamp = new Date(item.occurredAt).getTime();
    return Number.isFinite(timestamp) && (timestamp > now || timestamp < now - 90 * 86_400_000 || accountMovementAmountsValid(account, item));
  });
}

/** Native mobile analytics selection and cashflow rules, with explicit incomplete-data evidence. */
export function buildAccountAnalytics(account: AccountSummary, movements: readonly MovementRecord[], limit = ACCOUNT_ANALYTICS_LIMIT) {
  const own = movements.filter(item => item.workspaceId === account.workspaceId && item.status === "posted" && (item.sourceAccountId === account.id || item.destinationAccountId === account.id));
  const invalidDates = own.filter(item => !Number.isFinite(new Date(item.occurredAt).getTime())).length;
  const selected = own.filter(item => Number.isFinite(new Date(item.occurredAt).getTime()))
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime() || right.id - left.id).slice(0, limit);
  let totalIn = 0, totalOut = 0, transferOut = 0, uncategorized = 0, uncategorizedCount = 0, invalidAmounts = 0;
  const byCategory = new Map<string, number>();
  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const item of selected) {
    const key = analyticsMonthKey(item.occurredAt), month = byMonth.get(key) ?? { income: 0, expense: 0 };
    if (item.destinationAccountId === account.id) {
      if (item.destinationAmount == null || !Number.isFinite(item.destinationAmount) || (item.destinationCurrencyCode != null && item.destinationCurrencyCode !== account.currencyCode)) invalidAmounts++;
      else { totalIn += item.destinationAmount; month.income += item.destinationAmount; }
    }
    if (item.sourceAccountId === account.id) {
      if (item.sourceAmount == null || !Number.isFinite(item.sourceAmount) || (item.sourceCurrencyCode != null && item.sourceCurrencyCode !== account.currencyCode)) invalidAmounts++;
      else {
        totalOut += item.sourceAmount; month.expense += item.sourceAmount;
        if (item.movementType === "transfer") transferOut += item.sourceAmount;
        else if (item.categoryId != null && item.category) byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.sourceAmount);
        else { uncategorized += item.sourceAmount; uncategorizedCount++; }
      }
    }
    byMonth.set(key, month);
  }
  const categories = [...byCategory].sort((left, right) => right[1] - left[1]);
  const complete = invalidDates === 0 && invalidAmounts === 0 && [totalIn, totalOut, transferOut, uncategorized, totalIn - totalOut].every(Number.isFinite);
  return {
    selected, count: selected.length, totalCount: own.length, truncated: own.length > limit, invalidDates, invalidAmounts, complete,
    from: selected[selected.length - 1]?.occurredAt ?? null, to: selected[0]?.occurredAt ?? null,
    totalIn: complete ? totalIn : null, totalOut: complete ? totalOut : null,
    netFlow: complete ? totalIn - totalOut : null, spent: complete ? totalOut - transferOut : null,
    transferOut: complete ? transferOut : null, uncategorized: complete ? uncategorized : null, uncategorizedCount,
    visibleCategories: complete ? categories.slice(0, 4).map(([name, amount]) => ({ name, amount })) : [],
    remainingCategoryCount: categories.slice(4).length,
    remainingCategoryTotal: complete ? categories.slice(4).reduce((sum, [, amount]) => sum + amount, 0) : null,
    months: complete ? [...byMonth].sort(([left], [right]) => right.localeCompare(left)).slice(0, 6).map(([key, values]) => ({ key, ...values, net: values.income - values.expense })) : [],
  };
}
