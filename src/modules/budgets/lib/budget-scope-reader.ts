import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountSummary, BudgetOverview, CategorySummary, MovementRecord } from "../../../types/domain";
import { budgetDateFrom, budgetDateTo, validBudgetDay } from "./budget-date";

export type BudgetScopeInput = {
  workspaceId: number;
  userId: string;
  budgets: BudgetOverview[];
  accounts: AccountSummary[];
  categories: CategorySummary[];
};
const PAGE_SIZE = 500;
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const nullableId = (value: unknown) => value === null || positiveId(value);
const currency = (value: unknown): value is string => typeof value === "string" && /^[A-Z]{3}$/.test(value);
const invalid = () => new Error("El consumo contiene fechas, importes o referencias por comprobar. Actualiza Presupuestos antes de usar sus totales.");

function readMoney(value: unknown): number | null {
  if (value === null) return null;
  if (!["number", "string"].includes(typeof value) || (typeof value === "string" && !/^-?\d+(?:\.\d+)?$/.test(value))) throw invalid();
  const amount = Number(value), cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 1e-6) throw invalid();
  return amount;
}

/** Explicit timezone, real date/time, PostgreSQL microsecond precision. */
function readTime(value: unknown) {
  if (typeof value !== "string") throw invalid();
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  const millis = Date.parse(value);
  if (!match || !validBudgetDay(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59 || !Number.isFinite(millis)) throw invalid();
  return { millis, micros: BigInt(millis) * 1000n + BigInt((match[5] ?? "").padEnd(6, "0").slice(3)) };
}

/** Complete visible ledger, not a database snapshot transaction or proof of RLS completeness. */
export async function readBudgetScopeMovements(client: SupabaseClient, input: BudgetScopeInput, signal: AbortSignal): Promise<MovementRecord[]> {
  const { workspaceId, userId, budgets, accounts, categories } = input;
  if (!positiveId(workspaceId) || typeof userId !== "string" || !userId.trim()) throw new Error("No hay una sesión o espacio válidos para leer el consumo.");
  signal.throwIfAborted();
  const budgetIds = new Set<number>();
  for (const budget of budgets) {
    if (!budget || !positiveId(budget.id) || budgetIds.has(budget.id) || budget.workspaceId !== workspaceId || !validBudgetDay(budget.periodStart) || !validBudgetDay(budget.periodEnd) || budget.periodStart > budget.periodEnd) throw invalid();
    budgetIds.add(budget.id);
  }
  if (!budgets.length) return [];
  const start = budgets.reduce((min, budget) => budget.periodStart < min ? budget.periodStart : min, budgets[0].periodStart);
  const end = budgets.reduce((max, budget) => budget.periodEnd > max ? budget.periodEnd : max, budgets[0].periodEnd);
  const fromTime = budgetDateFrom(start), untilTime = new Date(Date.parse(budgetDateTo(end)) + 1).toISOString();
  const fromMillis = Date.parse(fromTime), untilMillis = Date.parse(untilTime);
  const accountMap = new Map<number, AccountSummary>(), categoryMap = new Map<number, CategorySummary>();
  for (const account of accounts) {
    if (!account || !positiveId(account.id) || accountMap.has(account.id) || account.workspaceId !== workspaceId || !currency(account.currencyCode) || typeof account.name !== "string") throw invalid();
    accountMap.set(account.id, account);
  }
  for (const category of categories) {
    if (!category || !positiveId(category.id) || categoryMap.has(category.id) || typeof category.name !== "string") throw invalid();
    categoryMap.set(category.id, category);
  }
  const result: MovementRecord[] = [], ids = new Set<number>();
  let total: number | undefined, previous: { micros: bigint; id: number } | undefined;
  for (let from = 0; ; from += PAGE_SIZE) {
    signal.throwIfAborted();
    const page = await client.from("movements")
      .select("id, workspace_id, status, movement_type, occurred_at, description, category_id, spend_type_id, category:categories(id, workspace_id, default_spend_type_id), source_account_id, source_amount, destination_account_id, destination_amount", { count: "exact" })
      .eq("workspace_id", workspaceId).eq("status", "posted")
      .gte("occurred_at", fromTime).lt("occurred_at", untilTime)
      .order("occurred_at", { ascending: false }).order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1).abortSignal(signal);
    if (page.error) throw page.error;
    signal.throwIfAborted();
    if (!Array.isArray(page.data) || !Number.isSafeInteger(page.count) || page.count! < 0 || (total !== undefined && total !== page.count)) throw new Error("No se pudo comprobar el conteo completo del consumo.");
    total = page.count!;
    if (page.data.length !== Math.min(PAGE_SIZE, Math.max(0, total - from))) throw new Error("Los movimientos del presupuesto están incompletos. Actualiza antes de usar sus totales.");
    for (const row of page.data) {
      if (!row || !positiveId(row.id) || ids.has(row.id) || row.workspace_id !== workspaceId || row.status !== "posted" ||
        !["expense", "income", "transfer", "subscription_payment", "obligation_opening", "obligation_payment", "refund", "adjustment"].includes(row.movement_type) ||
        (row.description !== null && typeof row.description !== "string") || !nullableId(row.category_id) || !nullableId(row.spend_type_id) || !nullableId(row.source_account_id) || !nullableId(row.destination_account_id)) throw invalid();
      const occurred = readTime(row.occurred_at);
      if (occurred.millis < fromMillis || occurred.millis >= untilMillis || (previous && (occurred.micros > previous.micros || (occurred.micros === previous.micros && row.id >= previous.id)))) throw invalid();
      const sourceAmount = readMoney(row.source_amount), destinationAmount = readMoney(row.destination_amount);
      const source = row.source_account_id === null ? null : accountMap.get(row.source_account_id);
      const destination = row.destination_account_id === null ? null : accountMap.get(row.destination_account_id);
      if ((row.source_account_id !== null && !source) || (row.destination_account_id !== null && !destination) || (sourceAmount !== null && !source) || (destinationAmount !== null && !destination) || (sourceAmount === null && destinationAmount === null)) throw invalid();
      const category = row.category_id === null ? null : categoryMap.get(row.category_id);
      const joined = row.category as { id?: unknown; workspace_id?: unknown; default_spend_type_id?: unknown } | null;
      if (row.category_id === null ? joined !== null : !category || !joined || joined.id !== row.category_id || joined.workspace_id !== workspaceId || !nullableId(joined.default_spend_type_id)) throw invalid();
      if (category?.defaultSpendTypeId !== undefined && category.defaultSpendTypeId !== joined?.default_spend_type_id) throw new Error("El tipo de gasto de una categoría cambió durante la lectura. Actualiza Presupuestos.");
      ids.add(row.id); previous = { micros: occurred.micros, id: row.id };
      result.push({ id: row.id, workspaceId: row.workspace_id, status: row.status, movementType: row.movement_type,
        occurredAt: row.occurred_at, description: row.description ?? "", categoryId: row.category_id, category: category?.name ?? "Sin categoría",
        spendTypeId: row.spend_type_id, categoryDefaultSpendTypeId: (joined?.default_spend_type_id as number | null) ?? null, counterparty: "Sin contraparte",
        sourceAccountId: row.source_account_id, sourceAccountName: source?.name ?? null, sourceCurrencyCode: source?.currencyCode ?? null, sourceAmount,
        destinationAccountId: row.destination_account_id, destinationAccountName: destination?.name ?? null, destinationCurrencyCode: destination?.currencyCode ?? null, destinationAmount });
    }
    if (result.length === total) return result;
  }
}
