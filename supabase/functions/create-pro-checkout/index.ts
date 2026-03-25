import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  createAdminClient,
  createMercadoPagoPreapproval,
  getAuthenticatedUser,
  getMercadoPagoPlanAmount,
  getMercadoPagoPlanCurrency,
  isAdminOverrideEmail,
  normalizePublicAppUrl,
  resolveAppUrl,
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

    if (!user.email) {
      return jsonResponse(
        { error: "Tu usuario no tiene email disponible para iniciar la suscripcion." },
        { status: 400 },
      );
    }

    if (isAdminOverrideEmail(user.email)) {
      return jsonResponse(
        {
          error:
            "Tu cuenta administradora ya tiene acceso total. No necesita abrir un checkout de Mercado Pago.",
        },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const explicitAppUrl = typeof body?.appUrl === "string" ? body.appUrl : null;
    const appUrl =
      normalizePublicAppUrl(explicitAppUrl) ??
      normalizePublicAppUrl(request.headers.get("origin")) ??
      resolveAppUrl(request, explicitAppUrl);
    const adminClient = createAdminClient();
    const externalReference = `dm-pro:${user.id}`;
    const preapproval = await createMercadoPagoPreapproval({
      amount: getMercadoPagoPlanAmount(),
      appUrl,
      payerEmail: user.email,
      externalReference,
    });

    const { error: entitlementError } = await adminClient.from("user_entitlements").upsert(
      {
        user_id: user.id,
        plan_code: "free",
        pro_access_enabled: false,
        billing_provider: "mercado_pago",
        billing_status: preapproval.status ?? "checkout_pending",
        provider_subscription_id: preapproval.id ?? null,
        metadata: {
          checkout_provider: "mercado_pago",
          last_checkout_at: new Date().toISOString(),
          last_checkout_url: preapproval.init_point ?? null,
          plan_currency: getMercadoPagoPlanCurrency(),
          plan_amount: getMercadoPagoPlanAmount(),
        },
      },
      {
        onConflict: "user_id",
      },
    );

    if (entitlementError) {
      throw entitlementError;
    }

    await upsertBillingEvent(adminClient, {
      providerEventId: preapproval.id ?? null,
      providerEventType: "checkout_created",
      userId: user.id,
      externalReference,
      payload: {
        request: {
          appUrl,
          workspaceId: body?.workspaceId ?? null,
        },
        response: preapproval,
      },
      processed: true,
      processedAt: new Date().toISOString(),
    });

    if (!preapproval.init_point) {
      throw new Error("Mercado Pago no devolvio init_point para continuar.");
    }

    return jsonResponse({
      provider: "mercado_pago",
      checkoutUrl: preapproval.init_point,
      subscriptionId: preapproval.id ?? null,
      billingStatus: preapproval.status ?? null,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pudimos crear el checkout Pro en Mercado Pago.",
      },
      { status: 500 },
    );
  }
});
