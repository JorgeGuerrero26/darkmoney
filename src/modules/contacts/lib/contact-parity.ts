import type { CounterpartyOverview, ObligationSummary } from "../../../types/domain";
import { currencyTotals, type CurrencyAmount } from "../../../lib/analytics-money";

export type ContactFilter = "pinned" | CounterpartyOverview["type"];

export function contactMatchesFilters(contact: CounterpartyOverview, filters: ContactFilter[], search: string) {
  if (filters.includes("pinned") && !contact.isPinned) return false;
  const types = filters.filter((value) => value !== "pinned");
  if (types.length && !types.includes(contact.type)) return false;
  const query = search.trim().toLocaleLowerCase("es-PE");
  return !query || [contact.name, contact.type, contact.phone, contact.email, contact.documentNumber, contact.notes].filter(Boolean).join(" ").toLocaleLowerCase("es-PE").includes(query);
}

export function contactExposure(obligations: ObligationSummary[], contactId: number, baseCurrencyCode: string) {
  const rows = obligations.filter((item) => item.counterpartyId === contactId && item.status !== "cancelled");
  const amount = (item: ObligationSummary): CurrencyAmount => ({ amount: item.pendingAmount, currencyCode: item.currencyCode, amountInBaseCurrency: item.pendingAmountInBaseCurrency });
  return {
    receivable: currencyTotals(rows.filter((item) => item.direction === "receivable").map(amount), baseCurrencyCode),
    payable: currencyTotals(rows.filter((item) => item.direction === "payable").map(amount), baseCurrencyCode),
  };
}

export function contactWhatsAppUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}
