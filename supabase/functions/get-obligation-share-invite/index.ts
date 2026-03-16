import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/mercado-pago.ts";

type ShareRow = {
  id: number;
  workspace_id: number;
  obligation_id: number;
  owner_user_id: string;
  invited_by_user_id: string;
  invited_user_id: string;
  owner_display_name: string | null;
  invited_display_name: string | null;
  invited_email: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  token: string;
  message: string | null;
  accepted_at: string | null;
  responded_at: string | null;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type ObligationSummaryRow = {
  id: number;
  direction: "receivable" | "payable";
  origin_type: "cash_loan" | "sale_financed" | "purchase_financed" | "manual";
  status: "draft" | "active" | "paid" | "cancelled" | "defaulted";
  title: string;
  counterparty_id: number | null;
  settlement_account_id: number | null;
  currency_code: string;
  principal_initial_amount: number | string | null;
  principal_current_amount: number | string | null;
  pending_amount: number | string | null;
  progress_percent: number | string | null;
  start_date: string;
  due_date: string | null;
  installment_amount: number | string | null;
  installment_count: number | null;
  interest_rate: number | string | null;
  description: string | null;
  notes: string | null;
  payment_count: number | null;
};

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
    const { data: shareData, error: shareError } = await adminClient
      .from("obligation_shares")
      .select(
        "id, workspace_id, obligation_id, owner_user_id, invited_by_user_id, invited_user_id, owner_display_name, invited_display_name, invited_email, status, token, message, accepted_at, responded_at, last_sent_at, created_at, updated_at",
      )
      .eq("token", token)
      .maybeSingle();

    if (shareError) {
      throw shareError;
    }

    if (!shareData) {
      return jsonResponse({
        ok: false,
        error: "Esta invitacion ya no existe o el enlace no es valido.",
      });
    }

    const share = shareData as ShareRow;
    const { data: obligationData, error: obligationError } = await adminClient
      .from("v_obligation_summary")
      .select(
        "id, direction, origin_type, status, title, counterparty_id, settlement_account_id, currency_code, principal_initial_amount, principal_current_amount, pending_amount, progress_percent, start_date, due_date, installment_amount, installment_count, interest_rate, description, notes, payment_count",
      )
      .eq("id", share.obligation_id)
      .maybeSingle();

    if (obligationError) {
      throw obligationError;
    }

    if (!obligationData) {
      return jsonResponse({
        ok: false,
        error: "El credito o deuda original ya no esta disponible.",
      });
    }

    const obligation = obligationData as ObligationSummaryRow;
    let counterpartyName = "Sin contraparte";
    let settlementAccountName: string | null = null;

    if (obligation.counterparty_id) {
      const { data: counterpartyData } = await adminClient
        .from("counterparties")
        .select("name")
        .eq("id", obligation.counterparty_id)
        .maybeSingle();

      counterpartyName = counterpartyData?.name ?? counterpartyName;
    }

    if (obligation.settlement_account_id) {
      const { data: accountData } = await adminClient
        .from("accounts")
        .select("name")
        .eq("id", obligation.settlement_account_id)
        .maybeSingle();

      settlementAccountName = accountData?.name ?? null;
    }

    return jsonResponse({
      ok: true,
      invite: {
        share: {
          id: share.id,
          workspaceId: share.workspace_id,
          obligationId: share.obligation_id,
          ownerUserId: share.owner_user_id,
          invitedByUserId: share.invited_by_user_id,
          invitedUserId: share.invited_user_id,
          ownerDisplayName: share.owner_display_name,
          invitedDisplayName: share.invited_display_name,
          invitedEmail: share.invited_email,
          status: share.status,
          token: share.token,
          message: share.message,
          acceptedAt: share.accepted_at,
          respondedAt: share.responded_at,
          lastSentAt: share.last_sent_at,
          createdAt: share.created_at,
          updatedAt: share.updated_at,
        },
        title: obligation.title,
        direction: obligation.direction,
        originType: obligation.origin_type,
        status: obligation.status,
        counterparty: counterpartyName,
        settlementAccountName,
        currencyCode: obligation.currency_code,
        principalAmount: toNumber(obligation.principal_initial_amount),
        currentPrincipalAmount: toNumber(obligation.principal_current_amount),
        pendingAmount: toNumber(obligation.pending_amount),
        progressPercent: toNumber(obligation.progress_percent),
        startDate: obligation.start_date,
        dueDate: obligation.due_date,
        installmentAmount:
          obligation.installment_amount === null
            ? null
            : toNumber(obligation.installment_amount),
        installmentCount: obligation.installment_count,
        interestRate:
          obligation.interest_rate === null ? null : toNumber(obligation.interest_rate),
        description: obligation.description,
        notes: obligation.notes,
        paymentCount: obligation.payment_count ?? 0,
      },
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No pudimos leer esta invitacion compartida.",
    });
  }
});
