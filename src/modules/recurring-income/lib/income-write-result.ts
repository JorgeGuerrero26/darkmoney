export class IncomeWritePreflightError extends Error {}
export const INCOME_WRITE_TIMEOUT_MS = 15_000;

/** Abort bounds the wait, not a server commit. A late reply must not resume a compound write. */
export async function withIncomeWriteTimeout<T>(write: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => write(controller.signal)),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("La respuesta tardó demasiado. Comprueba el ingreso y su historial antes de repetir.")); }, INCOME_WRITE_TIMEOUT_MS);
      }),
    ]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

export function assertIncomeWriteScope(input: { workspaceId: number; userId: string; recurringIncomeId?: number; amount?: number; grossAmount?: number | null }, workspaceId?: number, userId?: string, requiresTarget = false) {
  const validMoney = (value: number) => Number.isFinite(value) && value > 0 && Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) <= 1e-6;
  if (!userId || input.userId !== userId || !Number.isSafeInteger(workspaceId) || !workspaceId || workspaceId <= 0 || input.workspaceId !== workspaceId ||
    (requiresTarget && input.recurringIncomeId === undefined) || (input.recurringIncomeId !== undefined && (!Number.isSafeInteger(input.recurringIncomeId) || input.recurringIncomeId <= 0)) ||
    (input.amount !== undefined && !validMoney(input.amount)) || (input.grossAmount != null && !validMoney(input.grossAmount))) {
    throw new IncomeWritePreflightError("Revisa la sesión, el espacio, el ingreso y los montos (máximo dos decimales) antes de enviar.");
  }
}

function sameJSON(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (!actual || !expected || typeof actual !== "object" || typeof expected !== "object" || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const left = actual as Record<string, unknown>, right = expected as Record<string, unknown>;
  const keys = Object.keys(right);
  return Object.keys(left).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(left, key) && sameJSON(left[key], right[key]));
}

/** Confirms the requested fields as well as the identity; JSONB key order is not meaningful. */
export function confirmIncomeWrite(data: unknown, input: { workspaceId: number; recurringIncomeId?: number }, expected: Record<string, unknown> = {}) {
  const row = data as Record<string, unknown> | null;
  const numericColumns = new Set(["amount", "gross_amount"]);
  if (!row || !Number.isSafeInteger(row.id) || (row.id as number) <= 0 || row.workspace_id !== input.workspaceId ||
    (input.recurringIncomeId !== undefined && row.id !== input.recurringIncomeId) || Object.entries(expected).some(([key, value]) => {
      const actual = row[key];
      if (numericColumns.has(key) && typeof value === "number") return !["number", "string"].includes(typeof actual) || (typeof actual === "string" && !/^\d+(?:\.\d+)?$/.test(actual)) || !Number.isFinite(Number(actual)) || Number(actual) !== value;
      return !sameJSON(actual, value);
    })) throw new Error("No se confirmó el ingreso afectado. Puede haberse guardado; actualiza y comprueba antes de repetir.");
  return { id: row.id as number, workspaceId: input.workspaceId };
}

/** Single-statement saves only; never use this to replay a partly deleted history. */
export function isIncomeWriteRejected(error: unknown) {
  if (error instanceof IncomeWritePreflightError) return true;
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  return typeof code === "string" && /^(22|23|42)[A-Z0-9]{3}$/.test(code);
}
