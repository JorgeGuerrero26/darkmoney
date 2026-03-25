import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import {
  buildAppNavigationUrl,
  createAdminClient,
  getAuthenticatedUser,
  isAdminOverrideEmail,
  resolveAppUrl,
} from "../_shared/billing.ts";

type InviteLookupRow = {
  user_id: string;
  email: string;
  full_name: string;
};

type ObligationRow = {
  id: number;
  workspace_id: number;
  title: string;
  direction: "receivable" | "payable";
  currency_code: string;
  principal_amount: number | string | null;
  due_date: string | null;
};

type ExistingShareRow = {
  id: number;
  obligation_id: number;
  invited_user_id: string;
  invited_email: string;
  status: "pending" | "accepted" | "declined" | "revoked";
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  return 0;
}

function formatCurrency(amount: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Sin fecha objetivo";
  }

  try {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "America/Lima",
    }).format(new Date(`${value}T12:00:00.000Z`));
  } catch {
    return value;
  }
}

function getDirectionLabel(direction: "receivable" | "payable") {
  return direction === "receivable" ? "Credito compartido" : "Deuda compartida";
}

function buildInviteEmail(input: {
  appUrl: string;
  shareUrl: string;
  ownerDisplayName: string;
  invitedDisplayName: string;
  obligation: ObligationRow;
  message?: string | null;
}) {
  const title = escapeHtml(input.obligation.title);
  const ownerDisplayName = escapeHtml(input.ownerDisplayName);
  const invitedDisplayName = escapeHtml(input.invitedDisplayName);
  const directionLabel = escapeHtml(getDirectionLabel(input.obligation.direction));
  const amountLabel = escapeHtml(
    formatCurrency(toNumber(input.obligation.principal_amount), input.obligation.currency_code),
  );
  const dueDateLabel = escapeHtml(formatDate(input.obligation.due_date));
  const shareUrl = escapeHtml(input.shareUrl);
  const bannerUrl = buildAppNavigationUrl(input.appUrl, "banner-darkmoney.png");
  const bannerUrlEscaped = escapeHtml(bannerUrl);
  const messageBlock = input.message
    ? `
      <div style="margin-top:24px;border-radius:22px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);padding:20px 22px;">
        <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#8ea2bf;">Mensaje incluido</p>
        <p style="margin:0;font-size:15px;line-height:1.9;color:#d8e1f0;">${escapeHtml(input.message)}</p>
      </div>
    `
    : "";

  const html = `
    <div style="margin:0;background:#030711;padding:28px 14px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#f4f7fb;">
      <div style="max-width:680px;margin:0 auto;border-radius:30px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg,#07111d 0%,#050b14 100%);box-shadow:0 30px 100px rgba(0,0,0,0.45);">
        <div style="padding:18px 18px 0;">
          <img alt="DarkMoney" src="${bannerUrlEscaped}" style="display:block;width:100%;height:auto;border-radius:24px;border:1px solid rgba(255,255,255,0.08);" />
        </div>
        <div style="padding:30px 28px 32px;">
          <div style="display:inline-block;padding:8px 14px;border-radius:999px;border:1px solid rgba(107,228,197,0.24);background:rgba(27,106,88,0.18);font-size:11px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#6be4c5;">
            Invitacion compartida
          </div>
          <h1 style="margin:20px 0 12px;font-size:34px;line-height:1.12;font-weight:700;color:#f7fbff;">${ownerDisplayName} te compartio un registro en DarkMoney</h1>
          <p style="margin:0;font-size:16px;line-height:1.9;color:#b4c1d7;">
            Hola ${invitedDisplayName}, ahora puedes revisar este ${directionLabel.toLowerCase()} desde tu cuenta y confirmar que aceptas verlo dentro de la seccion de creditos y deudas.
          </p>

          <div style="margin-top:28px;border-radius:26px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);padding:22px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#8ea2bf;">Registro</p>
            <p style="margin:10px 0 0;font-size:30px;line-height:1.2;font-weight:700;color:#f5f8fd;">${title}</p>
            <div style="margin-top:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;">
              <div style="border-radius:18px;border:1px solid rgba(255,255,255,0.08);background:rgba(2,6,13,0.42);padding:16px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#8ea2bf;">Tipo</p>
                <p style="margin:10px 0 0;font-size:17px;font-weight:600;color:#f4f7fb;">${directionLabel}</p>
              </div>
              <div style="border-radius:18px;border:1px solid rgba(255,255,255,0.08);background:rgba(2,6,13,0.42);padding:16px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#8ea2bf;">Monto base</p>
                <p style="margin:10px 0 0;font-size:17px;font-weight:600;color:#f4f7fb;">${amountLabel}</p>
              </div>
              <div style="border-radius:18px;border:1px solid rgba(255,255,255,0.08);background:rgba(2,6,13,0.42);padding:16px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#8ea2bf;">Fecha objetivo</p>
                <p style="margin:10px 0 0;font-size:17px;font-weight:600;color:#f4f7fb;">${dueDateLabel}</p>
              </div>
            </div>
          </div>

          ${messageBlock}

          <div style="margin-top:30px;">
            <a href="${shareUrl}" style="display:inline-block;border-radius:999px;background:#f3f7fd;padding:15px 24px;font-size:15px;font-weight:700;color:#07111d;text-decoration:none;">
              Revisar y aceptar en DarkMoney
            </a>
          </div>

          <p style="margin:22px 0 0;font-size:13px;line-height:1.8;color:#8ea2bf;">
            Si el boton no abre directo, copia este enlace en tu navegador:
          </p>
          <p style="margin:10px 0 0;word-break:break-all;font-size:13px;line-height:1.8;color:#6be4c5;">
            ${shareUrl}
          </p>
        </div>
      </div>
    </div>
  `;

  const text = `${input.ownerDisplayName} te compartio "${input.obligation.title}" en DarkMoney.\n\nMonto base: ${formatCurrency(
    toNumber(input.obligation.principal_amount),
    input.obligation.currency_code,
  )}\nFecha objetivo: ${formatDate(input.obligation.due_date)}\n\nRevisa y acepta aqui:\n${input.shareUrl}`;

  return {
    subject: `${input.ownerDisplayName} te compartio un credito o deuda en DarkMoney`,
    html,
    text,
  };
}

Deno.serve(async (request) => {
  console.log("create-obligation-share-invite request received", {
    method: request.method,
    origin: request.headers.get("origin"),
    hasAuthorization: Boolean(request.headers.get("authorization")),
  });

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Metodo no permitido." }, { status: 405 });
  }

  let debugContext: Record<string, unknown> = {};

  try {
    const user = await getAuthenticatedUser(request);
    console.log("create-obligation-share-invite auth ok", {
      userId: user.id,
      userEmail: user.email ?? null,
    });
    const body = await request.json().catch(() => ({}));
    const workspaceId = Number(body?.workspaceId);
    const obligationId = Number(body?.obligationId);
    const invitedEmail = normalizeEmail(body?.invitedEmail);
    const message = getOptionalText(body?.message);
    debugContext = {
      userId: user.id,
      userEmail: user.email ?? null,
      workspaceId,
      obligationId,
      invitedEmail,
      hasMessage: Boolean(message),
    };

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return jsonResponse({ ok: false, error: "No encontramos el workspace de este registro." });
    }

    if (!Number.isInteger(obligationId) || obligationId <= 0) {
      return jsonResponse({ ok: false, error: "No encontramos el credito o deuda que quieres compartir." });
    }

    if (!invitedEmail) {
      return jsonResponse({ ok: false, error: "Ingresa el correo del usuario que recibira la invitacion." });
    }

    if (!user.email) {
      return jsonResponse({ ok: false, error: "Tu cuenta no tiene un correo disponible para compartir este registro." });
    }

    const adminClient = createAdminClient();
    const isAdmin = isAdminOverrideEmail(user.email);

    if (!isAdmin) {
      const { data: entitlementData, error: entitlementError } = await adminClient
        .from("user_entitlements")
        .select("pro_access_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (entitlementError) {
        throw entitlementError;
      }

      if (!entitlementData?.pro_access_enabled) {
        return jsonResponse({
          ok: false,
          error:
            "Compartir creditos o deudas con otros usuarios forma parte de DarkMoney Pro.",
        });
      }
    }

    const { data: membershipData, error: membershipError } = await adminClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!membershipData) {
      return jsonResponse({
        ok: false,
        error: "No tienes acceso a este workspace para compartir ese registro.",
      });
    }

    const { data: obligationData, error: obligationError } = await adminClient
      .from("obligations")
      .select("id, workspace_id, title, direction, currency_code, principal_amount, due_date")
      .eq("id", obligationId)
      .eq("workspace_id", workspaceId)
      .single();

    if (obligationError) {
      throw obligationError;
    }

    const obligation = obligationData as ObligationRow;
    const { data: ownerProfileData } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const ownerDisplayName =
      ownerProfileData?.full_name?.trim() ||
      ((user.user_metadata ?? {}) as { full_name?: string }).full_name?.trim() ||
      user.email.split("@")[0] ||
      "Usuario DarkMoney";

    const { data: lookupData, error: lookupError } = await adminClient.rpc(
      "find_darkmoney_user_by_email",
      {
        lookup_email: invitedEmail,
      },
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
        error:
          "Ese correo no corresponde a un usuario existente de DarkMoney. Primero debe tener una cuenta creada.",
      });
    }

    if (invitedUser.user_id === user.id) {
      return jsonResponse({
        ok: false,
        error: "No puedes compartirte este registro a ti mismo por invitacion.",
      });
    }

    const { data: existingShareData, error: existingShareError } = await adminClient
      .from("obligation_shares")
      .select("id, obligation_id, invited_user_id, invited_email, status, token")
      .eq("obligation_id", obligationId)
      .in("status", ["pending", "accepted"])
      .maybeSingle();

    if (existingShareError) {
      throw existingShareError;
    }

    const existingShare = existingShareData as ExistingShareRow | null;

    if (
      existingShare &&
      existingShare.status === "accepted" &&
      existingShare.invited_user_id === invitedUser.user_id
    ) {
      return jsonResponse({
        ok: true,
        alreadyAccepted: true,
        shareId: existingShare.id,
        status: existingShare.status,
        shareUrl: buildAppNavigationUrl(
          resolveAppUrl(request, typeof body?.appUrl === "string" ? body.appUrl : null),
          `share/obligations/${existingShare.token}`,
        ),
        emailSent: false,
        invitedEmail,
        invitedDisplayName: invitedUser.full_name,
      });
    }

    const nextToken = crypto.randomUUID();
    const now = new Date().toISOString();
    const sharePayload = {
      workspace_id: workspaceId,
      obligation_id: obligationId,
      owner_user_id: user.id,
      invited_by_user_id: user.id,
      invited_user_id: invitedUser.user_id,
      owner_display_name: ownerDisplayName,
      invited_display_name: invitedUser.full_name,
      invited_email: invitedEmail,
      status: "pending",
      token: nextToken,
      message,
      accepted_at: null,
      responded_at: null,
      last_sent_at: now,
      metadata: {
        source: "obligation_share_invite",
      },
    };

    const { data: savedShareData, error: saveShareError } = existingShare
      ? await adminClient
          .from("obligation_shares")
          .update(sharePayload)
          .eq("id", existingShare.id)
          .select(
            "id, obligation_id, invited_user_id, invited_email, status, token",
          )
          .single()
      : await adminClient
          .from("obligation_shares")
          .insert(sharePayload)
          .select(
            "id, obligation_id, invited_user_id, invited_email, status, token",
          )
          .single();

    if (saveShareError) {
      throw saveShareError;
    }

    const savedShare = savedShareData as ExistingShareRow;
    const appUrl = resolveAppUrl(
      request,
      typeof body?.appUrl === "string" ? body.appUrl : null,
    );
    const shareUrl = buildAppNavigationUrl(appUrl, `share/obligations/${savedShare.token}`);
    const emailTemplate = buildInviteEmail({
      appUrl,
      shareUrl,
      ownerDisplayName,
      invitedDisplayName: invitedUser.full_name,
      obligation,
      message,
    });
    const emailResult = await sendTransactionalEmail({
      to: invitedEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    return jsonResponse({
      ok: true,
      alreadyAccepted: false,
      shareId: savedShare.id,
      status: savedShare.status,
      shareUrl,
      emailSent: emailResult.sent,
      emailError: emailResult.error ?? null,
      invitedEmail,
      invitedDisplayName: invitedUser.full_name,
    });
  } catch (error) {
    console.error("create-obligation-share-invite failed", {
      ...debugContext,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack ?? null : null,
    });

    return jsonResponse({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No pudimos crear la invitacion para compartir este registro.",
    });
  }
});
