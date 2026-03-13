import { useEffect, useMemo } from "react";

import { useAuth } from "../auth/auth-context";
import { useWorkspacesQuery } from "../../services/queries/workspace-data";
import { useWorkspaceStore } from "../../stores/workspace-store";

export function useActiveWorkspace() {
  const { profile, user } = useAuth();
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore((state) => state.setActiveWorkspaceId);
  const clearActiveWorkspaceId = useWorkspaceStore((state) => state.clearActiveWorkspaceId);
  const workspacesQuery = useWorkspacesQuery(user?.id, profile);
  const workspaces = workspacesQuery.data ?? [];

  const activeWorkspace = useMemo(() => {
    if (!workspaces.length) {
      return null;
    }

    if (activeWorkspaceId === null) {
      return workspaces.find((workspace) => workspace.isDefaultWorkspace) ?? workspaces[0];
    }

    return workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  }, [activeWorkspaceId, workspaces]);

  useEffect(() => {
    if (!workspaces.length) {
      if (activeWorkspaceId !== null) {
        clearActiveWorkspaceId();
      }
      return;
    }

    if (activeWorkspace) {
      if (activeWorkspaceId !== activeWorkspace.id) {
        setActiveWorkspaceId(activeWorkspace.id);
      }
      return;
    }

    const fallbackWorkspace = workspaces.find((workspace) => workspace.isDefaultWorkspace) ?? workspaces[0];
    setActiveWorkspaceId(fallbackWorkspace.id);
  }, [
    activeWorkspace,
    activeWorkspaceId,
    clearActiveWorkspaceId,
    setActiveWorkspaceId,
    workspaces,
  ]);

  return {
    ...workspacesQuery,
    workspaces,
    activeWorkspace,
    activeWorkspaceId: activeWorkspace?.id ?? null,
    setActiveWorkspaceId,
  };
}
