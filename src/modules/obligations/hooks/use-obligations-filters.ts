import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  defaultObligationTableFilters,
  type DirectionFilterValue,
  type ObligationTableFilterField,
  type ObligationTableFilters,
  type StatusFilterValue,
} from "../lib/obligations-filters";

/**
 * Estado de filtros + paginación de creditos y deudas, persistido en la URL
 * (q, cp, dir, status, pr, pe, page). Unifica los filtros que aplican a todas
 * las vistas (busqueda, direccion, estado) con los solo-tabla (contraparte,
 * principal, pendiente), que se limpian al salir de esa vista. Cambiar un filtro
 * resetea a la página 1.
 */
export function useObligationsFilters(viewMode: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ObligationTableFilters>(() => {
    const defaults = defaultObligationTableFilters();
    const dirParam = searchParams.get("dir");
    const statusParam = searchParams.get("status");

    return {
      title: searchParams.get("q") ?? defaults.title,
      counterparty: searchParams.get("cp") ?? defaults.counterparty,
      direction: (dirParam as DirectionFilterValue) || "all",
      status: (statusParam as StatusFilterValue) || "all",
      principal: searchParams.get("pr") ?? defaults.principal,
      pending: searchParams.get("pe") ?? defaults.pending,
    };
  }, [searchParams]);

  const currentPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const writeFiltersToParams = useCallback(
    (next: ObligationTableFilters, page: number) => {
      const params = new URLSearchParams();
      if (next.title.trim()) params.set("q", next.title);
      if (next.counterparty.trim()) params.set("cp", next.counterparty);
      if (next.direction !== "all") params.set("dir", next.direction);
      if (next.status !== "all") params.set("status", next.status);
      if (next.principal.trim()) params.set("pr", next.principal);
      if (next.pending.trim()) params.set("pe", next.pending);
      if (page > 1) params.set("page", String(page));
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const setFilters = useCallback(
    (next: ObligationTableFilters | ((currentValue: ObligationTableFilters) => ObligationTableFilters)) => {
      const value = typeof next === "function" ? next(filters) : next;
      writeFiltersToParams(value, 1);
    },
    [filters, writeFiltersToParams],
  );

  const setCurrentPage = useCallback(
    (page: number) => writeFiltersToParams(filters, page),
    [filters, writeFiltersToParams],
  );

  const [openTableFilter, setOpenTableFilter] = useState<ObligationTableFilterField | null>(null);

  useEffect(() => {
    if (viewMode === "table") {
      return;
    }

    setOpenTableFilter(null);
    setFilters((currentValue) => {
      if (!currentValue.counterparty && !currentValue.principal && !currentValue.pending) {
        return currentValue;
      }

      return {
        ...currentValue,
        counterparty: "",
        principal: "",
        pending: "",
      };
    });
  }, [viewMode, setFilters]);

  const updateFilter = useCallback(
    <Field extends keyof ObligationTableFilters>(field: Field, value: ObligationTableFilters[Field]) => {
      setFilters((current) => ({ ...current, [field]: value }));
    },
    [setFilters],
  );

  const clearFilters = useCallback(() => {
    setFilters(defaultObligationTableFilters());
    setOpenTableFilter(null);
  }, [setFilters]);

  const toggleTableFilterMenu = useCallback((field: ObligationTableFilterField) => {
    setOpenTableFilter((current) => (current === field ? null : field));
  }, []);

  const closeTableFilterMenu = useCallback(() => setOpenTableFilter(null), []);

  const clearSingleTableFilter = useCallback(
    (field: ObligationTableFilterField) => {
      updateFilter(field, defaultObligationTableFilters()[field]);
    },
    [updateFilter],
  );

  const applyFilterAndClose = useCallback(
    <Field extends ObligationTableFilterField>(field: Field, value: ObligationTableFilters[Field]) => {
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
