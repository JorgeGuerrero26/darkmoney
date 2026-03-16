import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  createAdminClient,
  extractUserIdFromExternalReference,
  fetchMercadoPagoPreapproval,
  resolveEntitlementFromPreapproval,
  upsertBillingEvent,
  validateMercadoPagoWebhookSignature,
} from "../_shared/mercado-pago.ts";

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function resolvePreapprovalId(
  query: URLSearchParams,
  payload: Record<string, unknown>,
) {
  const directData = payload.data;

  if (
    directData &&
    typeof directData === "object" &&
    "id" in directData &&
    typeof directData.id === "string"
  ) {
    return directData.id;
  }

  if (
    directData &&
    typeof directData === "object" &&
    "id" in directData &&
    typeof directData.id === "number"
  ) {
    return String(directData.id);
  }

  if (typeof payload.id === "string" || typeof payload.id === "number") {
    return String(payload.id);
  }

  const resource = typeof payload.resource === "string" ? payload.resource : null;

  if (resource) {
    const match = resource.match(/\/preapproval\/([^/?]+)/i);

    if (match?.[1]) {
      return match[1];
    }
  }

  return query.get("data.id") ?? query.get("id");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const rawBody = await request.text();
  const payload = tryParseJson(rawBody);
  const providerEventType =
    (typeof payload.type === "string" ? payload.type : null) ??
    url.searchParams.get("type") ??
    url.searchParams.get("topic");
  const providerEventId = resolvePreapprovalId(url.searchParams, payload);
  const adminClient = createAdminClient();
  const signatureValidation = await validateMercadoPagoWebhookSignature(request);

  await upsertBillingEvent(adminClient, {
    providerEventId,
    providerEventType,
    externalReference:
      typeof payload.external_reference === "string" ? payload.external_reference : null,
    payload: {
      query: Object.fromEntries(url.searchParams.entries()),
      body: payload,
      receivedAt: new Date().toISOString(),
      signatureValidation,
    },
    processed: false,
  });

  if (!signatureValidation.valid) {
    await upsertBillingEvent(adminClient, {
      providerEventId,
      providerEventType,
      externalReference:
        typeof payload.external_reference === "string" ? payload.external_reference : null,
      payload: {
        query: Object.fromEntries(url.searchParams.entries()),
        body: payload,
        failedAt: new Date().toISOString(),
        signatureValidation,
      },
      processed: false,
      processingError: signatureValidation.reason ?? "Firma webhook invalida.",
    });

    return jsonResponse(
      {
        received: true,
        synced: false,
        error: signatureValidation.reason ?? "Firma webhook invalida.",
      },
      { status: 401 },
    );
  }

  if (!providerEventId) {
    return jsonResponse({ received: true, ignored: true, reason: "sin id util" });
  }

  try {
    const preapproval = await fetchMercadoPagoPreapproval(providerEventId);
    const userId = extractUserIdFromExternalReference(preapproval.external_reference);

    if (!userId) {
      throw new Error(
        "No pudimos resolver el usuario desde external_reference en Mercado Pago.",
      );
    }

    const entitlement = resolveEntitlementFromPreapproval(preapproval);
    const { error } = await adminClient.from("user_entitlements").upsert(
      {
        user_id: userId,
        plan_code: entitlement.planCode,
        pro_access_enabled: entitlement.proAccessEnabled,
        billing_provider: entitlement.billingProvider,
        billing_status: entitlement.billingStatus,
        provider_customer_id: entitlement.providerCustomerId,
        provider_subscription_id: entitlement.providerSubscriptionId,
        current_period_start: entitlement.currentPeriodStart,
        current_period_end: entitlement.currentPeriodEnd,
        cancel_at_period_end: entitlement.cancelAtPeriodEnd,
        metadata: {
          mercado_pago_status: preapproval.status ?? null,
          external_reference: preapproval.external_reference ?? null,
          next_payment_date: preapproval.next_payment_date ?? null,
          synced_at: new Date().toISOString(),
        },
      },
      {
        onConflict: "user_id",
      },
    );

    if (error) {
      throw error;
    }

    await upsertBillingEvent(adminClient, {
      providerEventId,
      providerEventType,
      userId,
      externalReference: preapproval.external_reference ?? null,
      payload: {
        query: Object.fromEntries(url.searchParams.entries()),
        body: payload,
        preapproval,
        processedAt: new Date().toISOString(),
        signatureValidation,
      },
      processed: true,
      processedAt: new Date().toISOString(),
    });

    return jsonResponse({ received: true, synced: true });
  } catch (error) {
    await upsertBillingEvent(adminClient, {
      providerEventId,
      providerEventType,
      externalReference:
        typeof payload.external_reference === "string" ? payload.external_reference : null,
      payload: {
        query: Object.fromEntries(url.searchParams.entries()),
        body: payload,
        failedAt: new Date().toISOString(),
        signatureValidation,
      },
      processed: false,
      processingError: error instanceof Error ? error.message : "Error procesando webhook.",
    });

    return jsonResponse(
      {
        received: true,
        synced: false,
        error: error instanceof Error ? error.message : "Error procesando webhook.",
      },
      { status: 200 },
    );
  }
});
