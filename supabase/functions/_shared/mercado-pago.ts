import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type BillingEventUpsertInput = {
  providerEventId?: string | null;
  providerEventType?: string | null;
  userId?: string | null;
  externalReference?: string | null;
  payload: Record<string, unknown>;
  processed?: boolean;
  processingError?: string | null;
  processedAt?: string | null;
};

type MercadoPagoPreapproval = {
  id?: string;
  status?: string | null;
  init_point?: string | null;
  payer_id?: number | string | null;
  payer_email?: string | null;
  external_reference?: string | null;
  next_payment_date?: string | null;
  auto_recurring?: {
    start_date?: string | null;
    end_date?: string | null;
  } | null;
};

const PRO_ADMIN_EMAIL = "joradrianmori@gmail.com";

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Falta configurar ${name} en Supabase Functions.`);
  }

  return value;
}

export function createAdminClient() {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getMercadoPagoAccessToken() {
  return getRequiredEnv("MERCADO_PAGO_ACCESS_TOKEN");
}

export function getMercadoPagoPlanAmount() {
  const rawValue = Deno.env.get("MERCADO_PAGO_PRO_MONTHLY_AMOUNT");

  if (!rawValue) {
    throw new Error(
      "Falta configurar MERCADO_PAGO_PRO_MONTHLY_AMOUNT en Supabase Functions.",
    );
  }

  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error("MERCADO_PAGO_PRO_MONTHLY_AMOUNT debe ser un numero positivo.");
  }

  return Number(parsedValue.toFixed(2));
}

export function getMercadoPagoPlanCurrency() {
  return (Deno.env.get("MERCADO_PAGO_PRO_MONTHLY_CURRENCY") ?? "PEN").trim().toUpperCase();
}

export function getMercadoPagoWebhookSecret() {
  return Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET")?.trim() ?? "";
}

export function resolveAppUrl(request: Request, explicitAppUrl?: string | null) {
  if (explicitAppUrl && /^https?:\/\//i.test(explicitAppUrl)) {
    return explicitAppUrl.replace(/\/$/, "");
  }

  const originHeader = request.headers.get("origin");

  if (originHeader && /^https?:\/\//i.test(originHeader)) {
    return originHeader.replace(/\/$/, "");
  }

  const configuredAppUrl = Deno.env.get("APP_URL");

  if (configuredAppUrl && /^https?:\/\//i.test(configuredAppUrl)) {
    return configuredAppUrl.replace(/\/$/, "");
  }

  throw new Error("No pudimos resolver APP_URL para el retorno de Mercado Pago.");
}

export async function getAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    throw new Error("Falta el header Authorization.");
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new Error("No pudimos leer el token del usuario autenticado.");
  }

  const adminClient = createAdminClient();
  const {
    data: { user },
    error,
  } = await adminClient.auth.getUser(token);

  if (error || !user) {
    throw new Error("No pudimos validar la sesion actual del usuario.");
  }

  return user;
}

export function isAdminOverrideEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase() === PRO_ADMIN_EMAIL;
}

async function mercadoPagoRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mercado Pago respondio ${response.status}: ${errorText}`);
  }

  return (await response.json()) as T;
}

async function updateMercadoPagoPreapprovalStatus(
  preapprovalId: string,
  status: "cancelled" | "canceled" | "paused" | "authorized",
) {
  return await mercadoPagoRequest<MercadoPagoPreapproval>(`/preapproval/${preapprovalId}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function createMercadoPagoPreapproval(input: {
  amount: number;
  appUrl: string;
  payerEmail: string;
  externalReference: string;
}) {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");

  return await mercadoPagoRequest<MercadoPagoPreapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: "DarkMoney Pro mensual",
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      back_url: `${input.appUrl}/app/settings?billing=mercadopago`,
      notification_url: `${supabaseUrl}/functions/v1/mercado-pago-webhook`,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: input.amount,
        currency_id: getMercadoPagoPlanCurrency(),
        start_date: new Date().toISOString(),
      },
    }),
  });
}

export async function fetchMercadoPagoPreapproval(preapprovalId: string) {
  return await mercadoPagoRequest<MercadoPagoPreapproval>(`/preapproval/${preapprovalId}`, {
    method: "GET",
  });
}

export async function cancelMercadoPagoPreapproval(preapprovalId: string) {
  try {
    return await updateMercadoPagoPreapprovalStatus(preapprovalId, "cancelled");
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";

    if (!message.includes("400") && !message.includes("status")) {
      throw error;
    }

    return await updateMercadoPagoPreapprovalStatus(preapprovalId, "canceled");
  }
}

export function extractUserIdFromExternalReference(reference?: string | null) {
  if (!reference) {
    return null;
  }

  if (!reference.startsWith("dm-pro:")) {
    return null;
  }

  const userId = reference.slice("dm-pro:".length).trim();
  return userId || null;
}

export function resolveEntitlementFromPreapproval(preapproval: MercadoPagoPreapproval) {
  const isActive = preapproval.status === "authorized";

  return {
    planCode: isActive ? "pro" : "free",
    proAccessEnabled: isActive,
    billingStatus: preapproval.status ?? null,
    billingProvider: "mercado_pago",
    providerCustomerId:
      preapproval.payer_id === null || preapproval.payer_id === undefined
        ? null
        : String(preapproval.payer_id),
    providerSubscriptionId: preapproval.id ?? null,
    currentPeriodStart: preapproval.auto_recurring?.start_date ?? null,
    currentPeriodEnd:
      preapproval.next_payment_date ?? preapproval.auto_recurring?.end_date ?? null,
    cancelAtPeriodEnd: preapproval.status === "cancelled",
  };
}

function parseMercadoPagoSignature(xSignature: string | null) {
  const result: { ts: string | null; v1: string | null } = { ts: null, v1: null };

  if (!xSignature) {
    return result;
  }

  for (const chunk of xSignature.split(",")) {
    const [rawKey, rawValue] = chunk.split("=", 2);
    const key = rawKey?.trim();
    const value = rawValue?.trim() ?? null;

    if (key === "ts") {
      result.ts = value;
    }

    if (key === "v1") {
      result.v1 = value?.toLowerCase() ?? null;
    }
  }

  return result;
}

function normalizeWebhookResourceId(value: string) {
  return /[a-z]/i.test(value) ? value.toLowerCase() : value;
}

function buildMercadoPagoManifest(url: URL, requestId: string | null, ts: string | null) {
  const resourceId = normalizeWebhookResourceId(
    url.searchParams.get("data.id") ??
      url.searchParams.get("id") ??
      url.searchParams.get("resource") ??
      "",
  );
  const parts: string[] = [];

  if (resourceId) {
    parts.push(`id:${resourceId};`);
  }

  if (requestId) {
    parts.push(`request-id:${requestId};`);
  }

  if (ts) {
    parts.push(`ts:${ts};`);
  }

  return {
    manifest: parts.join(""),
    resourceId: resourceId || null,
  };
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

export async function validateMercadoPagoWebhookSignature(request: Request) {
  const secret = getMercadoPagoWebhookSecret();

  if (!secret) {
    return {
      valid: true,
      skipped: true,
      reason: "MERCADO_PAGO_WEBHOOK_SECRET no esta configurado.",
    };
  }

  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  const { ts, v1 } = parseMercadoPagoSignature(xSignature);

  if (!v1) {
    return {
      valid: false,
      skipped: false,
      reason: "No llego la firma v1 en x-signature.",
    };
  }

  const { manifest, resourceId } = buildMercadoPagoManifest(new URL(request.url), xRequestId, ts);

  if (!manifest) {
    return {
      valid: false,
      skipped: false,
      reason: "No pudimos construir el manifiesto de validacion de Mercado Pago.",
      receivedSignature: v1,
      resourceId,
    };
  }

  const expectedSignature = await hmacSha256Hex(secret, manifest);
  const valid = timingSafeEqualHex(expectedSignature, v1);

  return {
    valid,
    skipped: false,
    reason: valid ? null : "La firma webhook de Mercado Pago no coincide.",
    manifest,
    ts,
    requestId: xRequestId,
    expectedSignature,
    receivedSignature: v1,
    resourceId,
  };
}

export async function upsertBillingEvent(
  adminClient: ReturnType<typeof createAdminClient>,
  input: BillingEventUpsertInput,
) {
  const payload = {
    provider: "mercado_pago",
    provider_event_id: input.providerEventId ?? null,
    provider_event_type: input.providerEventType ?? null,
    user_id: input.userId ?? null,
    external_reference: input.externalReference ?? null,
    payload: input.payload,
    processed: input.processed ?? false,
    processing_error: input.processingError ?? null,
    processed_at: input.processedAt ?? null,
  };
  const query = input.providerEventId
    ? adminClient.from("billing_events").upsert(payload, {
        onConflict: "provider,provider_event_id",
      })
    : adminClient.from("billing_events").insert(payload);
  const { error } = await query;

  if (error) {
    console.error("No pudimos guardar billing_events:", error.message);
  }
}
