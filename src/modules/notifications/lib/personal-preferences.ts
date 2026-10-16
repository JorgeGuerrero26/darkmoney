import type { UiPrefs } from "../../../services/queries/workspace-data";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const safeKey = (key: string) => key.length > 0 && key.length <= 200 && !["__proto__", "prototype", "constructor"].includes(key);

export function sameColumns(left: Record<string, boolean> | undefined, right: Record<string, boolean> | undefined) {
  return Boolean(left && right && Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([key, value]) => Object.prototype.hasOwnProperty.call(right, key) && right[key] === value));
}

export const uiPreferencesStorageKey = (userId: string) => `darkmoney.ui-prefs.v1.${encodeURIComponent(userId)}`;

export function normalizeUiPreferences(value: unknown): UiPrefs {
  const source = record(value) ? value : {};
  return {
    view_modes: Object.fromEntries(Object.entries(record(source.view_modes) ? source.view_modes : {}).filter(([key, mode]) => safeKey(key) && typeof mode === "string" && ["grid", "list", "table"].includes(mode))),
    column_visibility: Object.fromEntries(Object.entries(record(source.column_visibility) ? source.column_visibility : {}).filter(([key, columns]) => safeKey(key) && record(columns)).map(([key, columns]) =>
      [key, Object.fromEntries(Object.entries(columns as Record<string, unknown>).filter(([column, visible]) => safeKey(column) && typeof visible === "boolean"))])),
  } as UiPrefs;
}

export function normalizeSmartReads(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(record(value) ? value : {}).filter((entry): entry is [string, string] => entry[0].startsWith("smart:") && !entry[0].startsWith("smart:invite:") && typeof entry[1] === "string" && Number.isFinite(Date.parse(entry[1]))));
}

export function readUiPreferences(userId?: string): UiPrefs {
  if (!userId) return normalizeUiPreferences(null);
  try { return normalizeUiPreferences(JSON.parse(localStorage.getItem(uiPreferencesStorageKey(userId)) ?? "null")); }
  catch { return normalizeUiPreferences(null); }
}

export function writeUiPreferences(userId: string, value: UiPrefs) {
  try { localStorage.setItem(uiPreferencesStorageKey(userId), JSON.stringify(value)); } catch { /* Preferences still work in memory. */ }
}
