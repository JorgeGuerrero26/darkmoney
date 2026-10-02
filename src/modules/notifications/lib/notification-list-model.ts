import type { NotificationItem } from "../../../types/domain";

export type NotificationPriority = "critical" | "important" | "informational";
export type NotificationKindGroup = "all" | "detected_movements" | "obligations" | "subscriptions" | "balance" | "invites" | "digest" | "other";

// Same taxonomy as DarkMoneyApp/lib/notification-priority.ts, not tone inferred from color.
const critical = new Set(["workspace_invite", "obligation_payment_request", "obligation_event_delete_request", "obligation_event_edit_request", "negative_balance", "obligation_overdue", "multiple_obligations_overdue", "subscription_overdue"]);
const important = new Set(["obligation_share_invite", "obligation_request_accepted", "obligation_request_rejected", "obligation_due", "multiple_subscriptions_due", "subscription_reminder", "low_balance", "high_interest_obligation", "obligation_no_payment", "obligation_event_unlinked", "obligation_event_delete_pending", "obligation_event_delete_accepted", "obligation_event_delete_rejected", "obligation_event_edit_pending", "obligation_event_edit_accepted", "obligation_event_edit_rejected", "obligation_event_updated", "obligation_event_deleted", "detected_movement_suggestion", "possible_duplicate_charge", "cash_runway_alert", "commitments_vs_balance"]);

export function notificationPriority(kind: string): NotificationPriority {
  return critical.has(kind) ? "critical" : important.has(kind) ? "important" : "informational";
}

export const notificationPriorityOptions = [
  { value: "all", label: "Todas las prioridades" }, { value: "critical", label: "Críticas" },
  { value: "important", label: "Importantes" }, { value: "informational", label: "Informativas" },
] as const;
export const notificationKindOptions: { value: NotificationKindGroup; label: string }[] = [
  { value: "all", label: "Todos los tipos" }, { value: "detected_movements", label: "Movimientos detectados" },
  { value: "obligations", label: "Obligaciones" }, { value: "subscriptions", label: "Suscripciones" },
  { value: "balance", label: "Saldos" }, { value: "invites", label: "Invitaciones" },
  { value: "digest", label: "Resumen IA" }, { value: "other", label: "Otros" },
];

export function notificationKindGroup(kind: string): NotificationKindGroup {
  if (kind === "detected_movement_suggestion") return "detected_movements";
  // Invitation precedence avoids treating a share invitation as a debt notification.
  if (kind === "workspace_invite" || kind === "obligation_share_invite" || kind === "invite") return "invites";
  if (kind.startsWith("obligation_") || kind === "obligation") return "obligations";
  if (kind.startsWith("subscription_") || kind === "subscription" || kind === "multiple_subscriptions_due") return "subscriptions";
  if (kind === "low_balance" || kind === "negative_balance" || kind === "account") return "balance";
  if (kind === "daily_ai_digest" || kind === "weekly_ai_digest") return "digest";
  return "other";
}

type FilterableNotification = Pick<NotificationItem, "title" | "body" | "kind" | "status" | "payload">;
export function filterNotificationList<T extends FilterableNotification>(items: T[], filters: {
  search: string; priority: "all" | NotificationPriority; kind: NotificationKindGroup;
}) {
  const search = filters.search.trim().toLocaleLowerCase("es");
  return items.filter((item) => {
    if (filters.priority !== "all" && notificationPriority(item.kind) !== filters.priority) return false;
    if (filters.kind !== "all" && notificationKindGroup(item.kind) !== filters.kind) return false;
    const payloadTitle = item.payload && typeof item.payload === "object" && !Array.isArray(item.payload) ? item.payload.obligationTitle : "";
    return !search || [item.title, item.body, typeof payloadTitle === "string" ? payloadTitle : ""].some((value) => value.toLocaleLowerCase("es").includes(search));
  });
}

export function notificationReadingCounts(items: Pick<NotificationItem, "status">[]) {
  const unread = items.filter((item) => item.status !== "read").length;
  return { total: items.length, unread, read: items.length - unread };
}
