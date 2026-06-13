import { CheckCheck, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { ColumnPicker, type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { DataState } from "../../../components/ui/data-state";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { formatDateTime } from "../../../lib/formatting/dates";
import {
  formatNotificationChannelLabel,
  formatNotificationKindLabel,
  formatNotificationStatusLabel,
} from "../../../lib/formatting/labels";
import type { NotificationItem } from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { isActionRequiredNotificationKind, useNotificationInbox } from "../use-notification-inbox";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  getQueryErrorMessage,
  useCurrentUserEntitlementQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationPreferencesQuery,
  useNotificationsQuery,
  usePendingNotificationInvitesQuery,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";

type NotificationFilter = "all" | "unread" | "smart" | "database" | "read";
type NotificationSourceFilter = "all" | "database" | "smart";
type NotificationStatusFilter = "all" | NotificationItem["status"];

type NotificationTableFilters = {
  title: string;
  kind: string;
  source: NotificationSourceFilter;
  channel: string;
  status: NotificationStatusFilter;
  scheduledFrom: string;
  scheduledTo: string;
};

const filterOptions: Array<{ value: NotificationFilter; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "unread", label: "Pendientes" },
  { value: "smart", label: "Inteligentes" },
  { value: "database", label: "Guardadas" },
  { value: "read", label: "Leidas" },
];

const notificationColumns: ColumnDef[] = [
  { key: "tipo", label: "Tipo" },
  { key: "origen", label: "Origen" },
  { key: "canal", label: "Canal" },
  { key: "programada", label: "Programada" },
  { key: "estado", label: "Estado" },
];

const fieldClassName =
  "h-10 w-full rounded-[16px] border border-white/10 bg-[#0d1420]/95 px-3 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";

function buildFilterInitials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toUpperCase())
    .join("") || "FI";
}

function defaultNotificationTableFilters(): NotificationTableFilters {
  return {
    title: "",
    kind: "",
    source: "all",
    channel: "",
    status: "all",
    scheduledFrom: "",
    scheduledTo: "",
  };
}

function getToneClasses(tone: "info" | "success" | "warning" | "danger" | "neutral") {
  switch (tone) {
    case "success":
      return "border-pine/18 bg-pine/10";
    case "warning":
      return "border-gold/18 bg-gold/10";
    case "danger":
      return "border-ember/18 bg-ember/10";
    case "info":
      return "border-white/10 bg-white/[0.03]";
    default:
      return "border-white/10 bg-white/[0.03]";
  }
}

function getNotificationSourceLabel(source: "database" | "smart") {
  return source === "smart" ? "Inteligente" : "Guardada";
}

export function NotificationsPage() {
  const { profile, user } = useAuth();
  const { activeWorkspace } = useActiveWorkspace();
  const notificationsQuery = useNotificationsQuery(user?.id);
  const pendingInvitesQuery = usePendingNotificationInvitesQuery(user?.id);
  const preferencesQuery = useNotificationPreferencesQuery(user?.id);
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const entitlementQuery = useCurrentUserEntitlementQuery(user?.id);
  const markAllReadMutation = useMarkAllNotificationsReadMutation(user?.id);
  const markSingleReadMutation = useMarkNotificationReadMutation(user?.id);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useViewMode("notifications", "table");
  const [tableFilters, setTableFilters] = useState<NotificationTableFilters>(() =>
    defaultNotificationTableFilters(),
  );
  const { visible: colVis, toggle: toggleCol, cv } = useColumnVisibility(
    "notifications-table",
    notificationColumns,
  );

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
      Array.from(
        new Set(
          inbox.notifications
            .map((notification) => notification.kind.trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => formatNotificationKindLabel(left).localeCompare(formatNotificationKindLabel(right))),
    [inbox.notifications],
  );

  const availableChannels = useMemo(
    () =>
      Array.from(
        new Set(
          inbox.notifications
            .map((notification) => (notification.channel ?? "").trim())
            .filter(Boolean),
        ),
      ).sort((left, right) =>
        formatNotificationChannelLabel(left).localeCompare(formatNotificationChannelLabel(right)),
      ),
    [inbox.notifications],
  );
  const kindFilterOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Todos los tipos",
        description: "Muestra cualquier tipo de notificacion.",
        leadingLabel: "TT",
        leadingColor: "#64748B",
        searchText: "todos los tipos notificacion",
      },
      ...availableKinds.map((kind) => {
        const label = formatNotificationKindLabel(kind);

        return {
          value: kind,
          label,
          description: `Filtra por ${label}.`,
          leadingLabel: buildFilterInitials(label),
          leadingColor: "#4566D6",
          searchText: `${label} ${kind}`,
        };
      }),
    ],
    [availableKinds],
  );
  const sourceFilterOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "all",
        label: "Todo",
        description: "Incluye notificaciones guardadas e inteligentes.",
        leadingLabel: "TO",
        leadingColor: "#64748B",
        searchText: "todo todas origen",
      },
      {
        value: "smart",
        label: "Inteligente",
        description: "Alertas calculadas desde tus datos actuales.",
        leadingLabel: "IN",
        leadingColor: "#1B6A58",
      },
      {
        value: "database",
        label: "Guardada",
        description: "Notificaciones persistidas para tu cuenta.",
        leadingLabel: "GU",
        leadingColor: "#4566D6",
      },
    ],
    [],
  );
  const channelFilterOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Todos los canales",
        description: "Muestra cualquier canal de entrega.",
        leadingLabel: "TC",
        leadingColor: "#64748B",
        searchText: "todos los canales canal",
      },
      ...availableChannels.map((channel) => {
        const label = formatNotificationChannelLabel(channel);

        return {
          value: channel,
          label,
          description: `Filtra por canal ${label}.`,
          leadingLabel: buildFilterInitials(label),
          leadingColor: "#1B6A58",
          searchText: `${label} ${channel}`,
        };
      }),
    ],
    [availableChannels],
  );
  const statusFilterOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "all",
        label: "Todos los estados",
        description: "Incluye pendientes, enviadas, leidas y fallidas.",
        leadingLabel: "TE",
        leadingColor: "#64748B",
      },
      {
        value: "pending",
        label: "Pendiente",
        description: "Aun requiere atencion o envio.",
        leadingLabel: "PE",
        leadingColor: "#B48B34",
      },
      {
        value: "sent",
        label: "Enviada",
        description: "Ya fue enviada al canal configurado.",
        leadingLabel: "EN",
        leadingColor: "#4566D6",
      },
      {
        value: "read",
        label: "Leida",
        description: "Ya fue marcada como leida.",
        leadingLabel: "LE",
        leadingColor: "#64748B",
      },
      {
        value: "failed",
        label: "Fallida",
        description: "No se pudo completar el envio.",
        leadingLabel: "FA",
        leadingColor: "#8F3E3E",
      },
    ],
    [],
  );

  const filteredNotifications = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedTableTitle = tableFilters.title.trim().toLowerCase();

    return inbox.notifications.filter((notification) => {
      if (viewMode === "table") {
        const scheduledDate = notification.scheduledFor.slice(0, 10);

        if (
          normalizedTableTitle &&
          !(
            notification.title.toLowerCase().includes(normalizedTableTitle) ||
            notification.body.toLowerCase().includes(normalizedTableTitle)
          )
        ) {
          return false;
        }

        if (tableFilters.kind && notification.kind !== tableFilters.kind) {
          return false;
        }

        if (tableFilters.source !== "all" && notification.source !== tableFilters.source) {
          return false;
        }

        if (tableFilters.channel) {
          const channelValue = notification.channel?.trim() ?? "";
          if (channelValue !== tableFilters.channel) {
            return false;
          }
        }

        if (tableFilters.status !== "all" && notification.status !== tableFilters.status) {
          return false;
        }

        if (tableFilters.scheduledFrom && scheduledDate < tableFilters.scheduledFrom) {
          return false;
        }

        if (tableFilters.scheduledTo && scheduledDate > tableFilters.scheduledTo) {
          return false;
        }

        return true;
      }

      if (filter === "unread" && notification.status === "read") {
        return false;
      }

      if (filter === "smart" && notification.source !== "smart") {
        return false;
      }

      if (filter === "database" && notification.source !== "database") {
        return false;
      }

      if (filter === "read" && notification.status !== "read") {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        notification.title.toLowerCase().includes(normalizedSearch) ||
        notification.body.toLowerCase().includes(normalizedSearch) ||
        formatNotificationKindLabel(notification.kind).toLowerCase().includes(normalizedSearch) ||
        formatNotificationChannelLabel(notification.channel).toLowerCase().includes(normalizedSearch)
      );
    });
  }, [filter, inbox.notifications, search, tableFilters, viewMode]);

  const nextVisibleNotification = useMemo(
    () =>
      filteredNotifications
        .filter((notification) => notification.status !== "read")
        .slice()
        .sort(
          (left, right) =>
            new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime(),
        )[0] ?? filteredNotifications[0] ?? null,
    [filteredNotifications],
  );

  const enabledChannels = useMemo(() => {
    if (!preferencesQuery.data) {
      return [];
    }

    return [
      preferencesQuery.data.inAppEnabled ? "App" : null,
      preferencesQuery.data.emailEnabled ? "Correo" : null,
      preferencesQuery.data.pushEnabled ? "Push" : null,
    ].filter(Boolean) as string[];
  }, [preferencesQuery.data]);

  const hasExploreFilters = Boolean(search.trim()) || filter !== "all";
  const hasTableFilters =
    Boolean(tableFilters.title.trim()) ||
    Boolean(tableFilters.kind) ||
    tableFilters.source !== "all" ||
    Boolean(tableFilters.channel) ||
    tableFilters.status !== "all" ||
    Boolean(tableFilters.scheduledFrom) ||
    Boolean(tableFilters.scheduledTo);
  const hasActiveFilters = viewMode === "table" ? hasTableFilters : hasExploreFilters;
  const showNotificationExplore = viewMode !== "table" && inbox.notifications.length > 0;
  const isUpdatingReadState = markAllReadMutation.isPending || markSingleReadMutation.isPending;

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

  function updateNotificationTableFilter<Field extends keyof NotificationTableFilters>(
    field: Field,
    value: NotificationTableFilters[Field],
  ) {
    setTableFilters((current) => ({ ...current, [field]: value }));
  }

  function clearNotificationFilters() {
    if (viewMode === "table") {
      setTableFilters(defaultNotificationTableFilters());
      return;
    }

    setSearch("");
    setFilter("all");
  }

  function renderNotificationCard(notification: (typeof filteredNotifications)[number]) {
    const canMarkRead =
      notification.status !== "read" &&
      !(notification.source === "smart" && isActionRequiredNotificationKind(notification.kind));
    const hasInviteAction =
      notification.source === "smart" && isActionRequiredNotificationKind(notification.kind);

    return (
      <article
        className={`rounded-[28px] border p-5 ${getToneClasses(notification.tone)}`}
        key={notification.id}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={formatNotificationStatusLabel(notification.status)}
                tone={notification.status === "read" ? "neutral" : notification.tone}
              />
              <StatusBadge status={formatNotificationKindLabel(notification.kind)} tone="info" />
              <StatusBadge
                status={getNotificationSourceLabel(notification.source)}
                tone={notification.source === "smart" ? "success" : "neutral"}
              />
            </div>
            <div>
              <p className="font-display text-2xl font-semibold text-ink">{notification.title}</p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-storm">{notification.body}</p>
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-storm">
              {formatDateTime(notification.scheduledFor)}
            </p>
          </div>

          <div className="flex min-w-[220px] flex-col gap-3">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Canal</p>
              <p className="mt-2 text-sm font-medium text-ink">
                {formatNotificationChannelLabel(notification.channel)}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-storm">
                {notification.readAt ? `Leida ${formatDateTime(notification.readAt)}` : "Pendiente"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-storm transition hover:border-white/18 hover:bg-white/[0.07] hover:text-ink"
                to={notification.href}
              >
                {hasInviteAction ? "Abrir invitacion" : "Ir al modulo"}
              </Link>
              {canMarkRead ? (
                <Button
                  disabled={isUpdatingReadState}
                  onClick={() => void handleMarkOneRead(notification.id, notification.databaseId)}
                  variant="ghost"
                >
                  Marcar leida
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <section className="glass-panel-strong rounded-[32px] p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,430px)] xl:items-start">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.28em] text-storm/90">notificaciones</p>
              <h2 className="font-display text-4xl font-semibold text-ink">Bandeja personal</h2>
              <p className="max-w-3xl text-sm leading-7 text-storm">
                Entra directo a tu tabla de alertas. Cuando uses la vista tabla, los filtros viven
                dentro de cada columna; en lista o bloques reaparece el explorador compacto para
                revisar pendientes, recordatorios y alertas guardadas con mas contexto.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <StatusBadge status={`${inbox.unreadCount} pendientes`} tone="warning" />
              <StatusBadge
                status={`${inbox.unreadSmartCount} inteligentes`}
                tone={inbox.unreadSmartCount > 0 ? "success" : "neutral"}
              />
              <StatusBadge
                status={`${inbox.unreadDatabaseCount} guardadas`}
                tone={inbox.unreadDatabaseCount > 0 ? "info" : "neutral"}
              />
              <StatusBadge status={`${filteredNotifications.length} visibles`} tone="neutral" />
              {snapshotQuery.isFetching || notificationsQuery.isFetching || pendingInvitesQuery.isFetching ? (
                <StatusBadge status="Actualizando" tone="neutral" />
              ) : null}
            </div>
          </div>

          <aside className="glass-panel-soft rounded-[28px] border border-white/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.22em] text-storm">Control del modulo</p>
                <p className="text-sm leading-7 text-storm">
                  Marca alertas como leidas, cambia de vista y revisa el estado de tus canales.
                  En tabla filtras por columna; en otras vistas vuelve el explorador compacto.
                </p>
              </div>
              <button
                className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-storm transition hover:border-white/16 hover:text-ink disabled:opacity-50"
                disabled={snapshotQuery.isFetching || notificationsQuery.isFetching || pendingInvitesQuery.isFetching}
                onClick={() => {
                  void snapshotQuery.refetch();
                  void notificationsQuery.refetch();
                  void pendingInvitesQuery.refetch();
                }}
                title="Actualizar"
                type="button"
              >
                <RefreshCw
                  className={`h-4 w-4${
                    snapshotQuery.isFetching || notificationsQuery.isFetching || pendingInvitesQuery.isFetching
                      ? " animate-spin"
                      : ""
                  }`}
                />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={inbox.unreadCount === 0 || isUpdatingReadState}
                onClick={() => void handleMarkAllRead()}
                variant="ghost"
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                {isUpdatingReadState ? "Actualizando..." : "Marcar pendientes"}
              </Button>
              <Link
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-storm transition hover:border-white/18 hover:bg-white/[0.07] hover:text-ink"
                to="/app/settings"
              >
                Ajustes
              </Link>
              {hasActiveFilters ? (
                <Button onClick={clearNotificationFilters} variant="ghost">
                  Limpiar filtros
                </Button>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ViewSelector available={["grid", "list", "table"]} onChange={setViewMode} value={viewMode} />
              {viewMode === "table" ? (
                <ColumnPicker columns={notificationColumns} visible={colVis} onToggle={toggleCol} />
              ) : null}
              <StatusBadge status={`${filteredNotifications.length} visibles`} tone="neutral" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Workspace</p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {activeWorkspace?.name ?? "Sin workspace"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Canales activos</p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {preferencesQuery.isLoading
                    ? "Cargando..."
                    : preferencesQuery.error
                      ? "No disponible"
                      : enabledChannels.length > 0
                        ? enabledChannels.join(" · ")
                        : "Sin configurar"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Siguiente alerta</p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {nextVisibleNotification ? formatDateTime(nextVisibleNotification.scheduledFor) : "Sin pendientes"}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {showNotificationExplore ? (
        <SurfaceCard
          description="Busca por texto y filtra por estado u origen cuando prefieras recorrer la vista lista o bloques."
          title="Explorar notificaciones"
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.7fr)_auto]">
            <div className="relative min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
              <input
                className="h-16 w-full rounded-[24px] border border-white/10 bg-[#0d1420]/95 py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por titulo, detalle, tipo o canal..."
                type="text"
                value={search}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  className={`rounded-[18px] border px-4 py-2 text-sm font-semibold transition ${
                    filter === option.value
                      ? "border-pine/30 bg-pine/10 text-pine"
                      : "border-white/10 bg-white/[0.03] text-storm hover:border-white/18 hover:text-ink"
                  }`}
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button className="h-16 px-6" onClick={clearNotificationFilters} variant={hasActiveFilters ? "secondary" : "ghost"}>
              Limpiar filtros
            </Button>
          </div>
        </SurfaceCard>
      ) : null}

      {notificationsQuery.isLoading && !notificationsQuery.data && snapshotQuery.isLoading ? (
        <DataState
          description="Estamos reuniendo tu bandeja guardada y los recordatorios del workspace activo."
          title="Preparando notificaciones"
        />
      ) : notificationsQuery.error ? (
        <DataState
          description={getQueryErrorMessage(
            notificationsQuery.error,
            "No pudimos leer las notificaciones guardadas.",
          )}
          title="No fue posible cargar la bandeja"
          tone="error"
        />
      ) : filteredNotifications.length === 0 ? (
        <DataState
          description={
            inbox.notifications.length === 0
              ? "Aun no hay alertas guardadas ni recordatorios inteligentes activos."
              : "No hubo coincidencias con el filtro o la busqueda actual."
          }
          title={inbox.notifications.length === 0 ? "Tu bandeja esta vacia" : "No encontramos coincidencias"}
        />
      ) : viewMode === "table" ? (
        <section className="glass-panel-soft overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm text-ink">
              <thead>
                <tr className="bg-[#0c1522]">
                  <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">
                    Notificacion
                  </th>
                  <th
                    className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("tipo", "hidden md:table-cell")}`}
                  >
                    Tipo
                  </th>
                  <th
                    className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("origen", "hidden md:table-cell")}`}
                  >
                    Origen
                  </th>
                  <th
                    className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("canal", "hidden lg:table-cell")}`}
                  >
                    Canal
                  </th>
                  <th
                    className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("programada", "hidden xl:table-cell")}`}
                  >
                    Programada
                  </th>
                  <th
                    className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("estado", "hidden sm:table-cell")}`}
                  >
                    Estado
                  </th>
                  <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">
                    Acciones
                  </th>
                </tr>
                <tr className="border-b border-white/10 bg-[#0c1522]">
                  <th className="px-4 py-3 align-top">
                    <input
                      className={fieldClassName}
                      onChange={(event) => updateNotificationTableFilter("title", event.target.value)}
                      placeholder="Titulo o detalle..."
                      type="text"
                      value={tableFilters.title}
                    />
                  </th>
                  <th className={`px-4 py-3 align-top ${cv("tipo", "hidden md:table-cell")}`}>
                    <SearchablePicker
                      emptyMessage="No encontramos tipos con ese filtro."
                      onChange={(value) => updateNotificationTableFilter("kind", value)}
                      options={kindFilterOptions}
                      placeholderDescription="Muestra cualquier tipo de notificacion."
                      placeholderLabel="Todos los tipos"
                      queryPlaceholder="Buscar tipo..."
                      value={tableFilters.kind}
                    />
                  </th>
                  <th className={`px-4 py-3 align-top ${cv("origen", "hidden md:table-cell")}`}>
                    <SearchablePicker
                      emptyMessage="No encontramos origenes con ese filtro."
                      onChange={(value) =>
                        updateNotificationTableFilter("source", value as NotificationSourceFilter)
                      }
                      options={sourceFilterOptions}
                      placeholderDescription="Incluye notificaciones guardadas e inteligentes."
                      placeholderLabel="Todo"
                      queryPlaceholder="Buscar origen..."
                      value={tableFilters.source}
                    />
                  </th>
                  <th className={`px-4 py-3 align-top ${cv("canal", "hidden lg:table-cell")}`}>
                    <SearchablePicker
                      emptyMessage="No encontramos canales con ese filtro."
                      onChange={(value) => updateNotificationTableFilter("channel", value)}
                      options={channelFilterOptions}
                      placeholderDescription="Muestra cualquier canal de entrega."
                      placeholderLabel="Todos los canales"
                      queryPlaceholder="Buscar canal..."
                      value={tableFilters.channel}
                    />
                  </th>
                  <th className={`px-4 py-3 align-top ${cv("programada", "hidden xl:table-cell")}`}>
                    <div className="grid gap-2">
                      <input
                        className={fieldClassName}
                        onChange={(event) =>
                          updateNotificationTableFilter("scheduledFrom", event.target.value)
                        }
                        placeholder="Desde"
                        type="date"
                        value={tableFilters.scheduledFrom}
                      />
                      <input
                        className={fieldClassName}
                        onChange={(event) =>
                          updateNotificationTableFilter("scheduledTo", event.target.value)
                        }
                        placeholder="Hasta"
                        type="date"
                        value={tableFilters.scheduledTo}
                      />
                    </div>
                  </th>
                  <th className={`px-4 py-3 align-top ${cv("estado", "hidden sm:table-cell")}`}>
                    <SearchablePicker
                      emptyMessage="No encontramos estados con ese filtro."
                      onChange={(value) =>
                        updateNotificationTableFilter("status", value as NotificationStatusFilter)
                      }
                      options={statusFilterOptions}
                      placeholderDescription="Incluye pendientes, enviadas, leidas y fallidas."
                      placeholderLabel="Todos los estados"
                      queryPlaceholder="Buscar estado..."
                      value={tableFilters.status}
                    />
                  </th>
                  <th className="px-4 py-3 text-right align-top">
                    {hasTableFilters ? (
                      <Button onClick={clearNotificationFilters} variant="ghost">
                        Limpiar
                      </Button>
                    ) : null}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredNotifications.map((notification) => {
                  const canMarkRead =
                    notification.status !== "read" &&
                    !(notification.source === "smart" && isActionRequiredNotificationKind(notification.kind));
                  const hasInviteAction =
                    notification.source === "smart" && isActionRequiredNotificationKind(notification.kind);

                  return (
                    <tr
                      className={`border-b border-white/10 ${
                        notification.status !== "read" ? "bg-white/[0.03]" : "bg-transparent"
                      }`}
                      key={notification.id}
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink">{notification.title}</p>
                            {notification.status !== "read" ? (
                              <span className="rounded-full border border-pine/20 bg-pine/10 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-pine">
                                Nuevo
                              </span>
                            ) : null}
                          </div>
                          <p className="max-w-[520px] text-sm leading-6 text-storm">{notification.body}</p>
                        </div>
                      </td>
                      <td className={`px-5 py-4 align-top ${cv("tipo", "hidden md:table-cell")}`}>
                        <StatusBadge status={formatNotificationKindLabel(notification.kind)} tone="info" />
                      </td>
                      <td className={`px-5 py-4 align-top ${cv("origen", "hidden md:table-cell")}`}>
                        <StatusBadge
                          status={getNotificationSourceLabel(notification.source)}
                          tone={notification.source === "smart" ? "success" : "neutral"}
                        />
                      </td>
                      <td className={`px-5 py-4 align-top text-storm ${cv("canal", "hidden lg:table-cell")}`}>
                        {formatNotificationChannelLabel(notification.channel)}
                      </td>
                      <td className={`px-5 py-4 align-top text-storm ${cv("programada", "hidden xl:table-cell")}`}>
                        {formatDateTime(notification.scheduledFor)}
                      </td>
                      <td className={`px-5 py-4 align-top ${cv("estado", "hidden sm:table-cell")}`}>
                        <StatusBadge
                          status={formatNotificationStatusLabel(notification.status)}
                          tone={notification.status === "read" ? "neutral" : notification.tone}
                        />
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          <Link
                            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-storm transition hover:border-white/18 hover:bg-white/[0.07] hover:text-ink"
                            to={notification.href}
                          >
                            {hasInviteAction ? "Abrir" : "Ir"}
                          </Link>
                          {canMarkRead ? (
                            <Button
                              disabled={isUpdatingReadState}
                              onClick={() => void handleMarkOneRead(notification.id, notification.databaseId)}
                              variant="ghost"
                            >
                              Leida
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className={`${viewMode === "grid" ? "grid gap-4 xl:grid-cols-2" : "grid gap-3"}`}>
          {filteredNotifications.map((notification) => renderNotificationCard(notification))}
        </section>
      )}
    </div>
  );
}
