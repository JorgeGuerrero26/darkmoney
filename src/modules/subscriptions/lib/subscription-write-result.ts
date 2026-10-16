export class SubscriptionWritePreflightError extends Error {}
export const SUBSCRIPTION_WRITE_TIMEOUT_MS = 15_000;

/** A bounded wait/abort is not a server rollback. Never replay an uncertain write. */
export async function withSubscriptionWriteTimeout<T>(write: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => write(controller.signal)),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("La respuesta tardó demasiado. Comprueba la suscripción y su calendario antes de repetir.")); }, SUBSCRIPTION_WRITE_TIMEOUT_MS);
      }),
    ]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

export function assertSubscriptionWriteScope(
  input: { workspaceId: number; userId: string; subscriptionId?: number },
  workspaceId?: number, userId?: string, requiresTarget = false,
) {
  if (!userId || input.userId !== userId || !Number.isSafeInteger(workspaceId) || !workspaceId || workspaceId <= 0 || input.workspaceId !== workspaceId ||
    (requiresTarget && input.subscriptionId === undefined) ||
    (input.subscriptionId !== undefined && (!Number.isSafeInteger(input.subscriptionId) || input.subscriptionId <= 0))) {
    throw new SubscriptionWritePreflightError("La sesión, la suscripción o el espacio cambiaron antes de enviar.");
  }
}

export function confirmSubscriptionWrite(data: unknown, input: { workspaceId: number; subscriptionId?: number }, expected: Record<string, unknown> = {}) {
  const row = data as Record<string, unknown> | null;
  if (!row || !Number.isSafeInteger(row.id) || (row.id as number) <= 0 || row.workspace_id !== input.workspaceId ||
    (input.subscriptionId !== undefined && row.id !== input.subscriptionId) || Object.entries(expected).some(([key, value]) => row[key] !== value)) {
    throw new Error("No se confirmó la suscripción afectada. El cambio podría haberse guardado; actualiza y comprueba antes de repetir.");
  }
  return { id: row.id as number, workspaceId: input.workspaceId };
}

/** Only for single-statement saves, never for a partially completed deletion/payment. */
export function isSubscriptionWriteRejected(error: unknown) {
  if (error instanceof SubscriptionWritePreflightError) return true;
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  return typeof code === "string" && /^(22|23|42)[A-Z0-9]{3}$/.test(code);
}
