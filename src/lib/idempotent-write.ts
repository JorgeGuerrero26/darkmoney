type WriteResult<T> = { data: T | null; error: unknown };
type WriteError = { code?: string; message?: string; details?: string; hint?: string };

export function isAmbiguousWriteError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const detail = error as WriteError;
  if (detail.code?.trim()) return false;
  const message = [detail.message, detail.details, detail.hint].filter(Boolean).join(" ").toLowerCase();
  return ["abort", "timeout", "network request failed", "failed to fetch", "fetcherror", "networkerror"]
    .some((term) => message.includes(term));
}

/** Confirm uncertain writes with the same key; never retry an insert without one. */
export async function runIdempotentInsert<T>(input: {
  insert: () => PromiseLike<WriteResult<T>>;
  lookup: (signal: AbortSignal) => PromiseLike<WriteResult<T>>;
  dedupeKey?: string | null;
  sleep?: (ms: number) => Promise<void>;
  schedule?: readonly number[];
  lookupTimeoutMs?: number;
}): Promise<{ data: T; created: boolean }> {
  let result: WriteResult<T>;
  try {
    result = await input.insert();
  } catch (error) {
    result = { data: null, error };
  }
  if (!result.error && result.data) return { data: result.data, created: true };
  const code = (result.error as WriteError | null)?.code;
  if (input.dedupeKey && (code === "23505" || isAmbiguousWriteError(result.error))) {
    const sleep = input.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    for (const delay of input.schedule ?? [0, 1_200, 2_500, 4_000]) {
      if (delay > 0) await sleep(delay);
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const found = await Promise.race([
          Promise.resolve(input.lookup(controller.signal)),
          new Promise<WriteResult<T>>((resolve) => {
            timeout = setTimeout(() => {
              controller.abort();
              resolve({ data: null, error: new Error("timeout") });
            }, input.lookupTimeoutMs ?? 4_000);
          }),
        ]);
        if (found.data) return { data: found.data, created: false };
        if (found.error && !isAmbiguousWriteError(found.error)) break;
        // A clean empty response can precede a server commit after a timeout.
      } catch (error) {
        if (!isAmbiguousWriteError(error)) break;
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
      }
    }
  }
  throw result.error ?? new Error("No pudimos confirmar el movimiento guardado.");
}
