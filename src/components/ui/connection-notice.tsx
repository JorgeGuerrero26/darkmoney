import { useEffect, useState } from "react";

/** A short disconnect is not shown; this indicator does not imply queued writes. */
export function ConnectionNotice({ delayMs = 2500 }: { delayMs?: number }) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function update() {
      if (timer) clearTimeout(timer);
      if (window.navigator.onLine) { setOffline(false); return; }
      timer = setTimeout(() => { if (!window.navigator.onLine) setOffline(true); }, delayMs);
    }
    update();
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { if (timer) clearTimeout(timer); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, [delayMs]);
  if (!offline) return null;
  return <p role="status" className="mt-3 rounded-lg border border-gold/25 bg-gold/10 px-3 py-2 text-sm text-gold">Sin conexión · Comprueba que tus cambios se hayan guardado antes de cerrar la página.</p>;
}
