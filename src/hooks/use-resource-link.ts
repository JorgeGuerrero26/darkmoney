import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/** Open a loaded resource once, without saving a draft or altering other filters. */
export function useResourceLink(items: { id: number }[], onOpen: (id: number) => void) {
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const id = Number(params.get("resource"));
    if (!Number.isSafeInteger(id) || id <= 0 || !items.some((item) => item.id === id)) return;
    onOpen(id);
    setParams((current) => { const next = new URLSearchParams(current); next.delete("resource"); return next; }, { replace: true });
  }, [items, params, setParams, onOpen]);
}
