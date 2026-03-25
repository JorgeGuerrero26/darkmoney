import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type BillingEventUpsertInput = {
  provider: string;
  providerEventId?: string | null;
  providerEventType?: string | null;
  userId?: string | null;
  externalReference?: string | null;
  payload: Record<string, unknown>;
  processed?: boolean;
  processingError?: string | null;
  processedAt?: string | null;
};

export const PRO_ADMIN_EMAIL = "joradrianmori@gmail.com";

export function getRequiredEnv(name: string) {
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

export function normalizePublicAppUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  if (!/^https?:\/\//i.test(trimmedValue)) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);
    const hostname = url.hostname.trim().toLowerCase();
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost");

    if (url.protocol !== "https:" || isLocalhost) {
      return null;
    }

    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function buildAppNavigationUrl(appUrl: string, relativePath: string) {
  const normalizedAppUrl = normalizePublicAppUrl(appUrl);

  if (!normalizedAppUrl) {
    throw new Error(
      "No pudimos construir una APP_URL publica valida. Revisa APP_URL en Supabase Functions.",
    );
  }

  const baseUrl = new URL(normalizedAppUrl.endsWith("/") ? normalizedAppUrl : `${normalizedAppUrl}/`);
  const normalizedRelativePath = relativePath.replace(/^\/+/, "");
  return new URL(normalizedRelativePath, baseUrl).toString();
}

export function resolveAppUrl(request: Request, explicitAppUrl?: string | null) {
  const configuredAppUrl = normalizePublicAppUrl(Deno.env.get("APP_URL"));

  if (configuredAppUrl) {
    return configuredAppUrl;
  }

  const normalizedExplicitAppUrl = normalizePublicAppUrl(explicitAppUrl);

  if (normalizedExplicitAppUrl) {
    return normalizedExplicitAppUrl;
  }

  const normalizedOriginHeader = normalizePublicAppUrl(request.headers.get("origin"));

  if (normalizedOriginHeader) {
    return normalizedOriginHeader;
  }

  throw new Error(
    "No pudimos resolver una APP_URL publica y segura para el checkout externo. Configura APP_URL en Supabase Functions con una URL https real, sin query ni espacios, por ejemplo https://darkmoney.company.",
  );
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

export async function upsertBillingEvent(
  adminClient: ReturnType<typeof createAdminClient>,
  input: BillingEventUpsertInput,
) {
  const payload = {
    provider: input.provider,
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
