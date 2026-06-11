import {
  DASHBOARD_HIDDEN_WIDGETS_STORAGE_KEY,
  DASHBOARD_MODE_STORAGE_KEY,
  dashboardWidgetDefinitions,
} from "./dashboard-types";
import type { DashboardMode, DashboardWidgetId } from "./dashboard-types";

export function readStoredDashboardMode(): DashboardMode {
  if (typeof window === "undefined") {
    return "advanced";
  }

  const storedValue = window.localStorage.getItem(DASHBOARD_MODE_STORAGE_KEY);
  return storedValue === "simple" ? "simple" : "advanced";
}

export function readStoredHiddenWidgets(): DashboardWidgetId[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(DASHBOARD_HIDDEN_WIDGETS_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter((value): value is DashboardWidgetId =>
      dashboardWidgetDefinitions.some((widget) => widget.id === value),
    );
  } catch {
    return [];
  }
}
