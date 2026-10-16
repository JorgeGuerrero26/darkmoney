import type { AccountSummary } from "../../../types/domain";
import { getTypePreset } from "./account-options";
import { findAccountInstitution } from "./account-institutions";

export type AccountStatusFilter = "active" | "all" | "included" | "excluded" | "archived";
export type AccountViewMode = "table" | "list" | "grid";

export type AccountFilters = {
  q: string;
  type: string;
  types?: string[];
  institutions?: (string | null)[];
  status: AccountStatusFilter;
  currency: string;
  view: AccountViewMode;
  page: number;
};

export const ACCOUNT_PAGE_SIZE = 50;

export const accountStatusOptions: Array<{
  value: AccountStatusFilter;
  label: string;
  description: string;
  leadingLabel: string;
}> = [
  {
    value: "active",
    label: "Activas",
    description: "Oculta cuentas archivadas.",
    leadingLabel: "AC",
  },
  {
    value: "all",
    label: "Todas",
    description: "Incluye activas y archivadas.",
    leadingLabel: "TO",
  },
  {
    value: "included",
    label: "En patrimonio",
    description: "Solo cuentas incluidas en patrimonio.",
    leadingLabel: "PA",
  },
  {
    value: "excluded",
    label: "Fuera de patrimonio",
    description: "Cuentas operativas que no suman patrimonio.",
    leadingLabel: "FP",
  },
  {
    value: "archived",
    label: "Archivadas",
    description: "Cuentas retiradas del flujo principal.",
    leadingLabel: "AR",
  },
];

export function filterAccounts(accounts: AccountSummary[], filters: AccountFilters) {
  const query = filters.q.trim().toLowerCase();
  const currency = filters.currency.trim().toUpperCase();

  return accounts.filter((account) => {
    if (filters.status === "active" && account.isArchived) {
      return false;
    }

    if (filters.status === "included" && (account.isArchived || !account.includeInNetWorth)) {
      return false;
    }

    if (filters.status === "excluded" && (account.isArchived || account.includeInNetWorth)) {
      return false;
    }

    if (filters.status === "archived" && !account.isArchived) {
      return false;
    }

    const types = filters.types ?? (filters.type ? [filters.type] : []);
    if (types.length && !types.includes(account.type)) {
      return false;
    }
    if (filters.institutions?.length && !filters.institutions.includes(account.institutionCode || null)) return false;

    if (currency && account.currencyCode.toUpperCase() !== currency) {
      return false;
    }

    if (!query) {
      return true;
    }

    return (
      account.name.toLowerCase().includes(query) ||
      account.currencyCode.toLowerCase().includes(query)
    );
  });
}

export function paginateAccounts(accounts: AccountSummary[], page: number, pageSize = ACCOUNT_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(accounts.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    totalPages,
    items: accounts.slice(start, start + pageSize),
  };
}

export function getAvailableAccountTypes(accounts: AccountSummary[]) {
  return Array.from(new Set(accounts.map((account) => account.type).filter(Boolean))).sort((left, right) =>
    getTypePreset(left).label.localeCompare(getTypePreset(right).label),
  );
}

export function getAvailableCurrencyCodes(accounts: AccountSummary[]) {
  return Array.from(
    new Set(accounts.map((account) => account.currencyCode.trim().toUpperCase()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

export function getAvailableAccountInstitutions(accounts: AccountSummary[]) {
  return [...new Set(accounts.map(account => account.institutionCode || null))]
    .map(value => ({ value, label: value ? findAccountInstitution(value)?.label ?? value : "Sin institución" }))
    .sort((left, right) => left.label.localeCompare(right.label, "es"));
}
