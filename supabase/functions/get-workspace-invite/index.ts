import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/billing.ts";

type WorkspaceInvitationRow = {
  id: number;
  workspace_id: number;
  invited_by_user_id: string;
  invited_user_id: string;
  invited_email: string;
  invited_display_name: string | null;
  invited_by_display_name: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  status: "pending" | "accepted" | "declined" | "expired" | "revoked";
  token: string;
  note: string | null;
  accepted_at: string | null;
  responded_at: string | null;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type WorkspaceRow = {
  id: number;
  name: string;
  kind: "personal" | "shared";
  description: string | null;
  base_currency_code: string | null;
  owner_user_id: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Metodo no permitido." }, { status: 405 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    if (!token) {
      return jsonResponse({ ok: false, error: "No encontramos el token de esta invitacion." });
    }

    const adminClient = createAdminClient();
    const { data: invitationData, error: invitationError } = await adminClient
      .from("workspace_invitations")
      .select(
        "id, workspace_id, invited_by_user_id, invited_user_id, invited_email, invited_display_name, invited_by_display_name, role, status, token, note, accepted_at, responded_at, last_sent_at, created_at, updated_at",
      )
      .eq("token", token)
      .maybeSingle();

    if (invitationError) {
      throw invitationError;
    }

    if (!invitationData) {
      return jsonResponse({
        ok: false,
        error: "Esta invitacion ya no existe o el enlace no es valido.",
      });
    }

    const invitation = invitationData as WorkspaceInvitationRow;
    const { data: workspaceData, error: workspaceError } = await adminClient
      .from("workspaces")
      .select("id, name, kind, description, base_currency_code, owner_user_id")
      .eq("id", invitation.workspace_id)
      .maybeSingle();

    if (workspaceError) {
      throw workspaceError;
    }

    if (!workspaceData) {
      return jsonResponse({
        ok: false,
        error: "El workspace original ya no esta disponible.",
      });
    }

    const workspace = workspaceData as WorkspaceRow;

    return jsonResponse({
      ok: true,
      invite: {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          kind: workspace.kind,
          description: workspace.description ?? "",
          baseCurrencyCode: workspace.base_currency_code ?? "PEN",
          ownerUserId: workspace.owner_user_id,
        },
        invitation: {
          id: invitation.id,
          workspaceId: invitation.workspace_id,
          invitedByUserId: invitation.invited_by_user_id,
          invitedUserId: invitation.invited_user_id,
          invitedEmail: invitation.invited_email,
          invitedDisplayName: invitation.invited_display_name,
          invitedByDisplayName: invitation.invited_by_display_name,
          role: invitation.role,
          status: invitation.status,
          token: invitation.token,
          note: invitation.note,
          acceptedAt: invitation.accepted_at,
          respondedAt: invitation.responded_at,
          lastSentAt: invitation.last_sent_at,
          createdAt: invitation.created_at,
          updatedAt: invitation.updated_at,
        },
      },
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No pudimos leer esta invitacion de workspace.",
    });
  }
});
