import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient, getAuthenticatedUser } from "../_shared/mercado-pago.ts";

type MembershipRow = {
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  is_default_workspace: boolean;
  joined_at: string;
};

type WorkspaceRow = {
  id: number;
  owner_user_id: string;
  name: string;
  kind: "personal" | "shared";
  base_currency_code: string | null;
  description: string | null;
  is_archived: boolean;
};

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

type LookupUserRow = {
  user_id: string;
  email: string;
  full_name: string;
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
    const workspaceId = Number(body?.workspaceId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return jsonResponse({ ok: false, error: "No encontramos el workspace solicitado." });
    }

    const adminClient = createAdminClient();
    const { data: requesterMembershipData, error: requesterMembershipError } = await adminClient
      .from("workspace_members")
      .select("user_id, role, is_default_workspace, joined_at")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (requesterMembershipError) {
      throw requesterMembershipError;
    }

    if (!requesterMembershipData) {
      return jsonResponse({
        ok: false,
        error: "No tienes acceso a este workspace colaborativo.",
      });
    }

    const requesterMembership = requesterMembershipData as MembershipRow;
    const { data: workspaceData, error: workspaceError } = await adminClient
      .from("workspaces")
      .select("id, owner_user_id, name, kind, base_currency_code, description, is_archived")
      .eq("id", workspaceId)
      .maybeSingle();

    if (workspaceError) {
      throw workspaceError;
    }

    if (!workspaceData) {
      return jsonResponse({ ok: false, error: "No encontramos ese workspace." });
    }

    const workspace = workspaceData as WorkspaceRow;
    const { data: membershipsData, error: membershipsError } = await adminClient
      .from("workspace_members")
      .select("user_id, role, is_default_workspace, joined_at")
      .eq("workspace_id", workspaceId)
      .order("joined_at", { ascending: true });

    if (membershipsError) {
      throw membershipsError;
    }

    const memberships = (membershipsData as MembershipRow[] | null) ?? [];
    const memberUserIds = memberships.map((membership) => membership.user_id);
    const { data: usersLookupData, error: usersLookupError } = await adminClient.rpc(
      "find_darkmoney_users_by_ids",
      { lookup_user_ids: memberUserIds },
    );

    if (usersLookupError) {
      throw usersLookupError;
    }

    const usersById = new Map<string, LookupUserRow>(
      ((usersLookupData as LookupUserRow[] | null) ?? []).map((entry) => [entry.user_id, entry]),
    );

    const { data: invitationsData, error: invitationsError } = await adminClient
      .from("workspace_invitations")
      .select(
        "id, workspace_id, invited_by_user_id, invited_user_id, invited_email, invited_display_name, invited_by_display_name, role, status, token, note, accepted_at, responded_at, last_sent_at, created_at, updated_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .order("updated_at", { ascending: false });

    if (invitationsError) {
      throw invitationsError;
    }

    const invitations = (invitationsData as WorkspaceInvitationRow[] | null) ?? [];

    return jsonResponse({
      ok: true,
      collaboration: {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          kind: workspace.kind,
          role: requesterMembership.role,
          description: workspace.description ?? "",
          baseCurrencyCode: workspace.base_currency_code ?? "PEN",
          isDefaultWorkspace: requesterMembership.is_default_workspace,
          isArchived: workspace.is_archived,
          joinedAt: requesterMembership.joined_at,
          ownerUserId: workspace.owner_user_id,
        },
        requesterRole: requesterMembership.role,
        canManageMembers: requesterMembership.role === "owner" || requesterMembership.role === "admin",
        members: memberships.map((membership) => {
          const userLookup = usersById.get(membership.user_id);

          return {
            userId: membership.user_id,
            fullName: userLookup?.full_name ?? "Miembro DarkMoney",
            email: userLookup?.email ?? null,
            role: membership.role,
            isDefaultWorkspace: membership.is_default_workspace,
            joinedAt: membership.joined_at,
            isCurrentUser: membership.user_id === user.id,
          };
        }),
        invitations: invitations.map((invitation) => ({
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
        })),
      },
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No pudimos leer miembros e invitaciones de este workspace.",
    });
  }
});
