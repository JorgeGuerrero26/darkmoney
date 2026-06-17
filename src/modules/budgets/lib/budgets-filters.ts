import type { BudgetOverview } from "../../../types/domain";

export type BudgetScopeKind = BudgetOverview["scopeKind"];
export type ScopeFilter = "all" | BudgetScopeKind;
export type StatusFilter = "all" | "active" | "critical" | "inactive";

export type BudgetTableFilters = {
  name: string;
  scope: ScopeFilter;
  status: StatusFilter;
  currentOnly: boolean;
  period: string;
  limit: string;
  spent: string;
  remaining: string;
};

export type BudgetTableFilterField = keyof BudgetTableFilters;

export const defaultBudgetTableFilters = (): BudgetTableFilters => ({
  name: "",
  scope: "all",
  status: "all",
  currentOnly: true,
  period: "",
  limit: "",
  spent: "",
  remaining: "",
});

export function isBudgetTableFilterActive(
  filters: BudgetTableFilters,
  field: BudgetTableFilterField,
) {
  switch (field) {
    case "name":
    case "period":
    case "limit":
    case "spent":
    case "remaining":
      return Boolean(filters[field].trim());
    case "scope":
    case "status":
      return filters[field] !== "all";
    case "currentOnly":
      return filters.currentOnly !== true;
    default:
      return false;
  }
}
