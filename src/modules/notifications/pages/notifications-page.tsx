import { Bell, CheckCheck, MailWarning, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { formatDateTime } from "../../../lib/formatting/dates";
import {
  formatNotificationChannelLabel,
  formatNotificationKindLabel,
  formatNotificationStatusLabel,
} from "../../../lib/formatting/labels";
import { useAuth } from "../../auth/auth-context";
import { useNotificationInbox } from "../use-notification-inbox";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  getQueryErrorMessage,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationPreferencesQuery,
  useNotificationsQuery,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";

type NotificationFilter = "all" | "unread" | "smart" | "database" | "read";

const filterOptions: Array<{ value: NotificationFilter; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "unread", label: "Pendientes" },
  { value: "smart", label: "Inteligentes" },
  { value: "database", label: "Guardadas" },
  { value: "read", label: "Leidas" },
];

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

export function NotificationsPage() {
  const { profile, user } = useAuth();
  const { activeWorkspace } = useActiveWorkspace();
  const notificationsQuery = useNotificationsQuery(user?.id);
  const preferencesQuery = useNotificationPreferencesQuery(user?.id);
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const markAllReadMutation = useMarkAllNotificationsReadMutation(user?.id);
  const markSingleReadMutation = useMarkNotificationReadMutation(user?.id);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [search, setSearch] = useState("");

  const inbox = useNotificationInbox({
    databaseNotifications: notificationsQuery.data ?? [],
    snapshot: snapshotQuery.data,
    workspaceName: activeWorkspace?.name,
  });

  const filteredNotifications = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return inbox.notifications.filter((notification) => {
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
        formatNotificationKindLabel(notification.kind).toLowerCase().includes(normalizedSearch)
      );
    });
  }, [filter, inbox.notifications, search]);

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

  const isUpdatingReadState = markAllReadMutation.isPending || markSingleReadMutation.isPending;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={inbox.unreadCount === 0 || isUpdatingReadState}
              onClick={() => void handleMarkAllRead()}
              variant="ghost"
            >
              <CheckCheck className="h-4 w-4" />
              {isUpdatingReadState ? "Actualizando..." : "Marcar todo como leido"}
            </Button>
          </div>
        }
        description="Bandeja personal con alertas guardadas en base de datos y recordatorios inteligentes generados desde tus cuentas, suscripciones, creditos, deudas y presupuestos."
        eyebrow="notifications"
        title="Alertas y recordatorios"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass-panel-soft rounded-[24px] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-storm">Pendientes</p>
          <p className="mt-3 font-display text-3xl font-semibold text-ink">{inbox.unreadCount}</p>
          <p className="mt-2 text-sm text-storm">Lo que aun pide tu atencion.</p>
        </div>
        <div className="glass-panel-soft rounded-[24px] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-storm">Inteligentes</p>
          <p className="mt-3 font-display text-3xl font-semibold text-ink">
            {inbox.notifications.filter((notification) => notification.source === "smart").length}
          </p>
          <p className="mt-2 text-sm text-storm">Recordatorios vivos del workspace.</p>
        </div>
        <div className="glass-panel-soft rounded-[24px] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-storm">En base de datos</p>
          <p className="mt-3 font-display text-3xl font-semibold text-ink">
            {inbox.notifications.filter((notification) => notification.source === "database").length}
          </p>
          <p className="mt-2 text-sm text-storm">Alertas persistidas por tu usuario.</p>
        </div>
        <div className="glass-panel-soft rounded-[24px] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-storm">Workspace activo</p>
          <p className="mt-3 font-display text-2xl font-semibold text-ink">
            {activeWorkspace?.name ?? "Sin workspace"}
          </p>
          <p className="mt-2 text-sm text-storm">Fuente de las alertas inteligentes.</p>
        </div>
      </section>

      <SurfaceCard
        action={<Bell className="h-5 w-5 text-gold" />}
        description="Filtra la bandeja o busca una alerta puntual por tipo, texto o fuente."
        title="Bandeja unificada"
      >
        <div className="grid gap-4 lg:grid-cols-[1.1fr_auto]">
          <label className="block">
            <span className="mb-3 block text-xs uppercase tracking-[0.18em] text-storm">Buscar</span>
            <input
              className="field-dark"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ej. suscripcion, Kevin, presupuesto, pago..."
              value={search}
            />
          </label>
          <div>
            <span className="mb-3 block text-xs uppercase tracking-[0.18em] text-storm">Filtro</span>
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
          </div>
        </div>

        <div className="mt-6">
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
          ) : (
            <div className="grid gap-3">
              {filteredNotifications.map((notification) => (
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
                        <StatusBadge
                          status={formatNotificationKindLabel(notification.kind)}
                          tone="info"
                        />
                        <StatusBadge
                          status={notification.source === "smart" ? "Inteligente" : "Guardada"}
                          tone={notification.source === "smart" ? "success" : "neutral"}
                        />
                      </div>
                      <div>
                        <p className="font-display text-2xl font-semibold text-ink">{notification.title}</p>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-storm">
                          {notification.body}
                        </p>
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
                          {notification.readAt
                            ? `Leida ${formatDateTime(notification.readAt)}`
                            : "Pendiente"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-storm transition hover:border-white/18 hover:bg-white/[0.07] hover:text-ink"
                          to={notification.href}
                        >
                          {notification.kind === "invite" ? "Abrir invitacion" : "Ir al modulo"}
                        </Link>
                        {notification.status !== "read" && notification.kind !== "invite" ? (
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
              ))}
            </div>
          )}
        </div>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SurfaceCard
          action={<Sparkles className="h-5 w-5 text-pine" />}
          description="Resumen operativo de la bandeja para saber si lo que viene esta bajo control o ya necesita accion."
          title="Pulso de alertas"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="glass-panel-soft rounded-[24px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Pendientes</p>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">{inbox.unreadCount}</p>
              <p className="mt-2 text-sm text-storm">Entre recordatorios y base.</p>
            </div>
            <div className="glass-panel-soft rounded-[24px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Inteligentes sin leer</p>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">{inbox.unreadSmartCount}</p>
              <p className="mt-2 text-sm text-storm">Vienen del estado real del sistema.</p>
            </div>
            <div className="glass-panel-soft rounded-[24px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Base sin leer</p>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">{inbox.unreadDatabaseCount}</p>
              <p className="mt-2 text-sm text-storm">Guardadas de forma persistente.</p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard
          action={<MailWarning className="h-5 w-5 text-ember" />}
          description="Preferencias personales guardadas en notification_preferences."
          title="Preferencias actuales"
        >
          {preferencesQuery.isLoading ? (
            <DataState
              description="Consultando las preferencias reales del usuario."
              title="Cargando preferencias"
            />
          ) : preferencesQuery.error ? (
            <DataState
              description={getQueryErrorMessage(
                preferencesQuery.error,
                "No pudimos leer tus preferencias de notificacion.",
              )}
              title="No fue posible cargar las preferencias"
              tone="error"
            />
          ) : preferencesQuery.data ? (
            <div className="grid gap-4">
              <div className="glass-panel-soft rounded-[24px] p-4 text-sm text-ink">
                In-app: {preferencesQuery.data.inAppEnabled ? "activado" : "desactivado"}
              </div>
              <div className="glass-panel-soft rounded-[24px] p-4 text-sm text-ink">
                Email: {preferencesQuery.data.emailEnabled ? "activado" : "desactivado"}
              </div>
              <div className="glass-panel-soft rounded-[24px] p-4 text-sm text-ink">
                Push: {preferencesQuery.data.pushEnabled ? "activado" : "desactivado"}
              </div>
            </div>
          ) : (
            <DataState
              description="Todavia no existe una fila de preferencias para este usuario. Puedes crearla desde Configuracion."
              title="Sin preferencias guardadas"
            />
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
