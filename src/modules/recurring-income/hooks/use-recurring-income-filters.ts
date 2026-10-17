import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import {
  defaultRecurringIncomeTableFilters,
  incomeFrequencyValues,
  incomeStatusValues,
  type RecurringIncomeTableFilters,
} from "../lib/recurring-income-filters";

/**
 * Filtros y paginación de ingresos fijos persistidos en la URL. Cambiar un
 * filtro vuelve a la primera página sin descartar los demás filtros.
 */
export function useRecurringIncomeFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<RecurringIncomeTableFilters>(() => {
    const defaults = defaultRecurringIncomeTableFilters();
    const frequencies = [...new Set(searchParams.getAll("freq").flatMap(value => value.split(",")))].filter((value): value is RecurringIncomeTableFilters["selectedFrequencies"][number] => incomeFrequencyValues.some(valid => valid === value));
    const statuses = [...new Set(searchParams.getAll("status").flatMap(value => value.split(",")))].filter((value): value is RecurringIncomeTableFilters["selectedStatuses"][number] => incomeStatusValues.some(valid => valid === value));
    const readId = (key: string) => { const raw = searchParams.get(key); const value = raw && /^\d+$/.test(raw) ? Number(raw) : null; return Number.isSafeInteger(value) && value! > 0 ? value : null; };

    return {
      name: searchParams.get("q") ?? defaults.name,
      payer: searchParams.get("payer") ?? defaults.payer,
      frequency: frequencies.length === 1 ? frequencies[0] : "all",
      selectedFrequencies: frequencies.length > 1 ? frequencies : [],
      status: statuses.length === 1 ? statuses[0] : "all",
      selectedStatuses: statuses.length > 1 ? statuses : [],
      pinnedOnly: searchParams.get("pinned") === "1",
      upcomingOnly: searchParams.get("upcoming") === "1",
      category: searchParams.get("cat") ?? defaults.category,
      account: searchParams.get("account") ?? defaults.account,
      payerId: readId("payer_id"),
      categoryId: readId("category_id"),
      accountId: readId("account_id"),
      amount: searchParams.get("amount") ?? defaults.amount,
      nextExpectedDateFrom: searchParams.get("from") ?? defaults.nextExpectedDateFrom,
      nextExpectedDateTo: searchParams.get("to") ?? defaults.nextExpectedDateTo,
    };
  }, [searchParams]);

  const currentPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const writeFiltersToParams = useCallback(
    (next: RecurringIncomeTableFilters, page: number) => {
      // Preserve resource/notification destinations and other non-filter parameters.
      const params = new URLSearchParams(searchParams);
      for (const key of ["q", "payer", "freq", "status", "pinned", "upcoming", "cat", "account", "payer_id", "category_id", "account_id", "amount", "from", "to", "page"]) params.delete(key);
      if (next.name.trim()) params.set("q", next.name);
      if (next.payer.trim()) params.set("payer", next.payer);
      if (next.selectedFrequencies.length) params.set("freq", next.selectedFrequencies.join(","));
      else if (next.frequency !== "all") params.set("freq", next.frequency);
      if (next.selectedStatuses.length) params.set("status", next.selectedStatuses.join(","));
      else if (next.status !== "all") params.set("status", next.status);
      if (next.pinnedOnly) params.set("pinned", "1");
      if (next.upcomingOnly) params.set("upcoming", "1");
      if (next.category.trim()) params.set("cat", next.category);
      if (next.account.trim()) params.set("account", next.account);
      if (next.payerId !== null) params.set("payer_id", String(next.payerId));
      if (next.categoryId !== null) params.set("category_id", String(next.categoryId));
      if (next.accountId !== null) params.set("account_id", String(next.accountId));
      if (next.amount.trim()) params.set("amount", next.amount);
      if (next.nextExpectedDateFrom) params.set("from", next.nextExpectedDateFrom);
      if (next.nextExpectedDateTo) params.set("to", next.nextExpectedDateTo);
      if (page > 1) params.set("page", String(page));
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setFilters = useCallback(
    (
      next:
        | RecurringIncomeTableFilters
        | ((currentValue: RecurringIncomeTableFilters) => RecurringIncomeTableFilters),
    ) => {
      const value = typeof next === "function" ? next(filters) : next;
      writeFiltersToParams(value, 1);
    },
    [filters, writeFiltersToParams],
  );

  const setCurrentPage = useCallback(
    (page: number) => writeFiltersToParams(filters, page),
    [filters, writeFiltersToParams],
  );

  const updateFilter = useCallback(
    <Field extends keyof RecurringIncomeTableFilters>(field: Field, value: RecurringIncomeTableFilters[Field]) => {
      setFilters((current) => ({ ...current, [field]: value }));
    },
    [setFilters],
  );

  const updateFilters = useCallback((patch: Partial<RecurringIncomeTableFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, [setFilters]);

  const clearFilters = useCallback(() => {
    setFilters(defaultRecurringIncomeTableFilters());
  }, [setFilters]);

  return {
    filters,
    currentPage,
    setCurrentPage,
    updateFilter,
    updateFilters,
    clearFilters,
  };
}
