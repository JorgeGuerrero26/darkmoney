import type { ObligationDirection, ObligationStatus } from "../../../types/domain";

export type DirectionFilterValue = "all" | ObligationDirection;
export type StatusFilterValue = "all" | ObligationStatus;

export type ObligationTableFilters = {
  title: string;
  counterparty: string;
  direction: DirectionFilterValue;
  status: StatusFilterValue;
  principal: string;
  pending: string;
};

export type ObligationTableFilterField = keyof ObligationTableFilters;

export const defaultObligationTableFilters = (): ObligationTableFilters => ({
  title: "",
  counterparty: "",
  direction: "all",
  status: "all",
  principal: "",
  pending: "",
});

export function isObligationTableFilterActive(
  filters: ObligationTableFilters,
  field: ObligationTableFilterField,
) {
  switch (field) {
    case "title":
    case "counterparty":
    case "principal":
    case "pending":
      return Boolean(filters[field].trim());
    case "direction":
    case "status":
      return filters[field] !== "all";
    default:
      return false;
  }
}
