import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import type { CSSProperties, PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  title: string;
  description: string;
  tone?: ToastTone;
  duration?: number;
};

type ToastRecord = Required<Pick<ToastInput, "duration" | "tone">> &
  Omit<ToastInput, "duration" | "tone"> & {
    id: string;
    isLeaving: boolean;
  };

type ToastContextValue = {
  dismissToast: (id: string) => void;
  showToast: (toast: ToastInput) => string;
};

type SuccessToastSource =
  | {
      title: string;
      description: string;
      tone?: ToastTone;
    }
  | string
  | null
  | undefined;

type UseSuccessToastOptions = {
  clear?: () => void;
  duration?: number;
  title?: string;
};

const DEFAULT_DURATION = 4_600;
const EXIT_DURATION = 240;

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles = {
  error: {
    badge: "border-[#f27a86]/22 bg-[#f27a86]/12 text-[#ffb4bc]",
    container:
      "border-[#f27a86]/18 bg-[linear-gradient(135deg,rgba(47,18,24,0.95),rgba(16,12,22,0.94))]",
    glow: "bg-[#f27a86]/18",
    icon: AlertTriangle,
    iconContainer: "border-[#f27a86]/24 bg-[#f27a86]/12 text-[#ffb4bc]",
    progress: "bg-[#ff9ca6]",
  },
  info: {
    badge: "border-[#7aa2ff]/22 bg-[#7aa2ff]/12 text-[#d1dcff]",
    container:
      "border-[#7aa2ff]/18 bg-[linear-gradient(135deg,rgba(16,28,54,0.95),rgba(9,13,24,0.94))]",
    glow: "bg-[#7aa2ff]/18",
    icon: Info,
    iconContainer: "border-[#7aa2ff]/24 bg-[#7aa2ff]/12 text-[#d1dcff]",
    progress: "bg-[#9eb8ff]",
  },
  success: {
    badge: "border-[#6be4c5]/24 bg-[#6be4c5]/12 text-[#9af2dc]",
    container:
      "border-[#6be4c5]/18 bg-[linear-gradient(135deg,rgba(14,39,36,0.95),rgba(9,14,22,0.94))]",
    glow: "bg-[#6be4c5]/18",
    icon: CheckCircle2,
    iconContainer: "border-[#6be4c5]/24 bg-[#6be4c5]/12 text-[#9af2dc]",
    progress: "bg-[#8ef0d6]",
  },
} as const;

function createToastId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clearScheduledTimer(timerMap: Map<string, number>, id: string) {
  const timer = timerMap.get(id);

  if (timer) {
    window.clearTimeout(timer);
    timerMap.delete(id);
  }
}

function normalizeSuccessSource(source: SuccessToastSource, fallbackTitle: string) {
  if (!source) {
    return null;
  }

  if (typeof source === "string") {
    const description = source.trim();
    return description ? { title: fallbackTitle, description, tone: "success" as const } : null;
  }

  if (source.tone && source.tone !== "success") {
    return null;
  }

  const title = source.title.trim();
  const description = source.description.trim();

  if (!title || !description) {
    return null;
  }

  return {
    title,
    description,
    tone: "success" as const,
  };
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const dismissTimersRef = useRef(new Map<string, number>());
  const removeTimersRef = useRef(new Map<string, number>());

  function dismissToast(id: string) {
    clearScheduledTimer(dismissTimersRef.current, id);

    setToasts((currentToasts) =>
      currentToasts.map((toast) =>
        toast.id === id ? { ...toast, isLeaving: true } : toast,
      ),
    );

    clearScheduledTimer(removeTimersRef.current, id);

    const removeTimer = window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
      removeTimersRef.current.delete(id);
    }, EXIT_DURATION);

    removeTimersRef.current.set(id, removeTimer);
  }

  function showToast({
    description,
    duration = DEFAULT_DURATION,
    title,
    tone = "success",
  }: ToastInput) {
    const id = createToastId();

    setToasts((currentToasts) => [
      ...currentToasts.slice(-3),
      {
        id,
        title,
        description,
        duration,
        tone,
        isLeaving: false,
      },
    ]);

    if (duration > 0) {
      clearScheduledTimer(dismissTimersRef.current, id);

      const dismissTimer = window.setTimeout(() => {
        dismissToast(id);
      }, duration);

      dismissTimersRef.current.set(id, dismissTimer);
    }

    return id;
  }

  useEffect(() => {
    return () => {
      dismissTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      removeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      dismissTimersRef.current.clear();
      removeTimersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ dismissToast, showToast }}>
      {children}
      <div
        aria-atomic="false"
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3 sm:right-6 sm:top-6"
      >
        {toasts.map((toast) => {
          const toneStyle = toneStyles[toast.tone];
          const Icon = toneStyle.icon;
          const progressStyle = {
            animationDuration: `${toast.duration}ms`,
          } satisfies CSSProperties;

          return (
            <div
              className={`pointer-events-auto relative overflow-hidden rounded-[28px] border px-4 py-4 shadow-[0_26px_80px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:px-5 ${toneStyle.container} ${toast.isLeaving ? "animate-toast-out" : "animate-rise-in"}`}
              key={toast.id}
              role="status"
            >
              <div className="pointer-events-none absolute inset-0">
                <div className={`absolute -left-12 top-0 h-28 w-28 rounded-full blur-3xl ${toneStyle.glow}`} />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_58%)]" />
              </div>

              <div className="relative flex items-start gap-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border ${toneStyle.iconContainer}`}>
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] ${toneStyle.badge}`}>
                      {toast.tone === "error" ? "Atencion" : toast.tone === "info" ? "Aviso" : "Confirmado"}
                    </span>
                  </div>
                  <p className="mt-3 font-display text-xl font-semibold text-ink sm:text-2xl">
                    {toast.title}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-storm">{toast.description}</p>
                </div>

                <button
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-ink"
                  onClick={() => dismissToast(toast.id)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {toast.duration > 0 ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden">
                  <div
                    className={`h-full origin-left ${toneStyle.progress} ${toast.isLeaving ? "" : "animate-toast-progress"}`}
                    style={progressStyle}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return context;
}

export function useSuccessToast(
  source: SuccessToastSource,
  { clear, duration, title = "Cambios aplicados" }: UseSuccessToastOptions = {},
) {
  const { showToast } = useToast();
  const clearRef = useRef(clear);
  const lastSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    clearRef.current = clear;
  }, [clear]);

  useEffect(() => {
    const normalizedSource = normalizeSuccessSource(source, title);

    if (!normalizedSource) {
      lastSignatureRef.current = null;
      return;
    }

    const signature = `${normalizedSource.title}::${normalizedSource.description}::${normalizedSource.tone}`;

    if (signature === lastSignatureRef.current) {
      return;
    }

    lastSignatureRef.current = signature;
    showToast({
      ...normalizedSource,
      duration,
    });
    clearRef.current?.();
  }, [duration, showToast, source, title]);
}
