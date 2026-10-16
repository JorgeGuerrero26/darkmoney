export class AccountWritePreflightError extends Error {}
export const ACCOUNT_WRITE_TIMEOUT_MS = 15_000;

/** Abort limits the client's wait, not the server transaction or its possible late commit. */
export async function withAccountWriteTimeout<T>(write: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => write(controller.signal)),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("La respuesta tardó demasiado. El resultado de la cuenta está por comprobar.")); }, ACCOUNT_WRITE_TIMEOUT_MS);
      }),
    ]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

type Scope = { workspaceId: number; userId?: string; accountId?: number; isArchived?: boolean };

export function assertAccountWriteScope(input: Scope, workspaceId?: number, userId?: string, requiresTarget = false) {
  if (!userId || input.userId !== userId || !Number.isSafeInteger(workspaceId) || !workspaceId || workspaceId <= 0 || input.workspaceId !== workspaceId ||
    (requiresTarget && input.accountId === undefined) ||
    (input.accountId !== undefined && (!Number.isSafeInteger(input.accountId) || input.accountId <= 0)) ||
    (input.isArchived !== undefined && typeof input.isArchived !== "boolean")) {
    throw new AccountWritePreflightError("La sesión, la cuenta o el espacio cambiaron antes de enviar. Revisa los datos.");
  }
}

/** A fulfilled HTTP request is not proof that INSERT/UPDATE/DELETE returned the intended row. */
export function confirmAccountWrite(data: unknown, input: { workspaceId: number; accountId?: number }, archived?: boolean) {
  const row = data as { id?: unknown; workspace_id?: unknown; is_archived?: unknown } | null;
  if (!row || !Number.isSafeInteger(row.id) || (row.id as number) <= 0 || row.workspace_id !== input.workspaceId ||
    (input.accountId !== undefined && row.id !== input.accountId) || typeof row.is_archived !== "boolean" ||
    (archived !== undefined && row.is_archived !== archived)) {
    throw new Error("No se confirmó la cuenta afectada. El cambio podría haberse guardado; actualiza y comprueba antes de repetir.");
  }
  return { id: row.id as number, workspaceId: row.workspace_id, isArchived: row.is_archived };
}

/** Single-statement account writes only: an explicit SQL rejection differs from a lost response. */
export function isAccountWriteRejected(error: unknown) {
  if (error instanceof AccountWritePreflightError) return true;
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  return typeof code === "string" && /^(22|23|42)[A-Z0-9]{3}$/.test(code);
}
