import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  createAdminClient,
  getAuthenticatedUser,
  isAdminOverrideEmail,
  upsertBillingEvent,
} from "../_shared/billing.ts";
import {
  cancelPaddleSubscription,
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
          error:
            "Tu cuenta administradora no necesita cancelar Pro porque su acceso viene por override interno.",
        },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const { data: entitlement, error: entitlementError } = await adminClient
      .from("user_entitlements")
      .select(
        "user_id, billing_provider, provider_subscription_id, provider_customer_id, manual_override",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (entitlementError) {
      throw entitlementError;
    }

    if (!entitlement?.provider_subscription_id || entitlement.billing_provider !== "paddle") {
      return jsonResponse(
        {
          error: "No encontramos una suscripcion activa de Paddle asociada a esta cuenta.",
        },
        { status: 400 },
      );
    }

    const subscription = await cancelPaddleSubscription(entitlement.provider_subscription_id);
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
          cancelled_by_user: true,
          cancelled_at: new Date().toISOString(),
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
      providerEventType: "subscription_cancel_requested_by_user",
      userId: user.id,
      externalReference: `dm-pro:${user.id}`,
      payload: {
        subscription,
        cancelledAt: new Date().toISOString(),
      },
      processed: true,
      processedAt: new Date().toISOString(),
    });

    return jsonResponse({
      provider: "paddle",
      billingStatus: subscription?.status ?? "active",
      proAccessEnabled: resolvedEntitlement.proAccessEnabled,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pudimos cancelar la suscripcion de DarkMoney Pro en Paddle.",
      },
      { status: 500 },
    );
  }
});
