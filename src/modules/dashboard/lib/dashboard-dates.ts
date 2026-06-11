import { shortDateFormatter } from "./dashboard-format";
import type { ComparisonDefinition, ComparisonPreset, ComparisonWindow } from "./dashboard-types";

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const currentDay = next.getDay();
  const diff = currentDay === 0 ? -6 : 1 - currentDay;
  next.setDate(next.getDate() + diff);
  return next;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getDateDiffInclusive(start: Date, end: Date) {
  const normalizedStart = startOfDay(start).getTime();
  const normalizedEnd = startOfDay(end).getTime();
  return Math.max(1, Math.floor((normalizedEnd - normalizedStart) / 86_400_000) + 1);
}

export function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatShortDateRange(start: Date, end: Date) {
  if (toLocalDateKey(start) === toLocalDateKey(end)) {
    return shortDateFormatter.format(start);
  }

  return `${shortDateFormatter.format(start)} al ${shortDateFormatter.format(end)}`;
}

export function buildComparisonDefinition(preset: ComparisonPreset, reference = new Date()): ComparisonDefinition {
  const today = endOfDay(reference);

  if (preset === "today") {
    const currentStart = startOfDay(reference);
    const previousStart = addDays(currentStart, -1);

    return {
      preset,
      current: {
        start: currentStart,
        end: today,
        label: "Hoy",
        detail: formatShortDateRange(currentStart, today),
      },
      previous: {
        start: previousStart,
        end: endOfDay(previousStart),
        label: "Ayer",
        detail: formatShortDateRange(previousStart, previousStart),
      },
      caption: "Hoy contra ayer para detectar cambios inmediatos.",
    };
  }

  if (preset === "week") {
    const currentStart = startOfWeek(reference);
    const daySpan = getDateDiffInclusive(currentStart, today);
    const previousStart = addDays(currentStart, -7);
    const previousEnd = addDays(previousStart, daySpan - 1);

    return {
      preset,
      current: {
        start: currentStart,
        end: today,
        label: "Esta semana",
        detail: formatShortDateRange(currentStart, today),
      },
      previous: {
        start: previousStart,
        end: endOfDay(previousEnd),
        label: "Semana anterior",
        detail: formatShortDateRange(previousStart, previousEnd),
      },
      caption: "Lectura semanal para ver si mantienes el ritmo que venias construyendo.",
    };
  }

  if (preset === "last30") {
    const currentStart = startOfDay(addDays(reference, -29));
    const previousStart = addDays(currentStart, -30);
    const previousEnd = addDays(previousStart, 29);

    return {
      preset,
      current: {
        start: currentStart,
        end: today,
        label: "Últimos 30 días",
        detail: formatShortDateRange(currentStart, today),
      },
      previous: {
        start: previousStart,
        end: endOfDay(previousEnd),
        label: "30 dias previos",
        detail: formatShortDateRange(previousStart, previousEnd),
      },
      caption: "Comparación móvil para ver tendencia real sin depender del cambio de mes.",
    };
  }

  const currentStart = startOfMonth(reference);
  const daySpan = getDateDiffInclusive(currentStart, today);
  const previousStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1);
  const previousEnd = addDays(previousStart, daySpan - 1);

  return {
    preset,
    current: {
      start: currentStart,
      end: today,
      label: "Este mes",
      detail: formatShortDateRange(currentStart, today),
    },
    previous: {
      start: previousStart,
      end: endOfDay(previousEnd),
      label: "Mismo tramo del mes anterior",
      detail: formatShortDateRange(previousStart, previousEnd),
    },
    caption: "Vista mensual para entender si mejoras o te estas saliendo del plan.",
  };
}

export function isInRange(value: string, range: ComparisonWindow) {
  const timestamp = new Date(value).getTime();
  return timestamp >= range.start.getTime() && timestamp <= range.end.getTime();
}
