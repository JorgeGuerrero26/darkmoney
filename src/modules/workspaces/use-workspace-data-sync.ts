import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../../services/supabase/client";
import { isWorkspaceDataQuery, startWorkspaceDataSync, workspaceSyncTables } from "./workspace-data-sync";

export function useWorkspaceDataSync(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!supabase || !workspaceId || !userId) return;
    const client = supabase;
    const predicate = (query: { queryKey: readonly unknown[] }) => isWorkspaceDataQuery(query.queryKey, workspaceId);
    return startWorkspaceDataSync({
      isVisible: () => document.visibilityState === "visible" && navigator.onLine,
      hasStaleData: () => queryClient.getQueryCache().findAll({ predicate, type: "active" }).some((query) => Date.now() - query.state.dataUpdatedAt > 30_000),
      invalidate: () => queryClient.invalidateQueries({ predicate, refetchType: "active" }, { cancelRefetch: false }),
      after: (ms, callback) => { const timer = window.setTimeout(callback, ms); return () => window.clearTimeout(timer); },
      every: (ms, callback) => { const timer = window.setInterval(callback, ms); return () => window.clearInterval(timer); },
      onWake: (wake) => {
        window.addEventListener("focus", wake);
        window.addEventListener("online", wake);
        document.addEventListener("visibilitychange", wake);
        return () => { window.removeEventListener("focus", wake); window.removeEventListener("online", wake); document.removeEventListener("visibilitychange", wake); };
      },
      subscribe: (changed) => {
        let channel = client.channel(`web-workspace-data-${workspaceId}-${userId}`);
        for (const table of workspaceSyncTables) channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `workspace_id=eq.${workspaceId}` }, changed);
        channel.subscribe((status) => { if (status === "SUBSCRIBED") changed(); });
        return () => { void client.removeChannel(channel); };
      },
    });
  }, [queryClient, userId, workspaceId]);
}
