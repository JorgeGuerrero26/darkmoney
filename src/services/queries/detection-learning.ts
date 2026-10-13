import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase/client";
import { attachLearningReceipts, type LearningMovement, type LearningReceipt } from "../../lib/detection-personal-learning";

/** Read live personal decisions, not another member's habits or a stale ledger snapshot. */
export async function fetchDetectionLearning(client: SupabaseClient, userId: string, workspaceId: number): Promise<LearningMovement[]> {
  const [workspace, members] = await Promise.all([
    client.from("workspaces").select("kind, owner_user_id").eq("id", workspaceId).maybeSingle(),
    client.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).limit(2),
  ]);
  const allowLegacy = !workspace.error && !members.error && workspace.data?.kind === "personal" && workspace.data.owner_user_id === userId &&
    members.data?.length === 1 && members.data[0].user_id === userId;
  let query = client.from("movements")
    .select("id, description, movement_type, status, source_account_id, destination_account_id, category_id, metadata, client_dedupe_key, created_at, updated_at")
    .eq("workspace_id", workspaceId).eq("status", "posted");
  const editor = `or(updated_by_user_id.is.null,updated_by_user_id.eq.${userId})`;
  query = allowLegacy
    ? query.or(`and(created_by_user_id.eq.${userId},${editor}),and(created_by_user_id.is.null,${editor})`)
    : query.eq("created_by_user_id", userId).or(`updated_by_user_id.is.null,updated_by_user_id.eq.${userId}`);
  const [movements, receipts] = await Promise.all([
    query.order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(1000),
    client.from("notification_detected_movement_suggestions")
      .select("movement_id, description, movement_type, financial_app_key, metadata, status")
      .eq("workspace_id", workspaceId).eq("user_id", userId).in("status", ["registered", "duplicate"])
      .order("updated_at", { ascending: false }).limit(1000),
  ]);
  if (movements.error) throw movements.error;
  if (receipts.error) throw receipts.error;
  return attachLearningReceipts((movements.data ?? []) as LearningMovement[], (receipts.data ?? []) as LearningReceipt[]);
}

export function useDetectionLearningQuery(userId: string, workspaceId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["detection-learning", userId, workspaceId],
    queryFn: () => fetchDetectionLearning(supabase!, userId, workspaceId),
    enabled: Boolean(supabase && userId && workspaceId && enabled),
    staleTime: 60_000,
    refetchOnMount: "always",
    refetchInterval: enabled ? 60_000 : false,
    refetchOnWindowFocus: "always",
  });
}
