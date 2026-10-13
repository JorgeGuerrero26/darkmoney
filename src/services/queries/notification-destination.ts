import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SharedObligationSummary, Workspace, WorkspaceRole } from "../../types/domain";
import { supabase } from "../supabase/client";
import { notificationDefersRead, notificationHref, notificationId } from "../../modules/notifications/lib/notification-navigation";
import { readLegacySharedObligations, readSharedObligations } from "./shared-obligations";

export type NotificationDestination = {
  id: number;
  href: string;
  workspace: Workspace | null;
  scope: "workspace" | "shared" | "global";
  shouldMarkRead: boolean;
};
type ReadClient = Pick<SupabaseClient, "from">;

async function permittedWorkspace(client: ReadClient, userId: string, workspaceId: number): Promise<Workspace | null> {
  const [membership, workspace] = await Promise.all([
    client.from("workspace_members").select("role, joined_at, is_default_workspace").eq("user_id", userId).eq("workspace_id", workspaceId).maybeSingle(),
    client.from("workspaces").select("id, name, kind, description, base_currency_code, owner_user_id, is_archived").eq("id", workspaceId).eq("is_archived", false).maybeSingle(),
  ]);
  if (membership.error) throw membership.error;
  if (workspace.error) throw workspace.error;
  if (!workspace.data || workspace.data.is_archived) return null;
  const role = membership.data?.role ?? (workspace.data.owner_user_id === userId ? "owner" : null);
  if (!["owner", "admin", "member", "viewer"].includes(role)) return null;
  return {
    id: workspace.data.id, name: workspace.data.name, kind: workspace.data.kind,
    role: role as WorkspaceRole, description: workspace.data.description ?? "",
    baseCurrencyCode: workspace.data.base_currency_code, isArchived: false,
    ownerUserId: workspace.data.owner_user_id,
    isDefaultWorkspace: membership.data?.is_default_workspace ?? false, joinedAt: membership.data?.joined_at ?? null,
  };
}

/** Read-only preflight. Never guesses a space from the current UI or reconciles detections. */
export async function fetchNotificationDestination(client: ReadClient, userId: string, noticeId: number, readShared?: () => Promise<SharedObligationSummary[]>): Promise<NotificationDestination> {
  if (!userId || notificationId(noticeId) !== noticeId) throw new Error("Aviso inválido o sesión no disponible.");
  const { data: row, error } = await client.from("notifications")
    .select("id, kind, channel, status, related_entity_type, related_entity_id, payload")
    .eq("user_id", userId).eq("id", noticeId).maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("El aviso ya no está disponible para este usuario.");
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
  const kind = row.kind ?? row.related_entity_type ?? row.channel ?? "system";
  const notice = { kind, relatedEntityType: row.related_entity_type, relatedEntityId: row.related_entity_id, payload };
  const href = notificationHref(notice);
  const result = { id: noticeId, href, shouldMarkRead: row.status !== "read" && !notificationDefersRead(kind) };
  const url = new URL(href, "https://internal.invalid");
  // Tokens are handled by the invitation destination; an unknown kind stays in the personal inbox.
  if (url.pathname.startsWith("/share/") || (url.pathname === "/app/notifications" && !url.searchParams.has("detected"))) {
    return { ...result, workspace: null, scope: "global" };
  }
  const rawWorkspace = payload.workspaceId ?? payload.workspace_id;
  const declaredWorkspaceId = notificationId(rawWorkspace);
  if (rawWorkspace != null && !declaredWorkspaceId) throw new Error("El espacio del aviso no es válido.");
  if (payload.workspaceId != null && payload.workspace_id != null && notificationId(payload.workspaceId) !== notificationId(payload.workspace_id)) {
    throw new Error("El aviso contiene espacios incompatibles.");
  }
  const resource = notificationId(url.searchParams.get("resource") ?? url.searchParams.get("duplicateFrom") ?? url.searchParams.get("movement") ?? url.searchParams.get("categoryId"));
  const detected = notificationId(url.searchParams.get("detected"));
  const tables: Record<string, string> = {
    "/app/accounts": "accounts", "/app/subscriptions": "subscriptions", "/app/budgets": "budgets",
    "/app/obligations": "obligations", "/app/movements": url.searchParams.has("categoryId") ? "categories" : "movements",
  };
  const entityTables: Record<string, string> = { account: "accounts", subscription: "subscriptions", budget: "budgets", obligation: "obligations", movement: "movements", category: "categories", recurring_income: "recurring_income" };
  let table: string | undefined = detected ? "notification_detected_movement_suggestions" : resource ? tables[url.pathname] : entityTables[row.related_entity_type];
  const resourceId = detected ?? resource ?? (table ? notificationId(row.related_entity_id) : null);
  if (!resourceId) table = undefined;
  let workspaceId = declaredWorkspaceId;
  if (table && resourceId) {
    let query = client.from(table).select("id, workspace_id").eq("id", resourceId);
    if (detected) query = query.eq("user_id", userId);
    const resourceResponse = await query.maybeSingle();
    if (resourceResponse.error) throw resourceResponse.error;
    const actualWorkspaceId = notificationId(resourceResponse.data?.workspace_id);
    if (table === "obligations") {
      const ownWorkspace = actualWorkspaceId ? await permittedWorkspace(client, userId, actualWorkspaceId) : null;
      if (ownWorkspace) {
        if (declaredWorkspaceId && declaredWorkspaceId !== actualWorkspaceId) throw new Error("El recurso no pertenece al espacio del aviso.");
        return { ...result, workspace: ownWorkspace, scope: "workspace" };
      }
      if (readShared) {
        // The same authenticated RPC as the resource page also supports legacy email grants.
        const shared = (await readShared()).find((item) => item.id === resourceId);
        if (!shared) throw new Error("La obligación ya no está disponible o no tienes acceso.");
        if ((declaredWorkspaceId && declaredWorkspaceId !== shared.workspaceId) || (actualWorkspaceId && actualWorkspaceId !== shared.workspaceId)) throw new Error("El recurso no pertenece al espacio del aviso.");
        return { ...result, workspace: null, scope: "shared" };
      }
      // Sharing one obligation does not grant membership in its owner's space.
      const share = await client.from("obligation_shares").select("id, workspace_id")
        .eq("invited_user_id", userId).eq("obligation_id", resourceId).eq("status", "accepted")
        .order("id", { ascending: false }).limit(1).maybeSingle();
      if (share.error) throw share.error;
      const originalSpace = actualWorkspaceId ?? notificationId(share.data?.workspace_id);
      if (declaredWorkspaceId && originalSpace && declaredWorkspaceId !== originalSpace) throw new Error("El recurso no pertenece al espacio del aviso.");
      if (share.data && originalSpace) return { ...result, workspace: null, scope: "shared" };
      throw new Error("La obligación ya no está disponible o no tienes acceso.");
    }
    if (!actualWorkspaceId) throw new Error("El recurso ya no está disponible o no tienes acceso.");
    if (declaredWorkspaceId && declaredWorkspaceId !== actualWorkspaceId) throw new Error("El recurso no pertenece al espacio del aviso.");
    workspaceId = actualWorkspaceId;
  }
  if (row.related_entity_type === "workspace") {
    const entityWorkspace = notificationId(row.related_entity_id);
    if (workspaceId && entityWorkspace && workspaceId !== entityWorkspace) throw new Error("El aviso contiene espacios incompatibles.");
    workspaceId ??= entityWorkspace;
  }
  if (!workspaceId) throw new Error("Este aviso no identifica su espacio. No se abrirán datos de otro espacio por defecto.");
  const workspace = await permittedWorkspace(client, userId, workspaceId);
  if (!workspace) throw new Error("El espacio fue archivado o ya no tienes acceso.");
  return { ...result, workspace, scope: "workspace" };
}

export function useNotificationDestination(userId: string | undefined, noticeId: number | null) {
  return useQuery({
    queryKey: ["notification-destination", userId ?? null, noticeId],
    queryFn: ({ signal }) => {
      if (!supabase || !userId || !noticeId) throw new Error("No se puede consultar este aviso.");
      return fetchNotificationDestination(supabase, userId, noticeId, () => readSharedObligations(supabase!, userId,
        (legacySignal) => readLegacySharedObligations(supabase!, legacySignal), { signal }));
    },
    enabled: Boolean(userId && noticeId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
