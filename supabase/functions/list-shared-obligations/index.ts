import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  createAdminClient,
  getAuthenticatedUser,
} from "../_shared/mercado-pago.ts";

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
  workspace_id: number;
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
  last_payment_date: string | null;
};

type ObligationEventRow = {
  id: number;
  obligation_id: number;
  event_type:
    | "opening"
    | "principal_increase"
    | "principal_decrease"
    | "payment"
    | "interest"
    | "fee"
    | "discount"
    | "adjustment"
    | "writeoff";
  event_date: string;
  amount: number | string | null;
  installment_no: number | null;
  reason: string | null;
  description: string | null;
  notes: string | null;
  movement_id: number | null;
  created_by_user_id: string | null;
  metadata: unknown;
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
    const user = await getAuthenticatedUser(request);
    const adminClient = createAdminClient();
    const { data: shareData, error: shareError } = await adminClient
      .from("obligation_shares")
      .select(
        "id, workspace_id, obligation_id, owner_user_id, invited_by_user_id, invited_user_id, owner_display_name, invited_display_name, invited_email, status, token, message, accepted_at, responded_at, last_sent_at, created_at, updated_at",
      )
      .eq("invited_user_id", user.id)
      .eq("status", "accepted")
      .order("updated_at", { ascending: false });

    if (shareError) {
      throw shareError;
    }

    const shares = (shareData as ShareRow[] | null) ?? [];

    if (shares.length === 0) {
      return jsonResponse({ ok: true, obligations: [] });
    }

    const obligationIds = [...new Set(shares.map((share) => share.obligation_id))];
    const { data: obligationData, error: obligationError } = await adminClient
      .from("v_obligation_summary")
      .select(
        "id, workspace_id, direction, origin_type, status, title, counterparty_id, settlement_account_id, currency_code, principal_initial_amount, principal_current_amount, pending_amount, progress_percent, start_date, due_date, installment_amount, installment_count, interest_rate, description, notes, payment_count, last_payment_date",
      )
      .in("id", obligationIds);

    if (obligationError) {
      throw obligationError;
    }

    const obligations = (obligationData as ObligationSummaryRow[] | null) ?? [];

    if (obligations.length === 0) {
      return jsonResponse({ ok: true, obligations: [] });
    }

    const { data: eventData, error: eventError } = await adminClient
      .from("obligation_events")
      .select(
        "id, obligation_id, event_type, event_date, amount, installment_no, reason, description, notes, movement_id, created_by_user_id, metadata",
      )
      .in("obligation_id", obligationIds)
      .order("event_date", { ascending: false })
      .order("id", { ascending: false });

    if (eventError) {
      throw eventError;
    }

    const events = (eventData as ObligationEventRow[] | null) ?? [];
    const counterpartyIds = [
      ...new Set(
        obligations
          .map((obligation) => obligation.counterparty_id)
          .filter((counterpartyId): counterpartyId is number => Number.isInteger(counterpartyId)),
      ),
    ];
    const settlementAccountIds = [
      ...new Set(
        obligations
          .map((obligation) => obligation.settlement_account_id)
          .filter((accountId): accountId is number => Number.isInteger(accountId)),
      ),
    ];
    const { data: counterpartyData } = counterpartyIds.length
      ? await adminClient
          .from("counterparties")
          .select("id, name")
          .in("id", counterpartyIds)
      : { data: [] };
    const { data: accountData } = settlementAccountIds.length
      ? await adminClient
          .from("accounts")
          .select("id, name")
          .in("id", settlementAccountIds)
      : { data: [] };
    const counterpartyNameMap = new Map<number, string>(
      ((counterpartyData as Array<{ id: number; name: string }> | null) ?? []).map((item) => [
        item.id,
        item.name,
      ]),
    );
    const accountNameMap = new Map<number, string>(
      ((accountData as Array<{ id: number; name: string }> | null) ?? []).map((item) => [
        item.id,
        item.name,
      ]),
    );
    const eventsByObligation = new Map<number, ObligationEventRow[]>();

    for (const event of events) {
      const currentEvents = eventsByObligation.get(event.obligation_id) ?? [];
      currentEvents.push(event);
      eventsByObligation.set(event.obligation_id, currentEvents);
    }

    const shareByObligationId = new Map<number, ShareRow>(
      shares.map((share) => [share.obligation_id, share]),
    );

    const sharedObligations = obligations
      .map((obligation) => {
        const share = shareByObligationId.get(obligation.id);

        if (!share) {
          return null;
        }

        const obligationEvents = eventsByObligation.get(obligation.id) ?? [];
        const paymentInstallmentMax = obligationEvents.reduce((currentMax, event) => {
          if (event.event_type !== "payment") {
            return currentMax;
          }

          return Math.max(currentMax, event.installment_no ?? 0);
        }, 0);
        const paymentCount = obligation.payment_count ?? 0;
        const installmentLabel =
          obligation.installment_count && obligation.installment_count > 0
            ? `${Math.min(paymentInstallmentMax || paymentCount, obligation.installment_count)} de ${obligation.installment_count} cuotas`
            : paymentCount > 0
              ? `${paymentCount} pagos registrados`
              : "Sin pagos registrados";

        return {
          id: obligation.id,
          workspaceId: obligation.workspace_id,
          title: obligation.title,
          direction: obligation.direction,
          originType: obligation.origin_type,
          counterparty: obligation.counterparty_id
            ? counterpartyNameMap.get(obligation.counterparty_id) ?? "Sin contraparte"
            : "Sin contraparte",
          counterpartyId: obligation.counterparty_id,
          settlementAccountId: obligation.settlement_account_id,
          settlementAccountName: obligation.settlement_account_id
            ? accountNameMap.get(obligation.settlement_account_id) ?? null
            : null,
          status: obligation.status,
          currencyCode: obligation.currency_code,
          principalAmount: toNumber(obligation.principal_initial_amount),
          currentPrincipalAmount: toNumber(obligation.principal_current_amount),
          pendingAmount: toNumber(obligation.pending_amount),
          progressPercent: Math.round(toNumber(obligation.progress_percent)),
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
          paymentCount,
          lastPaymentDate: obligation.last_payment_date,
          installmentLabel,
          events: obligationEvents.map((event) => ({
            id: event.id,
            eventType: event.event_type,
            eventDate: event.event_date,
            amount: toNumber(event.amount),
            installmentNo: event.installment_no,
            reason: event.reason,
            description: event.description,
            notes: event.notes,
            movementId: event.movement_id,
            createdByUserId: event.created_by_user_id,
            metadata: event.metadata ?? null,
          })),
          viewerMode: "shared_viewer",
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
        };
      })
      .filter((obligation): obligation is NonNullable<typeof obligation> => Boolean(obligation))
      .sort(
        (left, right) =>
          new Date(right.share.updatedAt).getTime() - new Date(left.share.updatedAt).getTime(),
      );

    return jsonResponse({ ok: true, obligations: sharedObligations });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No pudimos cargar los creditos y deudas compartidos contigo.",
    });
  }
});
