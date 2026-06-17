import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  defaultCategoryTableFilters,
  type CategoryStatusFilter,
  type CategoryTableFilterField,
  type CategoryTableFilters,
  type KindFilter,
} from "../lib/categories-filters";

/**
 * Estado de filtros + paginación de categorías, persistido en la URL
 * (q, kind, status, parent, mov, subs, page). El estado por defecto muestra solo
 * activas. Cambiar un filtro resetea a la página 1. Los filtros solo-tabla
 * (parent/mov/subs) se limpian al salir de esa vista.
 */
export function useCategoriesFilters(viewMode: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<CategoryTableFilters>(() => {
    const defaults = defaultCategoryTableFilters();
    const kindParam = searchParams.get("kind");
    const statusParam = searchParams.get("status");

    return {
      name: searchParams.get("q") ?? defaults.name,
      kind: (kindParam as KindFilter) || "all",
      status: (statusParam as CategoryStatusFilter) || "active",
      parent: searchParams.get("parent") ?? defaults.parent,
      movements: searchParams.get("mov") ?? defaults.movements,
      subscriptions: searchParams.get("subs") ?? defaults.subscriptions,
    };
  }, [searchParams]);

  const currentPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const writeFiltersToParams = useCallback(
    (next: CategoryTableFilters, page: number) => {
      const params = new URLSearchParams();
      if (next.name.trim()) params.set("q", next.name);
      if (next.kind !== "all") params.set("kind", next.kind);
      if (next.status !== "active") params.set("status", next.status);
      if (next.parent.trim()) params.set("parent", next.parent);
      if (next.movements.trim()) params.set("mov", next.movements);
      if (next.subscriptions.trim()) params.set("subs", next.subscriptions);
      if (page > 1) params.set("page", String(page));
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const setFilters = useCallback(
    (next: CategoryTableFilters | ((currentValue: CategoryTableFilters) => CategoryTableFilters)) => {
      const value = typeof next === "function" ? next(filters) : next;
      writeFiltersToParams(value, 1);
    },
    [filters, writeFiltersToParams],
  );

  const setCurrentPage = useCallback(
    (page: number) => writeFiltersToParams(filters, page),
    [filters, writeFiltersToParams],
  );

  const [openTableFilter, setOpenTableFilter] = useState<CategoryTableFilterField | null>(null);

  useEffect(() => {
    if (viewMode === "table") {
      return;
    }

    setOpenTableFilter(null);
    setFilters((currentValue) => {
      if (!currentValue.parent && !currentValue.movements && !currentValue.subscriptions) {
        return currentValue;
      }

      return {
        ...currentValue,
        parent: "",
        movements: "",
        subscriptions: "",
      };
    });
  }, [viewMode, setFilters]);

  const updateFilter = useCallback(
    <Field extends keyof CategoryTableFilters>(field: Field, value: CategoryTableFilters[Field]) => {
      setFilters((current) => ({ ...current, [field]: value }));
    },
    [setFilters],
  );

  const clearFilters = useCallback(() => {
    setFilters(defaultCategoryTableFilters());
    setOpenTableFilter(null);
  }, [setFilters]);

  const toggleTableFilterMenu = useCallback((field: CategoryTableFilterField) => {
    setOpenTableFilter((current) => (current === field ? null : field));
  }, []);

  const closeTableFilterMenu = useCallback(() => setOpenTableFilter(null), []);

  const clearSingleTableFilter = useCallback(
    (field: CategoryTableFilterField) => {
      updateFilter(field, defaultCategoryTableFilters()[field]);
    },
    [updateFilter],
  );

  const applyFilterAndClose = useCallback(
    <Field extends CategoryTableFilterField>(field: Field, value: CategoryTableFilters[Field]) => {
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
