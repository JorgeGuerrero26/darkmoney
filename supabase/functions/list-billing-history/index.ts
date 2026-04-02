import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient, getAuthenticatedUser } from "../_shared/billing.ts";
import { listPaddleTransactions, type PaddleTransaction } from "../_shared/paddle.ts";

type BillingHistoryEventRow = {
  id: number;
  provider: string;
  provider_event_type: string | null;
  created_at: string;
  processed: boolean;
  processing_error: string | null;
};

type BillingHistoryPaymentItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  amountLabel: string | null;
  status: string | null;
  statusLabel: string;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  invoiceNumber: string | null;
};

type BillingHistoryEventItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
};

function toMoneyLabel(amountMinor?: string | null, currencyCode?: string | null) {
  if (!amountMinor || !currencyCode) {
    return null;
  }

  const parsed = Number(amountMinor);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  try {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parsed / 100);
  } catch {
    return `${currencyCode} ${(parsed / 100).toFixed(2)}`;
  }
}

function extractMoneyCandidate(candidate: unknown) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const amount = (candidate as Record<string, unknown>).amount;
  const currencyCode = (candidate as Record<string, unknown>).currency_code;

  if ((typeof amount === "string" || typeof amount === "number") && typeof currencyCode === "string") {
    return {
      amountMinor: String(amount),
      currencyCode,
    };
  }

  return null;
}

function extractTransactionAmount(transaction: PaddleTransaction) {
  const totals = transaction.details?.totals;
  const totalMoney =
    extractMoneyCandidate(totals?.total) ??
    extractMoneyCandidate(totals?.grand_total) ??
    extractMoneyCandidate(totals?.subtotal);

  if (totalMoney) {
    return totalMoney;
  }

  const firstItem = transaction.items?.[0];
  const unitPrice = firstItem?.price?.unit_price;
  const quantity = typeof firstItem?.quantity === "number" && Number.isFinite(firstItem.quantity)
    ? firstItem.quantity
    : 1;

  if (!unitPrice?.amount || !unitPrice.currency_code) {
    return null;
  }

  const parsedAmount = Number(unitPrice.amount);

  if (!Number.isFinite(parsedAmount)) {
    return null;
  }

  return {
    amountMinor: String(parsedAmount * quantity),
    currencyCode: unitPrice.currency_code,
  };
}

function getTransactionStatusPresentation(status?: string | null) {
  const normalizedStatus = status?.trim().toLowerCase() ?? null;

  switch (normalizedStatus) {
    case "completed":
      return {
        label: "Cobro completado",
        tone: "success" as const,
      };
    case "paid":
      return {
        label: "Pago confirmado",
        tone: "success" as const,
      };
    case "past_due":
      return {
        label: "Cobro pendiente",
        tone: "warning" as const,
      };
    case "draft":
    case "ready":
      return {
        label: "Pendiente de pago",
        tone: "info" as const,
      };
    case "canceled":
    case "cancelled":
      return {
        label: "Cobro cancelado",
        tone: "danger" as const,
      };
    case "billed":
      return {
        label: "Facturado",
        tone: "info" as const,
      };
    default:
      return {
        label: "Movimiento premium",
        tone: "neutral" as const,
      };
  }
}

function mapPaddleTransactionToPaymentItem(transaction: PaddleTransaction): BillingHistoryPaymentItem {
  const amount = extractTransactionAmount(transaction);
  const createdAt = transaction.billed_at ?? transaction.updated_at ?? transaction.created_at ?? new Date().toISOString();
  const presentation = getTransactionStatusPresentation(transaction.status);

  return {
    id: transaction.id ?? crypto.randomUUID(),
    title: presentation.label,
    description: transaction.invoice_number
      ? `Factura ${transaction.invoice_number}.`
      : "Movimiento registrado para tu plan premium.",
    createdAt,
    amountLabel: toMoneyLabel(amount?.amountMinor ?? null, amount?.currencyCode ?? transaction.currency_code ?? null),
    status: transaction.status ?? null,
    statusLabel: presentation.label,
    tone: presentation.tone,
    invoiceNumber: transaction.invoice_number ?? null,
  };
}

function mapBillingEventToTimelineItem(row: BillingHistoryEventRow): BillingHistoryEventItem | null {
  const normalizedType = row.provider_event_type?.trim().toLowerCase() ?? null;

  switch (normalizedType) {
    case "subscription_cancel_requested_by_user":
      return {
        id: `event-${row.id}`,
        title: "Cancelaste la renovacion automatica",
        description: "Registramos tu pedido para apagar la siguiente renovacion automatica.",
        createdAt: row.created_at,
        tone: "warning",
      };
    case "subscription.canceled":
      return {
        id: `event-${row.id}`,
        title: "Renovacion cancelada",
        description: "Tu suscripcion quedo marcada para no renovarse automaticamente.",
        createdAt: row.created_at,
        tone: "warning",
      };
    case "subscription.activated":
      return {
        id: `event-${row.id}`,
        title: "Suscripcion activada",
        description: "Confirmamos que tu acceso premium ya quedo activo.",
        createdAt: row.created_at,
        tone: "success",
      };
    case "subscription.created":
      return {
        id: `event-${row.id}`,
        title: "Suscripcion creada",
        description: "Se abrio correctamente el ciclo premium para esta cuenta.",
        createdAt: row.created_at,
        tone: "info",
      };
    case "subscription.resumed":
      return {
        id: `event-${row.id}`,
        title: "Suscripcion reanudada",
        description: "La renovacion automatica se reactivo otra vez.",
        createdAt: row.created_at,
        tone: "success",
      };
    case "subscription.paused":
      return {
        id: `event-${row.id}`,
        title: "Suscripcion pausada",
        description: "La suscripcion quedo pausada temporalmente.",
        createdAt: row.created_at,
        tone: "warning",
      };
    case "subscription.past_due":
      return {
        id: `event-${row.id}`,
        title: "Cobro pendiente",
        description: "El ultimo intento de cobro no se pudo completar y requiere seguimiento.",
        createdAt: row.created_at,
        tone: "warning",
      };
    case "subscription.updated":
      return {
        id: `event-${row.id}`,
        title: "Suscripcion actualizada",
        description: "Se registro un cambio en el estado o ciclo de tu suscripcion.",
        createdAt: row.created_at,
        tone: "info",
      };
    default:
      return row.processing_error
        ? {
            id: `event-${row.id}`,
            title: "Evento premium con incidencia",
            description: row.processing_error,
            createdAt: row.created_at,
            tone: "danger",
          }
        : null;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido." }, { status: 405 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    const adminClient = createAdminClient();

    const [{ data: entitlement, error: entitlementError }, { data: eventRows, error: eventsError }] = await Promise.all([
      adminClient
        .from("user_entitlements")
        .select("billing_provider, provider_customer_id, provider_subscription_id")
        .eq("user_id", user.id)
        .maybeSingle(),
      adminClient
        .from("billing_events")
        .select("id, provider, provider_event_type, created_at, processed, processing_error")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    if (entitlementError) {
      throw entitlementError;
    }

    if (eventsError) {
      throw eventsError;
    }

    const provider = entitlement?.billing_provider ?? null;
    let warning: string | null = null;
    let payments: BillingHistoryPaymentItem[] = [];

    if (provider === "paddle" && entitlement?.provider_subscription_id) {
      try {
        const transactions = await listPaddleTransactions(entitlement.provider_subscription_id);
        payments = transactions
          .map(mapPaddleTransactionToPaymentItem)
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
          .slice(0, 8);
      } catch (error) {
        warning = error instanceof Error && error.message.includes("403")
          ? "El historial premium esta activo, pero aun falta habilitar el permiso de lectura de cobros para mostrar montos e historial completo."
          : "No pudimos leer el historial de cobros en este momento.";
      }
    }

    const events = ((eventRows ?? []) as BillingHistoryEventRow[])
      .map(mapBillingEventToTimelineItem)
      .filter((item): item is BillingHistoryEventItem => Boolean(item))
      .slice(0, 8);

    return jsonResponse({
      provider,
      warning,
      payments,
      events,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "No pudimos leer el historial premium.",
      },
      { status: 500 },
    );
  }
});
