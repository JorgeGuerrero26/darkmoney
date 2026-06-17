import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  defaultNotificationTableFilters,
  type NotificationSourceFilter,
  type NotificationStatusFilter,
  type NotificationTableFilterField,
  type NotificationTableFilters,
} from "../lib/notifications-filters";

/**
 * Estado de filtros + paginación de notificaciones, persistido en la URL
 * (q, src, status, kind, channel, from, to, page). Busqueda, origen y estado
 * aplican a todas las vistas; los solo-tabla (kind, channel, fechas) se limpian
 * al salir de esa vista. Cambiar un filtro resetea a la página 1.
 */
export function useNotificationsFilters(viewMode: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<NotificationTableFilters>(() => {
    const defaults = defaultNotificationTableFilters();
    const sourceParam = searchParams.get("src");
    const statusParam = searchParams.get("status");

    return {
      title: searchParams.get("q") ?? defaults.title,
      source: (sourceParam as NotificationSourceFilter) || "all",
      status: (statusParam as NotificationStatusFilter) || "all",
      kind: searchParams.get("kind") ?? defaults.kind,
      channel: searchParams.get("channel") ?? defaults.channel,
      scheduledFrom: searchParams.get("from") ?? defaults.scheduledFrom,
      scheduledTo: searchParams.get("to") ?? defaults.scheduledTo,
    };
  }, [searchParams]);

  const currentPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const writeFiltersToParams = useCallback(
    (next: NotificationTableFilters, page: number) => {
      const params = new URLSearchParams();
      if (next.title.trim()) params.set("q", next.title);
      if (next.source !== "all") params.set("src", next.source);
      if (next.status !== "all") params.set("status", next.status);
      if (next.kind.trim()) params.set("kind", next.kind);
      if (next.channel.trim()) params.set("channel", next.channel);
      if (next.scheduledFrom) params.set("from", next.scheduledFrom);
      if (next.scheduledTo) params.set("to", next.scheduledTo);
      if (page > 1) params.set("page", String(page));
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const setFilters = useCallback(
    (next: NotificationTableFilters | ((currentValue: NotificationTableFilters) => NotificationTableFilters)) => {
      const value = typeof next === "function" ? next(filters) : next;
      writeFiltersToParams(value, 1);
    },
    [filters, writeFiltersToParams],
  );

  const setCurrentPage = useCallback(
    (page: number) => writeFiltersToParams(filters, page),
    [filters, writeFiltersToParams],
  );

  const [openTableFilter, setOpenTableFilter] = useState<NotificationTableFilterField | null>(null);

  useEffect(() => {
    if (viewMode === "table") {
      return;
    }

    setOpenTableFilter(null);
    setFilters((currentValue) => {
      if (!currentValue.kind && !currentValue.channel && !currentValue.scheduledFrom && !currentValue.scheduledTo) {
        return currentValue;
      }

      return {
        ...currentValue,
        kind: "",
        channel: "",
        scheduledFrom: "",
        scheduledTo: "",
      };
    });
  }, [viewMode, setFilters]);

  const updateFilter = useCallback(
    <Field extends keyof NotificationTableFilters>(field: Field, value: NotificationTableFilters[Field]) => {
      setFilters((current) => ({ ...current, [field]: value }));
    },
    [setFilters],
  );

  const clearFilters = useCallback(() => {
    setFilters(defaultNotificationTableFilters());
    setOpenTableFilter(null);
  }, [setFilters]);

  const toggleTableFilterMenu = useCallback((field: NotificationTableFilterField) => {
    setOpenTableFilter((current) => (current === field ? null : field));
  }, []);

  const closeTableFilterMenu = useCallback(() => setOpenTableFilter(null), []);

  const clearSingleTableFilter = useCallback(
    (field: NotificationTableFilterField) => {
      updateFilter(field, defaultNotificationTableFilters()[field]);
    },
    [updateFilter],
  );

  const applyFilterAndClose = useCallback(
    <Field extends NotificationTableFilterField>(field: Field, value: NotificationTableFilters[Field]) => {
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
