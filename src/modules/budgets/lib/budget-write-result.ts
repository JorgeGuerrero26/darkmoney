import type { BudgetFormInput } from "../../../services/queries/workspace-data";
import { validBudgetDay } from "./budget-date";

export class BudgetWritePreflightError extends Error {}
export const BUDGET_WRITE_TIMEOUT_MS = 15_000;
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
export function validBudgetMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) <= 1e-6;
}

export function assertBudgetWriteScope(input: { workspaceId?: number; userId?: string; budgetId?: number }, workspaceId?: number, userId?: string, target = false) {
  if (!positiveId(workspaceId) || typeof userId !== "string" || !userId.trim() || input.workspaceId !== workspaceId || input.userId !== userId ||
    (target && !positiveId(input.budgetId)) || (input.budgetId !== undefined && !positiveId(input.budgetId))) throw new BudgetWritePreflightError("Revisa la sesión, el espacio y el presupuesto antes de enviar.");
}

export function assertBudgetForm(input: BudgetFormInput) {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 120 || !validBudgetMoney(input.limitAmount) ||
    !Number.isInteger(input.alertPercent) || input.alertPercent < 1 || input.alertPercent > 100 ||
    !validBudgetDay(input.periodStart) || !validBudgetDay(input.periodEnd) || input.periodEnd < input.periodStart ||
    typeof input.currencyCode !== "string" || !/^[A-Z]{3}$/.test(input.currencyCode.trim().toUpperCase()) ||
    !["none", "weekly", "biweekly", "monthly", "quarterly", "yearly"].includes(input.recurrence ?? "none") ||
    typeof input.rolloverEnabled !== "boolean" || typeof input.isActive !== "boolean" ||
    [input.categoryId, input.accountId, input.spendTypeId].some(id => id != null && !positiveId(id))) throw new BudgetWritePreflightError("Revisa el alcance, período, renovación, límite (máximo dos decimales) y aviso del presupuesto.");
}

export function confirmBudgetWrite(data: unknown, input: { workspaceId: number; budgetId?: number }, expected: Record<string, unknown> = {}) {
  const row = data as Record<string, unknown> | null;
  if (!row || !positiveId(row.id) || row.workspace_id !== input.workspaceId || (input.budgetId !== undefined && row.id !== input.budgetId) ||
    Object.entries(expected).some(([key, value]) => {
      const actual = row[key];
      if (["limit_amount", "alert_percent"].includes(key) && typeof value === "number") return !["number", "string"].includes(typeof actual) || (typeof actual === "string" && !/^\d+(?:\.\d+)?$/.test(actual)) || !Number.isFinite(Number(actual)) || Number(actual) !== value;
      return actual !== value;
    })) throw new Error("No se confirmó el presupuesto afectado. Puede haberse guardado: comprueba el módulo antes de repetir.");
  return { id: row.id as number, workspaceId: input.workspaceId };
}

/** Bounded wait, not a rollback or server idempotency guarantee. */
export async function verifyBudgetWrite(write: (signal: AbortSignal) => PromiseLike<{ data: unknown; error: unknown }>, input: { workspaceId: number; budgetId?: number }, expected: Record<string, unknown> = {}) {
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(async () => { const { data, error } = await write(controller.signal); if (error) throw error; return confirmBudgetWrite(data, input, expected); }),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("La respuesta tardó demasiado. Comprueba Presupuestos antes de repetir.")); }, BUDGET_WRITE_TIMEOUT_MS); }),
    ]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

/** Only explicit single-statement rejection or preflight; never infer failure from a lost reply. */
export function isBudgetWriteRejected(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  return error instanceof BudgetWritePreflightError || (typeof code === "string" && /^(22|23|42)[A-Z0-9]{3}$/.test(code));
}
