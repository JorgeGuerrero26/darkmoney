import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

import type { PickerOption } from "../../../components/ui/searchable-picker";
import type {
  ObligationDirection,
  ObligationOriginType,
  ObligationShareSummary,
  ObligationStatus,
  ObligationSummary,
} from "../../../types/domain";

export const directionOptions = [
  {
    value: "receivable" as const,
    label: "Credito",
    description: "Dinero que te deben.",
    leadingLabel: "CR",
    leadingColor: "#1b6a58",
  },
  {
    value: "payable" as const,
    label: "Deuda",
    description: "Dinero que debes pagar.",
    leadingLabel: "DE",
    leadingColor: "#8f3e3e",
  },
] as const;

export const receivableOriginTypeOptions = [
  {
    value: "cash_loan" as const,
    label: "Preste dinero",
    description: "Tu entregaste dinero y nacio una cuenta por cobrar.",
    leadingLabel: "PD",
    leadingColor: "#4566d6",
  },
  {
    value: "sale_financed" as const,
    label: "Vendi a cuotas",
    description: "Te deben dinero, pero no salio efectivo de tu cuenta al inicio.",
    leadingLabel: "VF",
    leadingColor: "#1b6a58",
  },
  {
    value: "manual" as const,
    label: "Manual",
    description: "Define el caso manualmente si no encaja en los escenarios comunes.",
    leadingLabel: "MN",
    leadingColor: "#6b7280",
  },
] as const;

export const payableOriginTypeOptions = [
  {
    value: "cash_loan" as const,
    label: "Me prestaron dinero",
    description: "Recibiste dinero y nacio una deuda a pagar.",
    leadingLabel: "MP",
    leadingColor: "#4566d6",
  },
  {
    value: "purchase_financed" as const,
    label: "Compre a cuotas",
    description: "La deuda nace sin entrada de efectivo a tu cuenta.",
    leadingLabel: "CQ",
    leadingColor: "#c46a31",
  },
  {
    value: "manual" as const,
    label: "Manual",
    description: "Define el caso manualmente si no encaja en los escenarios comunes.",
    leadingLabel: "MN",
    leadingColor: "#6b7280",
  },
] as const;

export const statusOptions = [
  {
    value: "draft" as const,
    label: "Borrador",
    description: "Aun no esta en seguimiento activo.",
    leadingLabel: "BD",
    leadingColor: "#6b7280",
  },
  {
    value: "active" as const,
    label: "Activa",
    description: "Sigue pendiente de resolverse.",
    leadingLabel: "AC",
    leadingColor: "#4566d6",
  },
  {
    value: "paid" as const,
    label: "Liquidada",
    description: "Ya quedo saldada por completo.",
    leadingLabel: "LD",
    leadingColor: "#1b6a58",
  },
  {
    value: "cancelled" as const,
    label: "Cancelada",
    description: "Se cerro sin continuar.",
    leadingLabel: "CA",
    leadingColor: "#64748b",
  },
  {
    value: "defaulted" as const,
    label: "Atrasada",
    description: "Necesita atencion por mora o retraso.",
    leadingLabel: "AT",
    leadingColor: "#b48b34",
  },
] as const;

export function getOriginTypeOptions(direction: ObligationDirection) {
  return direction === "receivable" ? receivableOriginTypeOptions : payableOriginTypeOptions;
}

export function getOriginOption(originType: ObligationOriginType, direction: ObligationDirection) {
  const originTypeOptions = getOriginTypeOptions(direction);
  return originTypeOptions.find((option) => option.value === originType) ?? originTypeOptions[0];
}

export function getStatusOption(status: ObligationStatus) {
  return statusOptions.find((option) => option.value === status) ?? statusOptions[0];
}

export function getDirectionLabel(direction: ObligationDirection) {
  return direction === "receivable" ? "Me deben" : "Yo debo";
}

export function getSharedDirectionLabel(direction: ObligationDirection) {
  return direction === "receivable" ? "Credito compartido" : "Deuda compartida";
}

export function getSharedDirectionDescription(direction: ObligationDirection) {
  return direction === "receivable"
    ? "Al propietario de este registro aun le deben pagar."
    : "El propietario de este registro aun debe pagar.";
}

export function getDirectionTone(direction: ObligationDirection) {
  return direction === "receivable" ? "success" : "danger";
}

export function getStatusTone(status: ObligationStatus) {
  switch (status) {
    case "paid":
      return "success" as const;
    case "active":
      return "info" as const;
    case "defaulted":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function getShareStatusLabel(status: ObligationShareSummary["status"]) {
  switch (status) {
    case "accepted":
      return "Compartida";
    case "pending":
      return "Por aceptar";
    case "declined":
      return "No aceptada";
    case "revoked":
      return "Revocada";
    default:
      return "Compartida";
  }
}

export function getShareStatusTone(status: ObligationShareSummary["status"]) {
  switch (status) {
    case "accepted":
      return "success" as const;
    case "pending":
      return "warning" as const;
    case "declined":
      return "neutral" as const;
    case "revoked":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export function getDirectionVisual(direction: ObligationDirection) {
  return direction === "receivable"
    ? { icon: ArrowUpCircle, color: "#1b6a58" }
    : { icon: ArrowDownCircle, color: "#8f3e3e" };
}

export function getEventLabel(eventType: ObligationSummary["events"][number]["eventType"]) {
  switch (eventType) {
    case "payment":
      return "Abono";
    case "opening":
      return "Apertura";
    case "principal_increase":
      return "Aumento de principal";
    case "principal_decrease":
      return "Reduccion de principal";
    case "interest":
      return "Interes";
    case "fee":
      return "Cargo";
    case "discount":
      return "Descuento";
    case "adjustment":
      return "Ajuste";
    case "writeoff":
      return "Condonacion";
    default:
      return "Evento";
  }
}

export function getEventIcon(eventType: string) {
  switch (eventType) {
    case "opening":
      return "🏦";
    case "payment":
      return "💳";
    case "principal_increase":
      return "📈";
    case "principal_decrease":
      return "📉";
    case "interest":
      return "📊";
    case "fee":
      return "🧾";
    case "discount":
      return "🏷️";
    case "adjustment":
      return "⚙️";
    case "writeoff":
      return "✂️";
    default:
      return "📌";
  }
}

export const directionFilterPickerOptions: PickerOption[] = [
  { value: "all", label: "Toda la cartera", description: "Creditos y deudas juntos.", leadingLabel: "TO", leadingColor: "#64748b", searchText: "todo cartera" },
  ...directionOptions.map((option) => ({
    value: option.value,
    label: option.value === "receivable" ? "Me deben" : "Yo debo",
    description: option.description,
    leadingLabel: option.leadingLabel,
    leadingColor: option.leadingColor,
    searchText: `${option.value} ${option.label} ${option.value === "receivable" ? "me deben credito" : "yo debo deuda"}`,
  })),
];

export const statusFilterPickerOptions: PickerOption[] = [
  { value: "all", label: "Todos los estados", description: "No filtra por estado.", leadingLabel: "TO", leadingColor: "#64748b", searchText: "todos estados" },
  ...statusOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.leadingLabel,
    leadingColor: option.leadingColor,
    searchText: `${option.value} ${option.label}`,
  })),
];
