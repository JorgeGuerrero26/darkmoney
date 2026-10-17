import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecurringIncomeOccurrence } from "../../../types/domain";

const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const validDay = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** No missing-table fallback or truncated sample may masquerade as a verified empty history. */
export async function readIncomeHistory(client: SupabaseClient, workspaceId: number, incomeId: number, userId: string, signal: AbortSignal): Promise<RecurringIncomeOccurrence[]> {
  if (!positiveId(workspaceId) || !positiveId(incomeId) || !userId) throw new Error("No hay una sesión, un ingreso o un espacio válidos para leer el historial.");
  signal.throwIfAborted();
  const parent = await client.from("recurring_income").select("id, workspace_id").eq("workspace_id", workspaceId).eq("id", incomeId).abortSignal(signal).single();
  if (parent.error) throw parent.error;
  if (parent.data?.id !== incomeId || parent.data.workspace_id !== workspaceId) throw new Error("No se pudo comprobar el ingreso de este espacio.");
  const result: RecurringIncomeOccurrence[] = [], ids = new Set<number>();
  let total: number | undefined;
  for (let from = 0; ; from += 500) {
    signal.throwIfAborted();
    const page = await client.from("recurring_income_occurrences")
      .select("id, workspace_id, recurring_income_id, expected_date, actual_date, amount, currency_code, movement_id, status, notes, created_at", { count: "exact" })
      .eq("workspace_id", workspaceId).eq("recurring_income_id", incomeId)
      .order("actual_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false })
      .range(from, from + 499).abortSignal(signal);
    if (page.error) throw page.error;
    signal.throwIfAborted();
    if (!Array.isArray(page.data) || !Number.isSafeInteger(page.count) || page.count! < 0 || (total !== undefined && total !== page.count)) throw new Error("No se pudo comprobar el historial completo de llegadas.");
    total = page.count!;
    if (page.data.length !== Math.min(500, Math.max(0, total - from))) throw new Error("El historial de llegadas está incompleto. Actualiza antes de usar sus totales.");
    for (const row of page.data) {
      const amount = row.amount, numeric = Number(amount), cents = Math.round(numeric * 100);
      if (!positiveId(row.id) || ids.has(row.id) || row.workspace_id !== workspaceId || row.recurring_income_id !== incomeId ||
        !validDay(row.expected_date) || (row.actual_date !== null && !validDay(row.actual_date)) ||
        !["on_time", "late", "missed"].includes(row.status) || (row.status !== "missed" && row.actual_date === null) ||
        !["number", "string"].includes(typeof amount) || (typeof amount === "string" && !/^\d+(?:\.\d+)?$/.test(amount)) || !Number.isFinite(numeric) || numeric < 0 || !Number.isSafeInteger(cents) || Math.abs(numeric * 100 - cents) > 1e-6 ||
        typeof row.currency_code !== "string" || !/^[A-Z]{3}$/.test(row.currency_code) ||
        (row.movement_id !== null && !positiveId(row.movement_id)) || (row.notes !== null && typeof row.notes !== "string") ||
        (row.created_at !== null && (typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at))))) throw new Error("El historial cambió o contiene fechas, importes o referencias por comprobar.");
      ids.add(row.id);
      result.push({ id: row.id, workspaceId, recurringIncomeId: incomeId, expectedDate: row.expected_date, actualDate: row.actual_date,
        amount: numeric, currencyCode: row.currency_code, movementId: row.movement_id, status: row.status, notes: row.notes, createdAt: row.created_at ?? "" });
    }
    if (result.length === total) return result;
  }
}
