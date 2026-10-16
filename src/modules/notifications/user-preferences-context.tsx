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
import { normalizeUiPreferences, readUiPreferences, sameColumns, writeUiPreferences } from "./lib/personal-preferences";
import { usePreferenceSave } from "./use-preference-save";

interface UserPreferencesContextValue {
  viewModes: Record<string, string>;
  setViewMode: (module: string, mode: string) => void;
  columnVisibility: Record<string, Record<string, boolean>>;
  setColumnVisibility: (key: string, visibility: Record<string, boolean>) => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

type Props = PropsWithChildren<{
  userId?: string;
  initialUiPrefs?: UiPrefs | null;
}>;

export function UserPreferencesProvider(props: Props) {
  return <ScopedUserPreferencesProvider key={props.userId ?? "signed-out"} {...props} />;
}

function ScopedUserPreferencesProvider({ userId, initialUiPrefs, children }: Props) {
  const [preferences, setPreferences] = useState(() => readUiPreferences(userId));
  const latest = useRef(preferences);
  const mounted = useRef(true);
  const editedViews = useRef(new Set<string>());
  const editedColumns = useRef(new Set<string>());
  const saveMutation = useSaveUiPrefsMutation(userId);
  const scheduleSave = usePreferenceSave<UiPrefs>({ ready: Boolean(userId && initialUiPrefs !== undefined), delay: 2000, save: async value => {
    await saveMutation.mutateAsync(value);
    for (const key of editedViews.current) if (latest.current.view_modes[key] === value.view_modes[key]) editedViews.current.delete(key);
    for (const key of editedColumns.current) if (sameColumns(latest.current.column_visibility[key], value.column_visibility[key])) editedColumns.current.delete(key);
  } });

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Server values win over this user's local cache, but not over explicit edits
  // made while the first read was pending. Unowned legacy keys are never imported.
  useEffect(() => {
    if (!userId || initialUiPrefs === undefined) return;
    const remote = normalizeUiPreferences(initialUiPrefs), local = latest.current;
    const next: UiPrefs = {
      view_modes: { ...local.view_modes, ...remote.view_modes, ...Object.fromEntries([...editedViews.current].map(key => [key, local.view_modes[key]])) },
      column_visibility: { ...local.column_visibility, ...remote.column_visibility, ...Object.fromEntries([...editedColumns.current].map(key => [key, local.column_visibility[key]])) },
    };
    latest.current = next;
    setPreferences(next);
    writeUiPreferences(userId, next);
    if ([...editedViews.current].some(key => next.view_modes[key] !== remote.view_modes[key]) || [...editedColumns.current].some(key => !sameColumns(next.column_visibility[key], remote.column_visibility[key]))) scheduleSave(next, true);
  }, [userId, initialUiPrefs, scheduleSave]);

  const handleSetViewMode = useCallback(
    (module: string, mode: string) => {
      if (!mounted.current || !userId) return;
      const valid = normalizeUiPreferences({ view_modes: { [module]: mode } }).view_modes;
      if (!Object.prototype.hasOwnProperty.call(valid, module) || latest.current.view_modes[module] === mode) return;
      editedViews.current.add(module);
      const next = { ...latest.current, view_modes: { ...latest.current.view_modes, ...valid } };
      latest.current = next;
      setPreferences(next);
      writeUiPreferences(userId, next);
      scheduleSave(next);
    },
    [userId, scheduleSave],
  );

  const handleSetColumnVisibility = useCallback(
    (key: string, visibility: Record<string, boolean>) => {
      if (!mounted.current || !userId) return;
      const valid = normalizeUiPreferences({ column_visibility: { [key]: visibility } }).column_visibility;
      if (!Object.prototype.hasOwnProperty.call(valid, key) || sameColumns(latest.current.column_visibility[key], valid[key])) return;
      editedColumns.current.add(key);
      const next = { ...latest.current, column_visibility: { ...latest.current.column_visibility, ...valid } };
      latest.current = next;
      setPreferences(next);
      writeUiPreferences(userId, next);
      scheduleSave(next);
    },
    [userId, scheduleSave],
  );

  return (
    <UserPreferencesContext.Provider
      value={{
        viewModes: preferences.view_modes,
        setViewMode: handleSetViewMode,
        columnVisibility: preferences.column_visibility,
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
