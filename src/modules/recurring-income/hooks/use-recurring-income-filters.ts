import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  defaultRecurringIncomeTableFilters,
  type RecurringIncomeTableFilterField,
  type RecurringIncomeTableFilters,
} from "../lib/recurring-income-filters";

/**
 * Estado de filtros + paginación de ingresos recurrentes, persistido en la URL
 * (q, payer, freq, status, cat, account, amount, from, to, page). Cambiar un
 * filtro resetea a la página 1. Gestiona el menú de filtro por columna abierto y
 * limpia los filtros solo-tabla al salir de esa vista.
 */
export function useRecurringIncomeFilters(viewMode: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<RecurringIncomeTableFilters>(() => {
    const defaults = defaultRecurringIncomeTableFilters();
    const freqParam = searchParams.get("freq");
    const statusParam = searchParams.get("status");

    return {
      name: searchParams.get("q") ?? defaults.name,
      payer: searchParams.get("payer") ?? defaults.payer,
      frequency: (freqParam as RecurringIncomeTableFilters["frequency"]) || "all",
      status: (statusParam as RecurringIncomeTableFilters["status"]) || "all",
      category: searchParams.get("cat") ?? defaults.category,
      account: searchParams.get("account") ?? defaults.account,
      amount: searchParams.get("amount") ?? defaults.amount,
      nextExpectedDateFrom: searchParams.get("from") ?? defaults.nextExpectedDateFrom,
      nextExpectedDateTo: searchParams.get("to") ?? defaults.nextExpectedDateTo,
    };
  }, [searchParams]);

  const currentPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const writeFiltersToParams = useCallback(
    (next: RecurringIncomeTableFilters, page: number) => {
      const params = new URLSearchParams();
      if (next.name.trim()) params.set("q", next.name);
      if (next.payer.trim()) params.set("payer", next.payer);
      if (next.frequency !== "all") params.set("freq", next.frequency);
      if (next.status !== "all") params.set("status", next.status);
      if (next.category.trim()) params.set("cat", next.category);
      if (next.account.trim()) params.set("account", next.account);
      if (next.amount.trim()) params.set("amount", next.amount);
      if (next.nextExpectedDateFrom) params.set("from", next.nextExpectedDateFrom);
      if (next.nextExpectedDateTo) params.set("to", next.nextExpectedDateTo);
      if (page > 1) params.set("page", String(page));
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
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

  const [openTableFilter, setOpenTableFilter] = useState<RecurringIncomeTableFilterField | null>(null);

  // Los filtros por columna (payer/category/account/amount/fechas) solo aplican a
  // la tabla: al cambiar a lista/grid se cierran y se limpian.
  useEffect(() => {
    if (viewMode === "table") {
      return;
    }

    setOpenTableFilter(null);
    setFilters((currentValue) => {
      if (
        !currentValue.payer &&
        !currentValue.category &&
        !currentValue.account &&
        !currentValue.amount &&
        !currentValue.nextExpectedDateFrom &&
        !currentValue.nextExpectedDateTo
      ) {
        return currentValue;
      }

      return {
        ...currentValue,
        payer: "",
        category: "",
        account: "",
        amount: "",
        nextExpectedDateFrom: "",
        nextExpectedDateTo: "",
      };
    });
  }, [viewMode, setFilters]);

  const updateFilter = useCallback(
    <Field extends keyof RecurringIncomeTableFilters>(field: Field, value: RecurringIncomeTableFilters[Field]) => {
      setFilters((current) => ({ ...current, [field]: value }));
    },
    [setFilters],
  );

  const clearFilters = useCallback(() => {
    setFilters(defaultRecurringIncomeTableFilters());
    setOpenTableFilter(null);
  }, [setFilters]);

  const toggleTableFilterMenu = useCallback((field: RecurringIncomeTableFilterField) => {
    setOpenTableFilter((current) => (current === field ? null : field));
  }, []);

  const closeTableFilterMenu = useCallback(() => setOpenTableFilter(null), []);

  const clearSingleTableFilter = useCallback(
    (field: RecurringIncomeTableFilterField) => {
      updateFilter(field, defaultRecurringIncomeTableFilters()[field]);
    },
    [updateFilter],
  );

  const applyFilterAndClose = useCallback(
    <Field extends RecurringIncomeTableFilterField>(field: Field, value: RecurringIncomeTableFilters[Field]) => {
      updateFilter(field, value);
      setOpenTableFilter(null);
    },
    [updateFilter],
  );

  return {
    filters,
    currentPage,
    setCurrentPage,
    openTableFilter,
    updateFilter,
    clearFilters,
    toggleTableFilterMenu,
    closeTableFilterMenu,
    clearSingleTableFilter,
    applyFilterAndClose,
  };
}
