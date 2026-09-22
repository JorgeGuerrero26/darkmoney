import type { SubscriptionFrequency, SubscriptionStatus } from "../../../types/domain";

export type SubscriptionTableFilters = {
  name: string;
  pinned: boolean;
  vendor: string;
  frequency: "all" | SubscriptionFrequency;
  status: "all" | SubscriptionStatus;
  category: string;
  account: string;
  amount: string;
  nextDueDateFrom: string;
  nextDueDateTo: string;
};

export type SubscriptionTableFilterField = keyof SubscriptionTableFilters;

export const defaultSubscriptionTableFilters = (): SubscriptionTableFilters => ({
  name: "",
  pinned: false,
  vendor: "",
  frequency: "all",
  status: "all",
  category: "",
  account: "",
  amount: "",
  nextDueDateFrom: "",
  nextDueDateTo: "",
});

export function isSubscriptionTableFilterActive(
  filters: SubscriptionTableFilters,
  field: SubscriptionTableFilterField,
) {
  switch (field) {
    case "name":
    case "vendor":
    case "category":
    case "account":
    case "amount":
      return Boolean(filters[field].trim());
    case "pinned":
      return filters.pinned;
    case "nextDueDateFrom":
    case "nextDueDateTo":
      return Boolean(filters[field]);
    case "frequency":
    case "status":
      return filters[field] !== "all";
    default:
      return false;
  }
}
