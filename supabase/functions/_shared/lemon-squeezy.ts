import { buildAppNavigationUrl, getRequiredEnv } from "./billing.ts";

type LemonSqueezyCheckoutResponse = {
  data?: {
    id?: string;
    attributes?: {
      url?: string | null;
      test_mode?: boolean;
    } | null;
  } | null;
};

type LemonSqueezySubscriptionAttributes = {
  customer_id?: number | string | null;
  user_email?: string | null;
  user_name?: string | null;
  status?: string | null;
  cancelled?: boolean;
  renews_at?: string | null;
  ends_at?: string | null;
  trial_ends_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type LemonSqueezySubscription = {
  type?: string;
  id?: string;
  attributes?: LemonSqueezySubscriptionAttributes | null;
};

type LemonSqueezySubscriptionResponse = {
  data?: LemonSqueezySubscription | null;
};

function getLemonSqueezyApiKey() {
  return getRequiredEnv("LEMON_SQUEEZY_API_KEY");
}

function getLemonSqueezyStoreId() {
  return getRequiredEnv("LEMON_SQUEEZY_STORE_ID").trim();
}

function getLemonSqueezyProVariantId() {
  return getRequiredEnv("LEMON_SQUEEZY_PRO_VARIANT_ID").trim();
}

function getLemonSqueezyWebhookSecret() {
  return Deno.env.get("LEMON_SQUEEZY_WEBHOOK_SECRET")?.trim() ?? "";
}

async function lemonSqueezyRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`https://api.lemonsqueezy.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${getLemonSqueezyApiKey()}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lemon Squeezy respondio ${response.status}: ${errorText}`);
  }

  return (await response.json()) as T;
}

export async function createLemonSqueezyCheckout(input: {
  appUrl: string;
  userId: string;
  payerEmail: string;
  payerName?: string | null;
  workspaceId?: number | null;
}) {
  const redirectUrl = buildAppNavigationUrl(input.appUrl, "app/settings?billing=lemonsqueezy");
  const customData: Record<string, string> = {
    user_id: input.userId,
    source: "darkmoney_pro",
  };

  if (input.workspaceId) {
    customData.workspace_id = String(input.workspaceId);
  }

  const response = await lemonSqueezyRequest<LemonSqueezyCheckoutResponse>("/v1/checkouts", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          product_options: {
            redirect_url: redirectUrl,
            receipt_button_text: "Abrir DarkMoney",
            receipt_link_url: redirectUrl,
            receipt_thank_you_note:
              "Gracias por suscribirte a DarkMoney Pro. Tu acceso premium se activara automaticamente cuando Lemon Squeezy confirme el estado de la suscripcion.",
            enabled_variants: [getLemonSqueezyProVariantId()],
          },
          checkout_options: {
            embed: false,
            media: true,
            logo: true,
            desc: true,
            discount: true,
            subscription_preview: true,
            button_color: "#4566d6",
          },
          checkout_data: {
            email: input.payerEmail,
            name: input.payerName ?? "",
            custom: customData,
          },
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: getLemonSqueezyStoreId(),
            },
          },
          variant: {
            data: {
              type: "variants",
              id: getLemonSqueezyProVariantId(),
            },
          },
        },
      },
    }),
  });

  return {
    id: response.data?.id ?? null,
    url: response.data?.attributes?.url ?? null,
    testMode: Boolean(response.data?.attributes?.test_mode),
  };
}

export async function cancelLemonSqueezySubscription(subscriptionId: string) {
  const response = await lemonSqueezyRequest<LemonSqueezySubscriptionResponse>(
    `/v1/subscriptions/${subscriptionId}`,
    {
      method: "DELETE",
    },
  );

  return response.data ?? null;
}

function resolveStatusFromEventName(eventName?: string | null) {
  switch (eventName?.trim().toLowerCase()) {
    case "subscription_cancelled":
      return "cancelled";
    case "subscription_expired":
      return "expired";
    case "subscription_paused":
      return "paused";
    case "subscription_unpaused":
      return "active";
    case "subscription_payment_failed":
      return "past_due";
    case "subscription_payment_success":
    case "subscription_payment_recovered":
    case "subscription_resumed":
      return "active";
    default:
      return null;
  }
}

function resolveSubscriptionStatus(status?: string | null, eventName?: string | null) {
  const eventStatus = resolveStatusFromEventName(eventName);
  const normalizedStatus = eventStatus ?? status?.trim().toLowerCase() ?? null;
  const canAccessStatuses = new Set([
    "on_trial",
    "active",
    "paused",
    "past_due",
    "unpaid",
    "cancelled",
  ]);

  return {
    normalizedStatus,
    proAccessEnabled: normalizedStatus ? canAccessStatuses.has(normalizedStatus) : false,
  };
}

export function resolveEntitlementFromLemonSubscription(
  subscription: LemonSqueezySubscription | null,
  eventName?: string | null,
) {
  const attributes = subscription?.attributes ?? null;
  const { normalizedStatus, proAccessEnabled } = resolveSubscriptionStatus(
    attributes?.status,
    eventName,
  );

  return {
    planCode: proAccessEnabled ? "pro" : "free",
    proAccessEnabled,
    billingStatus: normalizedStatus,
    billingProvider: "lemon_squeezy",
    providerCustomerId:
      attributes?.customer_id === null || attributes?.customer_id === undefined
        ? null
        : String(attributes.customer_id),
    providerSubscriptionId: subscription?.id ?? null,
    currentPeriodStart: attributes?.created_at ?? null,
    currentPeriodEnd: attributes?.ends_at ?? attributes?.renews_at ?? attributes?.trial_ends_at ?? null,
    cancelAtPeriodEnd: Boolean(attributes?.cancelled) || normalizedStatus === "cancelled",
  };
}

export function extractUserIdFromLemonCustomData(
  customData?: Record<string, unknown> | null,
) {
  if (!customData || typeof customData !== "object") {
    return null;
  }

  const userId = customData.user_id;

  if (typeof userId === "string") {
    const normalizedUserId = userId.trim();
    return normalizedUserId || null;
  }

  if (typeof userId === "number") {
    return String(userId);
  }

  return null;
}

async function hmacSha256Hex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

export async function validateLemonSqueezyWebhookSignature(rawBody: string, xSignature: string | null) {
  const secret = getLemonSqueezyWebhookSecret();

  if (!secret) {
    return {
      valid: true,
      skipped: true,
      reason: "LEMON_SQUEEZY_WEBHOOK_SECRET no esta configurado.",
    };
  }

  const receivedSignature = xSignature?.trim().toLowerCase() ?? "";

  if (!receivedSignature) {
    return {
      valid: false,
      skipped: false,
      reason: "No llego la firma X-Signature de Lemon Squeezy.",
    };
  }

  const expectedSignature = await hmacSha256Hex(secret, rawBody);
  const valid = timingSafeEqualHex(expectedSignature, receivedSignature);

  return {
    valid,
    skipped: false,
    reason: valid ? null : "La firma webhook de Lemon Squeezy no coincide.",
    expectedSignature,
    receivedSignature,
  };
}
