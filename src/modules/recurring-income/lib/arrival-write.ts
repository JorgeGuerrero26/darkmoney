import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConfirmArrivalInput } from "../../../services/queries/workspace-data";
import type { RecurringIncomeSummary } from "../../../types/domain";
import { advanceNextExpectedDate } from "./recurring-income-parity";

export const ARRIVAL_WRITE_TIMEOUT_MS = 15_000;
export type ArrivalWriteInput = ConfirmArrivalInput & { isCurrent: () => boolean };
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
function money(value: unknown): number | null {
  if (!["number", "string"].includes(typeof value) || (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value))) return null;
  const amount = Number(value), cents = Math.round(amount * 100);
  return Number.isFinite(amount) && amount > 0 && Number.isSafeInteger(cents) && Math.abs(amount * 100 - cents) <= 1e-6 ? amount : null;
}
function day(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Preserves the native movement → occurrence → calendar sequence; not an atomic transaction. */
export async function confirmArrivalWrite(client: SupabaseClient, input: ArrivalWriteInput, workspaceId?: number, userId?: string) {
  if (!positiveId(workspaceId) || input.workspaceId !== workspaceId || !userId || input.userId !== userId || !positiveId(input.recurringIncomeId) || !positiveId(input.accountId) ||
    !day(input.actualDate) || !day(input.expectedDate) || !day(input.nextExpectedDate) || typeof input.amount !== "number" || typeof input.currentBaseAmount !== "number" || money(input.amount) !== input.amount || money(input.currentBaseAmount) !== input.currentBaseAmount ||
    (input.newBaseAmount !== null && (money(input.newBaseAmount) !== input.newBaseAmount || input.newBaseAmount !== input.amount)) ||
    typeof input.isCurrent !== "function" || !input.isCurrent()) throw new Error("Revisa la sesión, el espacio, la cuenta, las fechas y los montos antes de confirmar.");
  const controller = new AbortController(), signal = controller.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const assertCurrent = () => { signal.throwIfAborted(); if (!input.isCurrent()) throw new Error("El acceso cambió. Comprueba la llegada y Movimientos antes de repetir."); };
  async function write() {
    assertCurrent();
    const parent = await client.from("recurring_income")
      .select("id, workspace_id, status, currency_code, amount, account_id, category_id, payer_party_id, name, description, frequency, interval_count, day_of_month, next_expected_date")
      .eq("workspace_id", workspaceId!).eq("id", input.recurringIncomeId).abortSignal(signal).single();
    if (parent.error) throw parent.error;
    const row = parent.data;
    if (!row || row.id !== input.recurringIncomeId || row.workspace_id !== workspaceId || row.status !== "active" || row.currency_code !== input.currencyCode ||
      money(row.amount) !== input.currentBaseAmount || row.account_id !== input.currentAccountId || row.category_id !== input.categoryId || row.payer_party_id !== input.payerPartyId ||
      row.name !== input.recurringIncomeName || row.description !== input.description || row.next_expected_date !== input.expectedDate ||
      !["daily", "weekly", "monthly", "quarterly", "yearly", "custom"].includes(row.frequency) || !positiveId(row.interval_count) ||
      (row.day_of_month !== null && (!positiveId(row.day_of_month) || row.day_of_month > 31))) throw new Error("El ingreso o su calendario cambiaron. No se envió la llegada.");
    const expectedNext = advanceNextExpectedDate({ nextExpectedDate: row.next_expected_date, frequency: row.frequency, intervalCount: row.interval_count, dayOfMonth: row.day_of_month } as RecurringIncomeSummary);
    if (input.nextExpectedDate !== expectedNext) throw new Error("El próximo vencimiento no coincide con el calendario actual. No se envió la llegada.");
    assertCurrent();
    const account = await client.from("accounts").select("id, workspace_id, currency_code, is_archived")
      .eq("workspace_id", workspaceId!).eq("id", input.accountId).abortSignal(signal).single();
    if (account.error) throw account.error;
    if (account.data?.id !== input.accountId || account.data.workspace_id !== workspaceId || account.data.currency_code !== input.currencyCode || account.data.is_archived !== false) throw new Error("La cuenta de destino no está activa en el espacio y moneda actuales.");
    assertCurrent();
    const previous = await client.from("recurring_income_occurrences").select("id")
      .eq("workspace_id", workspaceId!).eq("recurring_income_id", input.recurringIncomeId).eq("expected_date", input.expectedDate).abortSignal(signal).maybeSingle();
    if (previous.error) throw previous.error;
    if (previous.data !== null) throw new Error("Esta llegada ya fue confirmada o su lectura está por comprobar. Actualiza antes de continuar.");
    assertCurrent();
    const updateBase = input.newBaseAmount !== null && input.newBaseAmount !== input.currentBaseAmount;
    const formatAmount = (amount: number) => `${input.currencyCode.trim().toUpperCase()} ${amount.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const baseNote = updateBase ? `El monto esperado de las próximas llegadas pasa de ${formatAmount(input.currentBaseAmount)} a ${formatAmount(input.newBaseAmount!)}.` : "";
    const notes = [input.notes.trim(), baseNote].filter(Boolean).join("\n") || null;
    const peruTime = new Date(Date.now() - 5 * 3600000).toISOString().slice(11, 23);
    const occurredAt = new Date(`${input.actualDate}T${peruTime}-05:00`).toISOString();
    const movement = await client.from("movements").insert({
      workspace_id: workspaceId, created_by_user_id: userId, updated_by_user_id: userId, movement_type: "income", status: "posted",
      occurred_at: occurredAt, description: input.description?.trim() || input.recurringIncomeName.trim(), notes,
      source_account_id: null, source_amount: null, destination_account_id: input.accountId, destination_amount: input.amount,
      category_id: input.categoryId, counterparty_id: input.payerPartyId,
      metadata: { recurring_income_id: input.recurringIncomeId, recurring_income_expected_date: input.expectedDate, recurring_income_actual_date: input.actualDate,
        recurring_income_confirmed_arrival: true, recurring_income_base_change_kind: updateBase ? (input.newBaseAmount! > input.currentBaseAmount ? "bonus" : "discount") : null,
        recurring_income_base_amount_before: input.currentBaseAmount, recurring_income_base_amount_after: updateBase ? input.newBaseAmount : null },
    }).select("id, workspace_id, movement_type, status, occurred_at, source_account_id, source_amount, destination_account_id, destination_amount, metadata").abortSignal(signal).single();
    if (movement.error) throw movement.error;
    const savedMovement = movement.data;
    if (!savedMovement || !positiveId(savedMovement.id) || savedMovement.workspace_id !== workspaceId || savedMovement.movement_type !== "income" || savedMovement.status !== "posted" ||
      savedMovement.source_account_id !== null || savedMovement.source_amount !== null || Date.parse(savedMovement.occurred_at) !== Date.parse(occurredAt) ||
      savedMovement.destination_account_id !== input.accountId || money(savedMovement.destination_amount) !== input.amount || savedMovement.metadata?.recurring_income_id !== input.recurringIncomeId ||
      savedMovement.metadata?.recurring_income_expected_date !== input.expectedDate || savedMovement.metadata?.recurring_income_actual_date !== input.actualDate || savedMovement.metadata?.recurring_income_confirmed_arrival !== true ||
      savedMovement.metadata?.recurring_income_base_amount_before !== input.currentBaseAmount || savedMovement.metadata?.recurring_income_base_amount_after !== (updateBase ? input.newBaseAmount : null)) throw new Error("El movimiento de llegada no se confirmó. Puede haberse guardado; no repitas ni envíes otra fase.");
    assertCurrent();
    const status = input.actualDate <= input.expectedDate ? "on_time" : "late";
    const occurrence = await client.from("recurring_income_occurrences").insert({ workspace_id: workspaceId, recurring_income_id: input.recurringIncomeId,
      expected_date: input.expectedDate, actual_date: input.actualDate, amount: input.amount, currency_code: input.currencyCode,
      movement_id: savedMovement.id, status, notes,
    }).select("id, workspace_id, recurring_income_id, expected_date, actual_date, amount, currency_code, movement_id, status").abortSignal(signal).single();
    if (occurrence.error) throw occurrence.error;
    const savedOccurrence = occurrence.data;
    if (!savedOccurrence || !positiveId(savedOccurrence.id) || savedOccurrence.workspace_id !== workspaceId || savedOccurrence.recurring_income_id !== input.recurringIncomeId ||
      savedOccurrence.expected_date !== input.expectedDate || savedOccurrence.actual_date !== input.actualDate || money(savedOccurrence.amount) !== input.amount ||
      savedOccurrence.currency_code !== input.currencyCode || savedOccurrence.movement_id !== savedMovement.id || savedOccurrence.status !== status) throw new Error("El movimiento se confirmó, pero la llegada del historial está por comprobar. No se avanzó otra fase.");
    assertCurrent();
    let update = client.from("recurring_income").update({ next_expected_date: expectedNext, ...(updateBase ? { amount: input.newBaseAmount } : {}), ...(!input.currentAccountId ? { account_id: input.accountId } : {}) })
      .eq("id", input.recurringIncomeId).eq("workspace_id", workspaceId!).eq("next_expected_date", input.expectedDate).eq("status", "active")
      .eq("currency_code", input.currencyCode).eq("amount", input.currentBaseAmount).eq("frequency", row.frequency).eq("interval_count", row.interval_count);
    update = row.day_of_month === null ? update.is("day_of_month", null) : update.eq("day_of_month", row.day_of_month);
    update = input.currentAccountId === null ? update.is("account_id", null) : update.eq("account_id", input.currentAccountId);
    const updated = await update.select("id, workspace_id, next_expected_date, amount, account_id").abortSignal(signal).single();
    if (updated.error) throw updated.error;
    if (updated.data?.id !== input.recurringIncomeId || updated.data.workspace_id !== workspaceId || updated.data.next_expected_date !== expectedNext ||
      money(updated.data.amount) !== (updateBase ? input.newBaseAmount : input.currentBaseAmount) || updated.data.account_id !== (input.currentAccountId ?? input.accountId)) throw new Error("Movimiento y llegada confirmados; el próximo vencimiento está por comprobar. No repitas la llegada.");
    return { movementId: savedMovement.id, occurrenceId: savedOccurrence.id, nextExpectedDate: expectedNext, updatedBaseAmount: updateBase ? input.newBaseAmount : null };
  }
  try {
    return await Promise.race([write(), new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("La llegada tardó demasiado y puede haberse guardado parcialmente. Comprueba historial y Movimientos antes de repetir.")); }, ARRIVAL_WRITE_TIMEOUT_MS);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
