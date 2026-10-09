import { useEffect, useRef } from "react";

/** Focus a rendered notification destination, never execute its action. */
export function useNotificationFocus<T extends HTMLElement>(id: number | null | undefined, ready = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!id || !ready || !ref.current) return;
    ref.current.focus({ preventScroll: true });
    ref.current.scrollIntoView({ block: "center", behavior: "auto" });
  }, [id, ready]);
  return ref;
}
