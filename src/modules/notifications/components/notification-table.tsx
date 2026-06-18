import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { InlineDateRangePicker } from "../../../components/ui/inline-date-range-picker";
import { StatusBadge } from "../../../components/ui/status-badge";
import { TableColumnFilterMenu, TableFilterOptionButton } from "../../../components/ui/table-column-filter-menu";
import { formatDateTime } from "../../../lib/formatting/dates";
import {
  formatNotificationChannelLabel,
  formatNotificationKindLabel,
  formatNotificationStatusLabel,
} from "../../../lib/formatting/labels";
import { isActionRequiredNotificationKind, type InboxNotification } from "../use-notification-inbox";
import {
  isNotificationTableFilterActive,
  type NotificationSourceFilter,
  type NotificationStatusFilter,
  type NotificationTableFilterField,
  type NotificationTableFilters,
} from "../lib/notifications-filters";
import { getNotificationSourceLabel } from "../lib/notifications-presenters";

const filterInputClassName =
  "w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";

const headerCellClassName =
  "relative px-5 py-3 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55";

const sourceFilterValues: Array<{ value: NotificationSourceFilter; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "smart", label: "Inteligente" },
  { value: "database", label: "Guardada" },
];

const statusFilterValues: Array<{ value: NotificationStatusFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendiente" },
  { value: "sent", label: "Enviada" },
  { value: "read", label: "Leida" },
  { value: "failed", label: "Fallida" },
];

type ColumnVisibilityFn = (key: string, hiddenClassName?: string) => string;

type NotificationTableProps = {
  notifications: InboxNotification[];
  availableKinds: string[];
  availableChannels: string[];
  isUpdatingReadState: boolean;
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  acceptingId: string | null;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onAccept: (notification: InboxNotification) => void;
  onMarkRead: (notificationId: string, databaseId?: number) => void;
  cv: ColumnVisibilityFn;
  filters: NotificationTableFilters;
  openFilter: NotificationTableFilterField | null;
  onUpdateFilter: <Field extends keyof NotificationTableFilters>(field: Field, value: NotificationTableFilters[Field]) => void;
  onClearSingleFilter: (field: NotificationTableFilterField) => void;
  onToggleFilterMenu: (field: NotificationTableFilterField) => void;
  onCloseFilterMenu: () => void;
  onApplyFilterAndClose: <Field extends NotificationTableFilterField>(field: Field, value: NotificationTableFilters[Field]) => void;
};

export function NotificationTable({
  notifications,
  availableKinds,
  availableChannels,
  isUpdatingReadState,
  selectedIds,
  allSelected,
  someSelected,
  acceptingId,
  onToggleSelect,
  onToggleSelectAll,
  onAccept,
  onMarkRead,
  cv,
  filters,
  openFilter,
  onUpdateFilter,
  onClearSingleFilter,
  onToggleFilterMenu,
  onCloseFilterMenu,
  onApplyFilterAndClose,
}: NotificationTableProps) {
  return (
    <div className="overflow-x-auto rounded-[24px] border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.02]">
            <th className="w-10 px-4 py-3.5">
              <SelectionCheckbox
                ariaLabel="Seleccionar todas las notificaciones visibles"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={onToggleSelectAll}
              />
            </th>
            <th className={headerCellClassName}>
              <TableColumnFilterMenu
                active={isNotificationTableFilterActive(filters, "title")}
                isOpen={openFilter === "title"}
                label="Notificacion"
                onClear={() => onClearSingleFilter("title")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("title")}
              >
                <div className="space-y-3">
                  <input
                    className={filterInputClassName}
                    onChange={(event) => onUpdateFilter("title", event.target.value)}
                    placeholder="Titulo o detalle..."
                    type="text"
                    value={filters.title}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("tipo", "hidden md:table-cell")}`}>
              <TableColumnFilterMenu
                active={isNotificationTableFilterActive(filters, "kind")}
                isOpen={openFilter === "kind"}
                label="Tipo"
                onClear={() => onClearSingleFilter("kind")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("kind")}
              >
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  <TableFilterOptionButton onClick={() => onApplyFilterAndClose("kind", "")} selected={!filters.kind}>
                    Todos
                  </TableFilterOptionButton>
                  {availableKinds.map((kind) => (
                    <TableFilterOptionButton key={kind} onClick={() => onApplyFilterAndClose("kind", kind)} selected={filters.kind === kind}>
                      {formatNotificationKindLabel(kind)}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("origen", "hidden md:table-cell")}`}>
              <TableColumnFilterMenu
                active={isNotificationTableFilterActive(filters, "source")}
                isOpen={openFilter === "source"}
                label="Origen"
                onClear={() => onClearSingleFilter("source")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("source")}
              >
                <div className="space-y-1">
                  {sourceFilterValues.map((option) => (
                    <TableFilterOptionButton key={option.value} onClick={() => onApplyFilterAndClose("source", option.value)} selected={filters.source === option.value}>
                      {option.label}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("canal", "hidden lg:table-cell")}`}>
              <TableColumnFilterMenu
                active={isNotificationTableFilterActive(filters, "channel")}
                isOpen={openFilter === "channel"}
                label="Canal"
                onClear={() => onClearSingleFilter("channel")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("channel")}
              >
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  <TableFilterOptionButton onClick={() => onApplyFilterAndClose("channel", "")} selected={!filters.channel}>
                    Todos
                  </TableFilterOptionButton>
                  {availableChannels.map((channel) => (
                    <TableFilterOptionButton key={channel} onClick={() => onApplyFilterAndClose("channel", channel)} selected={filters.channel === channel}>
                      {formatNotificationChannelLabel(channel)}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("programada", "hidden xl:table-cell")}`}>
              <TableColumnFilterMenu
                active={
                  isNotificationTableFilterActive(filters, "scheduledFrom") ||
                  isNotificationTableFilterActive(filters, "scheduledTo")
                }
                isOpen={openFilter === "scheduledFrom" || openFilter === "scheduledTo"}
                label="Programada"
                minWidthClassName="min-w-[320px]"
                onClear={() => {
                  onClearSingleFilter("scheduledFrom");
                  onClearSingleFilter("scheduledTo");
                }}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("scheduledFrom")}
              >
                <div className="space-y-3">
                  <InlineDateRangePicker
                    endDate={filters.scheduledTo}
                    onEndDateChange={(value) => onUpdateFilter("scheduledTo", value)}
                    onStartDateChange={(value) => onUpdateFilter("scheduledFrom", value)}
                    startDate={filters.scheduledFrom}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("estado", "hidden sm:table-cell")}`}>
              <TableColumnFilterMenu
                active={isNotificationTableFilterActive(filters, "status")}
                isOpen={openFilter === "status"}
                label="Estado"
                onClear={() => onClearSingleFilter("status")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("status")}
              >
                <div className="space-y-1">
                  {statusFilterValues.map((option) => (
                    <TableFilterOptionButton key={option.value} onClick={() => onApplyFilterAndClose("status", option.value)} selected={filters.status === option.value}>
                      {option.label}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right`}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {notifications.map((notification, index) => {
            const canMarkRead =
              notification.status !== "read" &&
              !(notification.source === "smart" && isActionRequiredNotificationKind(notification.kind));
            const hasInviteAction =
              notification.source === "smart" && isActionRequiredNotificationKind(notification.kind);

            return (
              <tr
                className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === notifications.length - 1 ? "border-b-0" : ""} ${notification.status !== "read" ? "bg-white/[0.02]" : ""}`}
                key={notification.id}
              >
                <td className="w-10 px-4 py-4 align-top">
                  <SelectionCheckbox
                    ariaLabel={`Seleccionar ${notification.title}`}
                    checked={selectedIds.has(notification.id)}
                    onChange={() => onToggleSelect(notification.id)}
                  />
                </td>
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
                  <StatusBadge status={getNotificationSourceLabel(notification.source)} tone={notification.source === "smart" ? "success" : "neutral"} />
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
                    {hasInviteAction ? (
                      <Button className="py-1.5 text-xs" disabled={acceptingId === notification.id} onClick={() => onAccept(notification)}>
                        {acceptingId === notification.id ? "Aceptando..." : "Aceptar"}
                      </Button>
                    ) : null}
                    <Link
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-storm transition hover:border-white/18 hover:bg-white/[0.07] hover:text-ink"
                      to={notification.href}
                    >
                      {hasInviteAction ? "Ver" : "Ir"}
                    </Link>
                    {canMarkRead ? (
                      <Button disabled={isUpdatingReadState} onClick={() => onMarkRead(notification.id, notification.databaseId)} variant="ghost">
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
  );
}
