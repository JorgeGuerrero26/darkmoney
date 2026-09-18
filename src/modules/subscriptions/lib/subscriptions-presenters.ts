import type { SubscriptionFrequency, SubscriptionStatus } from "../../../types/domain";

export const frequencyOptions = [
  { value: "daily" as const, label: "Diaria", description: "Se repite cada día.", leadingLabel: "D", leadingColor: "#1b6a58" },
  { value: "weekly" as const, label: "Semanal", description: "Se repite por semanas.", leadingLabel: "S", leadingColor: "#4566d6" },
  { value: "monthly" as const, label: "Mensual", description: "Se repite cada mes.", leadingLabel: "M", leadingColor: "#8366f2" },
  { value: "quarterly" as const, label: "Trimestral", description: "Se repite cada trimestre.", leadingLabel: "T", leadingColor: "#b48b34" },
  { value: "yearly" as const, label: "Anual", description: "Se repite una vez por año.", leadingLabel: "A", leadingColor: "#c46a31" },
  { value: "custom" as const, label: "Personalizada", description: "Tienes una frecuencia especial.", leadingLabel: "P", leadingColor: "#64748b" },
] as const;

export const statusOptions = [
  { value: "active" as const, label: "Activa", description: "Sigue generando recordatorios y vencimientos.", leadingLabel: "AC", leadingColor: "#1b6a58" },
  { value: "paused" as const, label: "Pausada", description: "Se conserva, pero temporalmente detenida.", leadingLabel: "PA", leadingColor: "#b48b34" },
  { value: "cancelled" as const, label: "Cancelada", description: "Ya no forma parte de tu control activo.", leadingLabel: "CA", leadingColor: "#8f3e3e" },
] as const;

export function getFrequencyOption(frequency: SubscriptionFrequency) {
  return frequencyOptions.find((option) => option.value === frequency) ?? frequencyOptions[0];
}

export function getStatusOption(status: SubscriptionStatus) {
  return statusOptions.find((option) => option.value === status) ?? statusOptions[0];
}

export function getStatusTone(status: SubscriptionStatus) {
  switch (status) {
    case "active":
      return "success" as const;
    case "paused":
      return "warning" as const;
    default:
      return "danger" as const;
  }
}

/**
 * Suma un intervalo de cadencia a una fecha YYYY-MM-DD. Los saltos por meses
 * recortan al ultimo dia real del mes destino: el 31 de enero mas un mes cae en
 * el 28 de febrero, no en el 3 de marzo. Espeja computeNextRecurringDate de la
 * app, que se apoya en addMonths de date-fns.
 */
export function computeNextRecurringDate(
  currentYmd: string,
  frequency: SubscriptionFrequency,
  intervalCount: number,
): string {
  const parts = currentYmd.split("-");
  const date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12));
  const count = Math.max(1, Math.floor(intervalCount) || 1);

  const addMonthsClamped = (months: number) => {
    const dayOfMonth = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + months);
    const lastDayOfTargetMonth = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
  };

  switch (frequency) {
    case "daily":
      date.setUTCDate(date.getUTCDate() + count);
      break;
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7 * count);
      break;
    case "monthly":
      addMonthsClamped(count);
      break;
    case "quarterly":
      addMonthsClamped(3 * count);
      break;
    case "yearly":
      addMonthsClamped(12 * count);
      break;
    // custom se trata como diario, igual que en la app.
    default:
      date.setUTCDate(date.getUTCDate() + count);
  }

  return date.toISOString().slice(0, 10);
}

/**
 * Empuja una fecha de cobro vencida hasta la primera ocurrencia >= hoy. Si ya
 * es futura se devuelve intacta. El tope de iteraciones cubre ~11 anos de
 * cadencia diaria y evita un bucle infinito si los datos vienen corruptos.
 */
export function rollDueDateForward(
  currentYmd: string,
  frequency: SubscriptionFrequency,
  intervalCount: number,
  todayYmd: string,
): string {
  let next = currentYmd;

  for (let i = 0; next < todayYmd && i < 4000; i += 1) {
    next = computeNextRecurringDate(next, frequency, intervalCount);
  }

  return next;
}
