import type { NotificationItem } from "../../../types/domain";
import { getCurrentMonthDateRange, movementDateInPeru } from "../../movements/lib/movement-date-range.ts";

export function notificationId(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function notificationDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : null;
}

function internalLink(path: string, values: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value != null && value !== "") params.set(key, String(value));
  return params.size ? `${path}?${params}` : path;
}

/** Persisted notices go through a canonical, user-scoped destination preflight. */
export function notificationDestinationHref(href: string, id: number) {
  if (!notificationId(id)) throw new Error("Aviso inválido.");
  if (/^\/share\/(obligations|workspaces)\//.test(href)) return href;
  if (!/^\/app(?:\/|\?|$)/.test(href)) return "/app/notifications";
  const url = new URL(href, "https://internal.invalid");
  if (!/^\/app(?:\/|$)/.test(url.pathname)) return "/app/notifications";
  url.searchParams.set("noticeId", String(id));
  return `${url.pathname}${url.search}`;
}

/** Calculated notices have no server row: reject a stale snapshot rather than guessing. */
export function notificationMatchesActiveSpace(notification: { source: string; workspaceId?: number }, activeWorkspaceId: number | null | undefined) {
  return notification.source !== "smart" || notification.workspaceId == null || notification.workspaceId === activeWorkspaceId;
}

/** These notices stay unread when merely opening their destination. */
export function notificationDefersRead(kind: string) {
  return ["invite", "workspace_invite", "obligation_share_invite", "obligation_payment_request", "obligation_event_delete_request", "obligation_event_edit_request", "detected_movement_suggestion"].includes(kind);
}

/** Never follow a URL from payload; map known kinds to internal product destinations. */
export function notificationHref(notification: Pick<NotificationItem, "kind" | "relatedEntityType" | "relatedEntityId" | "payload">, now = new Date()) {
  const { kind, relatedEntityType, relatedEntityId } = notification;
  const payload = notification.payload && typeof notification.payload === "object" && !Array.isArray(notification.payload) ? notification.payload : {};
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const id = notificationId(relatedEntityId);
  const text = (key: string) => typeof payload[key] === "string" ? String(payload[key]).trim().slice(0, 200) : "";
  const month = getCurrentMonthDateRange(now);
  const movements = (label: string, type?: string, from = month.from, to = month.to, categoryId?: number | null) =>
    internalLink("/app/movements", { from, to, type, categoryId, notice: label });
  if (kind === "detected_movement_suggestion") {
    const suggestionId = notificationId(payload.suggestionId) ?? (relatedEntityType === "detected_movement_suggestion" ? id : null);
    return internalLink("/app/notifications", { detected: suggestionId ?? "pending" });
  }
  if (kind === "detected_suggestions_pending" || kind === "detected_movements_pending") return "/app/notifications?detected=pending";
  if (kind === "assistant_insight") return "/app/assistant";
  if (["daily_digest", "daily_ai_digest", "daily_workspace_summary"].includes(kind)) {
    return internalLink("/app", { day: notificationDate(payload.todayKey) ?? movementDateInPeru(now.toISOString()) });
  }
  if (kind === "workspace_invite") return token ? `/share/workspaces/${encodeURIComponent(token)}` : "/app/notifications";
  if (kind === "obligation_share_invite") return token ? `/share/obligations/${encodeURIComponent(token)}` : "/app/obligations";
  if (kind.startsWith("obligation_") || kind === "multiple_obligations_overdue") {
    const obligationId = notificationId(payload.obligationId) ?? (relatedEntityType === "obligation" ? id : null);
    if (!obligationId) return "/app/obligations";
    const resolved = payload.responseStatus === "accepted" || payload.responseStatus === "rejected";
    const request = kind === "obligation_payment_request" && !resolved ? notificationId(payload.requestId) ?? id : null;
    const event = kind.startsWith("obligation_event_") ? notificationId(payload.eventId) ?? (relatedEntityType !== "obligation" ? id : null) : null;
    return internalLink("/app/obligations", { resource: obligationId, paymentRequest: request, event, notificationKind: request || event ? kind : null });
  }
  if (kind === "multiple_subscriptions_due" || kind === "subscription_cost_heavy") return "/app/subscriptions";
  if (kind.startsWith("subscription_") || kind === "upcoming_annual_subscription") {
    const subscriptionId = notificationId(payload.subscriptionId) ?? (relatedEntityType == null || relatedEntityType === "subscription" ? id : null);
    return subscriptionId ? `/app/subscriptions?resource=${subscriptionId}` : "/app/subscriptions";
  }
  if (kind === "low_balance" || kind === "negative_balance" || kind === "account_dormant") {
    const accountId = notificationId(payload.accountId) ?? (relatedEntityType == null || relatedEntityType === "account" ? id : null);
    return accountId ? `/app/accounts?resource=${accountId}` : "/app/accounts";
  }
  if (kind === "budget_period_ended") return relatedEntityType === "budget" && id ? `/app/budgets?duplicateFrom=${id}` : "/app/budgets";
  if (kind.includes("budget")) return relatedEntityType === "budget" && id ? `/app/budgets?resource=${id}` : "/app/budgets";
  if (kind === "recurring_income_reminder" || kind === "expected_income_missed") return "/app/recurring-income";
  if (kind === "monthly_recap") {
    const from = notificationDate(payload.monthFrom), to = notificationDate(payload.monthTo);
    return from && to && from <= to ? movements(`Resumen de ${text("monthLabel") || "el mes"}`, undefined, from, to) : "/app/movements";
  }
  if (kind === "high_expense_month") return movements("Gastos elevados del mes", "expense");
  if (kind === "category_spending_spike") return movements(text("categoryName") ? `Gasto alto: ${text("categoryName")}` : "Gasto elevado en categoría", "expense", month.from, month.to, relatedEntityType === "category" ? id : null);
  if (kind === "no_income_month") return movements("Sin ingresos este mes", "income");
  if (kind === "daily_cashflow_check") return movements("Chequeo de flujo del mes");
  if (kind === "expense_income_imbalance") return movements("Gastos vs ingresos del mes");
  if (kind === "savings_rate_low") return movements("Ahorro bajo este mes");
  if (kind === "no_movements_week") return movements("Sin movimientos (última semana)", undefined, movementDateInPeru(new Date(now.getTime() - 7 * 86400000).toISOString()), movementDateInPeru(now.toISOString()));
  if (kind === "possible_duplicate_charge") {
    const day = notificationDate(payload.day);
    return movements(text("amountLabel") ? `Posible cobro duplicado: ${text("amountLabel")}` : "Posible cobro duplicado", "expense", day ?? month.from, day ?? month.to);
  }
  if (kind === "cash_runway_alert") return "/app/accounts";
  if (kind === "commitments_vs_balance") return "/app/obligations";
  if (kind === "subscription_cost_heavy") return "/app/subscriptions";
  if (kind === "weekly_ai_digest") return "/app";
  if (relatedEntityType === "movement" && id) return `/app/movements?period=all&movement=${id}`;
  if (kind === "net_worth_negative") return "/app/accounts";
  return "/app/notifications";
}
