import type { RecurringIncomeFrequency, RecurringIncomeStatus } from "../../../types/domain";

export const frequencyOptions = [
  { value: "daily" as const, label: "Diaria", description: "Se repite cada dia.", leadingLabel: "D", leadingColor: "#1b6a58" },
  { value: "weekly" as const, label: "Semanal", description: "Se repite por semanas.", leadingLabel: "S", leadingColor: "#4566d6" },
  { value: "monthly" as const, label: "Mensual", description: "Se repite cada mes.", leadingLabel: "M", leadingColor: "#8366f2" },
  { value: "quarterly" as const, label: "Trimestral", description: "Se repite cada trimestre.", leadingLabel: "T", leadingColor: "#b48b34" },
  { value: "yearly" as const, label: "Anual", description: "Se repite una vez por ano.", leadingLabel: "A", leadingColor: "#c46a31" },
  { value: "custom" as const, label: "Personalizada", description: "Tienes una frecuencia especial.", leadingLabel: "P", leadingColor: "#64748b" },
] as const;

export const statusOptions = [
  { value: "active" as const, label: "Activo", description: "Sigue generando recordatorios y vencimientos.", leadingLabel: "AC", leadingColor: "#1b6a58" },
  { value: "paused" as const, label: "Pausado", description: "Se conserva, pero temporalmente detenido.", leadingLabel: "PA", leadingColor: "#b48b34" },
  { value: "cancelled" as const, label: "Cancelado", description: "Ya no forma parte de tu control activo.", leadingLabel: "CA", leadingColor: "#8f3e3e" },
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
