import { isCategorizedCashflow, isExpense } from "@darkmoney/shared/aggregations";
import { buildReadiness } from "@darkmoney/shared/readiness";
import { buildReviewInboxSnapshot } from "@darkmoney/shared/review-inbox";
import { findProbableDuplicateGroups } from "@darkmoney/shared/duplicate-detection";
import { movementDisplayAmount } from "@darkmoney/shared/movement-amounts";
import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import type { SharedObligationSummary } from "../../../types/domain";
import { isHistoryBalanceCorrection } from "./dashboard-health";
import { limaCalendarDay } from "./projection/lima-calendar";
import { parsePaymentPlan } from "../../obligations/lib/payment-plan";

/** Same seven review checks as mobile; not a count of unique movements or money. */
export function buildDashboardHealthReview(snapshot: WorkspaceSnapshot, shared: SharedObligationSummary[], now = new Date()) {
  const today = limaCalendarDay(now.toISOString())!, from = now.getTime() - 90 * 86400000;
  const rows = snapshot.movements.filter(row => row.workspaceId === snapshot.workspace.id && !isHistoryBalanceCorrection(row)
    && Number.isFinite(new Date(row.occurredAt).getTime()) && new Date(row.occurredAt).getTime() >= from && new Date(row.occurredAt) <= now)
    .map(row => ({ ...row, categoryId: row.categoryId ?? null, counterpartyId: row.counterpartyId ?? null }))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime() || b.id - a.id);
  const byId = new Map(snapshot.obligations.filter(row => row.workspaceId === snapshot.workspace.id).map(row => [row.id, row]));
  for (const row of shared) if (!byId.has(row.id)) byId.set(row.id, row);
  const obligations = [...byId.values()].filter(row => ["active", "defaulted"].includes(row.status) && row.pendingAmount > 0.009);
  const subscriptions = snapshot.subscriptions.filter(row => row.workspaceId === snapshot.workspace.id && row.status === "active");
  const invalidDates = obligations.filter(row => row.dueDate && !limaCalendarDay(row.dueDate) || row.startDate && !limaCalendarDay(row.startDate) || row.lastPaymentDate && !limaCalendarDay(row.lastPaymentDate)).length
    + subscriptions.filter(row => !limaCalendarDay(row.nextDueDate)).length;
  // Only calendar comparisons occur in the shared review helper. Local noon avoids browser
  // DST changing a whole-day threshold; actual history/readiness still use real instants.
  const raw = buildReviewInboxSnapshot(rows, subscriptions.map(row => ({ ...row, nextDueDate: limaCalendarDay(row.nextDueDate) ?? today })),
    obligations.map(row => ({ ...row, dueDate: limaCalendarDay(row.dueDate), startDate: limaCalendarDay(row.startDate), lastPaymentDate: limaCalendarDay(row.lastPaymentDate) })), new Date(`${today}T12:00:00`));
  const overdueObligationsCount = obligations.filter(row => { const due = limaCalendarDay(row.dueDate); return due && due < today; }).length;
  const obligationsWithoutPlanCount = obligations.filter(row => !row.dueDate && !parsePaymentPlan(row.paymentPlan) && !(row.installmentCount && row.installmentCount > 0) && !(row.installmentAmount && row.installmentAmount > 0)).length;
  const review = { ...raw, overdueObligationsCount, obligationsWithoutPlanCount,
    totalIssues: raw.totalIssues - raw.overdueObligationsCount - raw.obligationsWithoutPlanCount + overdueObligationsCount + obligationsWithoutPlanCount };
  const groups = findProbableDuplicateGroups({ movements: rows.filter(isExpense), getAmount: movementDisplayAmount });
  const quality = rows.filter(isCategorizedCashflow);
  return { today, from: limaCalendarDay(new Date(from).toISOString())!, review, readiness: buildReadiness(rows, now), invalidDates,
    duplicateExpenseCount: new Set(groups.flatMap(group => group.movementIds)).size,
    noCounterpartyCount: quality.filter(row => row.counterpartyId == null).length, noCategoryCount: quality.filter(row => row.categoryId == null).length };
}
