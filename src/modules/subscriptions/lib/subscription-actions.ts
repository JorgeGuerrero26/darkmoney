import { supabase } from "../../../services/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { SubscriptionStatus, SubscriptionSummary } from "../../../types/domain";
import { computeNextRecurringDate, rollDueDateForward } from "./subscriptions-presenters";
import { confirmSubscriptionWrite, SubscriptionWritePreflightError, withSubscriptionWriteTimeout } from "./subscription-write-result";

export type SubscriptionOccurrence = {
  id: number;
  dueDate: string;
  expectedAmount: number;
  status: "scheduled" | "paid" | "skipped" | "cancelled" | "overdue";
};

export function useSubscriptionOccurrences(subscriptionId: number, workspaceId?: number, userId?: string) {
  return useQuery({
    queryKey: ["subscription-occurrences", workspaceId ?? null, userId ?? null, subscriptionId],
    enabled: Boolean(Number.isSafeInteger(subscriptionId) && subscriptionId > 0 && Number.isSafeInteger(workspaceId) && workspaceId! > 0 && userId),
    queryFn: async ({ signal }): Promise<SubscriptionOccurrence[]> => {
      const parent = await client().from("subscriptions").select("id, workspace_id").eq("id", subscriptionId).eq("workspace_id", workspaceId!).abortSignal(signal).maybeSingle();
      if (parent.error) throw parent.error;
      if (parent.data?.id !== subscriptionId || parent.data.workspace_id !== workspaceId) throw new Error("No se pudo comprobar la suscripción de este espacio.");
      const result: SubscriptionOccurrence[] = [], ids = new Set<number>();
      let total: number | undefined;
      for (let from = 0; ; from += 500) {
        signal.throwIfAborted();
        const { data, error, count } = await client().from("subscription_occurrences")
          .select("id, subscription_id, due_date, expected_amount, status", { count: "exact" })
          .eq("subscription_id", subscriptionId).abortSignal(signal)
          .order("due_date", { ascending: true }).order("id", { ascending: true }).range(from, from + 499);
        if (error) throw error;
        if (!Array.isArray(data) || !Number.isSafeInteger(count) || count! < 0 || (total !== undefined && count !== total)) throw new Error("No se pudo comprobar el calendario completo de cobros.");
        total = count!;
        if (data.length !== Math.min(500, Math.max(0, total - from))) throw new Error("El calendario de cobros está incompleto. Actualiza antes de usar su estado.");
        for (const row of data) {
          const dueDate = String(row.due_date), parsed = new Date(`${dueDate}T12:00:00Z`), amount = row.expected_amount;
          if (!Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id) || row.subscription_id !== subscriptionId ||
            !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueDate ||
            !["number", "string"].includes(typeof amount) || (typeof amount === "string" && !/^\d+(?:\.\d+)?$/.test(amount)) || !Number.isFinite(Number(amount)) || Number(amount) < 0 ||
            !Number.isSafeInteger(Math.round(Number(amount) * 100)) || Math.abs(Number(amount) * 100 - Math.round(Number(amount) * 100)) > 1e-6 ||
            !["scheduled", "paid", "skipped", "cancelled", "overdue"].includes(row.status)) throw new Error("El calendario de cobros cambió o contiene datos por comprobar.");
          ids.add(row.id);
          result.push({ id: row.id, dueDate, expectedAmount: Number(amount), status: row.status as SubscriptionOccurrence["status"] });
        }
        if (result.length === total) return result;
      }
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

function assertActionTarget(subscription: SubscriptionSummary) {
  if (!Number.isSafeInteger(subscription.id) || subscription.id <= 0 || !Number.isSafeInteger(subscription.workspaceId) || subscription.workspaceId <= 0) {
    throw new SubscriptionWritePreflightError("La suscripción o el espacio ya no están disponibles.");
  }
}

export async function changeSubscriptionStatus(subscription: SubscriptionSummary, status: SubscriptionStatus) {
  assertActionTarget(subscription);
  if (!["active", "paused", "cancelled"].includes(status)) throw new SubscriptionWritePreflightError("Selecciona un estado válido.");
  const nextDueDate = status === "active"
    ? rollDueDateForward(subscription.nextDueDate, subscription.frequency, subscription.intervalCount, todayPeru(), subscription.dayOfMonth)
    : subscription.nextDueDate;
  const { data, error } = await withSubscriptionWriteTimeout(signal => client().from("subscriptions")
    .update({ status, next_due_date: nextDueDate })
    .eq("workspace_id", subscription.workspaceId)
    .eq("id", subscription.id)
    .eq("status", subscription.status).eq("next_due_date", subscription.nextDueDate)
    .select("id, workspace_id, status, next_due_date").abortSignal(signal).single());
  if (error) throw error;
  confirmSubscriptionWrite(data, { workspaceId: subscription.workspaceId, subscriptionId: subscription.id }, { status, next_due_date: nextDueDate });
  return nextDueDate;
}

export async function setSubscriptionPinned(subscription: SubscriptionSummary, isPinned: boolean) {
  assertActionTarget(subscription);
  if (typeof isPinned !== "boolean" || typeof subscription.isPinned !== "boolean") throw new SubscriptionWritePreflightError("Revisa la posición de la suscripción.");
  const { data, error } = await withSubscriptionWriteTimeout(signal => client().from("subscriptions")
    .update({ is_pinned: isPinned })
    .eq("workspace_id", subscription.workspaceId)
    .eq("id", subscription.id).eq("is_pinned", subscription.isPinned)
    .select("id, workspace_id, is_pinned").abortSignal(signal).single());
  if (error) throw error;
  return confirmSubscriptionWrite(data, { workspaceId: subscription.workspaceId, subscriptionId: subscription.id }, { is_pinned: isPinned });
}

export async function assignSubscriptionField(subscription: SubscriptionSummary, field: "account_id" | "category_id", value: number | null) {
  assertActionTarget(subscription);
  if (!["account_id", "category_id"].includes(field) || (value !== null && (!Number.isSafeInteger(value) || value <= 0)) ||
    (field === "account_id" && value === null && subscription.autoCreateMovement)) throw new SubscriptionWritePreflightError("Revisa la cuenta o categoría; el registro automático necesita una cuenta.");
  const previous = (field === "account_id" ? subscription.accountId : subscription.categoryId) ?? null;
  const { data, error } = await withSubscriptionWriteTimeout(signal => {
    let query = client().from("subscriptions")
    .update({ [field]: value })
    .eq("workspace_id", subscription.workspaceId)
    .eq("id", subscription.id).eq("currency_code", subscription.currencyCode);
    query = previous === null ? query.is(field, null) : query.eq(field, previous);
    if (field === "account_id" && value === null) query = query.eq("auto_create_movement", false);
    return query.select(`id, workspace_id, ${field}`).abortSignal(signal).single();
  });
  if (error) throw error;
  return confirmSubscriptionWrite(data, { workspaceId: subscription.workspaceId, subscriptionId: subscription.id }, { [field]: value });
}

export async function markSubscriptionPaid(
  subscription: SubscriptionSummary,
  input: { paidDate: string; amount: number; accountId: number },
  options: { isCurrent?: () => boolean } = {},
) {
  const date = new Date(`${input.paidDate}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.paidDate || !Number.isFinite(input.amount) || input.amount <= 0 ||
    !Number.isSafeInteger(Math.round(input.amount * 100)) || Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 1e-6 || !Number.isSafeInteger(input.accountId) || input.accountId <= 0 || subscription.status !== "active") {
    throw new Error("Revisa la fecha y el monto del pago.");
  }
  const nextDueDate = computeNextRecurringDate(
    subscription.nextDueDate, subscription.frequency, subscription.intervalCount, subscription.dayOfMonth,
  );
  // Misma secuencia que móvil: avanzar primero para evitar duplicar el vencimiento
  // si la inserción del movimiento falla. El error explica el estado parcial.
  if (options.isCurrent?.() === false) throw new Error("El contexto cambió antes de registrar el pago.");
  const { data: updated, error: updateError } = await client().from("subscriptions")
    .update({ next_due_date: nextDueDate })
    .eq("workspace_id", subscription.workspaceId)
    .eq("id", subscription.id)
    .eq("status", "active")
    .eq("currency_code", subscription.currencyCode)
    .eq("next_due_date", subscription.nextDueDate)
    .select("id, workspace_id, next_due_date").single();
  if (updateError) throw updateError;
  if (updated?.id !== subscription.id || updated.workspace_id !== subscription.workspaceId || updated.next_due_date !== nextDueDate) throw new Error("No se confirmó el avance del próximo cobro. Comprueba el calendario antes de repetir; no se insertó otro movimiento.");
  if (options.isCurrent?.() === false) throw new Error("El contexto cambió después de avanzar el cobro. Comprueba el calendario; no se enviará un movimiento en otro contexto.");

  const [year, month, day] = input.paidDate.split("-").map(Number);
  const peruNow = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const occurredAt = new Date(Date.UTC(year, month - 1, day,
    peruNow.getUTCHours() + 5, peruNow.getUTCMinutes(), peruNow.getUTCSeconds(), peruNow.getUTCMilliseconds())).toISOString();
  const { data: inserted, error: insertError } = await client().from("movements").insert({
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
  }).select("id, workspace_id, subscription_id, source_account_id, source_amount, status").single();
  if (insertError) {
    throw new Error(`El próximo cobro se confirmó en ${nextDueDate}, pero el movimiento quedó por comprobar: ${insertError.message}. No repitas el pago ni registres otro gasto sin revisar Movimientos y el calendario.`);
  }
  const amountType = typeof inserted?.source_amount;
  if (!inserted || !Number.isSafeInteger(inserted.id) || inserted.id <= 0 || inserted.workspace_id !== subscription.workspaceId || inserted.subscription_id !== subscription.id || inserted.source_account_id !== input.accountId || inserted.status !== "posted" ||
    !["number", "string"].includes(amountType) || Number(inserted.source_amount) !== input.amount) throw new Error(`El próximo cobro avanzó a ${nextDueDate}, pero no se confirmó el movimiento esperado. Comprueba el historial antes de repetir.`);
  return nextDueDate;
}
