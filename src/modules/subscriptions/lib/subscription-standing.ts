import type { SubscriptionSummary } from "../../../types/domain";
import { computeNextRecurringDate, rollDueDateForward } from "./subscriptions-presenters.ts";

export const SUBSCRIPTION_DUE_SOON_DAYS = 7;

export type StandingOccurrence = { dueDate: string; status: string; expectedAmount: number };
export type SubscriptionStanding = { label: string; detail: string; missedCharges: number; daysUntilDue: number };

type Args = {
  subscription: Pick<SubscriptionSummary, "status" | "nextDueDate" | "amount" | "frequency" | "intervalCount" | "dayOfMonth">;
  today: string;
  formatAmount: (amount: number) => string;
  formatDate: (ymd: string) => string;
  occurrences?: StandingOccurrence[];
};

function daysBetween(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(fy, fm - 1, fd) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

const plural = (count: number) => `${count} ${count === 1 ? "día" : "días"}`;

/** Native standing rules, except that verified overdue history cannot be hidden by a future pointer. */
export function subscriptionStandingCopy({ subscription, today, formatAmount, formatDate, occurrences }: Args): SubscriptionStanding {
  const daysUntilDue = daysBetween(subscription.nextDueDate, today);
  if (subscription.status === "cancelled") return { label: "Cancelada", detail: "Ya no genera cobros. Su historial se conserva.", missedCharges: 0, daysUntilDue };
  if (subscription.status === "paused") return { label: "Pausada", detail: "No se cobrará hasta que la reactives.", missedCharges: 0, daysUntilDue };

  const pending = occurrences?.filter((occurrence) => ["scheduled", "overdue"].includes(occurrence.status) && daysBetween(occurrence.dueDate, today) < 0);
  if (daysUntilDue < 0 || pending?.length) {
    let missedCharges: number;
    let missedAmount: number;
    if (pending) {
      missedCharges = pending.length;
      missedAmount = pending.reduce((total, occurrence) => total + occurrence.expectedAmount, 0);
    } else {
      missedCharges = 0;
      let cursor = subscription.nextDueDate;
      while (missedCharges < 400 && daysBetween(cursor, today) <= 0) {
        missedCharges += 1;
        const next = computeNextRecurringDate(cursor, subscription.frequency, subscription.intervalCount, subscription.dayOfMonth);
        if (next === cursor) break;
        cursor = next;
      }
      missedAmount = missedCharges * subscription.amount;
    }
    if (missedCharges === 0) {
      const upcoming = rollDueDateForward(subscription.nextDueDate, subscription.frequency, subscription.intervalCount, today, subscription.dayOfMonth);
      const days = daysBetween(upcoming, today);
      const when = days === 0 ? "hoy" : `el ${formatDate(upcoming)}, en ${plural(days)}`;
      return {
        label: days === 0 ? "Se cobra hoy" : days <= SUBSCRIPTION_DUE_SOON_DAYS ? "Por cobrar" : "Al día",
        detail: `Sin cobros pendientes. Próximo cobro ${when}, ${formatAmount(subscription.amount)}.`,
        missedCharges: 0,
        daysUntilDue: days,
      };
    }
    const oldestDueDate = pending?.length ? pending.reduce((oldest, occurrence) => occurrence.dueDate < oldest ? occurrence.dueDate : oldest, pending[0].dueDate) : subscription.nextDueDate;
    const actualDaysUntilDue = daysBetween(oldestDueDate, today);
    const late = Math.abs(actualDaysUntilDue);
    const charges = missedCharges === 1 ? "Va 1 cobro sin anotar" : `Van ${missedCharges} cobros sin anotar`;
    return {
      label: "Atrasada",
      detail: `Debía cobrarse el ${formatDate(oldestDueDate)}, hace ${plural(late)}. ${charges}, ${formatAmount(missedAmount)}.`,
      missedCharges,
      daysUntilDue: actualDaysUntilDue,
    };
  }
  if (daysUntilDue === 0) return { label: "Se cobra hoy", detail: `Toca hoy, ${formatAmount(subscription.amount)}.`, missedCharges: 0, daysUntilDue };
  const when = `el ${formatDate(subscription.nextDueDate)}, en ${plural(daysUntilDue)}`;
  return daysUntilDue <= SUBSCRIPTION_DUE_SOON_DAYS
    ? { label: "Por cobrar", detail: `Se cobra ${when}, ${formatAmount(subscription.amount)}.`, missedCharges: 0, daysUntilDue }
    : { label: "Al día", detail: `Próximo cobro ${when}, ${formatAmount(subscription.amount)}.`, missedCharges: 0, daysUntilDue };
}
