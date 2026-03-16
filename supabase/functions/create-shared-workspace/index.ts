import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient, getAuthenticatedUser } from "../_shared/mercado-pago.ts";

function getOptionalText(value: unknown, maxLength = 180) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue.slice(0, maxLength) : null;
}

function normalizeCurrencyCode(value: unknown, fallback = "PEN") {
  const normalizedValue = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/.test(normalizedValue) ? normalizedValue : fallback;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Metodo no permitido." }, { status: 405 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const name = getOptionalText(body?.name, 120);
    const description = getOptionalText(body?.description, 240);
    const adminClient = createAdminClient();

    if (!name) {
      return jsonResponse({
        ok: false,
        error: "Ponle un nombre claro a tu workspace colaborativo.",
      });
    }

    const { data: profileData } = await adminClient
      .from("profiles")
      .select("base_currency_code")
      .eq("id", user.id)
      .maybeSingle();
    const baseCurrencyCode = normalizeCurrencyCode(
      body?.baseCurrencyCode,
      profileData?.base_currency_code ?? "PEN",
    );

    const { data: workspaceData, error: workspaceError } = await adminClient
      .from("workspaces")
      .insert({
        owner_user_id: user.id,
        name,
        kind: "shared",
        base_currency_code: baseCurrencyCode,
        description: description ?? "Workspace colaborativo creado desde DarkMoney.",
      })
      .select(
        "id, owner_user_id, name, kind, base_currency_code, description, is_archived, created_at, updated_at",
      )
      .single();

    if (workspaceError) {
      throw workspaceError;
    }

    const { error: memberError } = await adminClient.from("workspace_members").insert({
      workspace_id: workspaceData.id,
      user_id: user.id,
      role: "owner",
      is_default_workspace: false,
    });

    if (memberError) {
      await adminClient.from("workspaces").delete().eq("id", workspaceData.id);
      throw memberError;
    }

    return jsonResponse({
      ok: true,
      workspace: {
        id: workspaceData.id,
        name: workspaceData.name,
        kind: workspaceData.kind,
        role: "owner",
        description: workspaceData.description ?? "",
        baseCurrencyCode: workspaceData.base_currency_code ?? baseCurrencyCode,
        isDefaultWorkspace: false,
        isArchived: Boolean(workspaceData.is_archived),
        joinedAt: workspaceData.created_at,
        ownerUserId: workspaceData.owner_user_id,
      },
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No pudimos crear el workspace colaborativo.",
    });
  }
});
