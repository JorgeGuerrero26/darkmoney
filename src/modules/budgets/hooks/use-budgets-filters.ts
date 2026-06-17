import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  defaultBudgetTableFilters,
  type BudgetTableFilterField,
  type BudgetTableFilters,
  type ScopeFilter,
  type StatusFilter,
} from "../lib/budgets-filters";

/**
 * Estado de filtros + paginación de presupuestos, persistido en la URL
 * (q, scope, status, hist, period, limit, spent, remaining, page). Cambiar un
 * filtro resetea a la página 1. Gestiona el menú de filtro por columna abierto y
 * limpia los filtros solo-tabla al salir de esa vista.
 */
export function useBudgetsFilters(viewMode: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<BudgetTableFilters>(() => {
    const defaults = defaultBudgetTableFilters();
    const scopeParam = searchParams.get("scope");
    const statusParam = searchParams.get("status");

    return {
      name: searchParams.get("q") ?? defaults.name,
      scope: (scopeParam as ScopeFilter) || "all",
      status: (statusParam as StatusFilter) || "all",
      currentOnly: searchParams.get("hist") !== "1",
      period: searchParams.get("period") ?? defaults.period,
      limit: searchParams.get("limit") ?? defaults.limit,
      spent: searchParams.get("spent") ?? defaults.spent,
      remaining: searchParams.get("remaining") ?? defaults.remaining,
    };
  }, [searchParams]);

  const currentPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const writeFiltersToParams = useCallback(
    (next: BudgetTableFilters, page: number) => {
      const params = new URLSearchParams();
      if (next.name.trim()) params.set("q", next.name);
      if (next.scope !== "all") params.set("scope", next.scope);
      if (next.status !== "all") params.set("status", next.status);
      if (!next.currentOnly) params.set("hist", "1");
      if (next.period.trim()) params.set("period", next.period);
      if (next.limit.trim()) params.set("limit", next.limit);
      if (next.spent.trim()) params.set("spent", next.spent);
      if (next.remaining.trim()) params.set("remaining", next.remaining);
      if (page > 1) params.set("page", String(page));
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const setFilters = useCallback(
    (next: BudgetTableFilters | ((currentValue: BudgetTableFilters) => BudgetTableFilters)) => {
      const value = typeof next === "function" ? next(filters) : next;
      writeFiltersToParams(value, 1);
    },
    [filters, writeFiltersToParams],
  );

  const setCurrentPage = useCallback(
    (page: number) => writeFiltersToParams(filters, page),
    [filters, writeFiltersToParams],
  );

  const [openTableFilter, setOpenTableFilter] = useState<BudgetTableFilterField | null>(null);

  // Los filtros por columna (period/limit/spent/remaining) solo aplican a la
  // tabla: al cambiar a lista/grid se cierran y se limpian.
  useEffect(() => {
    if (viewMode === "table") {
      return;
    }

    setOpenTableFilter(null);
    setFilters((currentValue) => {
      if (
        !currentValue.period &&
        !currentValue.limit &&
        !currentValue.spent &&
        !currentValue.remaining
      ) {
        return currentValue;
      }

      return {
        ...currentValue,
        period: "",
        limit: "",
        spent: "",
        remaining: "",
      };
    });
  }, [viewMode, setFilters]);

  const updateFilter = useCallback(
    <Field extends keyof BudgetTableFilters>(field: Field, value: BudgetTableFilters[Field]) => {
      setFilters((current) => ({ ...current, [field]: value }));
    },
    [setFilters],
  );

  const clearFilters = useCallback(() => {
    setFilters(defaultBudgetTableFilters());
    setOpenTableFilter(null);
  }, [setFilters]);

  const toggleTableFilterMenu = useCallback((field: BudgetTableFilterField) => {
    setOpenTableFilter((current) => (current === field ? null : field));
  }, []);

  const closeTableFilterMenu = useCallback(() => setOpenTableFilter(null), []);

  const clearSingleTableFilter = useCallback(
    (field: BudgetTableFilterField) => {
      updateFilter(field, defaultBudgetTableFilters()[field]);
    },
    [updateFilter],
  );

  const applyFilterAndClose = useCallback(
    <Field extends BudgetTableFilterField>(field: Field, value: BudgetTableFilters[Field]) => {
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
