import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  defaultSubscriptionTableFilters,
  type SubscriptionTableFilterField,
  type SubscriptionTableFilters,
} from "../lib/subscriptions-filters";

/**
 * Estado de filtros + paginación de suscripciones, persistido en la URL
 * (q, vendor, freq, status, cat, account, amount, from, to, page). Cambiar un
 * filtro resetea a la página 1. Gestiona el menú de filtro por columna abierto y
 * limpia los filtros solo-tabla al salir de esa vista.
 */
export function useSubscriptionsFilters(viewMode: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<SubscriptionTableFilters>(() => {
    const defaults = defaultSubscriptionTableFilters();
    const freqParam = searchParams.get("freq");
    const statusParam = searchParams.get("status");

    return {
      name: searchParams.get("q") ?? defaults.name,
      vendor: searchParams.get("vendor") ?? defaults.vendor,
      frequency: (freqParam as SubscriptionTableFilters["frequency"]) || "all",
      status: (statusParam as SubscriptionTableFilters["status"]) || "all",
      category: searchParams.get("cat") ?? defaults.category,
      account: searchParams.get("account") ?? defaults.account,
      amount: searchParams.get("amount") ?? defaults.amount,
      nextDueDateFrom: searchParams.get("from") ?? defaults.nextDueDateFrom,
      nextDueDateTo: searchParams.get("to") ?? defaults.nextDueDateTo,
    };
  }, [searchParams]);

  const currentPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const writeFiltersToParams = useCallback(
    (next: SubscriptionTableFilters, page: number) => {
      const params = new URLSearchParams();
      if (next.name.trim()) params.set("q", next.name);
      if (next.vendor.trim()) params.set("vendor", next.vendor);
      if (next.frequency !== "all") params.set("freq", next.frequency);
      if (next.status !== "all") params.set("status", next.status);
      if (next.category.trim()) params.set("cat", next.category);
      if (next.account.trim()) params.set("account", next.account);
      if (next.amount.trim()) params.set("amount", next.amount);
      if (next.nextDueDateFrom) params.set("from", next.nextDueDateFrom);
      if (next.nextDueDateTo) params.set("to", next.nextDueDateTo);
      if (page > 1) params.set("page", String(page));
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const setFilters = useCallback(
    (
      next:
        | SubscriptionTableFilters
        | ((currentValue: SubscriptionTableFilters) => SubscriptionTableFilters),
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

  const [openTableFilter, setOpenTableFilter] = useState<SubscriptionTableFilterField | null>(null);

  // Los filtros por columna (vendor/category/account/amount/fechas) solo aplican a
  // la tabla: al cambiar a lista/grid se cierran y se limpian.
  useEffect(() => {
    if (viewMode === "table") {
      return;
    }

    setOpenTableFilter(null);
    setFilters((currentValue) => {
      if (
        !currentValue.vendor &&
        !currentValue.category &&
        !currentValue.account &&
        !currentValue.amount &&
        !currentValue.nextDueDateFrom &&
        !currentValue.nextDueDateTo
      ) {
        return currentValue;
      }

      return {
        ...currentValue,
        vendor: "",
        category: "",
        account: "",
        amount: "",
        nextDueDateFrom: "",
        nextDueDateTo: "",
      };
    });
  }, [viewMode, setFilters]);

  const updateFilter = useCallback(
    <Field extends keyof SubscriptionTableFilters>(field: Field, value: SubscriptionTableFilters[Field]) => {
      setFilters((current) => ({ ...current, [field]: value }));
    },
    [setFilters],
  );

  const clearFilters = useCallback(() => {
    setFilters(defaultSubscriptionTableFilters());
    setOpenTableFilter(null);
  }, [setFilters]);

  const toggleTableFilterMenu = useCallback((field: SubscriptionTableFilterField) => {
    setOpenTableFilter((current) => (current === field ? null : field));
  }, []);

  const closeTableFilterMenu = useCallback(() => setOpenTableFilter(null), []);

  const clearSingleTableFilter = useCallback(
    (field: SubscriptionTableFilterField) => {
      updateFilter(field, defaultSubscriptionTableFilters()[field]);
    },
    [updateFilter],
  );

  const applyFilterAndClose = useCallback(
    <Field extends SubscriptionTableFilterField>(field: Field, value: SubscriptionTableFilters[Field]) => {
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
