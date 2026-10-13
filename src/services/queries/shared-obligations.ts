import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSharedObligationResponse } from "../../modules/obligations/lib/shared-obligation-response";

type Client = Pick<SupabaseClient, "rpc" | "auth">;

export async function readLegacySharedObligations(client: Pick<SupabaseClient, "functions">, signal?: AbortSignal) {
  const { data, error } = await client.functions.invoke("list-shared-obligations", { body: {}, signal });
  if (error) throw error;
  return data as unknown;
}

export async function readSharedObligations(client: Client, userId: string, legacy: (signal: AbortSignal) => Promise<unknown>, options: { signal?: AbortSignal; timeoutMs?: number } = {}) {
  if (!userId) throw new Error("Se necesita una sesión para consultar lo compartido.");
  if (options.signal?.aborted) throw new Error("La consulta de accesos compartidos fue cancelada.");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectCancelled: (error: Error) => void = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => { rejectCancelled = reject; });
  const cancel = () => { controller.abort(); rejectCancelled(new Error("La consulta de accesos compartidos fue cancelada.")); };
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  timer = setTimeout(() => {
    controller.abort(); rejectCancelled(new Error("La consulta de accesos compartidos tardó demasiado. Vuelve a intentarlo."));
  }, options.timeoutMs ?? 12_000);
  async function session() {
    if (controller.signal.aborted) throw new Error("Consulta cancelada.");
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session || data.session.user.id !== userId) throw new Error("La sesión cambió. Vuelve a abrir lo compartido.");
    if (controller.signal.aborted) throw new Error("Consulta cancelada.");
    return data.session.user;
  }
  try {
    return await Promise.race([cancelled, (async () => {
      const user = await session();
      const { data, error } = await client.rpc("list_shared_obligations").abortSignal(controller.signal);
      if (controller.signal.aborted) throw new Error("Consulta cancelada.");
      let response: unknown = data;
      if (error) {
        // Only an absent contract may use the old authenticated endpoint.
        // Network, quota, permissions and bad responses must not become empty success.
        const missingRpc = error.code === "PGRST202" && /function (?:public\.)?list_shared_obligations\b/i.test(error.message) ||
          error.code === "42883" && /function (?:public\.)?list_shared_obligations\(\) does not exist/i.test(error.message);
        if (!missingRpc) throw error;
        response = await legacy(controller.signal);
      }
      const currentUser = await session();
      if ((currentUser.email ?? "").toLowerCase() !== (user.email ?? "").toLowerCase()) throw new Error("La sesión cambió mientras consultábamos lo compartido.");
      return parseSharedObligationResponse(response, { userId, email: currentUser.email });
    })()]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}
