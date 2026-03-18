import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { type UiPrefs, useSaveUiPrefsMutation } from "../../services/queries/workspace-data";

interface UserPreferencesContextValue {
  viewModes: Record<string, string>;
  setViewMode: (module: string, mode: string) => void;
  columnVisibility: Record<string, Record<string, boolean>>;
  setColumnVisibility: (key: string, visibility: Record<string, boolean>) => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

function readFromLocalStorage(): { viewModes: Record<string, string>; columnVisibility: Record<string, Record<string, boolean>> } {
  const viewModes: Record<string, string> = {};
  const columnVisibility: Record<string, Record<string, boolean>> = {};

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("dm_view_")) {
        const val = localStorage.getItem(key);
        if (val && ["grid", "list", "table"].includes(val)) {
          viewModes[key.slice("dm_view_".length)] = val;
        }
      } else if (key.startsWith("dm_col_")) {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            columnVisibility[key] = JSON.parse(val) as Record<string, boolean>;
          } catch {
            // ignore malformed
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return { viewModes, columnVisibility };
}

export function UserPreferencesProvider({
  userId,
  initialUiPrefs,
  children,
}: PropsWithChildren<{
  userId?: string;
  initialUiPrefs?: UiPrefs | null;
}>) {
  const initial = readFromLocalStorage();

  const [viewModes, setViewModes] = useState<Record<string, string>>(initial.viewModes);
  const [columnVisibility, setColumnVisibilityState] = useState<Record<string, Record<string, boolean>>>(initial.columnVisibility);

  const vmRef = useRef(viewModes);
  const cvRef = useRef(columnVisibility);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbLoadedRef = useRef(false);

  const saveMutation = useSaveUiPrefsMutation(userId);

  useEffect(() => { vmRef.current = viewModes; }, [viewModes]);
  useEffect(() => { cvRef.current = columnVisibility; }, [columnVisibility]);

  // When DB data arrives, merge it in (DB wins over localStorage)
  useEffect(() => {
    if (!initialUiPrefs || dbLoadedRef.current) return;
    dbLoadedRef.current = true;

    if (initialUiPrefs.view_modes && Object.keys(initialUiPrefs.view_modes).length > 0) {
      setViewModes((prev) => {
        const next = { ...prev, ...initialUiPrefs.view_modes };
        // Sync back to localStorage
        try {
          for (const [module, mode] of Object.entries(initialUiPrefs.view_modes)) {
            localStorage.setItem(`dm_view_${module}`, mode);
          }
        } catch { /* ignore */ }
        return next;
      });
    }

    if (initialUiPrefs.column_visibility && Object.keys(initialUiPrefs.column_visibility).length > 0) {
      setColumnVisibilityState((prev) => {
        const next = { ...prev, ...initialUiPrefs.column_visibility };
        // Sync back to localStorage
        try {
          for (const [key, vis] of Object.entries(initialUiPrefs.column_visibility)) {
            localStorage.setItem(key, JSON.stringify(vis));
          }
        } catch { /* ignore */ }
        return next;
      });
    }
  }, [initialUiPrefs]);

  function scheduleSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveMutation.mutate({
        view_modes: vmRef.current,
        column_visibility: cvRef.current,
      });
    }, 2000);
  }

  const handleSetViewMode = useCallback(
    (module: string, mode: string) => {
      setViewModes((prev) => {
        const next = { ...prev, [module]: mode };
        vmRef.current = next;
        try { localStorage.setItem(`dm_view_${module}`, mode); } catch { /* ignore */ }
        scheduleSave();
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );

  const handleSetColumnVisibility = useCallback(
    (key: string, visibility: Record<string, boolean>) => {
      setColumnVisibilityState((prev) => {
        const next = { ...prev, [key]: visibility };
        cvRef.current = next;
        try { localStorage.setItem(key, JSON.stringify(visibility)); } catch { /* ignore */ }
        scheduleSave();
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );

  return (
    <UserPreferencesContext.Provider
      value={{
        viewModes,
        setViewMode: handleSetViewMode,
        columnVisibility,
        setColumnVisibility: handleSetColumnVisibility,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    throw new Error("useUserPreferences must be used inside UserPreferencesProvider");
  }
  return ctx;
}
