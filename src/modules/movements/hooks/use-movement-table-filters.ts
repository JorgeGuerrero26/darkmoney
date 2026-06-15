import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { MovementStatus, MovementType } from "../../../types/domain";
import {
  defaultMovementTableFilters,
  movementStatusOptions,
  movementTableFilterDefaults,
  movementTypeOptions,
} from "../lib/movement-form";
import type {
  MovementTableFilterField,
  MovementTableFilters,
} from "../lib/movement-form";

/**
 * Estado de filtros + paginación de movimientos, persistido en la URL
 * (q, type, status, cat, who, account, amount, from, to, page). Cambiar
 * cualquier filtro resetea a la página 1. También gestiona qué menú de filtro
 * por columna está abierto y limpia los filtros solo-tabla al salir de esa vista.
 */
export function useMovementTableFilters(viewMode: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const tableFilters = useMemo<MovementTableFilters>(() => {
    const defaults = defaultMovementTableFilters();
    const typeParam = searchParams.get("type");
    const statusParam = searchParams.get("status");

    return {
      description: searchParams.get("q") ?? defaults.description,
      type: movementTypeOptions.some((option) => option.value === typeParam)
        ? (typeParam as MovementType)
        : "all",
      status: movementStatusOptions.some((option) => option.value === statusParam)
        ? (statusParam as MovementStatus)
        : "all",
      category: searchParams.get("cat") ?? defaults.category,
      counterparty: searchParams.get("who") ?? defaults.counterparty,
      sourceAccount: searchParams.get("account") ?? defaults.sourceAccount,
      amount: searchParams.get("amount") ?? defaults.amount,
      dateFrom: searchParams.get("from") ?? defaults.dateFrom,
      dateTo: searchParams.get("to") ?? defaults.dateTo,
    };
  }, [searchParams]);

  const currentPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const writeFiltersToParams = useCallback(
    (filters: MovementTableFilters, page: number) => {
      const params = new URLSearchParams();
      if (filters.description.trim()) params.set("q", filters.description);
      if (filters.type !== "all") params.set("type", filters.type);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.category.trim()) params.set("cat", filters.category);
      if (filters.counterparty.trim()) params.set("who", filters.counterparty);
      if (filters.sourceAccount.trim()) params.set("account", filters.sourceAccount);
      if (filters.amount.trim()) params.set("amount", filters.amount);
      if (filters.dateFrom) params.set("from", filters.dateFrom);
      if (filters.dateTo) params.set("to", filters.dateTo);
      if (page > 1) params.set("page", String(page));
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const setTableFilters = useCallback(
    (
      next:
        | MovementTableFilters
        | ((currentValue: MovementTableFilters) => MovementTableFilters),
    ) => {
      const value = typeof next === "function" ? next(tableFilters) : next;
      // Cambiar filtros siempre vuelve a la página 1.
      writeFiltersToParams(value, 1);
    },
    [tableFilters, writeFiltersToParams],
  );

  const setCurrentPage = useCallback(
    (page: number) => writeFiltersToParams(tableFilters, page),
    [tableFilters, writeFiltersToParams],
  );

  const [openTableFilter, setOpenTableFilter] = useState<MovementTableFilterField | null>(null);

  // Los filtros por columna (cat/who/account/amount/fechas) solo aplican a la
  // tabla: al cambiar a lista/grid se cierran y se limpian.
  useEffect(() => {
    if (viewMode === "table") {
      return;
    }

    setOpenTableFilter(null);
    setTableFilters((currentValue) => {
      if (
        !currentValue.category &&
        !currentValue.counterparty &&
        !currentValue.sourceAccount &&
        !currentValue.amount &&
        !currentValue.dateFrom &&
        !currentValue.dateTo
      ) {
        return currentValue;
      }

      return {
        ...currentValue,
        category: "",
        counterparty: "",
        sourceAccount: "",
        amount: "",
        dateFrom: "",
        dateTo: "",
      };
    });
  }, [viewMode, setTableFilters]);

  const updateTableFilter = useCallback(
    <Field extends keyof MovementTableFilters>(field: Field, value: MovementTableFilters[Field]) => {
      setTableFilters((current) => ({ ...current, [field]: value }));
    },
    [setTableFilters],
  );

  const clearTableFilters = useCallback(() => {
    setTableFilters(defaultMovementTableFilters());
    setOpenTableFilter(null);
  }, [setTableFilters]);

  const toggleTableFilterMenu = useCallback((field: MovementTableFilterField) => {
    setOpenTableFilter((current) => (current === field ? null : field));
  }, []);

  const closeTableFilterMenu = useCallback(() => setOpenTableFilter(null), []);

  const clearSingleTableFilter = useCallback(
    (field: MovementTableFilterField) => {
      updateTableFilter(field, movementTableFilterDefaults[field]);
    },
    [updateTableFilter],
  );

  const applyTableFilterAndClose = useCallback(
    <Field extends MovementTableFilterField>(field: Field, value: MovementTableFilters[Field]) => {
      updateTableFilter(field, value);
      setOpenTableFilter(null);
    },
    [updateTableFilter],
  );

  return {
    tableFilters,
    currentPage,
    setCurrentPage,
    openTableFilter,
    updateTableFilter,
    clearTableFilters,
    toggleTableFilterMenu,
    closeTableFilterMenu,
    clearSingleTableFilter,
    applyTableFilterAndClose,
  };
}
