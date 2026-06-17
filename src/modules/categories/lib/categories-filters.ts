import type { CategoryKind } from "../../../types/domain";

export type KindFilter = "all" | CategoryKind;
export type CategoryStatusFilter = "all" | "active" | "inactive";

export type CategoryTableFilters = {
  name: string;
  kind: KindFilter;
  status: CategoryStatusFilter;
  parent: string;
  movements: string;
  subscriptions: string;
};

export type CategoryTableFilterField = keyof CategoryTableFilters;

export const defaultCategoryTableFilters = (): CategoryTableFilters => ({
  name: "",
  kind: "all",
  status: "active",
  parent: "",
  movements: "",
  subscriptions: "",
});

export function isCategoryTableFilterActive(
  filters: CategoryTableFilters,
  field: CategoryTableFilterField,
) {
  switch (field) {
    case "name":
    case "parent":
    case "movements":
    case "subscriptions":
      return Boolean(filters[field].trim());
    case "kind":
      return filters.kind !== "all";
    case "status":
      return filters.status !== "active";
    default:
      return false;
  }
}
