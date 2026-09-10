import { CheckCheck, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { DataState } from "../../../components/ui/data-state";
import { useToast } from "../../../components/ui/toast-provider";
import { formatRelativeTime } from "../../../lib/formatting/dates";
import { formatNotificationKindLabel } from "../../../lib/formatting/labels";
import {
  getQueryErrorMessage,
  useCurrentUserEntitlementQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  usePendingNotificationInvitesQuery,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  isActionRequiredNotificationKind,
  useNotificationInbox,
  type InboxNotification,
} from "../use-notification-inbox";

type NotificationFilter = "action" | "unread" | "all" | "archived";

const filterOptions: Array<{ key: NotificationFilter; label: string }> = [
  { key: "action", label: "Piden algo" },
  { key: "unread", label: "Sin leer" },
  { key: "all", label: "Todas" },
  { key: "archived", label: "Archivadas" },
];

function getNotificationActionLabel(kind: string) {
  if (kind.includes("invite") || kind.includes("share")) {
    return "Revisar invitación";
  }
  if (kind.includes("subscription")) {
    return "Revisar suscripción";
  }
  if (kind.includes("budget")) {
    return "Ver presupuesto";
  }
  if (kind.includes("obligation")) {
    return "Revisar obligación";
  }
  return "Revisar";
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: InboxNotification;
  onOpen: (notification: InboxNotification) => void;
}) {
  const needsAction = isActionRequiredNotificationKind(notification.kind);
  const isUnread = notification.status !== "read";

  return (
    <article className="grid gap-3 border-t border-white/[0.08] py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 gap-3">
        <span
          aria-label={isUnread ? "Sin leer" : "Leída"}
          className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
            isUnread ? (needsAction ? "bg-[#d6b69b]" : "bg-[#9c958b]") : "bg-white/15"
          }`}
        />
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-6 text-ink">{notification.title}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-storm">{notification.body}</p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-storm/65">
            {formatNotificationKindLabel(notification.kind)} · {formatRelativeTime(notification.scheduledFor)}
          </p>
        </div>
      </div>

      <button
        className={
          needsAction
            ? "ml-5 inline-flex h-9 items-center justify-center gap-1.5 justify-self-start rounded-[7px] bg-[#f4f1ec] px-3 text-xs font-semibold text-[#141312] transition hover:bg-white sm:justify-self-end"
            : "ml-5 inline-flex h-9 items-center gap-1 text-xs font-semibold text-storm transition hover:text-ink sm:justify-self-end"
        }
        onClick={() => onOpen(notification)}
        type="button"
      >
        {needsAction ? getNotificationActionLabel(notification.kind) : "Ver"}
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </article>
  );
}

export function NotificationsPage() {
  const { profile, user } = useAuth();
  const { activeWorkspace } = useActiveWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<NotificationFilter>("action");
  const notificationsQuery = useNotificationsQuery(user?.id);
  const pendingInvitesQuery = usePendingNotificationInvitesQuery(user?.id);
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const entitlementQuery = useCurrentUserEntitlementQuery(user?.id);
  const markAllReadMutation = useMarkAllNotificationsReadMutation(user?.id);
  const markSingleReadMutation = useMarkNotificationReadMutation(user?.id);
  const inbox = useNotificationInbox({
    databaseNotifications: notificationsQuery.data ?? [],
    entitlement: entitlementQuery.data,
    pendingObligationShares: pendingInvitesQuery.data?.obligationShares,
    pendingWorkspaceInvitations: pendingInvitesQuery.data?.workspaceInvitations,
    snapshot: snapshotQuery.data,
    workspaceName: activeWorkspace?.name,
  });

  const activeNotifications = useMemo(
    () => inbox.notifications.filter((notification) => !notification.isArchived),
    [inbox.notifications],
  );
  const actionRequired = useMemo(
    () =>
      activeNotifications.filter((notification) =>
        isActionRequiredNotificationKind(notification.kind),
      ),
    [activeNotifications],
  );
  const filteredNotifications = useMemo(() => {
    if (filter === "archived") {
      return inbox.notifications.filter((notification) => notification.isArchived);
    }
    if (filter === "action") {
      return actionRequired;
    }
    if (filter === "unread") {
      return activeNotifications.filter((notification) => notification.status !== "read");
    }
    return activeNotifications;
  }, [actionRequired, activeNotifications, filter, inbox.notifications]);
  const actionItems = filteredNotifications.filter((notification) =>
    isActionRequiredNotificationKind(notification.kind),
  );
  const informativeItems = filteredNotifications.filter(
    (notification) => !isActionRequiredNotificationKind(notification.kind),
  );

  async function handleOpen(notification: InboxNotification) {
    try {
      if (notification.status !== "read" && !isActionRequiredNotificationKind(notification.kind)) {
        if (notification.source === "database" && notification.databaseId) {
          await markSingleReadMutation.mutateAsync(notification.databaseId);
        } else {
          inbox.markSmartNotificationsAsRead([notification.id]);
        }
      }
    } catch {
      // Mantener disponible el destino aunque el cambio de lectura falle.
    }
    navigate(notification.href);
  }

  async function handleMarkAllRead() {
    try {
      if (inbox.unreadDatabaseCount > 0) {
        await markAllReadMutation.mutateAsync();
      }
      if (inbox.unreadSmartCount > 0) {
        inbox.markSmartNotificationsAsRead();
      }
    } catch (readError) {
      showToast({
        title: "No pudimos marcar las notificaciones",
        description: getQueryErrorMessage(readError, "Inténtalo de nuevo en unos segundos."),
        tone: "error",
      });
    }
  }

  if (notificationsQuery.isError) {
    return (
      <DataState
        description={getQueryErrorMessage(notificationsQuery.error, "No pudimos cargar tu bandeja.")}
        title="No pudimos abrir las notificaciones"
        tone="error"
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-12">
      <header className="flex flex-col gap-5 border-b border-white/[0.09] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-ink">
            Notificaciones
          </h1>
          <p className="mt-2 text-sm text-storm">
            <span className="font-semibold text-ink">{actionRequired.length}</span>{" "}
            {actionRequired.length === 1 ? "pide" : "piden"} algo tuyo. Las demás son avisos y se archivan a los 30 días.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <button
            className="inline-flex items-center gap-2 font-semibold text-storm transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            disabled={inbox.unreadCount === 0 || markAllReadMutation.isPending}
            onClick={() => void handleMarkAllRead()}
            type="button"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas leídas
          </button>
          <Link className="font-semibold text-storm transition hover:text-ink" to="/app/settings?section=notifications">
            Qué me avisa
          </Link>
        </div>
      </header>

      <nav aria-label="Filtros de notificaciones" className="flex gap-1 overflow-x-auto border-b border-white/[0.09] py-4">
        {filterOptions.map((option) => (
          <button
            aria-pressed={filter === option.key}
            className={`shrink-0 rounded-[7px] px-3 py-2 text-sm font-semibold transition ${
              filter === option.key ? "bg-[#f4f1ec] text-[#141312]" : "text-storm hover:bg-white/[0.04] hover:text-ink"
            }`}
            key={option.key}
            onClick={() => setFilter(option.key)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </nav>

      {notificationsQuery.isLoading && !inbox.notifications.length ? (
        <p className="py-12 text-center text-sm text-storm">Cargando notificaciones...</p>
      ) : filteredNotifications.length ? (
        <div>
          {actionItems.length ? (
            <section aria-labelledby="notifications-action-heading" className="pt-7">
              <h2 id="notifications-action-heading" className="font-public-mono text-[11px] uppercase tracking-[0.2em] text-[#d6b69b]">
                Piden algo
              </h2>
              <div className="mt-3">
                {actionItems.map((notification) => (
                  <NotificationRow key={notification.id} notification={notification} onOpen={(item) => void handleOpen(item)} />
                ))}
              </div>
            </section>
          ) : null}

          {informativeItems.length ? (
            <section aria-labelledby="notifications-info-heading" className="pt-7">
              <h2 id="notifications-info-heading" className="font-public-mono text-[11px] uppercase tracking-[0.2em] text-storm/70">
                {filter === "archived" ? "Archivadas" : "Para saber"}
              </h2>
              <div className="mt-3">
                {informativeItems.map((notification) => (
                  <NotificationRow key={notification.id} notification={notification} onOpen={(item) => void handleOpen(item)} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <p className="border-b border-white/[0.08] py-14 text-center text-sm text-storm">
          No hay notificaciones en esta vista.
        </p>
      )}
    </div>
  );
}
