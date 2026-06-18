import { Archive, CheckCheck, CheckCircle2, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { ColumnPicker, type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { DataState } from "../../../components/ui/data-state";
import { InfoTip } from "../../../components/ui/info-tip";
import { SearchablePicker } from "../../../components/ui/searchable-picker";
import { StatusBadge } from "../../../components/ui/status-badge";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { formatNotificationKindLabel } from "../../../lib/formatting/labels";
import { useAuth } from "../../auth/auth-context";
import { isActionRequiredNotificationKind, useNotificationInbox, type InboxNotification } from "../use-notification-inbox";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  getQueryErrorMessage,
  useAcceptObligationShareMutation,
  useAcceptWorkspaceInvitationMutation,
  useArchiveNotificationsMutation,
  useCurrentUserEntitlementQuery,
  useDeleteNotificationsMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  usePendingNotificationInvitesQuery,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { NotificationCard } from "../components/notification-card";
import { NotificationTable } from "../components/notification-table";
import { useNotificationsFilters } from "../hooks/use-notifications-filters";
import type { NotificationSourceFilter, NotificationStatusFilter } from "../lib/notifications-filters";
import { groupNotificationsByDate, sourceFilterPickerOptions, statusFilterPickerOptions } from "../lib/notifications-presenters";

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
  const acceptObligationShareMutation = useAcceptObligationShareMutation(user?.id);
  const acceptWorkspaceInvitationMutation = useAcceptWorkspaceInvitationMutation(user?.id);
  const archiveNotificationsMutation = useArchiveNotificationsMutation(user?.id);
  const deleteNotificationsMutation = useDeleteNotificationsMutation(user?.id);
  const [viewMode, setViewMode] = useViewMode("notifications", "table");
  const [quickFilter, setQuickFilter] = useState<"all" | "unread" | "action" | "read" | "archived">("all");
  const [liveMessage, setLiveMessage] = useState("");

  function announce(count: number) {
    setLiveMessage(count === 1 ? "1 notificacion marcada como leida." : `${count} notificaciones marcadas como leidas.`);
  }
  const {
    filters,
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
      // Las archivadas solo se ven en su propia vista; el resto las oculta.
      if (quickFilter === "archived") {
        if (!notification.isArchived) {
          return false;
        }
      } else if (notification.isArchived) {
        return false;
      }

      if (quickFilter === "unread" && notification.status === "read") {
        return false;
      }
      if (quickFilter === "read" && notification.status !== "read") {
        return false;
      }
      if (quickFilter === "action" && !isActionRequiredNotificationKind(notification.kind)) {
        return false;
      }

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
  }, [filters, inbox.notifications, quickFilter]);

  // Scroll infinito: mostramos un lote y vamos cargando más al llegar al final.
  const [visibleCount, setVisibleCount] = useState(NOTIFICATIONS_PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(NOTIFICATIONS_PAGE_SIZE);
  }, [filters, quickFilter, viewMode]);
  const visibleNotifications = useMemo(
    () => filteredNotifications.slice(0, visibleCount),
    [filteredNotifications, visibleCount],
  );
  const canLoadMore = visibleCount < filteredNotifications.length;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!canLoadMore) {
      return;
    }
    const sentinel = loadMoreRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((current) => current + NOTIFICATIONS_PAGE_SIZE);
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, filteredNotifications.length]);

  const hasActiveFilters =
    quickFilter !== "all" ||
    filters.title.trim() !== "" ||
    filters.source !== "all" ||
    filters.status !== "all" ||
    filters.kind.trim() !== "" ||
    filters.channel.trim() !== "" ||
    filters.scheduledFrom !== "" ||
    filters.scheduledTo !== "";

  function clearAllFilters() {
    clearFilters();
    setQuickFilter("all");
  }

  const visibleUnreadCount = filteredNotifications.filter((notification) => {
    if (notification.status === "read") {
      return false;
    }
    return !(notification.source === "smart" && isActionRequiredNotificationKind(notification.kind));
  }).length;

  async function handleMarkVisibleRead() {
    const databaseIds = filteredNotifications
      .filter((notification) => notification.source === "database" && notification.status !== "read" && notification.databaseId)
      .map((notification) => notification.databaseId as number);
    const smartIds = filteredNotifications
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
    announce(databaseIds.length + smartIds.length);
  }

  const isUpdatingReadState = markAllReadMutation.isPending || markSingleReadMutation.isPending;
  const isFetching = snapshotQuery.isFetching || notificationsQuery.isFetching || pendingInvitesQuery.isFetching;

  async function handleMarkAllRead() {
    if (inbox.unreadDatabaseCount > 0) {
      await markAllReadMutation.mutateAsync();
    }

    if (inbox.unreadSmartCount > 0) {
      inbox.markSmartNotificationsAsRead();
    }
    announce(inbox.unreadCount);
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
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; title: string; description: string } | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  useSuccessToast(feedback, { clear: () => setFeedback(null) });

  async function handleAcceptInvite(notification: InboxNotification) {
    const token = notification.href.split("/").filter(Boolean).pop() ?? "";
    if (!token) {
      return;
    }

    const isWorkspaceInvite =
      notification.kind === "workspace_invite" || notification.href.includes("/share/workspaces/");

    setAcceptingId(notification.id);
    setFeedback(null);
    try {
      if (isWorkspaceInvite) {
        await acceptWorkspaceInvitationMutation.mutateAsync(token);
        setFeedback({
          tone: "success",
          title: "Invitacion aceptada",
          description: "Ya tienes acceso al workspace compartido.",
        });
      } else {
        const result = await acceptObligationShareMutation.mutateAsync(token);
        setFeedback({
          tone: "success",
          title: result.alreadyAccepted ? "Acceso ya confirmado" : "Invitacion aceptada",
          description: "El credito o deuda compartido ya esta disponible en tu cartera.",
        });
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No pudimos aceptar la invitacion",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    } finally {
      setAcceptingId(null);
    }
  }

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

  const pageIds = visibleNotifications.map((notification) => notification.id);
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

    announce(databaseIds.length + smartIds.length);
    clearSelection();
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const selectedDbIds = Array.from(selectedIds)
    .map((id) => notificationById.get(id))
    .filter((notification): notification is InboxNotification => Boolean(notification) && notification!.source === "database" && Boolean(notification!.databaseId))
    .map((notification) => notification.databaseId as number);
  const isArchiving = archiveNotificationsMutation.isPending;
  const isDeleting = deleteNotificationsMutation.isPending;

  async function handleArchiveSelected(archived: boolean) {
    if (selectedDbIds.length === 0) {
      return;
    }
    try {
      await archiveNotificationsMutation.mutateAsync({ notificationIds: selectedDbIds, archived });
      setFeedback({
        tone: "success",
        title: archived ? "Notificaciones archivadas" : "Notificaciones restauradas",
        description: `${selectedDbIds.length} ${archived ? "archivada(s)" : "restaurada(s)"}. Las inteligentes no se archivan.`,
      });
      clearSelection();
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No pudimos archivar",
        description: getQueryErrorMessage(error, "Aplica la migracion sql/add_notifications_archived_at.sql en la base."),
      });
    }
  }

  async function handleDeleteSelected() {
    if (selectedDbIds.length === 0) {
      setShowDeleteConfirm(false);
      return;
    }
    try {
      await deleteNotificationsMutation.mutateAsync(selectedDbIds);
      setFeedback({
        tone: "success",
        title: "Notificaciones eliminadas",
        description: `${selectedDbIds.length} eliminada(s). Las inteligentes no se eliminan (se recalculan).`,
      });
      clearSelection();
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No pudimos eliminar",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    } finally {
      setShowDeleteConfirm(false);
    }
  }

  // Atajos: Esc limpia la selección, R marca leídas las seleccionadas.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable))
      ) {
        return;
      }

      if (event.key === "Escape" && selectedCount > 0) {
        clearSelection();
      } else if (event.key.toLowerCase() === "r" && selectedMarkableCount > 0) {
        event.preventDefault();
        void handleMarkSelectedRead();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedCount, selectedMarkableCount]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-6 pb-8">
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

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
              <Button onClick={clearAllFilters} variant="ghost">
                <X className="mr-2 h-4 w-4" />
                Limpiar
              </Button>
            ) : null}
            {hasActiveFilters ? (
              <Button
                disabled={visibleUnreadCount === 0 || isUpdatingReadState}
                onClick={() => void handleMarkVisibleRead()}
                variant="ghost"
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                {isUpdatingReadState ? "Actualizando..." : `Marcar visibles${visibleUnreadCount > 0 ? ` (${visibleUnreadCount})` : ""}`}
              </Button>
            ) : (
              <Button disabled={inbox.unreadCount === 0 || isUpdatingReadState} onClick={() => void handleMarkAllRead()} variant="ghost">
                <CheckCheck className="mr-2 h-4 w-4" />
                {isUpdatingReadState ? "Actualizando..." : "Marcar pendientes"}
              </Button>
            )}
            <Link
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-storm transition hover:border-white/18 hover:bg-white/[0.07] hover:text-ink"
              to="/app/settings"
            >
              Ajustes
            </Link>
          </div>
        </div>

        {/* Triage rápido */}
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              { value: "all", label: "Todo" },
              { value: "unread", label: "No leídas" },
              { value: "action", label: "Acción requerida" },
              { value: "read", label: "Leídas" },
              { value: "archived", label: "Archivadas" },
            ] as const
          ).map((option) => (
            <button
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                quickFilter === option.value
                  ? "border-pine/30 bg-pine/10 text-pine"
                  : "border-white/10 bg-white/[0.03] text-storm hover:border-white/16 hover:text-ink"
              }`}
              key={option.value}
              onClick={() => setQuickFilter(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
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

      {feedback?.tone === "error" ? (
        <FormFeedbackBanner description={feedback.description} title={feedback.title} />
      ) : null}

      {notificationsQuery.isLoading && !notificationsQuery.data && snapshotQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="shimmer-surface h-[96px] rounded-[24px]" key={index} />
          ))}
        </div>
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
              <Button onClick={clearAllFilters} variant="secondary">
                Quitar filtros
              </Button>
            ) : undefined
          }
          description={
            inbox.notifications.length === 0
              ? "Sin alertas pendientes ni recordatorios activos. Te avisamos cuando algo necesite tu atencion."
              : "No hubo coincidencias con el filtro o la busqueda actual."
          }
          title={inbox.notifications.length === 0 ? "Estas al dia 🎉" : "No encontramos coincidencias"}
        />
      ) : viewMode === "table" ? (
        <NotificationTable
          availableChannels={availableChannels}
          availableKinds={availableKinds}
          acceptingId={acceptingId}
          allSelected={allSelected}
          cv={cv}
          filters={filters}
          isUpdatingReadState={isUpdatingReadState}
          notifications={visibleNotifications}
          onAccept={(notification) => void handleAcceptInvite(notification)}
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
        <div className="space-y-6">
          {groupNotificationsByDate(visibleNotifications).map((group) => (
            <section key={group.key}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-storm/70">{group.label}</p>
              <div className={viewMode === "grid" ? "grid gap-4 xl:grid-cols-2" : "grid gap-3"}>
                {group.items.map((notification) => (
                  <NotificationCard
                    acceptingId={acceptingId}
                    isUpdatingReadState={isUpdatingReadState}
                    key={notification.id}
                    notification={notification}
                    onAccept={(item) => void handleAcceptInvite(item)}
                    onMarkRead={(id, dbId) => void handleMarkOneRead(id, dbId)}
                    onToggleSelect={toggleSelect}
                    selected={selectedIds.has(notification.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {canLoadMore ? (
        <div className="flex flex-col items-center gap-2" ref={loadMoreRef}>
          <Button onClick={() => setVisibleCount((current) => current + NOTIFICATIONS_PAGE_SIZE)} variant="ghost">
            Cargar más
          </Button>
          <p className="text-xs text-storm/70">
            Mostrando {visibleNotifications.length} de {filteredNotifications.length}
          </p>
        </div>
      ) : filteredNotifications.length > NOTIFICATIONS_PAGE_SIZE ? (
        <p className="text-center text-xs text-storm/60">{filteredNotifications.length} notificaciones</p>
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
            {selectedDbIds.length > 0 ? (
              <button
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm font-medium text-storm transition hover:border-white/16 hover:text-ink disabled:opacity-40"
                disabled={isArchiving}
                onClick={() => void handleArchiveSelected(quickFilter !== "archived")}
                type="button"
              >
                <Archive className="h-4 w-4" />
                {quickFilter === "archived" ? "Restaurar" : "Archivar"} ({selectedDbIds.length})
              </button>
            ) : null}
            {selectedDbIds.length > 0 ? (
              <button
                className="inline-flex items-center gap-2 rounded-full border border-rosewood/25 bg-rosewood/10 px-3.5 py-1.5 text-sm font-semibold text-rosewood transition hover:bg-rosewood/15 disabled:opacity-40"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(true)}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar ({selectedDbIds.length})
              </button>
            ) : null}
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

      {showDeleteConfirm ? (
        <div
          aria-labelledby="notif-delete-title"
          aria-modal="true"
          className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="glass-panel-strong w-full max-w-md rounded-[28px] p-6">
            <h2 className="font-display text-xl font-semibold text-ink" id="notif-delete-title">
              Eliminar {selectedDbIds.length} notificación{selectedDbIds.length !== 1 ? "es" : ""}?
            </h2>
            <p className="mt-3 text-sm leading-7 text-storm">
              Se eliminan permanentemente las guardadas seleccionadas. Las inteligentes no se eliminan (se recalculan).
              No se puede deshacer.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button disabled={isDeleting} onClick={() => void handleDeleteSelected()}>
                {isDeleting ? "Eliminando..." : `Eliminar ${selectedDbIds.length}`}
              </Button>
              <Button disabled={isDeleting} onClick={() => setShowDeleteConfirm(false)} variant="ghost">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
