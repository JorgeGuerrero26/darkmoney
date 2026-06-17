import type { BudgetOverview, CategorySummary } from "../../../types/domain";
import type { BudgetScopeKind, ScopeFilter, StatusFilter } from "./budgets-filters";
import type { PickerOption } from "../../../components/ui/searchable-picker";

export type DisplayBudgetOverview = BudgetOverview & {
  displayCurrencyCode: string;
  displayLimitAmount: number;
  displaySpentAmount: number;
  displayRemainingAmount: number;
  isConvertedDisplay: boolean;
};

export const scopeOptions: Array<{
  value: BudgetScopeKind;
  label: string;
  description: string;
}> = [
  {
    value: "general",
    label: "General",
    description: "Controla el gasto total del periodo sin amarrarlo a una categoría o cuenta concreta.",
  },
  {
    value: "category",
    label: "Por categoría",
    description: "Ideal para poner un tope a Salud, Comida, Transporte u otra familia de gasto.",
  },
  {
    value: "account",
    label: "Por cuenta",
    description: "Sirve para limitar cuánto sale de una cuenta específica durante el período.",
  },
  {
    value: "category_account",
    label: "Categoría en cuenta",
    description: "Cruza categoría y cuenta para presupuestos más estrictos y granulares.",
  },
];

export const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "active", label: "Activos" },
  { value: "critical", label: "Críticos" },
  { value: "inactive", label: "Inactivos" },
];

export const scopeFilterOptions: Array<{ value: ScopeFilter; label: string }> = [
  { value: "all", label: "Todo alcance" },
  { value: "general", label: "General" },
  { value: "category", label: "Categoría" },
  { value: "account", label: "Cuenta" },
  { value: "category_account", label: "Categoría + cuenta" },
];

export function normalizeCurrencyCode(currencyCode: string) {
  return currencyCode.trim().toUpperCase();
}

export function getBudgetCurrencyOption(
  currencyCode: string,
  workspaceBaseCurrencyCode?: string | null,
): PickerOption {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);

  switch (normalizedCurrencyCode) {
    case "PEN":
      return {
        value: "PEN",
        label: "PEN",
        description:
          workspaceBaseCurrencyCode === "PEN"
            ? "Sol peruano. Moneda base recomendada para este workspace."
            : "Sol peruano para topes y seguimiento local.",
        leadingLabel: "S/",
        leadingColor: "#1b6a58",
      };
    case "USD":
      return {
        value: "USD",
        label: "USD",
        description: "Dolar estadounidense para cuentas o gastos en dolares.",
        leadingLabel: "US$",
        leadingColor: "#4566d6",
      };
    case "EUR":
      return {
        value: "EUR",
        label: "EUR",
        description: "Euro para presupuestos y gastos en moneda europea.",
        leadingLabel: "EUR",
        leadingColor: "#b48b34",
      };
    default:
      return {
        value: normalizedCurrencyCode,
        label: normalizedCurrencyCode,
        description: "Moneda disponible en este workspace.",
        leadingLabel: normalizedCurrencyCode,
        leadingColor: "#6b7280",
      };
  }
}

export function getBudgetCategoryColor(kind: CategorySummary["kind"]) {
  switch (kind) {
    case "expense":
      return "#8f3e3e";
    case "income":
      return "#1b6a58";
    default:
      return "#4566d6";
  }
}

export function getBudgetTone(budget: BudgetOverview) {
  if (budget.isOverLimit) {
    return "danger" as const;
  }

  if (budget.isNearLimit) {
    return "warning" as const;
  }

  return "success" as const;
}

export function getBudgetStatusLabel(budget: BudgetOverview) {
  if (!budget.isActive) {
    return "Inactivo";
  }

  if (budget.isOverLimit) {
    return "Excedido";
  }

  if (budget.isNearLimit) {
    return "En alerta";
  }

  return "Saludable";
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isBudgetCurrent(budget: BudgetOverview) {
  const todayKey = toDateKey(new Date());
  return budget.periodStart <= todayKey && budget.periodEnd >= todayKey;
}

export function getBudgetScopeDetails(scopeKind: BudgetScopeKind) {
  return scopeOptions.find((option) => option.value === scopeKind) ?? scopeOptions[0];
}

export function getBudgetScopeFilterLeadingLabel(scope: ScopeFilter) {
  switch (scope) {
    case "general":
      return "GE";
    case "category":
      return "CA";
    case "account":
      return "CU";
    case "category_account":
      return "CC";
    case "all":
    default:
      return "TA";
  }
}

export function getBudgetScopeFilterColor(scope: ScopeFilter) {
  switch (scope) {
    case "general":
      return "#1B6A58";
    case "category":
      return "#C46A31";
    case "account":
      return "#4566D6";
    case "category_account":
      return "#8366F2";
    case "all":
    default:
      return "#64748B";
  }
}

export function getBudgetStatusFilterDetails(status: StatusFilter) {
  switch (status) {
    case "active":
      return {
        description: "Presupuestos activos sin filtrar por alerta.",
        leadingLabel: "AC",
        leadingColor: "#1B6A58",
      };
    case "critical":
      return {
        description: "Incluye presupuestos cerca del limite o excedidos.",
        leadingLabel: "CR",
        leadingColor: "#B48B34",
      };
    case "inactive":
      return {
        description: "Presupuestos desactivados conservados para historial.",
        leadingLabel: "IN",
        leadingColor: "#64748B",
      };
    case "all":
    default:
      return {
        description: "Muestra cualquier estado del presupuesto.",
        leadingLabel: "TO",
        leadingColor: "#64748B",
      };
  }
}

export const scopeFilterPickerOptions: PickerOption[] = scopeFilterOptions.map((option) => {
  const description =
    option.value === "all"
      ? "Muestra cualquier alcance del presupuesto."
      : getBudgetScopeDetails(option.value).description;

  return {
    value: option.value,
    label: option.label,
    description,
    leadingLabel: getBudgetScopeFilterLeadingLabel(option.value),
    leadingColor: getBudgetScopeFilterColor(option.value),
    searchText: `${option.label} ${option.value} ${description}`,
  };
});

export const statusFilterPickerOptions: PickerOption[] = statusOptions.map((option) => {
  const details = getBudgetStatusFilterDetails(option.value);

  return {
    value: option.value,
    label: option.label,
    description: details.description,
    leadingLabel: details.leadingLabel,
    leadingColor: details.leadingColor,
    searchText: `${option.label} ${option.value} ${details.description}`,
  };
});
