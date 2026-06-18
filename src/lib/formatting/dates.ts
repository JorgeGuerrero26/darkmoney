export function formatDate(value: string, locale = "es-PE") {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string, locale = "es-PE") {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * Tiempo relativo en español ("hace 5 min", "en 2 h", "ahora"). Cae a una fecha
 * absoluta para diferencias mayores a una semana. Útil para bandejas/timelines.
 */
export function formatRelativeTime(value: string, locale = "es-PE") {
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) {
    return "";
  }

  const diffMs = target - Date.now();
  const absSeconds = Math.round(Math.abs(diffMs) / 1000);
  const isFuture = diffMs > 0;

  if (absSeconds < 45) {
    return isFuture ? "en un momento" : "ahora";
  }

  const minutes = Math.round(absSeconds / 60);
  const hours = Math.round(absSeconds / 3600);
  const days = Math.round(absSeconds / 86400);

  let unit: string;
  if (absSeconds < 3600) {
    unit = `${minutes} min`;
  } else if (absSeconds < 86400) {
    unit = `${hours} h`;
  } else if (days < 7) {
    unit = `${days} d`;
  } else {
    return formatDate(value, locale);
  }

  return isFuture ? `en ${unit}` : `hace ${unit}`;
}
