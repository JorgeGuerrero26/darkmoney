import type { NotificationItem } from "../../../types/domain";

/** Never follow a URL from payload; map known kinds to internal product destinations. */
export function notificationHref(notification: Pick<NotificationItem, "kind" | "relatedEntityType" | "relatedEntityId" | "payload">) {
  const { kind, relatedEntityType, relatedEntityId } = notification;
  const payload = notification.payload && typeof notification.payload === "object" && !Array.isArray(notification.payload) ? notification.payload : {};
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const positiveId = (value: unknown) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };
  const id = positiveId(relatedEntityId);
  if (kind === "workspace_invite") return token ? `/share/workspaces/${encodeURIComponent(token)}` : "/app/notifications";
  if (kind === "obligation_share_invite") return token ? `/share/obligations/${encodeURIComponent(token)}` : "/app/obligations";
  if (kind.startsWith("obligation_") || kind === "multiple_obligations_overdue") {
    const obligationId = positiveId(payload.obligationId) ?? (relatedEntityType === "obligation" ? id : null);
    return obligationId ? `/app/obligations?resource=${obligationId}` : "/app/obligations";
  }
  if (kind.startsWith("subscription_") || kind === "multiple_subscriptions_due" || kind === "upcoming_annual_subscription") return id ? `/app/subscriptions?resource=${id}` : "/app/subscriptions";
  if (kind === "low_balance" || kind === "negative_balance" || kind === "account_dormant") return id ? `/app/accounts?resource=${id}` : "/app/accounts";
  if (kind.includes("budget")) return id ? `/app/budgets?resource=${id}&hist=1` : "/app/budgets";
  if (kind === "recurring_income_reminder" || kind === "expected_income_missed") return "/app/recurring-income";
  if (kind === "daily_ai_digest" || kind === "weekly_ai_digest" || kind === "daily_workspace_summary" || kind === "monthly_recap" || kind === "cash_runway_alert" || kind === "commitments_vs_balance") return "/app";
  if (relatedEntityType === "movement" && id) return `/app/movements?period=all&movement=${id}`;
  if (kind === "net_worth_negative") return "/app/accounts";
  if (["daily_cashflow_check", "no_income_month", "high_expense_month", "category_spending_spike", "expense_income_imbalance", "savings_rate_low", "no_movements_week", "possible_duplicate_charge", "detected_movements_pending", "detected_suggestions_pending", "detected_movement_suggestion"].includes(kind)) return "/app/movements";
  return "/app/notifications";
}
