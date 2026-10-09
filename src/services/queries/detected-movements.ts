import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client";
import { createDetectedMovementStore } from "./detected-movement-store";
import type { DetectionSetting } from "../../modules/notifications/lib/detected-movement";

export function useDetectedMovements(userId: string | undefined, workspaceId: number | undefined, enabled: boolean, settingsEnabled = enabled) {
  const queryClient = useQueryClient();
  const store = useMemo(() => supabase && userId && workspaceId ? createDetectedMovementStore(supabase, { userId, workspaceId }) : null, [userId, workspaceId]);
  const key = ["detected-movements-web", userId, workspaceId] as const;
  const pending = useQuery({ queryKey: [...key, "pending"], enabled: Boolean(store && enabled), queryFn: () => store!.pending(), refetchInterval: enabled ? 30_000 : false });
  const settings = useQuery({ queryKey: [...key, "settings"], enabled: Boolean(store && settingsEnabled), queryFn: async (): Promise<DetectionSetting[]> => {
    const { data, error } = await supabase!.from("notification_detection_app_settings").select("financial_app_key,enabled,default_account_id").eq("user_id", userId!).eq("workspace_id", workspaceId!);
    if (error) throw new Error("No se pudo consultar la cuenta predeterminada de detección.");
    return (data ?? []).map((row) => ({ financialAppKey: row.financial_app_key, enabled: row.enabled, defaultAccountId: row.default_account_id == null ? null : Number(row.default_account_id) }));
  } });
  function invalidate() { void queryClient.invalidateQueries({ queryKey: key }); void queryClient.invalidateQueries({ queryKey: ["notifications"] }); }
  return { store, key, pending, settings, invalidate };
}

export function useDetectedMovementReviewQuery(userId: string, workspaceId: number, id: number) {
  const { store, key, settings, invalidate } = useDetectedMovements(userId, workspaceId, false, true);
  const review = useQuery({ queryKey: [...key, "review", id], enabled: Boolean(store), queryFn: () => store!.review(id), refetchOnWindowFocus: true });
  const resolve = useMutation({ mutationFn: (input: Parameters<NonNullable<typeof store>["resolve"]>) => store!.resolve(...input), onSuccess: invalidate });
  return { store, review, settings, resolve, invalidate };
}
