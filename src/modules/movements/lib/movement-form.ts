import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  BriefcaseBusiness,
  CalendarClock,
  ReceiptText,
} from "lucide-react";

import type { ReactNode } from "react";

import type {
  CategorySummary,
  CounterpartySummary,
  JsonValue,
  MovementRecord,
  MovementStatus,
  MovementType,
} from "../../../types/domain";

export type MovementEditorMode = "create" | "edit";

export type MovementFormState = {
  movementType: MovementType;
  status: MovementStatus;
  occurredAt: string;
  description: string;
  notes: string;
  sourceAccountId: string;
  sourceAmount: string;
  destinationAccountId: string;
  destinationAmount: string;
  fxRate: string;
  categoryId: string;
  counterpartyId: string;
  obligationId: string;
  subscriptionId: string;
  metadata: string;
};

export type MovementFieldProps = {
  label: string;
  hint?: string;
  errorKey?: string;
  invalidFields?: Set<string>;
  children: ReactNode;
};

// Fuente única del tipo de opción: el SearchablePicker compartido.
export type { PickerOption } from "../../../components/ui/searchable-picker";

export type MovementTableFilters = {
  description: string;
  type: MovementType | "all";
  status: MovementStatus | "all";
  category: string;
  counterparty: string;
  sourceAccount: string;
  amount: string;
  dateFrom: string;
  dateTo: string;
};

export type MovementTableFilterField = keyof MovementTableFilters;

export const movementTypeOptions = [
  {
    value: "expense" as const,
    label: "Gasto",
    description: "Saca saldo de una cuenta por una compra o consumo.",
  },
  {
    value: "income" as const,
    label: "Ingreso",
    description: "Agrega saldo a una cuenta por cobro o deposito.",
  },
  {
    value: "transfer" as const,
    label: "Transferencia",
    description: "Mueve dinero entre dos cuentas del mismo workspace.",
  },
  {
    value: "subscription_payment" as const,
    label: "Pago de suscripcion",
    description: "Registra un cobro recurrente ligado a una suscripcion.",
  },
  {
    value: "obligation_opening" as const,
    label: "Apertura de obligacion",
    description: "Crea el movimiento inicial ligado a un credito o deuda.",
  },
  {
    value: "obligation_payment" as const,
    label: "Pago de obligacion",
    description: "Asocia un pago real a un credito o deuda existente.",
  },
  {
    value: "refund" as const,
    label: "Reembolso",
    description: "Recupera dinero en una cuenta destino.",
  },
  {
    value: "adjustment" as const,
    label: "Ajuste manual",
    description: "Corrige un saldo con una entrada o salida puntual.",
  },
] as const;

export const movementStatusOptions = [
  {
    value: "planned" as const,
    label: "Planeado",
    description:
      "Compromiso con fecha: aún no mueve el saldo. Úsalo para lo que planeas hacer en el calendario.",
  },
  {
    value: "pending" as const,
    label: "Pendiente",
    description:
      "Registro que ya ocurrió o está por cerrarse y falta confirmar como aplicado para que actualice el saldo.",
  },
  {
    value: "posted" as const,
    label: "Aplicado",
    description: "Confirmado: ya impacta cuentas, saldos y reportes como movimiento real.",
  },
  {
    value: "voided" as const,
    label: "Anulado",
    description: "No cuenta en saldos; se mantiene solo para historial y trazabilidad.",
  },
] as const;

export const expenseLikeMovementTypes = new Set<MovementType>([
  "expense",
  "subscription_payment",
  "obligation_payment",
]);
export const incomeLikeMovementTypes = new Set<MovementType>(["income", "refund"]);

export type MovementDisplayInfo = {
  accountLabel: string;
  amount: number | null;
  currencyCode: string;
};

/** Cuenta, monto y moneda a mostrar según el tipo de movimiento. */
export function getMovementDisplayInfo(
  movement: MovementRecord,
  fallbackCurrencyCode: string,
): MovementDisplayInfo {
  if (incomeLikeMovementTypes.has(movement.movementType)) {
    return {
      accountLabel: movement.destinationAccountName ?? "-",
      amount: movement.destinationAmount,
      currencyCode: movement.destinationCurrencyCode ?? fallbackCurrencyCode,
    };
  }

  if (movement.movementType === "transfer") {
    const accountLabel =
      movement.sourceAccountName && movement.destinationAccountName
        ? `${movement.sourceAccountName} -> ${movement.destinationAccountName}`
        : movement.sourceAccountName ?? movement.destinationAccountName ?? "-";

    return {
      accountLabel,
      amount: movement.sourceAmount ?? movement.destinationAmount,
      currencyCode:
        movement.sourceCurrencyCode ?? movement.destinationCurrencyCode ?? fallbackCurrencyCode,
    };
  }

  if (expenseLikeMovementTypes.has(movement.movementType)) {
    return {
      accountLabel: movement.sourceAccountName ?? "-",
      amount: movement.sourceAmount,
      currencyCode: movement.sourceCurrencyCode ?? fallbackCurrencyCode,
    };
  }

  const amount = movement.sourceAmount ?? movement.destinationAmount;
  const accountLabel = movement.sourceAccountName ?? movement.destinationAccountName ?? "-";

  return {
    accountLabel,
    amount,
    currencyCode:
      movement.sourceCurrencyCode ?? movement.destinationCurrencyCode ?? fallbackCurrencyCode,
  };
}

export function getMovementTypeOption(movementType: MovementType) {
  return movementTypeOptions.find((option) => option.value === movementType) ?? movementTypeOptions[0];
}

export function getMovementStatusOption(status: MovementStatus) {
  return movementStatusOptions.find((option) => option.value === status) ?? movementStatusOptions[0];
}

export function getMovementTypeTone(movementType: MovementType) {
  if (expenseLikeMovementTypes.has(movementType)) {
    return "danger" as const;
  }

  if (incomeLikeMovementTypes.has(movementType)) {
    return "success" as const;
  }

  if (movementType === "transfer") {
    return "info" as const;
  }

  return "warning" as const;
}

export function getMovementStatusTone(status: MovementStatus) {
  if (status === "posted") {
    return "success" as const;
  }

  if (status === "voided") {
    return "danger" as const;
  }

  if (status === "pending") {
    return "warning" as const;
  }

  return "neutral" as const;
}

export function getMovementStatusColor(status: MovementStatus) {
  switch (status) {
    case "posted":
      return "#1b6a58";
    case "pending":
      return "#b48b34";
    case "voided":
      return "#8f3e3e";
    default:
      return "#6b7280";
  }
}

export function getCategoryColor(kind: CategorySummary["kind"]) {
  switch (kind) {
    case "expense":
      return "#8f3e3e";
    case "income":
      return "#1b6a58";
    default:
      return "#4566d6";
  }
}

export function getCounterpartyColor(type: CounterpartySummary["type"]) {
  switch (type) {
    case "person":
      return "#4566d6";
    case "company":
      return "#8366f2";
    case "merchant":
      return "#c46a31";
    case "service":
      return "#b48b34";
    case "bank":
      return "#1b6a58";
    default:
      return "#6b7280";
  }
}

export function getMovementVisualPreset(movementType: MovementType) {
  switch (movementType) {
    case "expense":
      return { color: "#8f3e3e", icon: ArrowDownCircle };
    case "income":
    case "refund":
      return { color: "#1b6a58", icon: ArrowUpCircle };
    case "transfer":
      return { color: "#4566d6", icon: ArrowLeftRight };
    case "subscription_payment":
      return { color: "#b48b34", icon: CalendarClock };
    case "obligation_opening":
    case "obligation_payment":
      return { color: "#c46a31", icon: BriefcaseBusiness };
    default:
      return { color: "#8366f2", icon: ReceiptText };
  }
}

export function toDateTimeLocalValue(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const timezoneOffsetInMs = parsedDate.getTimezoneOffset() * 60_000;
  return new Date(parsedDate.getTime() - timezoneOffsetInMs).toISOString().slice(0, 16);
}

export function createDefaultMovementFormState() {
  return {
    movementType: "expense" as MovementType,
    status: "posted" as MovementStatus,
    occurredAt: toDateTimeLocalValue(new Date().toISOString()),
    description: "",
    notes: "",
    sourceAccountId: "",
    sourceAmount: "",
    destinationAccountId: "",
    destinationAmount: "",
    fxRate: "",
    categoryId: "",
    counterpartyId: "",
    obligationId: "",
    subscriptionId: "",
    metadata: "",
  };
}

export function stringifyMetadata(metadata?: JsonValue | null) {
  if (metadata === null || metadata === undefined) {
    return "";
  }

  if (typeof metadata === "object" && !Array.isArray(metadata) && Object.keys(metadata).length === 0) {
    return "";
  }

  return JSON.stringify(metadata, null, 2);
}

export function buildFormStateFromMovement(movement: MovementRecord): MovementFormState {
  return {
    movementType: movement.movementType,
    status: movement.status,
    occurredAt: toDateTimeLocalValue(movement.occurredAt),
    description: movement.description,
    notes: movement.notes ?? "",
    sourceAccountId: movement.sourceAccountId ? String(movement.sourceAccountId) : "",
    sourceAmount: movement.sourceAmount === null ? "" : String(movement.sourceAmount),
    destinationAccountId: movement.destinationAccountId ? String(movement.destinationAccountId) : "",
    destinationAmount: movement.destinationAmount === null ? "" : String(movement.destinationAmount),
    fxRate: movement.fxRate === null || movement.fxRate === undefined ? "" : String(movement.fxRate),
    categoryId: movement.categoryId ? String(movement.categoryId) : "",
    counterpartyId: movement.counterpartyId ? String(movement.counterpartyId) : "",
    obligationId: movement.obligationId ? String(movement.obligationId) : "",
    subscriptionId: movement.subscriptionId ? String(movement.subscriptionId) : "",
    metadata: stringifyMetadata(movement.metadata),
  };
}

export function parseOptionalInteger(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);
  return Number.isInteger(parsedValue) ? parsedValue : Number.NaN;
}

export function parseOptionalNumber(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
}

export function parseMetadataValue(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return {} as JsonValue;
  }

  return JSON.parse(normalizedValue) as JsonValue;
}

export function filterCategoriesForMovementType(
  categories: CategorySummary[],
  movementType: MovementType,
  selectedCategoryId: number | null,
) {
  return categories
    .filter((category) => {
      if (selectedCategoryId === category.id) {
        return true;
      }

      if (!category.isActive) {
        return false;
      }

      if (expenseLikeMovementTypes.has(movementType)) {
        return category.kind === "expense" || category.kind === "both";
      }

      if (incomeLikeMovementTypes.has(movementType)) {
        return category.kind === "income" || category.kind === "both";
      }

      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}

export const movementTableFilterDefaults: MovementTableFilters = {
  description: "",
  type: "all",
  status: "all",
  category: "",
  counterparty: "",
  sourceAccount: "",
  amount: "",
  dateFrom: "",
  dateTo: "",
};

export const defaultMovementTableFilters = (): MovementTableFilters => ({
  ...movementTableFilterDefaults,
});

export function isMovementTableFilterActive(
  filters: MovementTableFilters,
  field: MovementTableFilterField,
) {
  switch (field) {
    case "description":
    case "category":
    case "counterparty":
    case "sourceAccount":
    case "amount":
      return Boolean(filters[field].trim());
    case "dateFrom":
    case "dateTo":
      return Boolean(filters[field]);
    case "type":
      return filters.type !== "all";
    case "status":
      return filters.status !== "all";
    default:
      return false;
  }
}

export function downloadMovementsCSV(movements: MovementRecord[], filename: string) {
  const headers = [
    "Fecha",
    "Tipo",
    "Estado",
    "Descripcion",
    "Categoria",
    "Contraparte",
    "Cuenta origen",
    "Monto origen",
    "Moneda origen",
    "Cuenta destino",
    "Monto destino",
    "Moneda destino",
    "Notas",
  ];
  const escape = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = movements.map((m) => [
    escape(m.occurredAt),
    escape(m.movementType),
    escape(m.status),
    escape(m.description),
    escape(m.category ?? ""),
    escape(m.counterparty ?? ""),
    escape(m.sourceAccountName ?? ""),
    escape(m.sourceAmount ?? ""),
    escape(m.sourceCurrencyCode ?? ""),
    escape(m.destinationAccountName ?? ""),
    escape(m.destinationAmount ?? ""),
    escape(m.destinationCurrencyCode ?? ""),
    escape(m.notes ?? ""),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
