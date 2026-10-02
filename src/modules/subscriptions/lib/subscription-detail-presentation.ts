import type { SubscriptionFrequency, SubscriptionSummary } from "../../../types/domain";

const phrases: Record<SubscriptionFrequency, string> = {
  daily: "Cada día", weekly: "Cada semana", monthly: "Cada mes",
  quarterly: "Cada trimestre", yearly: "Cada año", custom: "Cada día",
};
const units: Record<SubscriptionFrequency, string> = {
  daily: "días", weekly: "semanas", monthly: "meses",
  quarterly: "trimestres", yearly: "años", custom: "días",
};

export function subscriptionRecurrencePhrase(subscription: Pick<SubscriptionSummary, "frequency" | "intervalCount" | "dayOfMonth">) {
  const count = Math.max(1, Math.floor(subscription.intervalCount) || 1);
  if (count > 1) return `Cada ${count} ${units[subscription.frequency]}`;
  if (subscription.dayOfMonth === 31) {
    if (subscription.frequency === "monthly") return "Cada mes, el último día";
    if (subscription.frequency === "quarterly") return "Cada trimestre, el último día";
    if (subscription.frequency === "yearly") return "Cada año, el último día del mes";
  }
  return phrases[subscription.frequency];
}

export function subscriptionRowSubtitle(subscription: Pick<SubscriptionSummary, "status" | "nextDueDate">, today: string, displayDate: (date: string) => string) {
  if (subscription.status === "cancelled") return "Cancelada · sin cobros programados";
  if (subscription.status === "paused") return `Pausada · el cobro quedó en el ${displayDate(subscription.nextDueDate)}`;
  return `${subscription.nextDueDate < today ? "Venció" : "Se cobra"} el ${displayDate(subscription.nextDueDate)}`;
}
