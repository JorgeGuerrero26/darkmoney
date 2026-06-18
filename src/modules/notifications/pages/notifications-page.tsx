import { CheckCheck, CheckCircle2, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { ColumnPicker, type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { DataState } from "../../../components/ui/data-state";
import { InfoTip } from "../../../components/ui/info-tip";
import { Pagination } from "../../../components/ui/pagination";
import { SearchablePicker } from "../../../components/ui/searchable-picker";
import { StatusBadge } from "../../../components/ui/status-badge";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { formatNotificationKindLabel } from "../../../lib/formatting/labels";
import { useAuth } from "../../auth/auth-context";
import { isActionRequiredNotificationKind, useNotificationInbox, type InboxNotification } from "../use-notification-inbox";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  getQueryErrorMessage,
  useCurrentUserEntitlementQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  usePendingNotificationInvitesQuery,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import { NotificationCard } from "../components/notification-card";
import { NotificationTable } from "../components/notification-table";
import { useNotificationsFilters } from "../hooks/use-notifications-filters";
import type { NotificationSourceFilter, NotificationStatusFilter } from "../lib/notifications-filters";
import { sourceFilterPickerOptions, statusFilterPickerOptions } from "../lib/notifications-presenters";

const NOTIFICATIONS_PAGE_SIZE = 50;

const notificationColumns: ColumnDef[] = [
  { key: "tipo", label: "Tipo" },
  { key: "origen", label: "Origen" },
  { key: "canal", label: "Canal" },
  { key: "programada", label: "Programada" },
  { key: "estado", label: "Estado" },
];

function NotificationsSummaryChip({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "info" | "warning" | "success";
  value: string;
}) {
  const valueTone = {
    neutral: "text-ink",
    info: "text-ember",
    warning: "text-gold",
    success: "text-pine",
  } as const;

  return (
    <article className="glass-panel-soft min-w-0 rounded-[24px] p-4 transition duration-300 hover:border-white/15">
      <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-storm/80">{label}</p>
      <p className={`mt-2 truncate font-display text-2xl font-semibold leading-tight ${valueTone[tone]}`}>{value}</p>
    </article>
  );
}

export function NotificationsPage() {
  const { profile, user } = useAuth();
  const { activeWorkspace } = useActiveWorkspace();
  const notificationsQuery = useNotificationsQuery(user?.id);
  const pendingInvitesQuery = usePendingNotificationInvitesQuery(user?.id);
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const entitlementQuery = useCurrentUserEntitlementQuery(user?.id);
  const markAllReadMutation = useMarkAllNotificationsReadMutation(user?.id);
  const markSingleReadMutation = useMarkNotificationReadMutation(user?.id);
  const [viewMode, setViewMode] = useViewMode("notifications", "table");
  const {
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
  } = useNotificationsFilters(viewMode);
  const { visible: colVis, toggle: toggleCol, cv } = useColumnVisibility("notifications-table", notificationColumns);

  const inbox = useNotificationInbox({
    databaseNotifications: notificationsQuery.data ?? [],
    entitlement: entitlementQuery.data,
    pendingObligationShares: pendingInvitesQuery.data?.obligationShares,
    pendingWorkspaceInvitations: pendingInvitesQuery.data?.workspaceInvitations,
    snapshot: snapshotQuery.data,
    workspaceName: activeWorkspace?.name,
  });

  const availableKinds = useMemo(
    () =>
      Array.from(new Set(inbox.notifications.map((notification) => notification.kind.trim()).filter(Boolean))).sort(
        (left, right) => formatNotificationKindLabel(left).localeCompare(formatNotificationKindLabel(right)),
      ),
    [inbox.notifications],
  );

  const availableChannels = useMemo(
    () =>
      Array.from(new Set(inbox.notifications.map((notification) => (notification.channel ?? "").trim()).filter(Boolean))).sort(
        (left, right) => left.localeCompare(right),
      ),
    [inbox.notifications],
  );

  const filteredNotifications = useMemo(() => {
    const normalizedSearch = filters.title.trim().toLowerCase();

    return inbox.notifications.filter((notification) => {
      if (filters.source !== "all" && notification.source !== filters.source) {
        return false;
      }

      if (filters.status !== "all" && notification.status !== filters.status) {
        return false;
      }

      if (normalizedSearch) {
        const searchableText = `${notification.title} ${notification.body} ${formatNotificationKindLabel(notification.kind)} ${notification.channel ?? ""}`.toLowerCase();
        if (!searchableText.includes(normalizedSearch)) {
          return false;
        }
      }

      if (filters.kind && notification.kind !== filters.kind) {
        return false;
      }

      if (filters.channel && (notification.channel?.trim() ?? "") !== filters.channel) {
        return false;
      }

      const scheduledDate = notification.scheduledFor.slice(0, 10);
      if (filters.scheduledFrom && scheduledDate < filters.scheduledFrom) {
        return false;
      }
      if (filters.scheduledTo && scheduledDate > filters.scheduledTo) {
        return false;
      }

      return true;
    });
  }, [filters, inbox.notifications]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / NOTIFICATIONS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedNotifications = useMemo(
    () => filteredNotifications.slice((safePage - 1) * NOTIFICATIONS_PAGE_SIZE, safePage * NOTIFICATIONS_PAGE_SIZE),
    [filteredNotifications, safePage],
  );

  const hasActiveFilters =
    filters.title.trim() !== "" ||
    filters.source !== "all" ||
    filters.status !== "all" ||
    filters.kind.trim() !== "" ||
    filters.channel.trim() !== "" ||
    filters.scheduledFrom !== "" ||
    filters.scheduledTo !== "";

  const isUpdatingReadState = markAllReadMutation.isPending || markSingleReadMutation.isPending;
  const isFetching = snapshotQuery.isFetching || notificationsQuery.isFetching || pendingInvitesQuery.isFetching;

  async function handleMarkAllRead() {
    if (inbox.unreadDatabaseCount > 0) {
      await markAllReadMutation.mutateAsync();
    }

    if (inbox.unreadSmartCount > 0) {
      inbox.markSmartNotificationsAsRead();
    }
  }

  async function handleMarkOneRead(notificationId: string, databaseId?: number) {
    if (notificationId.startsWith("db:") && databaseId) {
      await markSingleReadMutation.mutateAsync(databaseId);
      return;
    }

    inbox.markSmartNotificationsAsRead([notificationId]);
  }

  // --- Selección múltiple + acciones masivas (web) ---
  const notificationById = useMemo(() => {
    const map = new Map<string, InboxNotification>();
    for (const notification of inbox.notifications) {
      map.set(notification.id, notification);
    }
    return map;
  }, [inbox.notifications]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Limpia de la selección los ids que ya no existen (p. ej. tras marcar leídas).
  useEffect(() => {
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (notificationById.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [notificationById]);

  const pageIds = paginatedNotifications.map((notification) => notification.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && pageIds.some((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pageIds.every((id) => next.has(id))) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const selectedMarkableCount = Array.from(selectedIds).filter((id) => {
    const notification = notificationById.get(id);
    if (!notification || notification.status === "read") {
      return false;
    }
    return !(notification.source === "smart" && isActionRequiredNotificationKind(notification.kind));
  }).length;

  async function handleMarkSelectedRead() {
    const selected = Array.from(selectedIds)
      .map((id) => notificationById.get(id))
      .filter((notification): notification is InboxNotification => Boolean(notification));

    const databaseIds = selected
      .filter((notification) => notification.source === "database" && notification.status !== "read" && notification.databaseId)
      .map((notification) => notification.databaseId as number);
    const smartIds = selected
      .filter(
        (notification) =>
          notification.source === "smart" &&
          notification.status !== "read" &&
          !isActionRequiredNotificationKind(notification.kind),
      )
      .map((notification) => notification.id);

    for (const databaseId of databaseIds) {
      await markSingleReadMutation.mutateAsync(databaseId);
    }
    if (smartIds.length > 0) {
      inbox.markSmartNotificationsAsRead(smartIds);
    }

    clearSelection();
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header compacto (estándar) */}
      <section className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine/80">Notificaciones</p>
        <div className="mt-1 flex items-center gap-2.5">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">Bandeja personal</h2>
          <InfoTip ariaLabel="Sobre las notificaciones">
            Pendientes, recordatorios y alertas inteligentes de tu cuenta. Los filtros de la barra superior aplican a
            todas las vistas.
          </InfoTip>
        </div>
        <p className="mt-1 text-xs text-storm">Alertas guardadas y recordatorios inteligentes del workspace activo.</p>
      </section>

      {/* Métricas compactas */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
        <NotificationsSummaryChip label="pendientes" tone="warning" value={String(inbox.unreadCount)} />
        <NotificationsSummaryChip label="inteligentes" tone="success" value={String(inbox.unreadSmartCount)} />
        <NotificationsSummaryChip label="guardadas" tone="info" value={String(inbox.unreadDatabaseCount)} />
        <NotificationsSummaryChip label="visibles" value={String(filteredNotifications.length)} />
      </div>

      {/* Toolbar sticky (estándar) */}
      <section className="sticky top-3 z-30 rounded-[24px] border border-white/10 bg-canvas/85 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <ViewSelector available={["grid", "list", "table"]} onChange={setViewMode} value={viewMode} />
          {viewMode === "table" ? <ColumnPicker columns={notificationColumns} visible={colVis} onToggle={toggleCol} /> : null}
          <StatusBadge status={`${filteredNotifications.length} visibles`} tone="neutral" />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-storm transition hover:border-white/16 hover:text-ink disabled:opacity-50"
              disabled={isFetching}
              onClick={() => {
                void snapshotQuery.refetch();
                void notificationsQuery.refetch();
                void pendingInvitesQuery.refetch();
              }}
              title="Actualizar"
              type="button"
            >
              <RefreshCw className={`h-4 w-4${isFetching ? " animate-spin" : ""}`} />
            </button>
            {hasActiveFilters ? (
              <Button onClick={clearFilters} variant="ghost">
                <X className="mr-2 h-4 w-4" />
                Limpiar
              </Button>
            ) : null}
            <Button disabled={inbox.unreadCount === 0 || isUpdatingReadState} onClick={() => void handleMarkAllRead()} variant="ghost">
              <CheckCheck className="mr-2 h-4 w-4" />
              {isUpdatingReadState ? "Actualizando..." : "Marcar pendientes"}
            </Button>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-storm transition hover:border-white/18 hover:bg-white/[0.07] hover:text-ink"
              to="/app/settings"
            >
              Ajustes
            </Link>
          </div>
        </div>

        {/* Filtros principales: siempre visibles (aplican a todas las vistas) */}
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <input
            className="field-dark"
            onChange={(event) => updateFilter("title", event.target.value)}
            placeholder="Buscar por titulo, detalle, tipo o canal..."
            type="text"
            value={filters.title}
          />
          <SearchablePicker
            emptyMessage="No hay origenes para mostrar."
            onChange={(value) => updateFilter("source", value as NotificationSourceFilter)}
            options={sourceFilterPickerOptions}
            placeholderDescription="Filtra por origen."
            placeholderLabel="Origen"
            queryPlaceholder="Buscar origen..."
            value={filters.source}
          />
          <SearchablePicker
            emptyMessage="No hay estados para mostrar."
            onChange={(value) => updateFilter("status", value as NotificationStatusFilter)}
            options={statusFilterPickerOptions}
            placeholderDescription="Filtra por estado."
            placeholderLabel="Estado"
            queryPlaceholder="Buscar estado..."
            value={filters.status}
          />
        </div>
      </section>

      {notificationsQuery.isLoading && !notificationsQuery.data && snapshotQuery.isLoading ? (
        <DataState
          description="Estamos reuniendo tu bandeja guardada y los recordatorios del workspace activo."
          title="Preparando notificaciones"
        />
      ) : notificationsQuery.error ? (
        <DataState
          description={getQueryErrorMessage(notificationsQuery.error, "No pudimos leer las notificaciones guardadas.")}
          title="No fue posible cargar la bandeja"
          tone="error"
        />
      ) : filteredNotifications.length === 0 ? (
        <DataState
          action={
            hasActiveFilters ? (
              <Button onClick={clearFilters} variant="secondary">
                Quitar filtros
              </Button>
            ) : undefined
          }
          description={
            inbox.notifications.length === 0
              ? "Aun no hay alertas guardadas ni recordatorios inteligentes activos."
              : "No hubo coincidencias con el filtro o la busqueda actual."
          }
          title={inbox.notifications.length === 0 ? "Tu bandeja esta vacia" : "No encontramos coincidencias"}
        />
      ) : viewMode === "table" ? (
        <NotificationTable
          availableChannels={availableChannels}
          availableKinds={availableKinds}
          allSelected={allSelected}
          cv={cv}
          filters={filters}
          isUpdatingReadState={isUpdatingReadState}
          notifications={paginatedNotifications}
          onApplyFilterAndClose={applyFilterAndClose}
          onClearSingleFilter={clearSingleTableFilter}
          onCloseFilterMenu={closeTableFilterMenu}
          onMarkRead={(id, dbId) => void handleMarkOneRead(id, dbId)}
          onToggleFilterMenu={toggleTableFilterMenu}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onUpdateFilter={updateFilter}
          openFilter={openTableFilter}
          selectedIds={selectedIds}
          someSelected={someSelected}
        />
      ) : (
        <section className={viewMode === "grid" ? "grid gap-4 xl:grid-cols-2" : "grid gap-3"}>
          {paginatedNotifications.map((notification) => (
            <NotificationCard
              isUpdatingReadState={isUpdatingReadState}
              key={notification.id}
              notification={notification}
              onMarkRead={(id, dbId) => void handleMarkOneRead(id, dbId)}
              onToggleSelect={toggleSelect}
              selected={selectedIds.has(notification.id)}
            />
          ))}
        </section>
      )}

      {filteredNotifications.length > 0 ? (
        <Pagination
          onPageChange={setCurrentPage}
          page={safePage}
          pageSize={NOTIFICATIONS_PAGE_SIZE}
          totalItems={filteredNotifications.length}
        />
      ) : null}

      {selectedCount > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="glass-panel-strong pointer-events-auto flex flex-wrap items-center gap-3 rounded-full border border-white/10 px-4 py-2.5 shadow-haze">
            <span className="text-sm font-medium text-ink">
              {selectedCount} seleccionada{selectedCount !== 1 ? "s" : ""}
            </span>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-pine/25 bg-pine/10 px-3.5 py-1.5 text-sm font-semibold text-pine transition hover:bg-pine/15 disabled:opacity-40"
              disabled={selectedMarkableCount === 0 || isUpdatingReadState}
              onClick={() => void handleMarkSelectedRead()}
              type="button"
            >
              <CheckCircle2 className="h-4 w-4" />
              Marcar leídas{selectedMarkableCount > 0 ? ` (${selectedMarkableCount})` : ""}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm font-medium text-storm transition hover:border-white/16 hover:text-ink"
              onClick={clearSelection}
              type="button"
            >
              <X className="h-4 w-4" />
              Limpiar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
