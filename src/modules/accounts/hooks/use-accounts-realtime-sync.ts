import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "../../../services/supabase/client";

export function useAccountsRealtimeSync(workspaceId?: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabase || !workspaceId) return;
    const client = supabase;

    let refreshTimer: number | null = null;
    const refresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["workspace-snapshot", workspaceId], exact: false });
      }, 120);
    };
    const channel = client
      .channel(`web-accounts-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts", filter: `workspace_id=eq.${workspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "movements", filter: `workspace_id=eq.${workspaceId}` }, refresh)
      .subscribe();

    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      void client.removeChannel(channel);
    };
  }, [queryClient, workspaceId]);
}
