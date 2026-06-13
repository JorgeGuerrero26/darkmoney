/**
 * PARITY PORT de DarkMoneyApp/lib/date.ts (parseDisplayDate + isoToDateStr).
 * Perú siempre es UTC-5 (sin DST). El parsing de fechas de display debe ser
 * idéntico al móvil o los bordes de ventana difieren.
 */

const PERU_OFFSET_MS = 5 * 60 * 60 * 1000;
const YMD_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isoToDateStr(isoString: string): string {
  if (YMD_ONLY_RE.test(isoString)) return isoString;
  const peruMs = new Date(isoString).getTime() - PERU_OFFSET_MS;
  return new Date(peruMs).toISOString().slice(0, 10);
}

/**
 * Crea un Date LOCAL para mostrar una fecha almacenada en DB.
 * Parsea solo la parte de fecha (ignora la hora) para evitar desfases en render.
 */
export function parseDisplayDate(isoString: string): Date {
  if (YMD_ONLY_RE.test(isoString)) {
    const [y, m, d] = isoString.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const s = isoToDateStr(isoString);
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
