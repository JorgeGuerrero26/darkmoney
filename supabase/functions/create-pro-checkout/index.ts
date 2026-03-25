import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  createAdminClient,
  getAuthenticatedUser,
  isAdminOverrideEmail,
  normalizePublicAppUrl,
  resolveAppUrl,
  upsertBillingEvent,
} from "../_shared/billing.ts";
import { createLemonSqueezyCheckout } from "../_shared/lemon-squeezy.ts";

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
            "Tu cuenta administradora ya tiene acceso total. No necesita abrir un checkout de Lemon Squeezy.",
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
    const checkout = await createLemonSqueezyCheckout({
      appUrl,
      userId: user.id,
      payerEmail: user.email,
      payerName:
        ((user.user_metadata ?? {}) as { full_name?: string }).full_name?.trim() ??
        user.email.split("@")[0] ??
        "Usuario DarkMoney",
      workspaceId: typeof body?.workspaceId === "number" ? body.workspaceId : null,
    });

    const { error: entitlementError } = await adminClient.from("user_entitlements").upsert(
      {
        user_id: user.id,
        plan_code: "free",
        pro_access_enabled: false,
        billing_provider: "lemon_squeezy",
        billing_status: "checkout_created",
        provider_subscription_id: null,
        metadata: {
          checkout_provider: "lemon_squeezy",
          last_checkout_at: new Date().toISOString(),
          last_checkout_id: checkout.id,
          last_checkout_url: checkout.url,
          test_mode: checkout.testMode,
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
      provider: "lemon_squeezy",
      providerEventId: checkout.id ?? null,
      providerEventType: "checkout_created",
      userId: user.id,
      externalReference: `dm-pro:${user.id}`,
      payload: {
        request: {
          appUrl,
          workspaceId: body?.workspaceId ?? null,
        },
        response: checkout,
      },
      processed: true,
      processedAt: new Date().toISOString(),
    });

    if (!checkout.url) {
      throw new Error("Lemon Squeezy no devolvio una URL valida para continuar.");
    }

    return jsonResponse({
      provider: "lemon_squeezy",
      checkoutUrl: checkout.url,
      subscriptionId: null,
      billingStatus: "checkout_created",
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pudimos crear el checkout Pro en Lemon Squeezy.",
      },
      { status: 500 },
    );
  }
});
