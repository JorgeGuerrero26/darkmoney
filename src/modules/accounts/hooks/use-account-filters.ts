import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type { AccountFilters, AccountStatusFilter, AccountViewMode } from "../lib/account-filters";

const statusValues: AccountStatusFilter[] = ["active", "all", "included", "excluded", "archived"];
const viewValues: AccountViewMode[] = ["table", "list", "grid"];

function parsePositiveInteger(value: string | null) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseStatus(value: string | null): AccountStatusFilter {
  return statusValues.includes(value as AccountStatusFilter) ? (value as AccountStatusFilter) : "active";
}

function parseView(value: string | null): AccountViewMode {
  return viewValues.includes(value as AccountViewMode) ? (value as AccountViewMode) : "table";
}

export function useAccountFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo<AccountFilters>(
    () => ({
      q: searchParams.get("q") ?? "",
      type: searchParams.get("type") ?? "",
      status: parseStatus(searchParams.get("status")),
      currency: searchParams.get("currency") ?? "",
      view: parseView(searchParams.get("view")),
      page: parsePositiveInteger(searchParams.get("page")),
    }),
    [searchParams],
  );

  function writeFilters(nextFilters: Partial<AccountFilters>, options: { resetPage?: boolean } = {}) {
    const merged = {
      ...filters,
      ...nextFilters,
      page: options.resetPage ? 1 : nextFilters.page ?? filters.page,
    };
    const nextParams = new URLSearchParams();

    if (merged.q.trim()) {
      nextParams.set("q", merged.q.trim());
    }
    if (merged.type) {
      nextParams.set("type", merged.type);
    }
    if (merged.status !== "active") {
      nextParams.set("status", merged.status);
    }
    if (merged.currency) {
      nextParams.set("currency", merged.currency);
    }
    if (merged.view !== "table") {
      nextParams.set("view", merged.view);
    }
    if (merged.page > 1) {
      nextParams.set("page", String(merged.page));
    }

    setSearchParams(nextParams, { replace: true });
  }

  function resetFilters() {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  return {
    filters,
    resetFilters,
    writeFilters,
  };
}
