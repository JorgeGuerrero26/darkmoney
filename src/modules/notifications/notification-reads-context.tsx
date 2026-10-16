import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { useSaveSmartNotificationReadsMutation } from "../../services/queries/workspace-data";
import { normalizeSmartReads } from "./lib/personal-preferences";
import { usePreferenceSave } from "./use-preference-save";

export type SmartNotificationReadMap = Record<string, string>;

interface NotificationReadsContextValue {
  smartReadMap: SmartNotificationReadMap;
  markSmartAsRead: (ids: string[]) => void;
}

const NotificationReadsContext =
  createContext<NotificationReadsContextValue | null>(null);

type Props = PropsWithChildren<{
  userId?: string;
  initialSmartReads?: SmartNotificationReadMap;
}>;

export function NotificationReadsProvider(props: Props) {
  return <ScopedNotificationReadsProvider key={props.userId ?? "signed-out"} {...props} />;
}

function ScopedNotificationReadsProvider({ userId, initialSmartReads, children }: Props) {
  const [smartReadMap, setSmartReadMap] = useState<SmartNotificationReadMap>({});
  const latest = useRef(smartReadMap);
  const edited = useRef<SmartNotificationReadMap>({});
  const mounted = useRef(true);
  const saveMutation = useSaveSmartNotificationReadsMutation(userId);
  const scheduleSave = usePreferenceSave<SmartNotificationReadMap>({ ready: Boolean(userId && initialSmartReads !== undefined), save: async value => {
    await saveMutation.mutateAsync(value);
    for (const key of Object.keys(edited.current)) if (edited.current[key] === value[key]) delete edited.current[key];
  } });

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!userId || initialSmartReads === undefined) return;
    const remote = normalizeSmartReads(initialSmartReads), next = { ...remote, ...edited.current };
    latest.current = next;
    setSmartReadMap(next);
    if (Object.entries(edited.current).some(([key, stamp]) => remote[key] !== stamp)) scheduleSave(next, true);
  }, [userId, initialSmartReads, scheduleSave]);

  const markSmartAsRead = useCallback(
    (ids: string[]) => {
      if (!mounted.current || !userId) return;
      const now = new Date().toISOString();
      const additions = normalizeSmartReads(Object.fromEntries(ids.map(id => [id, now])));
      if (!Object.keys(additions).length) return;
      edited.current = { ...edited.current, ...additions };
      const next = { ...latest.current, ...additions };
      latest.current = next;
      setSmartReadMap(next);
      scheduleSave(next);
    },
    [userId, scheduleSave],
  );

  return (
    <NotificationReadsContext.Provider value={{ smartReadMap, markSmartAsRead }}>
      {children}
    </NotificationReadsContext.Provider>
  );
}

export function useNotificationReads(): NotificationReadsContextValue {
  const ctx = useContext(NotificationReadsContext);
  if (!ctx)
    throw new Error(
      "useNotificationReads must be used inside NotificationReadsProvider",
    );
  return ctx;
}
