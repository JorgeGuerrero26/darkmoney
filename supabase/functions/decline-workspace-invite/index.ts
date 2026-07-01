import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient, getAuthenticatedUser } from "../_shared/billing.ts";

// Despliegue:
//   npx supabase functions deploy decline-workspace-invite --no-verify-jwt --project-ref <ref>

type WorkspaceInvitationRow = {
  id: number;
  workspace_id: number;
  invited_user_id: string;
  invited_email: string;
  status: "pending" | "accepted" | "declined" | "expired" | "revoked";
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
      return jsonResponse({ ok: false, error: "No encontramos el token para rechazar esta invitacion." });
    }

    const adminClient = createAdminClient();
    const { data: invitationData, error: invitationError } = await adminClient
      .from("workspace_invitations")
      .select("id, workspace_id, invited_user_id, invited_email, status")
      .eq("token", token)
      .maybeSingle();

    if (invitationError) {
      throw invitationError;
    }

    if (!invitationData) {
      return jsonResponse({ ok: false, error: "La invitacion ya no existe o no esta disponible." });
    }

    const invitation = invitationData as WorkspaceInvitationRow;

    if (invitation.invited_user_id !== user.id) {
      return jsonResponse({
        ok: false,
        error: `Esta invitacion fue enviada a ${invitation.invited_email}. Debes entrar con esa misma cuenta para responderla.`,
      });
    }

    if (invitation.status === "accepted") {
      return jsonResponse({ ok: false, alreadyAccepted: true, status: "accepted" });
    }

    if (invitation.status === "declined") {
      return jsonResponse({ ok: true, alreadyDeclined: true, status: "declined" });
    }

    if (invitation.status !== "pending") {
      return jsonResponse({ ok: false, error: "Esta invitacion ya no esta disponible." });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("workspace_invitations")
      .update({ status: "declined", responded_at: now })
      .eq("id", invitation.id);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({ ok: true, status: "declined" });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "No pudimos rechazar esta invitacion de workspace.",
    });
  }
});
