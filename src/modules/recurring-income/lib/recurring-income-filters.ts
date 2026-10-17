import type { RecurringIncomeFrequency, RecurringIncomeStatus, RecurringIncomeSummary } from "../../../types/domain";

export const incomeFrequencyValues: RecurringIncomeFrequency[] = ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"];
export const incomeStatusValues: RecurringIncomeStatus[] = ["active", "paused", "cancelled"];

export type RecurringIncomeTableFilters = {
  name: string;
  payer: string;
  frequency: "all" | RecurringIncomeFrequency;
  selectedFrequencies: RecurringIncomeFrequency[];
  status: "all" | RecurringIncomeStatus;
  selectedStatuses: RecurringIncomeStatus[];
  pinnedOnly: boolean;
  upcomingOnly: boolean;
  category: string;
  account: string;
  payerId: number | null;
  categoryId: number | null;
  accountId: number | null;
  amount: string;
  nextExpectedDateFrom: string;
  nextExpectedDateTo: string;
};

export type RecurringIncomeTableFilterField = keyof RecurringIncomeTableFilters;

export const defaultRecurringIncomeTableFilters = (): RecurringIncomeTableFilters => ({
  name: "",
  payer: "",
  frequency: "all",
  selectedFrequencies: [],
  status: "all",
  selectedStatuses: [],
  pinnedOnly: false,
  upcomingOnly: false,
  category: "",
  account: "",
  payerId: null,
  categoryId: null,
  accountId: null,
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
      return filters.frequency !== "all" || filters.selectedFrequencies.length > 0;
    case "status":
      return filters.status !== "all" || filters.selectedStatuses.length > 0;
    case "payerId":
    case "categoryId":
    case "accountId":
      return filters[field] !== null;
    case "pinnedOnly":
    case "upcomingOnly":
      return filters[field];
    case "selectedStatuses":
    case "selectedFrequencies":
      return filters[field].length > 0;
    default:
      return false;
  }
}

/** OR within status/frequency, AND across groups; legacy textual URLs remain explicit. */
export function filterRecurringIncome(items: RecurringIncomeSummary[], filters: RecurringIncomeTableFilters, today: string) {
  const statuses = filters.selectedStatuses.length ? filters.selectedStatuses : filters.status === "all" ? [] : [filters.status];
  const frequencies = filters.selectedFrequencies.length ? filters.selectedFrequencies : filters.frequency === "all" ? [] : [filters.frequency];
  const query = filters.name.trim().toLowerCase();
  const includes = (value: string | null | undefined, text: string) => (value ?? "").toLowerCase().includes(text.trim().toLowerCase());
  const through = new Date(`${today}T12:00:00Z`); through.setUTCDate(through.getUTCDate() + 30);
  const lastDay = through.toISOString().slice(0, 10);
  return items.filter(item => {
    if (statuses.length && !statuses.includes(item.status)) return false;
    if (frequencies.length && !frequencies.includes(item.frequency)) return false;
    if (filters.pinnedOnly && !item.isPinned) return false;
    if (filters.payerId !== null && item.payerPartyId !== filters.payerId) return false;
    if (filters.categoryId !== null && item.categoryId !== filters.categoryId) return false;
    if (filters.accountId !== null && item.accountId !== filters.accountId) return false;
    if (!includes(item.payer, filters.payer) || !includes(item.categoryName, filters.category) || !includes(item.accountName, filters.account)) return false;
    if (filters.upcomingOnly && (item.nextExpectedDate < today || item.nextExpectedDate > lastDay)) return false;
    if (filters.nextExpectedDateFrom && item.nextExpectedDate < filters.nextExpectedDateFrom) return false;
    if (filters.nextExpectedDateTo && item.nextExpectedDate > filters.nextExpectedDateTo) return false;
    if (filters.amount.trim() && !String(item.amount).includes(filters.amount.trim())) return false;
    return !query || includes([item.name, item.payer, item.accountName, item.categoryName, item.description, item.notes].join(" "), query);
  }).sort((a, b) => a.nextExpectedDate.localeCompare(b.nextExpectedDate));
}

export function incomeReferenceOptions(items: RecurringIncomeSummary[], field: "payer" | "category" | "account", selectedId: number | null) {
  const values = new Map<number, string>();
  for (const item of items) {
    const id = field === "payer" ? item.payerPartyId : field === "category" ? item.categoryId : item.accountId;
    const name = field === "payer" ? item.payer : field === "category" ? item.categoryName : item.accountName;
    if (Number.isSafeInteger(id) && id! > 0) values.set(id!, name?.trim() || `#${id}`);
  }
  if (selectedId !== null && !values.has(selectedId)) values.set(selectedId, `Referencia #${selectedId} sin filas en esta vista`);
  const counts = new Map<string, number>();
  for (const name of values.values()) counts.set(name.toLocaleLowerCase("es-PE"), (counts.get(name.toLocaleLowerCase("es-PE")) ?? 0) + 1);
  return [...values].map(([id, name]) => ({ value: String(id), label: counts.get(name.toLocaleLowerCase("es-PE"))! > 1 ? `${name} · #${id}` : name, description: "", leadingLabel: "" }))
    .sort((a, b) => a.label.localeCompare(b.label, "es-PE"));
}
