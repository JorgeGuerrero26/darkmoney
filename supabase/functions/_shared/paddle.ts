import { buildAppNavigationUrl, getRequiredEnv } from "./billing.ts";

type PaddleScheduledChange = {
  action?: string | null;
  effective_at?: string | null;
};

type PaddleBillingPeriod = {
  starts_at?: string | null;
  ends_at?: string | null;
};

type PaddleMoney = {
  amount?: string | null;
  currency_code?: string | null;
};

type PaddleTransactionItemPrice = {
  unit_price?: PaddleMoney | null;
};

type PaddleTransactionItem = {
  price?: PaddleTransactionItemPrice | null;
  quantity?: number | null;
};

type PaddleTransactionTotals = {
  total?: PaddleMoney | null;
  grand_total?: PaddleMoney | null;
  subtotal?: PaddleMoney | null;
};

type PaddleTransactionDetails = {
  totals?: PaddleTransactionTotals | null;
};

export type PaddleSubscription = {
  id?: string | null;
  status?: string | null;
  customer_id?: string | null;
  custom_data?: Record<string, unknown> | null;
  started_at?: string | null;
  first_billed_at?: string | null;
  next_billed_at?: string | null;
  paused_at?: string | null;
  canceled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  current_billing_period?: PaddleBillingPeriod | null;
  scheduled_change?: PaddleScheduledChange | null;
};

export type PaddleTransaction = {
  id?: string | null;
  status?: string | null;
  customer_id?: string | null;
  subscription_id?: string | null;
  invoice_number?: string | null;
  currency_code?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  billed_at?: string | null;
  details?: PaddleTransactionDetails | null;
  items?: PaddleTransactionItem[] | null;
};

type PaddleSubscriptionResponse = {
  data?: PaddleSubscription | null;
};

type PaddleTransactionsResponse = {
  data?: PaddleTransaction[] | null;
};

type PaddleCustomerPortalSessionUrls = {
  general?: {
    overview?: string | null;
  } | null;
  subscriptions?: Array<{
    id?: string | null;
    cancel_subscription?: string | null;
    update_subscription_payment_method?: string | null;
  }> | null;
};

type PaddleCustomerPortalSessionResponse = {
  data?: {
    urls?: PaddleCustomerPortalSessionUrls | null;
  } | null;
};

function getPaddleApiKey() {
  return getRequiredEnv("PADDLE_API_KEY").trim();
}

function getPaddleWebhookSecret() {
  return getRequiredEnv("PADDLE_WEBHOOK_SECRET").trim();
}

function resolvePaddleApiEnvironment() {
  const configuredEnvironment = Deno.env.get("PADDLE_ENV")?.trim().toLowerCase();

  if (configuredEnvironment === "sandbox" || configuredEnvironment === "production") {
    return configuredEnvironment;
  }

  return getPaddleApiKey().includes("_sdbx") ? "sandbox" : "production";
}

function getPaddleApiBaseUrl() {
  return resolvePaddleApiEnvironment() === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

async function paddleRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${getPaddleApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${getPaddleApiKey()}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Paddle respondio ${response.status}: ${errorText}`);
  }

  return (await response.json()) as T;
}

export async function cancelPaddleSubscription(subscriptionId: string) {
  const response = await paddleRequest<PaddleSubscriptionResponse>(
    `/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        effective_from: "next_billing_period",
      }),
    },
  );

  return response.data ?? null;
}

export async function getPaddleSubscription(subscriptionId: string) {
  const response = await paddleRequest<PaddleSubscriptionResponse>(`/subscriptions/${subscriptionId}`, {
    method: "GET",
  });

  return response.data ?? null;
}

export async function listPaddleTransactions(subscriptionId: string) {
  const query = new URLSearchParams({
    subscription_id: subscriptionId,
  });
  const response = await paddleRequest<PaddleTransactionsResponse>(`/transactions?${query.toString()}`, {
    method: "GET",
  });

  return response.data ?? [];
}

export async function createPaddleCustomerPortalSession(customerId: string, subscriptionId?: string | null) {
  const body = subscriptionId
    ? {
      subscription_ids: [subscriptionId],
    }
    : {};
  const response = await paddleRequest<PaddleCustomerPortalSessionResponse>(
    `/customers/${customerId}/portal-sessions`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  const urls = response.data?.urls;
  const subscriptionUrls = urls?.subscriptions?.[0];

  return {
    overviewUrl: urls?.general?.overview ?? null,
    cancelUrl: subscriptionUrls?.cancel_subscription ?? null,
    updatePaymentMethodUrl: subscriptionUrls?.update_subscription_payment_method ?? null,
  };
}

export async function reactivatePaddleSubscription(subscriptionId: string) {
  const response = await paddleRequest<PaddleSubscriptionResponse>(
    `/subscriptions/${subscriptionId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        scheduled_change: null,
      }),
    },
  );

  return response.data ?? null;
}

function normalizePaddleSubscriptionStatus(status?: string | null) {
  return status?.trim().toLowerCase() ?? null;
}

export function resolveEntitlementFromPaddleSubscription(subscription: PaddleSubscription | null) {
  const normalizedStatus = normalizePaddleSubscriptionStatus(subscription?.status);
  const scheduledChangeAction = subscription?.scheduled_change?.action?.trim().toLowerCase() ?? null;
  const currentPeriodEnd =
    subscription?.current_billing_period?.ends_at ??
    subscription?.next_billed_at ??
    subscription?.scheduled_change?.effective_at ??
    subscription?.canceled_at ??
    null;
  const proAccessEnabled = normalizedStatus !== null && new Set([
    "trialing",
    "active",
    "paused",
    "past_due",
  ]).has(normalizedStatus);

  return {
    planCode: proAccessEnabled ? "pro" : "free",
    proAccessEnabled,
    billingStatus: normalizedStatus,
    billingProvider: "paddle",
    providerCustomerId: subscription?.customer_id ?? null,
    providerSubscriptionId: subscription?.id ?? null,
    currentPeriodStart:
      subscription?.current_billing_period?.starts_at ??
      subscription?.started_at ??
      subscription?.first_billed_at ??
      subscription?.created_at ??
      null,
    currentPeriodEnd,
    cancelAtPeriodEnd: scheduledChangeAction === "cancel",
    metadata: {
      paddle_status: normalizedStatus,
      paddle_scheduled_change_action: scheduledChangeAction,
      paddle_next_billed_at: subscription?.next_billed_at ?? null,
      paddle_updated_at: subscription?.updated_at ?? null,
    },
  };
}

export function extractUserIdFromPaddleCustomData(customData?: Record<string, unknown> | null) {
  if (!customData || typeof customData !== "object") {
    return null;
  }

  const userId = customData.user_id;

  if (typeof userId === "string") {
    return userId.trim() || null;
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

function parsePaddleSignatureHeader(value?: string | null) {
  if (!value) {
    return {
      timestamp: null,
      signatures: [] as string[],
    };
  }

  const attributes = value
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.split("="))
    .filter((parts) => parts.length === 2)
    .reduce<Record<string, string[]>>((accumulator, [rawKey, rawValue]) => {
      const key = rawKey.trim();
      const parsedValue = rawValue.trim();

      if (!accumulator[key]) {
        accumulator[key] = [];
      }

      accumulator[key].push(parsedValue);
      return accumulator;
    }, {});

  return {
    timestamp: attributes.ts?.[0] ?? null,
    signatures: attributes.h1 ?? [],
  };
}

export async function validatePaddleWebhookSignature(rawBody: string, signatureHeader?: string | null) {
  const { timestamp, signatures } = parsePaddleSignatureHeader(signatureHeader);

  if (!timestamp || signatures.length === 0) {
    return {
      valid: false,
      reason: "No llego una firma Paddle-Signature valida.",
    };
  }

  const timestampSeconds = Number(timestamp);

  if (!Number.isFinite(timestampSeconds)) {
    return {
      valid: false,
      reason: "La firma Paddle-Signature no incluyo un timestamp interpretable.",
    };
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);

  if (ageSeconds > 300) {
    return {
      valid: false,
      reason: "La firma Paddle-Signature esta fuera de la ventana permitida.",
    };
  }

  const signedPayload = `${timestamp}:${rawBody}`;
  const computedSignature = await hmacSha256Hex(getPaddleWebhookSecret(), signedPayload);
  const valid = signatures.some((signature) => timingSafeEqualHex(signature, computedSignature));

  return {
    valid,
    reason: valid ? null : "La firma webhook de Paddle no coincide.",
  };
}

export function buildPaddleSuccessUrl(appUrl: string) {
  return buildAppNavigationUrl(appUrl, "app/settings?billing=paddle");
}
