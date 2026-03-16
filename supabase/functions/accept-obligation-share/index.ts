import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  createAdminClient,
  getAuthenticatedUser,
} from "../_shared/mercado-pago.ts";

type ShareRow = {
  id: number;
  invited_user_id: string;
  invited_email: string;
  status: "pending" | "accepted" | "declined" | "revoked";
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Metodo no permitido." }, { status: 405 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    if (!token) {
      return jsonResponse({ ok: false, error: "No encontramos el token para aceptar esta invitacion." });
    }

    const adminClient = createAdminClient();
    const { data: shareData, error: shareError } = await adminClient
      .from("obligation_shares")
      .select("id, invited_user_id, invited_email, status")
      .eq("token", token)
      .maybeSingle();

    if (shareError) {
      throw shareError;
    }

    if (!shareData) {
      return jsonResponse({ ok: false, error: "La invitacion ya no existe o no esta disponible." });
    }

    const share = shareData as ShareRow;

    if (share.invited_user_id !== user.id) {
      return jsonResponse({
        ok: false,
        error: `Esta invitacion fue enviada a ${share.invited_email}. Debes entrar con esa misma cuenta para aceptarla.`,
      });
    }

    if (share.status === "accepted") {
      return jsonResponse({ ok: true, accepted: true, alreadyAccepted: true });
    }

    if (share.status !== "pending") {
      return jsonResponse({
        ok: false,
        error: "Esta invitacion ya no esta pendiente de aceptacion.",
      });
    }

    const { data: profileData } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const displayName =
      profileData?.full_name?.trim() ||
      ((user.user_metadata ?? {}) as { full_name?: string }).full_name?.trim() ||
      user.email?.split("@")[0] ||
      "Usuario";

    const now = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("obligation_shares")
      .update({
        status: "accepted",
        invited_display_name: displayName,
        accepted_at: now,
        responded_at: now,
      })
      .eq("id", share.id);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({ ok: true, accepted: true, alreadyAccepted: false });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No pudimos aceptar esta invitacion compartida.",
    });
  }
});
