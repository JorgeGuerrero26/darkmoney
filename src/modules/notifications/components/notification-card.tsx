import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { formatDateTime } from "../../../lib/formatting/dates";
import {
  formatNotificationChannelLabel,
  formatNotificationKindLabel,
  formatNotificationStatusLabel,
} from "../../../lib/formatting/labels";
import { isActionRequiredNotificationKind, type InboxNotification } from "../use-notification-inbox";
import { getNotificationSourceLabel, getToneClasses } from "../lib/notifications-presenters";

type NotificationCardProps = {
  notification: InboxNotification;
  isUpdatingReadState: boolean;
  selected: boolean;
  acceptingId: string | null;
  onToggleSelect: (id: string) => void;
  onAccept: (notification: InboxNotification) => void;
  onMarkRead: (notificationId: string, databaseId?: number) => void;
};

export function NotificationCard({
  notification,
  isUpdatingReadState,
  selected,
  acceptingId,
  onToggleSelect,
  onAccept,
  onMarkRead,
}: NotificationCardProps) {
  const canMarkRead =
    notification.status !== "read" &&
    !(notification.source === "smart" && isActionRequiredNotificationKind(notification.kind));
  const hasInviteAction =
    notification.source === "smart" && isActionRequiredNotificationKind(notification.kind);

  return (
    <article className={`rounded-[24px] border p-5 transition ${getToneClasses(notification.tone)} ${selected ? "ring-2 ring-pine/30" : ""}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex gap-3">
          <SelectionCheckbox
            ariaLabel={`Seleccionar ${notification.title}`}
            checked={selected}
            onChange={() => onToggleSelect(notification.id)}
          />
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
          <p className="text-xs uppercase tracking-[0.18em] text-storm">{formatDateTime(notification.scheduledFor)}</p>
        </div>
        </div>

        <div className="flex min-w-[220px] flex-col gap-3">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Canal</p>
            <p className="mt-2 text-sm font-medium text-ink">{formatNotificationChannelLabel(notification.channel)}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-storm">
              {notification.readAt ? `Leida ${formatDateTime(notification.readAt)}` : "Pendiente"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {hasInviteAction ? (
              <Button disabled={acceptingId === notification.id} onClick={() => onAccept(notification)}>
                {acceptingId === notification.id ? "Aceptando..." : "Aceptar"}
              </Button>
            ) : null}
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-storm transition hover:border-white/18 hover:bg-white/[0.07] hover:text-ink"
              to={notification.href}
            >
              {hasInviteAction ? "Ver detalle" : "Ir al modulo"}
            </Link>
            {canMarkRead ? (
              <Button disabled={isUpdatingReadState} onClick={() => onMarkRead(notification.id, notification.databaseId)} variant="ghost">
                Marcar leida
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
