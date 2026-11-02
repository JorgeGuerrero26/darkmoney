import { supabase, supabasePublicConfig } from "../../../services/supabase/client";

/** Lo que hay que escribir para confirmar (igual que en la Edge Function delete-account). */
export const DELETE_CONFIRM_WORD = "ELIMINAR";

export type AccountDeletionPreview = {
  mustCancelPro: boolean;
  transfers: Array<{ workspaceName: string; newOwnerName: string }>;
};

export type AccountDeletionResult =
  | { kind: "deleted" }
  | { kind: "cancel_pro_first"; message: string }
  | { kind: "error"; message: string };

const GENERIC_ERROR = "No pudimos eliminar tu cuenta. Revisa tu conexión e inténtalo de nuevo. Si sigue fallando, escríbenos.";

async function callDeleteAccount(body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  const { url, anonKey } = supabasePublicConfig;
  if (!supabase || !url || !anonKey) throw new Error("Supabase no está configurado.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, json: {} };
  const response = await fetch(`${url.replace(/\/+$/, "")}/functions/v1/delete-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, json };
}

/** Qué pasaría al eliminar la cuenta: si Pro se sigue cobrando y qué espacios compartidos pasan a otra persona. */
export async function fetchAccountDeletionPreview(): Promise<AccountDeletionPreview> {
  const { status, json } = await callDeleteAccount({ preview: true });
  if (status !== 200) throw new Error("No pudimos revisar tu cuenta. Revisa tu conexión e inténtalo de nuevo.");
  const transfers = Array.isArray(json.transfers) ? json.transfers : [];
  return {
    mustCancelPro: json.mustCancelPro === true,
    transfers: transfers
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({ workspaceName: String(item.workspaceName ?? "Espacio compartido"), newOwnerName: String(item.newOwnerName ?? "otro miembro") })),
  };
}

export async function deleteMyAccount(confirm: string): Promise<AccountDeletionResult> {
  let response: { status: number; json: Record<string, unknown> };
  try {
    response = await callDeleteAccount({ confirm });
  } catch {
    return { kind: "error", message: GENERIC_ERROR };
  }
  const { status, json } = response;
  if (status === 200 && json.deleted === true) return { kind: "deleted" };
  if (status === 409 && json.error === "cancel_pro_first") {
    return { kind: "cancel_pro_first", message: "Tu plan Pro se sigue cobrando. Cancélalo primero en Configuración → Plan y pagos y vuelve a intentarlo." };
  }
  if (status === 400) return { kind: "error", message: `Escribe ${DELETE_CONFIRM_WORD} para confirmar.` };
  if (status === 401) return { kind: "error", message: "Tu sesión expiró. Vuelve a iniciar sesión e inténtalo otra vez." };
  return { kind: "error", message: GENERIC_ERROR };
}

/** La cuenta ya no existe: se borra lo que este navegador guardaba y se vuelve a la entrada con el aviso. */
export async function leaveAfterAccountDeletion(clearQueries: () => void) {
  clearQueries();
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    // Almacenamiento bloqueado: no hay nada que borrar.
  }
  await supabase?.auth.signOut({ scope: "local" }).catch(() => undefined);
  // Recarga completa: no queda nada de la cuenta en memoria.
  window.location.replace("/auth/login?cuenta=eliminada");
}
