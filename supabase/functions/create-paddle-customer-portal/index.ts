import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient, getAuthenticatedUser, isAdminOverrideEmail } from "../_shared/billing.ts";
import { createPaddleCustomerPortalSession } from "../_shared/paddle.ts";

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
          error: "La cuenta administradora no necesita portal de suscripcion porque su acceso premium viene por override interno.",
        },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const { data: entitlement, error: entitlementError } = await adminClient
      .from("user_entitlements")
      .select("billing_provider, provider_customer_id, provider_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (entitlementError) {
      throw entitlementError;
    }

    if (entitlement?.billing_provider !== "paddle" || !entitlement.provider_customer_id) {
      return jsonResponse(
        {
          error: "No encontramos una suscripcion de Paddle vinculada a esta cuenta para abrir el portal.",
        },
        { status: 400 },
      );
    }

    const session = await createPaddleCustomerPortalSession(
      entitlement.provider_customer_id,
      entitlement.provider_subscription_id,
    );

    const portalUrl = session.updatePaymentMethodUrl ?? session.overviewUrl ?? session.cancelUrl ?? null;

    if (!portalUrl) {
      throw new Error(
        "Paddle no devolvio una URL util del portal. Revisa que la API key tenga permiso Customer portal sessions -> Write.",
      );
    }

    return jsonResponse({
      provider: "paddle",
      portalUrl,
      overviewUrl: session.overviewUrl,
      cancelUrl: session.cancelUrl,
      updatePaymentMethodUrl: session.updatePaymentMethodUrl,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pudimos abrir el portal de suscripcion de Paddle.",
      },
      { status: 500 },
    );
  }
});
