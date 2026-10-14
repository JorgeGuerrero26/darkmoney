import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDuplicateVerdict, type DuplicateAiResult } from "../../modules/notifications/lib/duplicate-verdict";
import type { DuplicateCheckBody } from "./detection-duplicates";

/** One cancellable, bounded AI request. Late replies do not authorize financial writes. */
export async function confirmDuplicateWithAi(client: SupabaseClient, body: DuplicateCheckBody, signal?: AbortSignal, timeoutMs = 8000): Promise<DuplicateAiResult> {
  const unknown = (): DuplicateAiResult => ({ verdict: "unknown", reason: null });
  if (signal?.aborted) return unknown();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const stopped = new Promise<DuplicateAiResult>(resolve => {
      const stop = () => { controller.abort(); resolve(unknown()); };
      onAbort = stop; signal?.addEventListener("abort", stop, { once: true });
      timer = setTimeout(stop, timeoutMs);
    });
    const request = client.functions.invoke("movement-duplicate-ai-check", { body, signal: controller.signal })
      .then(({ data, error }) => error ? unknown() : parseDuplicateVerdict(data), () => unknown());
    return await Promise.race([request, stopped]);
  } catch { return unknown(); }
  finally { clearTimeout(timer); if (onAbort) signal?.removeEventListener("abort", onAbort); }
}
