import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  createAdminClient,
  getAuthenticatedUser,
  isAdminOverrideEmail,
  upsertBillingEvent,
} from "../_shared/billing.ts";
import {
  cancelLemonSqueezySubscription,
  resolveEntitlementFromLemonSubscription,
} from "../_shared/lemon-squeezy.ts";

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

    if (!entitlement?.provider_subscription_id || entitlement.billing_provider !== "lemon_squeezy") {
      return jsonResponse(
        {
          error:
            "No encontramos una suscripcion activa de Lemon Squeezy asociada a esta cuenta.",
        },
        { status: 400 },
      );
    }

    const subscription = await cancelLemonSqueezySubscription(entitlement.provider_subscription_id);
    const resolvedEntitlement = resolveEntitlementFromLemonSubscription(subscription);
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
          cancelled_by_user: true,
          cancelled_at: new Date().toISOString(),
          lemon_squeezy_status: subscription?.attributes?.status ?? null,
        },
      },
      { onConflict: "user_id" },
    );

    if (upsertError) {
      throw upsertError;
    }

    await upsertBillingEvent(adminClient, {
      provider: "lemon_squeezy",
      providerEventId: entitlement.provider_subscription_id,
      providerEventType: "subscription_cancelled_by_user",
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
      provider: "lemon_squeezy",
      planCode: resolvedEntitlement.planCode,
      billingProvider: resolvedEntitlement.billingProvider,
      billingStatus: resolvedEntitlement.billingStatus ?? subscription?.attributes?.status ?? "cancelled",
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
            : "No pudimos cancelar la suscripcion de DarkMoney Pro.",
      },
      { status: 500 },
    );
  }
});
