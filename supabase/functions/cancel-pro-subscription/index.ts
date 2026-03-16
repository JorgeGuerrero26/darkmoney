import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  cancelMercadoPagoPreapproval,
  createAdminClient,
  getAuthenticatedUser,
  isAdminOverrideEmail,
  resolveEntitlementFromPreapproval,
  upsertBillingEvent,
} from "../_shared/mercado-pago.ts";

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

    if (!entitlement?.provider_subscription_id || entitlement.billing_provider !== "mercado_pago") {
      return jsonResponse(
        {
          error:
            "No encontramos una suscripcion activa de Mercado Pago asociada a esta cuenta.",
        },
        { status: 400 },
      );
    }

    const preapproval = await cancelMercadoPagoPreapproval(entitlement.provider_subscription_id);
    const resolvedEntitlement = resolveEntitlementFromPreapproval(preapproval);
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
        cancel_at_period_end: false,
        manual_override: false,
        metadata: {
          cancelled_by_user: true,
          cancelled_at: new Date().toISOString(),
          mercado_pago_status: preapproval.status ?? null,
        },
      },
      { onConflict: "user_id" },
    );

    if (upsertError) {
      throw upsertError;
    }

    await upsertBillingEvent(adminClient, {
      providerEventId: entitlement.provider_subscription_id,
      providerEventType: "subscription_cancelled_by_user",
      userId: user.id,
      externalReference: preapproval.external_reference ?? `dm-pro:${user.id}`,
      payload: {
        preapproval,
        cancelledAt: new Date().toISOString(),
      },
      processed: true,
      processedAt: new Date().toISOString(),
    });

    return jsonResponse({
      provider: "mercado_pago",
      billingStatus: preapproval.status ?? "cancelled",
      proAccessEnabled: resolvedEntitlement.proAccessEnabled,
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
