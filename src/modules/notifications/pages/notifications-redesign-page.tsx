import { CheckCheck, ChevronRight, MoreVertical, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { notificationDefersRead, notificationId, notificationMatchesActiveSpace } from "../lib/notification-navigation";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import { closeDetectedReviewParams, detectedReviewParams } from "../lib/detected-movement";
import { DetectedMovementInbox } from "../components/detected-movement-inbox";
import { DetectedMovementReview } from "../components/detected-movement-review";

import { DataState } from "../../../components/ui/data-state";
import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { Modal, ModalHeader } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { SearchablePicker } from "../../../components/ui/searchable-picker";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { useToast } from "../../../components/ui/toast-provider";
import { formatRelativeTime } from "../../../lib/formatting/dates";
import { formatNotificationKindLabel } from "../../../lib/formatting/labels";
import {
  getQueryErrorMessage,
  useCurrentUserEntitlementQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationsUnreadMutation,
  useMarkNotificationsReadMutation,
  useDeleteNotificationsMutation,
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
import { groupNotificationsByDate } from "../lib/notifications-presenters";
import { filterNotificationList, notificationKindOptions, notificationPriorityOptions, notificationReadingCounts, type NotificationKindGroup, type NotificationPriority } from "../lib/notification-list-model";

type NotificationFilter = "action" | "unread" | "all" | "archived" | "calculated";

const filterOptions: Array<{ key: NotificationFilter; label: string }> = [
  { key: "action", label: "Piden algo" },
  { key: "unread", label: "Sin leer" },
  { key: "all", label: "Todas" },
  { key: "archived", label: "Archivadas" },
  { key: "calculated", label: "Avisos web" },
];

function getNotificationActionLabel(kind: string) {
  if (kind === "detected_movement_suggestion") return "Revisar detección";
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
  selected,
  onToggleSelect,
}: {
  notification: InboxNotification;
  onOpen: (notification: InboxNotification) => void;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const needsAction = isActionRequiredNotificationKind(notification.kind) || notification.kind === "detected_movement_suggestion";
  const isUnread = notification.status !== "read";

  return (
    <article className="grid gap-3 border-t border-white/[0.08] py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 gap-3">
        {notification.source === "database" ? <span className="pt-1"><SelectionCheckbox ariaLabel={`Seleccionar ${notification.title}`} checked={selected} onChange={onToggleSelect} /></span> : null}
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
            {formatNotificationKindLabel(notification.kind)} · {formatRelativeTime(notification.scheduledFor)}{notification.source === "smart" ? " · Aviso calculado en web" : ""}
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
  const [params, setParams] = useSearchParams();
  const detectedId = notificationId(params.get("detected"));
  const showDetectedInbox = params.get("detected") === "pending";
  function closeDetection() { setParams(closeDetectedReviewParams, { replace: true }); }
  const { profile, user } = useAuth();
  const { activeWorkspace } = useActiveWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<"all" | NotificationPriority>("all");
  const [kind, setKind] = useState<NotificationKindGroup>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [deleteIds, setDeleteIds] = useState<number[] | null>(null);
  const [isBatchPending, setIsBatchPending] = useState(false);
  const { schedule } = useUndoQueue();
  const notificationsQuery = useNotificationsQuery(user?.id);
  const pendingInvitesQuery = usePendingNotificationInvitesQuery(user?.id);
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const entitlementQuery = useCurrentUserEntitlementQuery(user?.id);
  const markAllReadMutation = useMarkAllNotificationsReadMutation(user?.id);
  const unreadMutation = useMarkNotificationsUnreadMutation(user?.id);
  const readMutation = useMarkNotificationsReadMutation(user?.id);
  const deleteMutation = useDeleteNotificationsMutation(user?.id);
  const inbox = useNotificationInbox({
    databaseNotifications: notificationsQuery.data ?? [],
    entitlement: entitlementQuery.data,
    pendingObligationShares: pendingInvitesQuery.data?.obligationShares,
    pendingWorkspaceInvitations: pendingInvitesQuery.data?.workspaceInvitations,
    snapshot: snapshotQuery.data?.workspace.id === activeWorkspace?.id ? snapshotQuery.data : undefined,
    workspaceName: activeWorkspace?.name,
  });

  const activeNotifications = useMemo(
    () => inbox.notifications.filter((notification) => !notification.isArchived && (notification.source === "database" || isActionRequiredNotificationKind(notification.kind))),
    [inbox.notifications],
  );
  const actionRequired = useMemo(
    () =>
      activeNotifications.filter((notification) =>
        isActionRequiredNotificationKind(notification.kind),
      ),
    [activeNotifications],
  );
  const scopedNotifications = useMemo(() => {
    if (filter === "calculated") return inbox.notifications.filter((notification) => notification.source === "smart" && !isActionRequiredNotificationKind(notification.kind));
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
  const filteredNotifications = useMemo(() => filterNotificationList(scopedNotifications, { search, priority, kind }).filter((item) => !item.databaseId || !hiddenIds.has(item.databaseId)), [scopedNotifications, search, priority, kind, hiddenIds]);
  const databaseItems = (notificationsQuery.data ?? []).filter((item) => !hiddenIds.has(item.id));
  const counts = notificationReadingCounts(databaseItems);
  const visibleDatabaseIds = filteredNotifications.flatMap((item) => item.databaseId ? [item.databaseId] : []);
  const selectedItems = databaseItems.filter((item) => selectedIds.has(item.id));
  const groups = groupNotificationsByDate(filteredNotifications);
  const busy = isBatchPending || markAllReadMutation.isPending || readMutation.isPending || unreadMutation.isPending || deleteMutation.isPending;
  useEffect(() => {
    const visible = new Set(filteredNotifications.flatMap((item) => item.databaseId ? [item.databaseId] : []));
    setSelectedIds((current) => { const next = new Set([...current].filter((id) => visible.has(id))); return next.size === current.size ? current : next; });
  }, [filteredNotifications]);

  function toggleSelection(id: number) {
    setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function markReadState(ids: number[], read: boolean) {
    if (busy || !ids.length) return;
    setIsBatchPending(true);
    try {
      if (read) await readMutation.mutateAsync(ids);
      else await unreadMutation.mutateAsync(ids);
      setSelectedIds(new Set());
    } catch (error) {
      showToast({ title: "No pudimos cambiar la lectura", description: getQueryErrorMessage(error, "Inténtalo de nuevo."), tone: "error" });
    } finally { setIsBatchPending(false); }
  }

  function confirmDelete() {
    const ids = deleteIds;
    if (!ids?.length || busy) return;
    setDeleteIds(null);
    setSelectedIds(new Set());
    setHiddenIds((current) => new Set([...current, ...ids]));
    const restore = () => setHiddenIds((current) => new Set([...current].filter((id) => !ids.includes(id))));
    schedule({ label: `${ids.length} notificaciones eliminadas`, onUndo: restore, onCommit: async () => {
      try { await deleteMutation.mutateAsync(ids); }
      catch (error) { restore(); showToast({ title: "No pudimos eliminar las notificaciones", description: getQueryErrorMessage(error, "Inténtalo de nuevo."), tone: "error" }); }
    } });
  }

  async function handleOpen(notification: InboxNotification) {
    if (!notificationMatchesActiveSpace(notification, useWorkspaceStore.getState().activeWorkspaceId)) {
      showToast({ title: "El espacio cambió", description: "Este aviso se calculó en el espacio anterior. Abre los avisos actualizados.", tone: "error" });
      return;
    }
    try {
      if (notification.source !== "database" && notification.status !== "read" && !isActionRequiredNotificationKind(notification.kind) && !notificationDefersRead(notification.kind)) {
        inbox.markSmartNotificationsAsRead([notification.id]);
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

  if (notificationsQuery.isError && !detectedId && !showDetectedInbox) {
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
            <span className="font-semibold text-ink">{counts.unread}</span> sin leer · {counts.read} leídas en tu cuenta.
            {inbox.smartNotifications.some((item) => !isActionRequiredNotificationKind(item.kind)) ? " Los avisos locales están separados en «Avisos web»." : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link className="font-semibold text-storm hover:text-ink" to={showDetectedInbox ? "/app/notifications" : "/app/notifications?detected=pending"}>{showDetectedInbox ? "Volver a avisos" : "Detecciones pendientes"}</Link>
          <button
            className="inline-flex items-center gap-2 font-semibold text-storm transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            disabled={inbox.unreadCount === 0 || busy}
            onClick={() => void handleMarkAllRead()}
            type="button"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas leídas
          </button>
          <Link className="font-semibold text-storm transition hover:text-ink" to="/app/settings?section=notifications">
            Qué me avisa
          </Link>
          <div className="relative" onKeyDown={(event) => {
            if (event.key === "Escape" && menuOpen) {
              event.stopPropagation();
              setMenuOpen(false);
              event.currentTarget.querySelector("button")?.focus();
            }
          }}>
            <button aria-label="Más acciones de notificaciones" aria-expanded={menuOpen} className="grid h-10 w-10 place-items-center rounded-lg border border-white/[0.08] text-storm hover:bg-white/[0.04]" onClick={() => setMenuOpen((open) => !open)} type="button"><MoreVertical className="h-4 w-4" /></button>
            {menuOpen ? <><button aria-label="Cerrar acciones" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenuOpen(false)} type="button" /><div className="absolute right-0 top-12 z-40 w-64 rounded-xl border border-white/10 bg-[#1b1a18] py-1">
              <button className="min-h-11 w-full px-4 text-left text-sm text-ink hover:bg-white/[0.04] disabled:opacity-40" disabled={!counts.read || busy} onClick={() => { setMenuOpen(false); void markReadState(databaseItems.filter((item) => item.status === "read").map((item) => item.id), false); }} type="button">Marcar guardadas como no leídas</button>
              <button className="flex min-h-11 w-full items-center gap-2 border-t border-white/[0.08] px-4 text-left text-sm text-storm hover:bg-white/[0.04] disabled:opacity-40" disabled={!counts.read || busy} onClick={() => { setMenuOpen(false); setDeleteIds(databaseItems.filter((item) => item.status === "read").map((item) => item.id)); }} type="button"><Trash2 className="h-4 w-4" />Eliminar las leídas</button>
            </div></> : null}
          </div>
        </div>
      </header>

      {showDetectedInbox && user?.id && activeWorkspace ? <DetectedMovementInbox key={`${user.id}:${activeWorkspace.id}`} userId={user.id} workspaceId={activeWorkspace.id} onOpen={(id) => setParams((current) => detectedReviewParams(current, id))} /> : null}
      {!showDetectedInbox ? <>
      <section aria-label="Buscar y filtrar notificaciones" className="grid gap-2 pt-6 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_1fr_1fr]">
        <input aria-label="Buscar notificaciones" className="field-dark !h-14" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por título o contenido..." type="search" value={search} />
        <SearchablePicker appearance="toolbar" emptyMessage="No hay prioridades." onChange={(value) => setPriority(value as typeof priority)} options={notificationPriorityOptions.map((option) => ({ ...option, description: "", leadingLabel: "" }))} placeholderLabel="Todas las prioridades" placeholderDescription="Prioridad" queryPlaceholder="Buscar prioridad" showSearch={false} value={priority} />
        <SearchablePicker appearance="toolbar" emptyMessage="No hay tipos." onChange={(value) => setKind(value as NotificationKindGroup)} options={notificationKindOptions.map((option) => ({ ...option, description: "", leadingLabel: "" }))} placeholderLabel="Todos los tipos" placeholderDescription="Tipo" queryPlaceholder="Buscar tipo" showSearch={false} value={kind} />
      </section>
      {search || priority !== "all" || kind !== "all" ? <div className="flex flex-wrap items-center gap-3 pt-3 text-xs text-storm">{search ? <button onClick={() => setSearch("")} type="button">Búsqueda: {search} ×</button> : null}{priority !== "all" ? <button onClick={() => setPriority("all")} type="button">{notificationPriorityOptions.find((option) => option.value === priority)?.label} ×</button> : null}{kind !== "all" ? <button onClick={() => setKind("all")} type="button">{notificationKindOptions.find((option) => option.value === kind)?.label} ×</button> : null}<button className="ml-auto text-ink hover:underline" onClick={() => { setSearch(""); setPriority("all"); setKind("all"); setFilter("all"); }} type="button">Quitar filtros</button></div> : null}

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

      {visibleDatabaseIds.length ? <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.08] py-3 text-xs text-storm"><SelectionCheckbox ariaLabel="Seleccionar notificaciones guardadas en esta vista" checked={visibleDatabaseIds.every((id) => selectedIds.has(id))} indeterminate={visibleDatabaseIds.some((id) => selectedIds.has(id)) && !visibleDatabaseIds.every((id) => selectedIds.has(id))} onChange={() => setSelectedIds(visibleDatabaseIds.every((id) => selectedIds.has(id)) ? new Set() : new Set(visibleDatabaseIds))} />Seleccionar guardadas{selectedIds.size ? <><span className="text-ink">{selectedIds.size} seleccionadas</span><button disabled={busy || !selectedItems.some((item) => item.status !== "read")} onClick={() => void markReadState(selectedItems.filter((item) => item.status !== "read").map((item) => item.id), true)} type="button">Marcar leídas</button><button disabled={busy || !selectedItems.some((item) => item.status === "read")} onClick={() => void markReadState(selectedItems.filter((item) => item.status === "read").map((item) => item.id), false)} type="button">Marcar no leídas</button><button disabled={busy} onClick={() => setDeleteIds([...selectedIds])} type="button">Eliminar</button><button aria-label="Cancelar selección" onClick={() => setSelectedIds(new Set())} type="button"><X className="h-4 w-4" /></button></> : null}</div> : null}

      {notificationsQuery.isLoading && !inbox.notifications.length ? (
        <p className="py-12 text-center text-sm text-storm">Cargando notificaciones...</p>
      ) : filteredNotifications.length ? (
        <div>
          {groups.map((group) => (
            <section aria-labelledby={`notifications-${group.key}`} className="pt-7" key={group.key}>
              <h2 id={`notifications-${group.key}`} className="font-public-mono text-[11px] uppercase tracking-[0.14em] text-storm">{group.label}</h2>
              <div className="mt-3">
                {group.items.map((notification) => (
                  <NotificationRow key={notification.id} notification={notification} selected={Boolean(notification.databaseId && selectedIds.has(notification.databaseId))} onToggleSelect={() => { if (notification.databaseId) toggleSelection(notification.databaseId); }} onOpen={(item) => void handleOpen(item)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="border-b border-white/[0.08] py-14 text-center text-sm text-storm">
          No hay notificaciones en esta vista.
        </p>
      )}
      </> : null}
      {detectedId && user?.id && activeWorkspace && snapshotQuery.data?.workspace.id === activeWorkspace.id ? <DetectedMovementReview key={`${activeWorkspace.id}:${detectedId}`} id={detectedId} snapshot={snapshotQuery.data} userId={user.id} proAccessEnabled={entitlementQuery.data?.proAccessEnabled === true} onClose={closeDetection} /> : null}
      {detectedId && !snapshotQuery.data ? <Modal labelledBy="detection-space-title" onClose={closeDetection} size="md"><ModalHeader title="Revisar movimiento detectado" titleId="detection-space-title" onClose={closeDetection} /><ModalBody>{snapshotQuery.isError ? <p role="alert" className="text-sm text-storm">No se pudo cargar el espacio para revisar la detección. <button className="text-ink underline" onClick={() => void snapshotQuery.refetch()} type="button">Reintentar</button></p> : <p role="status" className="text-sm text-storm">Preparando los datos del espacio...</p>}</ModalBody></Modal> : null}
      {deleteIds ? <Modal labelledBy="notification-delete-title" onClose={() => { if (!busy) setDeleteIds(null); }} size="sm"><ResourceEditorHeader disabled={busy} onClose={() => setDeleteIds(null)} title={`Eliminar ${deleteIds.length} notificaciones`} titleId="notification-delete-title" /><ModalBody><p className="text-sm leading-6 text-storm">Solo se eliminan las notificaciones guardadas seleccionadas, no los avisos calculados ni los registros financieros. Tendrás unos segundos para deshacer.</p></ModalBody><footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4"><Button disabled={busy} onClick={() => setDeleteIds(null)} variant="secondary">Cancelar</Button><Button disabled={busy} onClick={confirmDelete}>Eliminar</Button></footer></Modal> : null}
    </div>
  );
}
