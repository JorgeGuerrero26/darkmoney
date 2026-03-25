import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient, getAuthenticatedUser } from "../_shared/billing.ts";

type WorkspaceInvitationRow = {
  id: number;
  workspace_id: number;
  invited_user_id: string;
  invited_email: string;
  invited_display_name: string | null;
  role: "owner" | "admin" | "member" | "viewer";
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
      return jsonResponse({ ok: false, error: "No encontramos el token para aceptar esta invitacion." });
    }

    const adminClient = createAdminClient();
    const { data: invitationData, error: invitationError } = await adminClient
      .from("workspace_invitations")
      .select("id, workspace_id, invited_user_id, invited_email, invited_display_name, role, status")
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
        error: `Esta invitacion fue enviada a ${invitation.invited_email}. Debes entrar con esa misma cuenta para aceptarla.`,
      });
    }

    if (!["pending", "accepted"].includes(invitation.status)) {
      return jsonResponse({
        ok: false,
        error: "Esta invitacion ya no esta pendiente de aceptacion.",
      });
    }

    const now = new Date().toISOString();
    const { error: membershipError } = await adminClient.from("workspace_members").upsert(
      {
        workspace_id: invitation.workspace_id,
        user_id: user.id,
        role: invitation.role,
        is_default_workspace: false,
      },
      {
        onConflict: "workspace_id,user_id",
      },
    );

    if (membershipError) {
      throw membershipError;
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
      invitation.invited_display_name ||
      "Usuario";

    const { error: updateError } = await adminClient
      .from("workspace_invitations")
      .update({
        status: "accepted",
        invited_display_name: displayName,
        accepted_at: now,
        responded_at: now,
      })
      .eq("id", invitation.id);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({
      ok: true,
      accepted: true,
      alreadyAccepted: invitation.status === "accepted",
      workspaceId: invitation.workspace_id,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No pudimos aceptar esta invitacion de workspace.",
    });
  }
});
