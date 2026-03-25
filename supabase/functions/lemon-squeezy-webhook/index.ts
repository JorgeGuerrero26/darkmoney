import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient, upsertBillingEvent } from "../_shared/billing.ts";
import {
  extractUserIdFromLemonCustomData,
  resolveEntitlementFromLemonSubscription,
  type LemonSqueezySubscription,
  validateLemonSqueezyWebhookSignature,
} from "../_shared/lemon-squeezy.ts";

type LemonSqueezyWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown> | null;
  } | null;
  data?: LemonSqueezySubscription | null;
};

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as LemonSqueezyWebhookPayload;
  } catch {
    return {};
  }
}

function resolveProviderEventId(eventName: string | null, dataId: string | null) {
  if (eventName && dataId) {
    return `${eventName}:${dataId}`;
  }

  return dataId ?? eventName;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const rawBody = await request.text();
  const payload = tryParseJson(rawBody);
  const adminClient = createAdminClient();
  const eventName =
    payload.meta?.event_name?.trim() ??
    request.headers.get("X-Event-Name")?.trim() ??
    null;
  const subscription = payload.data ?? null;
  const subscriptionId =
    typeof subscription?.id === "string"
      ? subscription.id
      : typeof subscription?.id === "number"
        ? String(subscription.id)
        : null;
  const customData =
    payload.meta?.custom_data && typeof payload.meta.custom_data === "object"
      ? payload.meta.custom_data
      : null;
  const userId = extractUserIdFromLemonCustomData(customData);
  const providerEventId = resolveProviderEventId(eventName, subscriptionId);
  const signatureValidation = await validateLemonSqueezyWebhookSignature(
    rawBody,
    request.headers.get("X-Signature"),
  );

  await upsertBillingEvent(adminClient, {
    provider: "lemon_squeezy",
    providerEventId,
    providerEventType: eventName,
    userId,
    externalReference: userId ? `dm-pro:${userId}` : null,
    payload: {
      headers: {
        xEventName: request.headers.get("X-Event-Name"),
      },
      body: payload,
      receivedAt: new Date().toISOString(),
      signatureValidation,
    },
    processed: false,
  });

  if (!signatureValidation.valid) {
    await upsertBillingEvent(adminClient, {
      provider: "lemon_squeezy",
      providerEventId,
      providerEventType: eventName,
      userId,
      externalReference: userId ? `dm-pro:${userId}` : null,
      payload: {
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

  if (subscription?.type !== "subscriptions" || !subscriptionId || !eventName) {
    return jsonResponse({ received: true, ignored: true, reason: "evento no relevante" });
  }

  if (!userId) {
    await upsertBillingEvent(adminClient, {
      provider: "lemon_squeezy",
      providerEventId,
      providerEventType: eventName,
      externalReference: null,
      payload: {
        body: payload,
        failedAt: new Date().toISOString(),
      },
      processed: false,
      processingError: "No pudimos resolver user_id desde custom_data en Lemon Squeezy.",
    });

    return jsonResponse({
      received: true,
      synced: false,
      error: "No pudimos resolver user_id desde custom_data en Lemon Squeezy.",
    });
  }

  try {
    const entitlement = resolveEntitlementFromLemonSubscription(subscription);
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
        manual_override: false,
        metadata: {
          lemon_squeezy_event: eventName,
          lemon_squeezy_status: subscription.attributes?.status ?? null,
          lemon_squeezy_cancelled: subscription.attributes?.cancelled ?? null,
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
      provider: "lemon_squeezy",
      providerEventId,
      providerEventType: eventName,
      userId,
      externalReference: `dm-pro:${userId}`,
      payload: {
        body: payload,
        processedAt: new Date().toISOString(),
        signatureValidation,
      },
      processed: true,
      processedAt: new Date().toISOString(),
    });

    return jsonResponse({ received: true, synced: true });
  } catch (error) {
    await upsertBillingEvent(adminClient, {
      provider: "lemon_squeezy",
      providerEventId,
      providerEventType: eventName,
      userId,
      externalReference: `dm-pro:${userId}`,
      payload: {
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
