import { parseDisplayDate } from "@darkmoney/shared/dates";
import { endOfMonth } from "@darkmoney/shared/date-utils";
import { buildMonthProjection as buildSharedProjection } from "@darkmoney/shared/month-projection";

/**
 * The installed shared package projects commitments over 30 days. Mobile's
 * month model narrows that window to the current calendar month. Keep the
 * shared conversion/variable model, but apply the same cutoff at its boundary.
 */
export const buildMonthProjection: typeof buildSharedProjection = (
  movements,
  obligations,
  subscriptions,
  recurringIncome,
  currentVisibleBalance,
  ctx,
  now = new Date(),
) => {
  const monthEnd = endOfMonth(now);
  const withinMonth = (date: string | null) =>
    date !== null && parseDisplayDate(date) <= monthEnd;

  return buildSharedProjection(
    movements,
    obligations.filter((item) => withinMonth(item.dueDate)),
    subscriptions.filter((item) => withinMonth(item.nextDueDate)),
    recurringIncome.filter((item) => withinMonth(item.nextExpectedDate)),
    currentVisibleBalance,
    ctx,
    now,
  );
};
