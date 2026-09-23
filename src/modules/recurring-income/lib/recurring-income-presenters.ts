import type { RecurringIncomeFrequency, RecurringIncomeStatus } from "../../../types/domain";

export const frequencyOptions = [
  { value: "daily" as const, label: "Diaria", description: "Se repite cada día.", leadingLabel: "D" },
  { value: "weekly" as const, label: "Semanal", description: "Se repite por semanas.", leadingLabel: "S" },
  { value: "monthly" as const, label: "Mensual", description: "Se repite cada mes.", leadingLabel: "M" },
  { value: "quarterly" as const, label: "Trimestral", description: "Se repite cada trimestre.", leadingLabel: "T" },
  { value: "yearly" as const, label: "Anual", description: "Se repite una vez por año.", leadingLabel: "A" },
  { value: "custom" as const, label: "Personalizada", description: "Tienes una frecuencia especial.", leadingLabel: "P" },
] as const;

export const statusOptions = [
  { value: "active" as const, label: "Activo", description: "Sigue generando recordatorios y vencimientos.", leadingLabel: "AC" },
  { value: "paused" as const, label: "Pausado", description: "Se conserva, pero temporalmente detenido.", leadingLabel: "PA" },
  { value: "cancelled" as const, label: "Cancelado", description: "Ya no forma parte de tu control activo.", leadingLabel: "CA" },
] as const;

export function getFrequencyOption(frequency: RecurringIncomeFrequency) {
  return frequencyOptions.find((option) => option.value === frequency) ?? frequencyOptions[0];
}

export function getStatusOption(status: RecurringIncomeStatus) {
  return statusOptions.find((option) => option.value === status) ?? statusOptions[0];
}

export function getStatusTone(status: RecurringIncomeStatus) {
  switch (status) {
    case "active":
      return "success" as const;
    case "paused":
      return "warning" as const;
    default:
      return "danger" as const;
  }
}
