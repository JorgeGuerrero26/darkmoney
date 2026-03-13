import { Bell, CheckCheck, MailWarning } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { formatDateTime } from "../../../lib/formatting/dates";
import { useAuth } from "../../auth/auth-context";
import {
  getQueryErrorMessage,
  useMarkAllNotificationsReadMutation,
  useNotificationPreferencesQuery,
  useNotificationsQuery,
} from "../../../services/queries/workspace-data";

export function NotificationsPage() {
  const { user } = useAuth();
  const notificationsQuery = useNotificationsQuery(user?.id);
  const preferencesQuery = useNotificationPreferencesQuery(user?.id);
  const markAllReadMutation = useMarkAllNotificationsReadMutation(user?.id);
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((notification) => notification.status !== "read").length;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        actions={
          <>
            <Button disabled variant="ghost">
              Filtrar
            </Button>
            <Button
              disabled={unreadCount === 0 || markAllReadMutation.isPending}
              onClick={() => void markAllReadMutation.mutateAsync()}
            >
              {markAllReadMutation.isPending ? "Actualizando..." : "Marcar todo como leido"}
            </Button>
          </>
        }
        description="Bandeja personal real de alertas y recordatorios. Estas notificaciones no dependen del workspace, sino del usuario autenticado."
        eyebrow="notifications"
        title="Alertas y recordatorios"
      />

      <SurfaceCard
        action={<Bell className="h-5 w-5 text-gold" />}
        description="Lista real de notificaciones del usuario autenticado."
        title="Bandeja personal"
      >
        {notificationsQuery.isLoading ? (
          <DataState
            description="Consultando la tabla notifications de tu usuario."
            title="Cargando notificaciones reales"
          />
        ) : notificationsQuery.error ? (
          <DataState
            description={getQueryErrorMessage(
              notificationsQuery.error,
              "No pudimos leer tus notificaciones reales.",
            )}
            title="No fue posible cargar las notificaciones"
            tone="error"
          />
        ) : notifications.length === 0 ? (
          <DataState
            description="Todavia no hay alertas registradas para tu usuario."
            title="Tu bandeja esta vacia"
          />
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <article
                className="glass-panel-soft rounded-[28px] p-5"
                key={notification.id}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-medium text-ink">{notification.title}</p>
                      <StatusBadge
                        status={notification.status}
                        tone={notification.status === "read" ? "neutral" : "warning"}
                      />
                      <StatusBadge
                        status={notification.kind}
                        tone="info"
                      />
                    </div>
                    <p className="text-sm leading-7 text-storm">{notification.body}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-storm">
                      {formatDateTime(notification.scheduledFor)}
                    </p>
                  </div>
                  <div className="min-w-[144px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-storm">Canal</p>
                    <p className="mt-2 text-sm font-medium text-ink">{notification.channel ?? "in_app"}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-storm">
                      {notification.readAt ? `Leida ${formatDateTime(notification.readAt)}` : "Pendiente"}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SurfaceCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard
          action={<CheckCheck className="h-5 w-5 text-pine" />}
          description="Resumen real de tu bandeja personal."
          title="Estado de alertas"
        >
          {notificationsQuery.isLoading ? (
            <DataState
              description="Esperando la respuesta real de la bandeja para calcular el resumen."
              title="Preparando resumen"
            />
          ) : notificationsQuery.error ? (
            <DataState
              description={getQueryErrorMessage(
                notificationsQuery.error,
                "No pudimos calcular el resumen de alertas.",
              )}
              title="Resumen no disponible"
              tone="error"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="glass-panel-soft rounded-[24px] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Total</p>
                <p className="mt-3 font-display text-3xl font-semibold text-ink">{notifications.length}</p>
                <p className="mt-2 text-sm text-storm">Notificaciones visibles para tu usuario.</p>
              </div>
              <div className="glass-panel-soft rounded-[24px] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Pendientes</p>
                <p className="mt-3 font-display text-3xl font-semibold text-ink">{unreadCount}</p>
                <p className="mt-2 text-sm text-storm">Aun no marcadas como leidas.</p>
              </div>
              <div className="glass-panel-soft rounded-[24px] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Leidas</p>
                <p className="mt-3 font-display text-3xl font-semibold text-ink">
                  {notifications.filter((notification) => notification.status === "read").length}
                </p>
                <p className="mt-2 text-sm text-storm">Confirmadas desde la base de datos.</p>
              </div>
            </div>
          )}
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
