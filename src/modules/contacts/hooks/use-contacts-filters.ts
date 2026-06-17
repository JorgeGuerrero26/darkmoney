import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  defaultContactTableFilters,
  type ContactStatusFilter,
  type ContactTableFilterField,
  type ContactTableFilters,
  type ContactTypeFilter,
  type RoleFilter,
} from "../lib/contacts-filters";

/**
 * Estado de filtros + paginación de contactos, persistido en la URL
 * (q, type, role, status, recv, pay, page). El estado por defecto muestra solo
 * activos. Cambiar un filtro resetea a la página 1. Los filtros solo-tabla
 * (type/recv/pay) se limpian al salir de esa vista.
 */
export function useContactsFilters(viewMode: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ContactTableFilters>(() => {
    const defaults = defaultContactTableFilters();
    const typeParam = searchParams.get("type");
    const roleParam = searchParams.get("role");
    const statusParam = searchParams.get("status");

    return {
      name: searchParams.get("q") ?? defaults.name,
      type: (typeParam as ContactTypeFilter) || "all",
      role: (roleParam as RoleFilter) || "all",
      status: (statusParam as ContactStatusFilter) || "active",
      receivable: searchParams.get("recv") ?? defaults.receivable,
      payable: searchParams.get("pay") ?? defaults.payable,
    };
  }, [searchParams]);

  const currentPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const writeFiltersToParams = useCallback(
    (next: ContactTableFilters, page: number) => {
      const params = new URLSearchParams();
      if (next.name.trim()) params.set("q", next.name);
      if (next.type !== "all") params.set("type", next.type);
      if (next.role !== "all") params.set("role", next.role);
      if (next.status !== "active") params.set("status", next.status);
      if (next.receivable.trim()) params.set("recv", next.receivable);
      if (next.payable.trim()) params.set("pay", next.payable);
      if (page > 1) params.set("page", String(page));
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const setFilters = useCallback(
    (next: ContactTableFilters | ((currentValue: ContactTableFilters) => ContactTableFilters)) => {
      const value = typeof next === "function" ? next(filters) : next;
      writeFiltersToParams(value, 1);
    },
    [filters, writeFiltersToParams],
  );

  const setCurrentPage = useCallback(
    (page: number) => writeFiltersToParams(filters, page),
    [filters, writeFiltersToParams],
  );

  const [openTableFilter, setOpenTableFilter] = useState<ContactTableFilterField | null>(null);

  useEffect(() => {
    if (viewMode === "table") {
      return;
    }

    setOpenTableFilter(null);
    setFilters((currentValue) => {
      if (currentValue.type === "all" && currentValue.receivable === "" && currentValue.payable === "") {
        return currentValue;
      }

      return {
        ...currentValue,
        type: "all",
        receivable: "",
        payable: "",
      };
    });
  }, [viewMode, setFilters]);

  const updateFilter = useCallback(
    <Field extends keyof ContactTableFilters>(field: Field, value: ContactTableFilters[Field]) => {
      setFilters((current) => ({ ...current, [field]: value }));
    },
    [setFilters],
  );

  const clearFilters = useCallback(() => {
    setFilters(defaultContactTableFilters());
    setOpenTableFilter(null);
  }, [setFilters]);

  const toggleTableFilterMenu = useCallback((field: ContactTableFilterField) => {
    setOpenTableFilter((current) => (current === field ? null : field));
  }, []);

  const closeTableFilterMenu = useCallback(() => setOpenTableFilter(null), []);

  const clearSingleTableFilter = useCallback(
    (field: ContactTableFilterField) => {
      updateFilter(field, defaultContactTableFilters()[field]);
    },
    [updateFilter],
  );

  const applyFilterAndClose = useCallback(
    <Field extends ContactTableFilterField>(field: Field, value: ContactTableFilters[Field]) => {
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
