import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduleOptions {
  label: string;
  onCommit: () => void | Promise<void>;
  onUndo?: () => void | Promise<void>;
  duration?: number;
}

interface UndoEntry {
  id: string;
  label: string;
  expiresAt: number;
  duration: number;
  /** "visible" → showing countdown | "exiting" → fade-out before removal */
  phase: "visible" | "exiting";
}

interface UndoQueueContextValue {
  schedule: (opts: ScheduleOptions) => string;
  cancel: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UndoQueueContext = createContext<UndoQueueContextValue | null>(null);

const DEFAULT_DURATION = 5_000;
const EXIT_DURATION = 240; // ms for fade-out animation

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UndoQueueProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<UndoEntry[]>([]);

  // Callbacks stored outside state to survive re-renders without triggering them
  const callbacksRef = useRef<
    Map<string, Pick<ScheduleOptions, "onCommit" | "onUndo">>
  >(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // Remove an entry: start exit animation then delete from state
  const removeEntry = useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, phase: "exiting" as const } : e)),
    );
    setTimeout(() => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      callbacksRef.current.delete(id);
    }, EXIT_DURATION);
  }, []);

  // Commit: run onCommit and remove
  const commit = useCallback(
    async (id: string) => {
      const cbs = callbacksRef.current.get(id);
      removeEntry(id);
      if (cbs?.onCommit) {
        try {
          await cbs.onCommit();
        } catch {
          // errors are handled by the mutation's own onError
        }
      }
    },
    [removeEntry],
  );

  // Cancel: run onUndo and remove
  const cancel = useCallback(
    async (id: string) => {
      const timer = timersRef.current.get(id);
      if (timer !== undefined) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
      const cbs = callbacksRef.current.get(id);
      removeEntry(id);
      if (cbs?.onUndo) {
        try {
          await cbs.onUndo();
        } catch {
          // ignore
        }
      }
    },
    [removeEntry],
  );

  // Schedule a new undoable action
  const schedule = useCallback(
    (opts: ScheduleOptions): string => {
      const id = Math.random().toString(36).slice(2);
      const duration = opts.duration ?? DEFAULT_DURATION;
      const expiresAt = Date.now() + duration;

      callbacksRef.current.set(id, {
        onCommit: opts.onCommit,
        onUndo: opts.onUndo,
      });

      setEntries((prev) => [
        ...prev,
        { id, label: opts.label, expiresAt, duration, phase: "visible" },
      ]);

      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        commit(id);
      }, duration);
      timersRef.current.set(id, timer);

      return id;
    },
    [commit],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <UndoQueueContext.Provider value={{ schedule, cancel }}>
      {children}
      <UndoToastStack entries={entries} onUndo={cancel} />
    </UndoQueueContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUndoQueue(): UndoQueueContextValue {
  const ctx = useContext(UndoQueueContext);
  if (!ctx) throw new Error("useUndoQueue must be used inside UndoQueueProvider");
  return ctx;
}

// ─── Visual Stack ─────────────────────────────────────────────────────────────

function UndoToastStack({
  entries,
  onUndo,
}: {
  entries: UndoEntry[];
  onUndo: (id: string) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div
      aria-label="Acciones pendientes"
      aria-live="polite"
      className="fixed bottom-24 right-4 z-[200] flex flex-col-reverse gap-2"
      role="region"
    >
      {entries.map((entry) => (
        <UndoToast key={entry.id} entry={entry} onUndo={onUndo} />
      ))}
    </div>
  );
}

function UndoToast({
  entry,
  onUndo,
}: {
  entry: UndoEntry;
  onUndo: (id: string) => void;
}) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const remaining = entry.expiresAt - start;
    if (remaining <= 0) return;

    const raf = { id: 0 };
    function tick() {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / remaining) * 100);
      setProgress(pct);
      if (pct > 0) raf.id = requestAnimationFrame(tick);
    }
    raf.id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.id);
  }, [entry.expiresAt]);

  const exiting = entry.phase === "exiting";

  return (
    <div
      aria-atomic="true"
      aria-live="off"
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#080d14]/95 shadow-[0_8px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl"
      role="status"
      style={{
        transition: `opacity ${EXIT_DURATION}ms ease, transform ${EXIT_DURATION}ms ease`,
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateX(12px)" : "translateX(0)",
        minWidth: "220px",
        maxWidth: "320px",
      }}
    >
      {/* Content row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex-1 truncate text-sm text-ink">{entry.label}</span>
        <button
          aria-label={`Deshacer: ${entry.label}`}
          className="shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold text-pine transition hover:text-pine/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pine/50"
          onClick={() => onUndo(entry.id)}
          type="button"
        >
          Deshacer
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] w-full bg-white/5">
        <div
          className="h-full bg-pine/60 transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
