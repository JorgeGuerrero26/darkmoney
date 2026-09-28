import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "../../../services/supabase/client";

const MAX_SNAPSHOT_AGE_MS = 30_000;

export function useMovementsRealtimeSync(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabase || !workspaceId || !userId) return;
    const client = supabase;
    const queryKey = ["workspace-snapshot", workspaceId, userId];

    let refreshTimer: number | null = null;
    const refresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void queryClient.invalidateQueries({ queryKey, exact: true });
      }, 120);
    };
    const refreshIfStale = () => {
      const updatedAt = queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0;
      if (Date.now() - updatedAt > MAX_SNAPSHOT_AGE_MS) refresh();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshIfStale();
    };

    const channel = client
      .channel(`web-movements-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "movements", filter: `workspace_id=eq.${workspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts", filter: `workspace_id=eq.${workspaceId}` }, refresh)
      .subscribe();

    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void client.removeChannel(channel);
    };
  }, [queryClient, userId, workspaceId]);
}
