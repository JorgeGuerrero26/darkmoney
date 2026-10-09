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
  if (kind.startsWith("subscription_") || kind === "multiple_subscriptions_due" || kind === "upcoming_annual_subscription") return id ? `/app/subscriptions?resource=${id}` : "/app/subscriptions";
  if (kind === "low_balance" || kind === "negative_balance" || kind === "account_dormant") return id ? `/app/accounts?resource=${id}` : "/app/accounts";
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
  if (["daily_cashflow_check", "no_income_month", "high_expense_month", "category_spending_spike", "expense_income_imbalance", "savings_rate_low", "no_movements_week", "possible_duplicate_charge", "detected_movements_pending", "detected_suggestions_pending", "detected_movement_suggestion"].includes(kind)) return "/app/movements";
  return "/app/notifications";
}
