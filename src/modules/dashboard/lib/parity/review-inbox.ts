/**
 * PARITY PORT de DarkMoneyApp/features/dashboard/lib/dashboard-builders.ts
 * (buildReviewInboxSnapshot) — mantener en sincronía. Los 7 contadores del móvil.
 */

import { isCategorizedCashflow, isExpense } from "./aggregations";
import { differenceInDays } from "./date-utils";
import { parseDisplayDate } from "./dates";
import { findProbableDuplicateGroups } from "./duplicate-detection";
import { movementDisplayAmount } from "./movement-amounts";
import type {
  ParityMovement,
  ParityObligation,
  ParitySubscription,
} from "./types";

export type DashboardReviewInbox = {
  uncategorizedCount: number;
  pendingMovementsCount: number;
  duplicateExpenseGroups: number;
  subscriptionsAttentionCount: number;
  obligationsWithoutPlanCount: number;
  staleObligationsCount: number;
  overdueObligationsCount: number;
  totalIssues: number;
};

export function buildReviewInboxSnapshot(
  movements: ParityMovement[],
  subscriptions: ParitySubscription[],
  obligations: ParityObligation[],
  now: Date = new Date(),
): DashboardReviewInbox {
  const today = now;
  const uncategorizedCount = movements.filter(
    (movement) =>
      movement.status === "posted" && isCategorizedCashflow(movement) && movement.categoryId == null,
  ).length;

  const pendingMovementsCount = movements.filter((movement) => movement.status === "pending").length;

  const duplicateExpenseGroups = findProbableDuplicateGroups({
    movements: movements.filter(isExpense),
    getAmount: movementDisplayAmount,
  }).length;

  const subscriptionsAttentionCount = subscriptions.filter((subscription) => {
    if (subscription.status !== "active") return false;
    const dueDate = parseDisplayDate(subscription.nextDueDate);
    return !subscription.accountId || dueDate < today;
  }).length;

  const activeObligations = obligations.filter(
    (obligation) => obligation.pendingAmount > 0.009 && obligation.status !== "paid",
  );

  const obligationsWithoutPlanCount = activeObligations.filter(
    (obligation) =>
      !obligation.dueDate &&
      !(obligation.installmentCount && obligation.installmentCount > 0) &&
      !(obligation.installmentAmount && obligation.installmentAmount > 0),
  ).length;

  const staleObligationsCount = activeObligations.filter((obligation) => {
    const referenceDate = obligation.lastPaymentDate ?? obligation.startDate;
    if (!referenceDate) return true;
    return differenceInDays(today, parseDisplayDate(referenceDate)) > 50;
  }).length;

  const overdueObligationsCount = activeObligations.filter(
    (obligation) => obligation.dueDate && parseDisplayDate(obligation.dueDate) < today,
  ).length;

  const totalIssues =
    uncategorizedCount +
    pendingMovementsCount +
    duplicateExpenseGroups +
    subscriptionsAttentionCount +
    obligationsWithoutPlanCount +
    staleObligationsCount +
    overdueObligationsCount;

  return {
    duplicateExpenseGroups,
    obligationsWithoutPlanCount,
    overdueObligationsCount,
    pendingMovementsCount,
    staleObligationsCount,
    subscriptionsAttentionCount,
    totalIssues,
    uncategorizedCount,
  };
}
