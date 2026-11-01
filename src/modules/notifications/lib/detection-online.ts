import { onlineManager } from "@tanstack/react-query";

/** Detections are online-only and must never resume silently after reconnection. */
export function requireDetectionOnline() {
  if (!onlineManager.isOnline() || (typeof navigator !== "undefined" && navigator.onLine === false)) throw new Error("Necesitas conexión para esta detección. No se guardó ningún cambio; vuelve a intentarlo al conectarte.");
}
