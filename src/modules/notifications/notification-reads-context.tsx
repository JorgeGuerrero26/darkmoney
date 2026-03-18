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

export type SmartNotificationReadMap = Record<string, string>;

interface NotificationReadsContextValue {
  smartReadMap: SmartNotificationReadMap;
  markSmartAsRead: (ids: string[]) => void;
}

const NotificationReadsContext =
  createContext<NotificationReadsContextValue | null>(null);

export function NotificationReadsProvider({
  userId,
  initialSmartReads,
  children,
}: PropsWithChildren<{
  userId?: string;
  initialSmartReads?: SmartNotificationReadMap;
}>) {
  const [smartReadMap, setSmartReadMap] = useState<SmartNotificationReadMap>({});
  const initializedRef = useRef(false);
  const saveMutation = useSaveSmartNotificationReadsMutation(userId);

  // Initialize once when DB data arrives
  useEffect(() => {
    if (initialSmartReads && !initializedRef.current) {
      initializedRef.current = true;
      setSmartReadMap(initialSmartReads);
    }
  }, [initialSmartReads]);

  const markSmartAsRead = useCallback(
    (ids: string[]) => {
      const filtered = ids.filter((id) => !id.startsWith("smart:invite:"));
      if (!filtered.length) return;

      const now = new Date().toISOString();
      setSmartReadMap((prev) => {
        const next = { ...prev };
        for (const id of filtered) {
          next[id] = now;
        }
        saveMutation.mutate(next);
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
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
