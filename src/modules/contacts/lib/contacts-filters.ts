import type { CounterpartyRoleType, CounterpartySummary } from "../../../types/domain";

export type RoleFilter = "all" | CounterpartyRoleType;
export type ContactStatusFilter = "all" | "active" | "archived";
export type ContactTypeFilter = "all" | CounterpartySummary["type"];

export type ContactTableFilters = {
  name: string;
  type: ContactTypeFilter;
  role: RoleFilter;
  status: ContactStatusFilter;
  receivable: string;
  payable: string;
};

export type ContactTableFilterField = keyof ContactTableFilters;

export const defaultContactTableFilters = (): ContactTableFilters => ({
  name: "",
  type: "all",
  role: "all",
  status: "active",
  receivable: "",
  payable: "",
});

export function isContactTableFilterActive(
  filters: ContactTableFilters,
  field: ContactTableFilterField,
) {
  switch (field) {
    case "name":
    case "receivable":
    case "payable":
      return Boolean(filters[field].trim());
    case "type":
    case "role":
      return filters[field] !== "all";
    case "status":
      return filters.status !== "active";
    default:
      return false;
  }
}
