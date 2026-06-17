import type { NotificationItem } from "../../../types/domain";

export type NotificationSourceFilter = "all" | "database" | "smart";
export type NotificationStatusFilter = "all" | NotificationItem["status"];

export type NotificationTableFilters = {
  title: string;
  source: NotificationSourceFilter;
  status: NotificationStatusFilter;
  kind: string;
  channel: string;
  scheduledFrom: string;
  scheduledTo: string;
};

export type NotificationTableFilterField = keyof NotificationTableFilters;

export const defaultNotificationTableFilters = (): NotificationTableFilters => ({
  title: "",
  source: "all",
  status: "all",
  kind: "",
  channel: "",
  scheduledFrom: "",
  scheduledTo: "",
});

export function isNotificationTableFilterActive(
  filters: NotificationTableFilters,
  field: NotificationTableFilterField,
) {
  switch (field) {
    case "title":
    case "kind":
    case "channel":
      return Boolean(filters[field].trim());
    case "scheduledFrom":
    case "scheduledTo":
      return Boolean(filters[field]);
    case "source":
    case "status":
      return filters[field] !== "all";
    default:
      return false;
  }
}
