import { supabase } from "../../../services/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { SubscriptionStatus, SubscriptionSummary } from "../../../types/domain";
import { computeNextRecurringDate, rollDueDateForward } from "./subscriptions-presenters";

export type SubscriptionOccurrence = {
  id: number;
  dueDate: string;
  expectedAmount: number;
  status: "scheduled" | "paid" | "skipped" | "cancelled" | "overdue";
};

export function useSubscriptionOccurrences(subscriptionId: number) {
  return useQuery({
    queryKey: ["subscription-occurrences", subscriptionId],
    queryFn: async (): Promise<SubscriptionOccurrence[]> => {
      const { data, error } = await client().from("subscription_occurrences")
        .select("id, due_date, expected_amount, status")
        .eq("subscription_id", subscriptionId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: Number(row.id),
        dueDate: String(row.due_date).slice(0, 10),
        expectedAmount: Number(row.expected_amount),
        status: row.status as SubscriptionOccurrence["status"],
      }));
    },
  });
}

function client() {
  if (!supabase) throw new Error("Supabase no disponible.");
  return supabase;
}

export function todayPeru() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function changeSubscriptionStatus(subscription: SubscriptionSummary, status: SubscriptionStatus) {
  const nextDueDate = status === "active"
    ? rollDueDateForward(subscription.nextDueDate, subscription.frequency, subscription.intervalCount, todayPeru(), subscription.dayOfMonth)
    : subscription.nextDueDate;
  const { error } = await client().from("subscriptions")
    .update({ status, next_due_date: nextDueDate })
    .eq("workspace_id", subscription.workspaceId)
    .eq("id", subscription.id);
  if (error) throw error;
  return nextDueDate;
}

export async function setSubscriptionPinned(subscription: SubscriptionSummary, isPinned: boolean) {
  const { error } = await client().from("subscriptions")
    .update({ is_pinned: isPinned })
    .eq("workspace_id", subscription.workspaceId)
    .eq("id", subscription.id);
  if (error) throw error;
}

export async function assignSubscriptionField(subscription: SubscriptionSummary, field: "account_id" | "category_id", value: number | null) {
  const { error } = await client().from("subscriptions")
    .update({ [field]: value })
    .eq("workspace_id", subscription.workspaceId)
    .eq("id", subscription.id);
  if (error) throw error;
}

export async function markSubscriptionPaid(
  subscription: SubscriptionSummary,
  input: { paidDate: string; amount: number; accountId: number },
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidDate) || !Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Revisa la fecha y el monto del pago.");
  }
  const nextDueDate = computeNextRecurringDate(
    subscription.nextDueDate, subscription.frequency, subscription.intervalCount, subscription.dayOfMonth,
  );
  // Misma secuencia que móvil: avanzar primero para evitar duplicar el vencimiento
  // si la inserción del movimiento falla. El error explica el estado parcial.
  const { error: updateError } = await client().from("subscriptions")
    .update({ next_due_date: nextDueDate })
    .eq("workspace_id", subscription.workspaceId)
    .eq("id", subscription.id);
  if (updateError) throw updateError;

  const [year, month, day] = input.paidDate.split("-").map(Number);
  const peruNow = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const occurredAt = new Date(Date.UTC(year, month - 1, day,
    peruNow.getUTCHours() + 5, peruNow.getUTCMinutes(), peruNow.getUTCSeconds(), peruNow.getUTCMilliseconds())).toISOString();
  const { error: insertError } = await client().from("movements").insert({
    workspace_id: subscription.workspaceId,
    movement_type: "subscription_payment",
    status: "posted",
    occurred_at: occurredAt,
    description: subscription.name,
    notes: subscription.notes ?? "Pago registrado manualmente.",
    source_account_id: input.accountId,
    source_amount: input.amount,
    destination_account_id: null,
    destination_amount: null,
    fx_rate: null,
    category_id: subscription.categoryId ?? null,
    counterparty_id: subscription.vendorPartyId ?? null,
    obligation_id: null,
    subscription_id: subscription.id,
    metadata: { manual_subscription_payment: true, paid_for_due_date: subscription.nextDueDate },
  });
  if (insertError) {
    throw new Error(`La fecha avanzó a ${nextDueDate}, pero no se creó el movimiento: ${insertError.message}. Registra el gasto manualmente.`);
  }
  return nextDueDate;
}
