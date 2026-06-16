import type { RecurringIncomeFrequency, RecurringIncomeStatus } from "../../../types/domain";

export type RecurringIncomeTableFilters = {
  name: string;
  payer: string;
  frequency: "all" | RecurringIncomeFrequency;
  status: "all" | RecurringIncomeStatus;
  category: string;
  account: string;
  amount: string;
  nextExpectedDateFrom: string;
  nextExpectedDateTo: string;
};

export type RecurringIncomeTableFilterField = keyof RecurringIncomeTableFilters;

export const defaultRecurringIncomeTableFilters = (): RecurringIncomeTableFilters => ({
  name: "",
  payer: "",
  frequency: "all",
  status: "all",
  category: "",
  account: "",
  amount: "",
  nextExpectedDateFrom: "",
  nextExpectedDateTo: "",
});

export function isRecurringIncomeTableFilterActive(
  filters: RecurringIncomeTableFilters,
  field: RecurringIncomeTableFilterField,
) {
  switch (field) {
    case "name":
    case "payer":
    case "category":
    case "account":
    case "amount":
      return Boolean(filters[field].trim());
    case "nextExpectedDateFrom":
    case "nextExpectedDateTo":
      return Boolean(filters[field]);
    case "frequency":
    case "status":
      return filters[field] !== "all";
    default:
      return false;
  }
}
