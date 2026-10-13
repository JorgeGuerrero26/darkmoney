import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client";
import { createDetectedMovementStore } from "./detected-movement-store";
import { createDetectedDuplicateChecker } from "./detection-duplicates";
import { detectionPending, type DetectedMovement, type DetectionSetting } from "../../modules/notifications/lib/detected-movement";
import type { DetectionOmissionInput } from "../../modules/notifications/lib/detection-omissions";

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
  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["detection-learning", userId, workspaceId] });
  }
  const omissions = useMutation({
    mutationFn: (input: DetectionOmissionInput) => {
      if (!store) throw new Error("No hay una sesión disponible.");
      return store.omissions(input);
    },
    onSuccess: ({ changes }) => {
      const updated = new Map(changes.map(({ after }) => [after.id, after]));
      queryClient.setQueryData<DetectedMovement[]>([...key, "pending"], (previous) => previous ? [
        ...previous.filter((row) => !updated.has(row.id)),
        ...[...updated.values()].filter(detectionPending),
      ].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id - a.id) : previous);
    },
    onSettled: invalidate,
  });
  async function invalidateFinances() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: ["workspace-snapshot", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["categories-overview", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["counterparties-overview", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["movements"] }),
      queryClient.invalidateQueries({ queryKey: ["detection-learning", userId, workspaceId] }),
    ]);
  }
  return { store, key, pending, settings, invalidate, invalidateFinances, omissions };
}

export function useDetectedMovementReviewQuery(userId: string, workspaceId: number, id: number) {
  const { store, key, settings, invalidate, invalidateFinances } = useDetectedMovements(userId, workspaceId, false, true);
  const duplicateChecker = useMemo(() => supabase ? createDetectedDuplicateChecker(supabase, { userId, workspaceId }) : null, [userId, workspaceId]);
  const review = useQuery({ queryKey: [...key, "review", id], enabled: Boolean(store), queryFn: () => store!.review(id), refetchOnWindowFocus: true });
  const resolve = useMutation({ mutationFn: (input: Parameters<NonNullable<typeof store>["resolve"]>) => store!.resolve(...input), onSuccess: invalidate });
  const undo = useMutation({ mutationFn: (movementId: number) => store!.undoRegistration(id, movementId), onSettled: invalidateFinances });
  return { store, duplicateChecker, review, settings, resolve, undo, invalidate, invalidateFinances };
}
