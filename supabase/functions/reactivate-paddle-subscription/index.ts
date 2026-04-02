import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  createAdminClient,
  getAuthenticatedUser,
  isAdminOverrideEmail,
  upsertBillingEvent,
} from "../_shared/billing.ts";
import {
  reactivatePaddleSubscription,
  resolveEntitlementFromPaddleSubscription,
} from "../_shared/paddle.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido." }, { status: 405 });
  }

  try {
    const user = await getAuthenticatedUser(request);

    if (isAdminOverrideEmail(user.email)) {
      return jsonResponse(
        {
          error: "La cuenta administradora no necesita reactivar renovaciones porque su acceso premium viene por override interno.",
        },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const { data: entitlement, error: entitlementError } = await adminClient
      .from("user_entitlements")
      .select(
        "user_id, billing_provider, provider_subscription_id, provider_customer_id, current_period_end, cancel_at_period_end",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (entitlementError) {
      throw entitlementError;
    }

    if (!entitlement?.provider_subscription_id || entitlement.billing_provider !== "paddle") {
      return jsonResponse(
        {
          error: "No encontramos una suscripcion de Paddle asociada a esta cuenta para reactivar la renovacion.",
        },
        { status: 400 },
      );
    }

    const subscription = await reactivatePaddleSubscription(entitlement.provider_subscription_id);
    const resolvedEntitlement = resolveEntitlementFromPaddleSubscription(subscription);
    const { error: upsertError } = await adminClient.from("user_entitlements").upsert(
      {
        user_id: user.id,
        plan_code: resolvedEntitlement.planCode,
        pro_access_enabled: resolvedEntitlement.proAccessEnabled,
        billing_provider: resolvedEntitlement.billingProvider,
        billing_status: resolvedEntitlement.billingStatus,
        provider_customer_id:
          resolvedEntitlement.providerCustomerId ?? entitlement.provider_customer_id ?? null,
        provider_subscription_id:
          resolvedEntitlement.providerSubscriptionId ?? entitlement.provider_subscription_id,
        current_period_start: resolvedEntitlement.currentPeriodStart,
        current_period_end: resolvedEntitlement.currentPeriodEnd,
        cancel_at_period_end: resolvedEntitlement.cancelAtPeriodEnd,
        manual_override: false,
        metadata: {
          ...(resolvedEntitlement.metadata ?? {}),
          reactivated_by_user: true,
          reactivated_at: new Date().toISOString(),
        },
      },
      { onConflict: "user_id" },
    );

    if (upsertError) {
      throw upsertError;
    }

    await upsertBillingEvent(adminClient, {
      provider: "paddle",
      providerEventId: entitlement.provider_subscription_id,
      providerEventType: "subscription_reactivated_by_user",
      userId: user.id,
      externalReference: `dm-pro:${user.id}`,
      payload: {
        subscription,
        reactivatedAt: new Date().toISOString(),
      },
      processed: true,
      processedAt: new Date().toISOString(),
    });

    return jsonResponse({
      provider: "paddle",
      planCode: resolvedEntitlement.planCode,
      billingProvider: resolvedEntitlement.billingProvider,
      billingStatus: resolvedEntitlement.billingStatus,
      proAccessEnabled: resolvedEntitlement.proAccessEnabled,
      currentPeriodStart: resolvedEntitlement.currentPeriodStart,
      currentPeriodEnd: resolvedEntitlement.currentPeriodEnd,
      cancelAtPeriodEnd: resolvedEntitlement.cancelAtPeriodEnd,
      providerSubscriptionId:
        resolvedEntitlement.providerSubscriptionId ?? entitlement.provider_subscription_id ?? null,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pudimos reactivar la renovacion de DarkMoney Pro en Paddle.",
      },
      { status: 500 },
    );
  }
});
