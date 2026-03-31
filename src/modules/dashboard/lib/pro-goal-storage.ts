const STORAGE_KEY = "darkmoney.dashboard.proPrimaryGoal.v1";

type GoalStore = Record<string, { monthlySavingsTarget: number }>;

function parseStore(raw: string | null): GoalStore {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed as GoalStore;
  } catch {
    return {};
  }
}

export function readMonthlySavingsTarget(workspaceId: number): number | null {
  if (typeof window === "undefined") {
    return null;
  }
  const entry = parseStore(window.localStorage.getItem(STORAGE_KEY))[String(workspaceId)];
  if (!entry || typeof entry.monthlySavingsTarget !== "number" || entry.monthlySavingsTarget <= 0) {
    return null;
  }
  return entry.monthlySavingsTarget;
}

export function writeMonthlySavingsTarget(workspaceId: number, target: number | null) {
  if (typeof window === "undefined") {
    return;
  }
  const store = parseStore(window.localStorage.getItem(STORAGE_KEY));
  const key = String(workspaceId);
  if (target === null || target <= 0) {
    delete store[key];
  } else {
    store[key] = { monthlySavingsTarget: target };
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
