import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient, upsertBillingEvent } from "../_shared/billing.ts";
import {
  extractUserIdFromPaddleCustomData,
  resolveEntitlementFromPaddleSubscription,
  type PaddleSubscription,
  validatePaddleWebhookSignature,
} from "../_shared/paddle.ts";

type PaddleWebhookPayload = {
  event_id?: string | null;
  event_type?: string | null;
  notification_id?: string | null;
  occurred_at?: string | null;
  data?: PaddleSubscription | null;
};

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as PaddleWebhookPayload;
  } catch {
    return {};
  }
}

function extractStoredOccurredAt(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const occurredAt = (metadata as Record<string, unknown>).last_paddle_event_occurred_at;
  return typeof occurredAt === "string" ? occurredAt : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const rawBody = await request.text();
  const payload = tryParseJson(rawBody);
  const adminClient = createAdminClient();
  const eventType = payload.event_type?.trim() ?? null;
  const occurredAt = payload.occurred_at?.trim() ?? new Date().toISOString();
  const subscription = payload.data ?? null;
  const subscriptionId = subscription?.id?.trim() ?? null;
  const providerEventId = payload.event_id?.trim() ?? payload.notification_id?.trim() ?? subscriptionId ?? eventType;
  const userId = extractUserIdFromPaddleCustomData(subscription?.custom_data);
  const signatureValidation = await validatePaddleWebhookSignature(
    rawBody,
    request.headers.get("Paddle-Signature"),
  );

  await upsertBillingEvent(adminClient, {
    provider: "paddle",
    providerEventId,
    providerEventType: eventType,
    userId,
    externalReference: userId ? `dm-pro:${userId}` : null,
    payload: {
      body: payload,
      headers: {
        paddleSignature: request.headers.get("Paddle-Signature"),
      },
      receivedAt: new Date().toISOString(),
      signatureValidation,
    },
    processed: false,
  });

  if (!signatureValidation.valid) {
    await upsertBillingEvent(adminClient, {
      provider: "paddle",
      providerEventId,
      providerEventType: eventType,
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

  if (!eventType || !subscriptionId || !eventType.startsWith("subscription.")) {
    return jsonResponse({ received: true, ignored: true, reason: "evento no relevante" });
  }

  if (!userId) {
    await upsertBillingEvent(adminClient, {
      provider: "paddle",
      providerEventId,
      providerEventType: eventType,
      payload: {
        body: payload,
        failedAt: new Date().toISOString(),
      },
      processed: false,
      processingError: "No pudimos resolver user_id desde custom_data en Paddle.",
    });

    return jsonResponse({
      received: true,
      synced: false,
      error: "No pudimos resolver user_id desde custom_data en Paddle.",
    });
  }

  try {
    const { data: currentEntitlement, error: currentEntitlementError } = await adminClient
      .from("user_entitlements")
      .select("metadata")
      .eq("user_id", userId)
      .maybeSingle();

    if (currentEntitlementError) {
      throw currentEntitlementError;
    }

    const lastOccurredAt = extractStoredOccurredAt(currentEntitlement?.metadata);

    if (lastOccurredAt && new Date(lastOccurredAt).getTime() > new Date(occurredAt).getTime()) {
      await upsertBillingEvent(adminClient, {
        provider: "paddle",
        providerEventId,
        providerEventType: eventType,
        userId,
        externalReference: `dm-pro:${userId}`,
        payload: {
          body: payload,
          ignoredAt: new Date().toISOString(),
          reason: "evento desordenado",
        },
        processed: true,
        processedAt: new Date().toISOString(),
      });

      return jsonResponse({ received: true, synced: true, ignored: true });
    }

    const entitlement = resolveEntitlementFromPaddleSubscription(subscription);
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
          ...(entitlement.metadata ?? {}),
          last_paddle_event_id: payload.event_id ?? null,
          last_paddle_event_type: eventType,
          last_paddle_event_occurred_at: occurredAt,
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
      provider: "paddle",
      providerEventId,
      providerEventType: eventType,
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
      provider: "paddle",
      providerEventId,
      providerEventType: eventType,
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
