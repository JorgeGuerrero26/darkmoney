import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { formatDateTime, formatRelativeTime } from "../../../lib/formatting/dates";
import {
  formatNotificationChannelLabel,
  formatNotificationKindLabel,
  formatNotificationStatusLabel,
} from "../../../lib/formatting/labels";
import { isActionRequiredNotificationKind, type InboxNotification } from "../use-notification-inbox";
import {
  getNotificationChannelIcon,
  getNotificationKindIcon,
  getNotificationSourceLabel,
  getToneClasses,
} from "../lib/notifications-presenters";

const iconChipTone: Record<string, string> = {
  success: "border-pine/20 bg-pine/10 text-pine",
  warning: "border-gold/20 bg-gold/10 text-gold",
  danger: "border-ember/20 bg-ember/10 text-ember",
  info: "border-white/10 bg-white/[0.04] text-storm",
  neutral: "border-white/10 bg-white/[0.04] text-storm",
};

type NotificationCardProps = {
  notification: InboxNotification;
  isUpdatingReadState: boolean;
  selected: boolean;
  acceptingId: string | null;
  decliningId: string | null;
  onToggleSelect: (id: string) => void;
  onAccept: (notification: InboxNotification) => void;
  onDecline: (notification: InboxNotification) => void;
  onMarkRead: (notificationId: string, databaseId?: number) => void;
};

export function NotificationCard({
  notification,
  isUpdatingReadState,
  selected,
  acceptingId,
  decliningId,
  onToggleSelect,
  onAccept,
  onDecline,
  onMarkRead,
}: NotificationCardProps) {
  const canMarkRead =
    notification.status !== "read" &&
    !(notification.source === "smart" && isActionRequiredNotificationKind(notification.kind));
  const hasInviteAction =
    notification.source === "smart" && isActionRequiredNotificationKind(notification.kind);
  const canDecline =
    hasInviteAction &&
    (notification.kind === "obligation_share_invite" ||
      (notification.kind === "invite" && notification.href.includes("/share/obligations/")));
  const KindIcon = getNotificationKindIcon(notification.kind);
  const ChannelIcon = getNotificationChannelIcon(notification.channel);
  const navigate = useNavigate();

  function handleCardClick(event: MouseEvent<HTMLElement>) {
    if (event.target instanceof HTMLElement && event.target.closest('button, a, input, label, [role="button"]')) {
      return;
    }
    if (canMarkRead) {
      onMarkRead(notification.id, notification.databaseId);
    }
    navigate(notification.href);
  }

  return (
    <article
      className={`cursor-pointer rounded-[24px] border p-5 transition hover:border-white/20 ${getToneClasses(notification.tone)} ${selected ? "ring-2 ring-pine/30" : ""}`}
      onClick={handleCardClick}
    >
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
          <div className="flex items-start gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border ${iconChipTone[notification.tone] ?? iconChipTone.neutral}`}>
              <KindIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-2xl font-semibold text-ink">{notification.title}</p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-storm">{notification.body}</p>
            </div>
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-storm" title={formatDateTime(notification.scheduledFor)}>
            {formatRelativeTime(notification.scheduledFor)}
          </p>
        </div>
        </div>

        <div className="flex min-w-[220px] flex-col gap-3">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Canal</p>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-ink">
              <ChannelIcon className="h-3.5 w-3.5 text-storm" />
              {formatNotificationChannelLabel(notification.channel)}
            </p>
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
            {canDecline ? (
              <Button
                className="text-[#ffb4bc] hover:text-white"
                disabled={decliningId === notification.id}
                onClick={() => onDecline(notification)}
                variant="ghost"
              >
                {decliningId === notification.id ? "Rechazando..." : "Rechazar"}
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
