import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import {
  buildAppNavigationUrl,
  createAdminClient,
  getAuthenticatedUser,
  resolveAppUrl,
} from "../_shared/mercado-pago.ts";

type InviteLookupRow = {
  user_id: string;
  email: string;
  full_name: string;
};

type MembershipRow = {
  role: "owner" | "admin" | "member" | "viewer";
};

type WorkspaceRow = {
  id: number;
  name: string;
  kind: "personal" | "shared";
  base_currency_code: string | null;
  description: string | null;
};

type ExistingInvitationRow = {
  id: number;
  invited_user_id: string;
  invited_email: string;
  status: "pending" | "accepted" | "declined" | "expired" | "revoked";
  token: string;
};

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getOptionalText(value: unknown, maxLength = 600) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue.slice(0, maxLength) : null;
}

function isWorkspaceRole(value: unknown): value is "admin" | "member" | "viewer" {
  return value === "admin" || value === "member" || value === "viewer";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getRoleLabel(role: "admin" | "member" | "viewer") {
  switch (role) {
    case "admin":
      return "Administrador";
    case "viewer":
      return "Solo lectura";
    default:
      return "Miembro";
  }
}

function buildWorkspaceInviteEmail(input: {
  appUrl: string;
  inviteUrl: string;
  invitedDisplayName: string;
  invitedByDisplayName: string;
  workspace: WorkspaceRow;
  role: "admin" | "member" | "viewer";
  note?: string | null;
}) {
  const workspaceName = escapeHtml(input.workspace.name);
  const invitedByDisplayName = escapeHtml(input.invitedByDisplayName);
  const invitedDisplayName = escapeHtml(input.invitedDisplayName);
  const roleLabel = escapeHtml(getRoleLabel(input.role));
  const inviteUrl = escapeHtml(input.inviteUrl);
  const bannerUrl = escapeHtml(buildAppNavigationUrl(input.appUrl, "banner-darkmoney.png"));
  const messageBlock = input.note
    ? `
      <div style="margin-top:24px;border-radius:22px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);padding:20px 22px;">
        <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#8ea2bf;">Mensaje incluido</p>
        <p style="margin:0;font-size:15px;line-height:1.9;color:#d8e1f0;">${escapeHtml(input.note)}</p>
      </div>
    `
    : "";

  const html = `
    <div style="margin:0;background:#030711;padding:28px 14px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#f4f7fb;">
      <div style="max-width:680px;margin:0 auto;border-radius:30px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg,#07111d 0%,#050b14 100%);box-shadow:0 30px 100px rgba(0,0,0,0.45);">
        <div style="padding:18px 18px 0;">
          <img alt="DarkMoney" src="${bannerUrl}" style="display:block;width:100%;height:auto;border-radius:24px;border:1px solid rgba(255,255,255,0.08);" />
        </div>
        <div style="padding:30px 28px 32px;">
          <div style="display:inline-block;padding:8px 14px;border-radius:999px;border:1px solid rgba(69,102,214,0.24);background:rgba(69,102,214,0.14);font-size:11px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#a8b9ff;">
            Workspace colaborativo
          </div>
          <h1 style="margin:20px 0 12px;font-size:34px;line-height:1.12;font-weight:700;color:#f7fbff;">${invitedByDisplayName} te invito a un workspace de DarkMoney</h1>
          <p style="margin:0;font-size:16px;line-height:1.9;color:#b4c1d7;">
            Hola ${invitedDisplayName}, te invitaron a colaborar en <strong style="color:#f7fbff;">${workspaceName}</strong>. Cuando aceptes, veras sus cuentas, movimientos, presupuestos, suscripciones y creditos o deudas segun el mismo workspace.
          </p>

          <div style="margin-top:28px;border-radius:26px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);padding:22px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#8ea2bf;">Acceso</p>
            <p style="margin:10px 0 0;font-size:30px;line-height:1.2;font-weight:700;color:#f5f8fd;">${workspaceName}</p>
            <div style="margin-top:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;">
              <div style="border-radius:18px;border:1px solid rgba(255,255,255,0.08);background:rgba(2,6,13,0.42);padding:16px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#8ea2bf;">Rol sugerido</p>
                <p style="margin:10px 0 0;font-size:17px;font-weight:600;color:#f4f7fb;">${roleLabel}</p>
              </div>
              <div style="border-radius:18px;border:1px solid rgba(255,255,255,0.08);background:rgba(2,6,13,0.42);padding:16px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#8ea2bf;">Moneda base</p>
                <p style="margin:10px 0 0;font-size:17px;font-weight:600;color:#f4f7fb;">${escapeHtml(input.workspace.base_currency_code ?? "PEN")}</p>
              </div>
            </div>
          </div>

          ${messageBlock}

          <div style="margin-top:30px;">
            <a href="${inviteUrl}" style="display:inline-block;border-radius:999px;background:#f3f7fd;padding:15px 24px;font-size:15px;font-weight:700;color:#07111d;text-decoration:none;">
              Revisar y aceptar en DarkMoney
            </a>
          </div>

          <p style="margin:22px 0 0;font-size:13px;line-height:1.8;color:#8ea2bf;">
            Si el boton no abre directo, copia este enlace en tu navegador:
          </p>
          <p style="margin:10px 0 0;word-break:break-all;font-size:13px;line-height:1.8;color:#6be4c5;">
            ${inviteUrl}
          </p>
        </div>
      </div>
    </div>
  `;

  const text = `${input.invitedByDisplayName} te invito al workspace "${input.workspace.name}" en DarkMoney.\n\nRol sugerido: ${getRoleLabel(input.role)}\nMoneda base: ${input.workspace.base_currency_code ?? "PEN"}\n\nRevisa y acepta aqui:\n${input.inviteUrl}`;

  return {
    subject: `${input.invitedByDisplayName} te invito a colaborar en DarkMoney`,
    html,
    text,
  };
}

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
    const invitedEmail = normalizeEmail(body?.invitedEmail);
    const note = getOptionalText(body?.note);
    const role = isWorkspaceRole(body?.role) ? body.role : "member";

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return jsonResponse({ ok: false, error: "No encontramos el workspace que quieres compartir." });
    }

    if (!invitedEmail) {
      return jsonResponse({ ok: false, error: "Ingresa el correo del usuario que recibira la invitacion." });
    }

    const adminClient = createAdminClient();
    const { data: membershipData, error: membershipError } = await adminClient
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    const requesterMembership = membershipData as MembershipRow | null;

    if (!requesterMembership || (requesterMembership.role !== "owner" && requesterMembership.role !== "admin")) {
      return jsonResponse({
        ok: false,
        error: "Necesitas ser owner o admin de este workspace para invitar personas.",
      });
    }

    const { data: workspaceData, error: workspaceError } = await adminClient
      .from("workspaces")
      .select("id, name, kind, base_currency_code, description")
      .eq("id", workspaceId)
      .maybeSingle();

    if (workspaceError) {
      throw workspaceError;
    }

    if (!workspaceData) {
      return jsonResponse({ ok: false, error: "No encontramos ese workspace." });
    }

    const workspace = workspaceData as WorkspaceRow;

    if (workspace.kind !== "shared") {
      return jsonResponse({
        ok: false,
        error: "Solo los workspaces compartidos admiten miembros invitados.",
      });
    }

    const { data: inviterProfileData } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const invitedByDisplayName =
      inviterProfileData?.full_name?.trim() ||
      ((user.user_metadata ?? {}) as { full_name?: string }).full_name?.trim() ||
      user.email?.split("@")[0] ||
      "Usuario DarkMoney";

    const { data: lookupData, error: lookupError } = await adminClient.rpc(
      "find_darkmoney_user_by_email",
      { lookup_email: invitedEmail },
    );

    if (lookupError) {
      throw lookupError;
    }

    const invitedUser = Array.isArray(lookupData)
      ? ((lookupData[0] as InviteLookupRow | undefined) ?? null)
      : null;

    if (!invitedUser) {
      return jsonResponse({
        ok: false,
        error: "Ese correo no corresponde a un usuario existente de DarkMoney.",
      });
    }

    if (invitedUser.user_id === user.id) {
      return jsonResponse({
        ok: false,
        error: "No puedes invitarte a ti mismo a este workspace.",
      });
    }

    const { data: memberAlreadyData, error: memberAlreadyError } = await adminClient
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", invitedUser.user_id)
      .maybeSingle();

    if (memberAlreadyError) {
      throw memberAlreadyError;
    }

    if (memberAlreadyData) {
      return jsonResponse({
        ok: true,
        alreadyMember: true,
        invitedEmail,
        invitedDisplayName: invitedUser.full_name,
        role: (memberAlreadyData as MembershipRow).role,
        emailSent: false,
      });
    }

    const { data: existingInvitationData, error: existingInvitationError } = await adminClient
      .from("workspace_invitations")
      .select("id, invited_user_id, invited_email, status, token")
      .eq("workspace_id", workspaceId)
      .eq("invited_user_id", invitedUser.user_id)
      .in("status", ["pending", "accepted"])
      .maybeSingle();

    if (existingInvitationError) {
      throw existingInvitationError;
    }

    const existingInvitation = existingInvitationData as ExistingInvitationRow | null;
    const nextToken = crypto.randomUUID();
    const now = new Date().toISOString();
    const invitationPayload = {
      workspace_id: workspaceId,
      invited_by_user_id: user.id,
      invited_user_id: invitedUser.user_id,
      invited_email: invitedEmail,
      invited_display_name: invitedUser.full_name,
      invited_by_display_name: invitedByDisplayName,
      role,
      status: "pending",
      token: nextToken,
      note,
      accepted_at: null,
      responded_at: null,
      last_sent_at: now,
      metadata: {
        source: "workspace_invitation",
      },
    };

    const { data: savedInvitationData, error: saveInvitationError } = existingInvitation
      ? await adminClient
          .from("workspace_invitations")
          .update(invitationPayload)
          .eq("id", existingInvitation.id)
          .select("id, invited_user_id, invited_email, status, token")
          .single()
      : await adminClient
          .from("workspace_invitations")
          .insert(invitationPayload)
          .select("id, invited_user_id, invited_email, status, token")
          .single();

    if (saveInvitationError) {
      throw saveInvitationError;
    }

    const savedInvitation = savedInvitationData as ExistingInvitationRow;
    const appUrl = resolveAppUrl(request, typeof body?.appUrl === "string" ? body.appUrl : null);
    const inviteUrl = buildAppNavigationUrl(appUrl, `share/workspaces/${savedInvitation.token}`);
    const emailTemplate = buildWorkspaceInviteEmail({
      appUrl,
      inviteUrl,
      invitedDisplayName: invitedUser.full_name,
      invitedByDisplayName,
      workspace,
      role,
      note,
    });
    const emailResult = await sendTransactionalEmail({
      to: invitedEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    return jsonResponse({
      ok: true,
      alreadyMember: false,
      invitationId: savedInvitation.id,
      status: "pending",
      role,
      inviteUrl,
      emailSent: emailResult.sent,
      emailError: emailResult.error ?? null,
      invitedEmail,
      invitedDisplayName: invitedUser.full_name,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No pudimos crear la invitacion para este workspace.",
    });
  }
});
