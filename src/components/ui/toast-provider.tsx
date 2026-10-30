import { Check, Info, LoaderCircle, Trash2, X } from "lucide-react";
import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { appendToast, visibleStack } from "./toast-stack";

type ToastTone = "success" | "error" | "info" | "undo" | "progress";

type ToastInput = {
  title: string;
  description: string;
  tone?: ToastTone;
  duration?: number;
  action?: { label: string; onClick: () => void };
  onPause?: () => void;
  onResume?: () => void;
};

type ToastRecord = Required<Pick<ToastInput, "duration" | "tone">> &
  Omit<ToastInput, "duration" | "tone"> & {
    id: string;
    isLeaving: boolean;
    count?: number;
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

const DEFAULT_DURATION = 4_000;
const EXIT_DURATION = 150;

const ToastContext = createContext<ToastContextValue | null>(null);

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
  const remainingRef = useRef(new Map<string, { remaining: number; started: number }>());
  const interactingRef = useRef(new Set<string>());

  const dismissToast = useCallback((id: string) => {
    clearScheduledTimer(dismissTimersRef.current, id);
    remainingRef.current.delete(id);
    interactingRef.current.delete(id);

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
  }, []);

  const resumeToast = useCallback((id: string) => {
    const timer = remainingRef.current.get(id);
    if (!timer || dismissTimersRef.current.has(id)) return;
    timer.started = Date.now();
    dismissTimersRef.current.set(id, window.setTimeout(() => dismissToast(id), timer.remaining));
  }, [dismissToast]);

  const pauseToast = useCallback((id: string) => {
    const timer = remainingRef.current.get(id);
    if (!timer || !dismissTimersRef.current.has(id)) return;
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.started));
    clearScheduledTimer(dismissTimersRef.current, id);
  }, []);

  const showToast = useCallback(({
    description,
    duration,
    title,
    tone = "success",
    action,
    onPause,
    onResume,
  }: ToastInput) => {
    const id = createToastId();
    const effectiveDuration = duration ?? (tone === "error" || tone === "progress" || tone === "undo" ? 0 : DEFAULT_DURATION);

    setToasts((currentToasts) => appendToast(currentToasts, {
        id,
        title,
        description,
        duration: effectiveDuration,
        tone,
        action,
        onPause,
        onResume,
        isLeaving: false,
      }));

    if (effectiveDuration > 0) {
      remainingRef.current.set(id, { remaining: effectiveDuration, started: Date.now() });
      resumeToast(id);
    }

    return id;
  }, [resumeToast]);

  // Keep actionable messages in the queue. Hidden undo actions must not expire
  // before the user has had the opportunity to see and cancel them.
  const visibleToasts = visibleStack(toasts);
  const visibleIds = visibleToasts.map((toast) => toast.id).join("|");
  useEffect(() => {
    const visible = new Set(visibleIds ? visibleIds.split("|") : []);
    const current = new Set(toasts.map((toast) => toast.id));
    for (const id of remainingRef.current.keys()) {
      if (!current.has(id)) {
        clearScheduledTimer(dismissTimersRef.current, id);
        remainingRef.current.delete(id);
      }
    }
    for (const toast of toasts) {
      if (toast.isLeaving) continue;
      if (visible.has(toast.id) && !interactingRef.current.has(toast.id)) {
        resumeToast(toast.id);
        toast.onResume?.();
      } else if (!visible.has(toast.id)) {
        interactingRef.current.delete(toast.id);
        pauseToast(toast.id);
        toast.onPause?.();
      }
    }
  }, [toasts, visibleIds, pauseToast, resumeToast]);

  useEffect(() => {
    return () => {
      dismissTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      removeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      dismissTimersRef.current.clear();
      removeTimersRef.current.clear();
      remainingRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ dismissToast, showToast }}>
      {children}
      <div
        aria-atomic="false"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-[76px] z-[120] flex flex-col items-center gap-2 lg:left-[var(--toast-content-left,232px)] lg:right-0"
      >
        {visibleToasts.map((toast, index) => {
          const Icon = toast.tone === "success" ? Check : toast.tone === "undo" ? Trash2 : toast.tone === "progress" ? LoaderCircle : Info;

          return (
            <div
              className={`pointer-events-auto flex max-w-full items-center gap-3 rounded-[22px] border bg-[#2a2825] px-4 py-2.5 text-sm text-ink shadow-[0_12px_36px_rgba(0,0,0,0.3)] motion-safe:animate-rise-in ${toast.tone === "error" ? "border-[#ea7770]/40" : "border-white/10"} ${toast.isLeaving ? "opacity-0 transition-opacity duration-150" : index === 1 ? "opacity-70" : ""}`}
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              onMouseEnter={() => { interactingRef.current.add(toast.id); pauseToast(toast.id); toast.onPause?.(); }}
              onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) { interactingRef.current.delete(toast.id); resumeToast(toast.id); toast.onResume?.(); } }}
              onFocus={() => { interactingRef.current.add(toast.id); pauseToast(toast.id); toast.onPause?.(); }}
              onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !event.currentTarget.matches(":hover")) { interactingRef.current.delete(toast.id); resumeToast(toast.id); toast.onResume?.(); } }}
            >
              <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${toast.tone === "progress" ? "animate-spin motion-reduce:animate-none" : ""} ${toast.tone === "error" ? "text-[#ee7971]" : toast.tone === "success" ? "text-[#84cba0]" : "text-storm"}`} />
              <p className="min-w-0 font-semibold">{toast.count && toast.count > 1 ? `${toast.count} veces: ` : ""}{toast.tone === "success" || toast.tone === "undo" || toast.tone === "progress" ? toast.description : <>{toast.title}. <span className="font-normal text-storm">{toast.description}</span></>}</p>
              {toast.action ? <button className="shrink-0 rounded-full bg-white/[0.08] px-3 py-1 font-semibold hover:bg-white/[0.14]" onClick={() => { toast.action?.onClick(); if (toast.tone !== "undo") dismissToast(toast.id); }} type="button">{toast.action.label}</button> : null}
              {toast.tone === "error" ? <button aria-label="Cerrar notificación" className="shrink-0 rounded-full p-1 text-storm hover:text-ink" onClick={() => dismissToast(toast.id)} type="button"><X className="h-4 w-4" /></button> : null}
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
