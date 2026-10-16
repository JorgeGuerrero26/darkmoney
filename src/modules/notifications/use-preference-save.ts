import { useCallback, useEffect, useRef } from "react";

/** Personal preference writes only: coalesce edits, serialize requests, cancel queued work on unmount. */
export function usePreferenceSave<T>({ ready, save, delay = 0 }: {
  ready: boolean;
  save: (value: T) => Promise<unknown>;
  delay?: number;
}) {
  const current = useRef({ ready, save, delay });
  current.current = { ready, save, delay };
  const mounted = useRef(true);
  const pending = useRef<{ value: T } | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    timer.current = null;
    if (!mounted.current || !current.current.ready || inFlight.current || !pending.current) return;
    const next = pending.current;
    pending.current = null;
    inFlight.current = true;
    try {
      await current.current.save(next.value);
    } catch {
      // No automatic retry: local state is retained; a later explicit edit can try again.
    } finally {
      inFlight.current = false;
      if (mounted.current && current.current.ready && pending.current) {
        timer.current = setTimeout(() => void flush(), current.current.delay);
      }
    }
  }, []);

  const schedule = useCallback((value: T, onlyIfQueued = false) => {
    if (!mounted.current || onlyIfQueued && !pending.current) return;
    pending.current = { value };
    if (timer.current) clearTimeout(timer.current);
    if (current.current.ready) timer.current = setTimeout(() => void flush(), current.current.delay);
  }, [flush]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (ready && pending.current && !inFlight.current) timer.current = setTimeout(() => void flush(), current.current.delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [ready, flush]);

  return schedule;
}
