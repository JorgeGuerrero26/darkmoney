import { createContext, useCallback, useContext, useEffect, useRef, type PropsWithChildren } from "react";
import { useToast } from "./toast-provider";

export interface ScheduleOptions {
  label: string;
  onCommit: () => void | Promise<void>;
  onUndo?: () => void | Promise<void>;
  duration?: number;
}

interface PendingAction {
  toastId: string;
  remaining: number;
  started: number;
  timer: ReturnType<typeof setTimeout> | null;
  onCommit: ScheduleOptions["onCommit"];
  onUndo: ScheduleOptions["onUndo"];
}

interface UndoQueueContextValue {
  schedule: (opts: ScheduleOptions) => string;
  cancel: (id: string) => void;
}

const UndoQueueContext = createContext<UndoQueueContextValue | null>(null);
const DEFAULT_DURATION = 8_000;

export function UndoQueueProvider({ children }: PropsWithChildren) {
  const { showToast, dismissToast } = useToast();
  const pending = useRef(new Map<string, PendingAction>());

  const finish = useCallback((id: string, undo: boolean) => {
    const entry = pending.current.get(id);
    if (!entry) return;
    pending.current.delete(id);
    if (entry.timer !== null) clearTimeout(entry.timer);
    dismissToast(entry.toastId);
    void Promise.resolve().then(() => undo ? entry.onUndo?.() : entry.onCommit()).catch(() => {
      showToast({ title: undo ? "No se pudo deshacer" : "No se pudo completar la acción", description: "Actualiza la página y revisa el resultado antes de volver a intentarlo.", tone: "error" });
    });
  }, [dismissToast, showToast]);

  const resume = useCallback((id: string) => {
    const entry = pending.current.get(id);
    if (!entry || entry.timer !== null) return;
    entry.started = Date.now();
    entry.timer = setTimeout(() => finish(id, false), entry.remaining);
  }, [finish]);

  const pause = useCallback((id: string) => {
    const entry = pending.current.get(id);
    if (!entry || entry.timer === null) return;
    clearTimeout(entry.timer);
    entry.timer = null;
    entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.started));
  }, []);

  const cancel = useCallback((id: string) => finish(id, true), [finish]);
  const schedule = useCallback((opts: ScheduleOptions) => {
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const toastId = showToast({ title: "Acción pendiente", description: opts.label, tone: "undo",
      action: { label: "Deshacer", onClick: () => cancel(id) },
      onPause: () => pause(id), onResume: () => resume(id) });
    pending.current.set(id, { toastId, remaining: opts.duration ?? DEFAULT_DURATION, started: Date.now(), timer: null, onCommit: opts.onCommit, onUndo: opts.onUndo });
    resume(id);
    return id;
  }, [cancel, pause, resume, showToast]);

  useEffect(() => () => {
    pending.current.forEach((entry) => { if (entry.timer !== null) clearTimeout(entry.timer); });
    pending.current.clear();
  }, []);

  return <UndoQueueContext.Provider value={{ schedule, cancel }}>{children}</UndoQueueContext.Provider>;
}

export function useUndoQueue(): UndoQueueContextValue {
  const context = useContext(UndoQueueContext);
  if (!context) throw new Error("useUndoQueue must be used inside UndoQueueProvider");
  return context;
}
