import { create } from "zustand";
import { persist } from "zustand/middleware";

type WorkspaceState = {
  activeWorkspaceId: number | null;
  isSidebarCollapsed: boolean;
  setActiveWorkspaceId: (workspaceId: number | null) => void;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  clearActiveWorkspaceId: () => void;
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      isSidebarCollapsed: false,
      setActiveWorkspaceId: (workspaceId) => set({ activeWorkspaceId: workspaceId }),
      setSidebarCollapsed: (isCollapsed) => set({ isSidebarCollapsed: isCollapsed }),
      toggleSidebarCollapsed: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      clearActiveWorkspaceId: () => set({ activeWorkspaceId: null }),
    }),
    {
      name: "darkmoney-workspace",
    },
  ),
);
