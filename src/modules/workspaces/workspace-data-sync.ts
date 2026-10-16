export const workspaceSyncTables = ["accounts", "movements", "categories", "counterparties", "obligations", "subscriptions", "recurring_income", "budgets", "spend_types"] as const;
export const workspaceSyncQueryNames = ["workspace-snapshot", "dashboard-projection-inputs", "categories-overview", "counterparties-overview", "budget-spend-types", "recurring_income_occurrences", "subscription-occurrences", "obligation-shares", "obligation-payment-request-counts", "obligation-payment-requests-pending"] as const;

export function isWorkspaceDataQuery(key: readonly unknown[], workspaceId: number) {
  return key[1] === workspaceId && workspaceSyncQueryNames.some((name) => name === key[0]);
}

type Runtime = {
  subscribe: (changed: () => void) => () => void;
  onWake: (wake: () => void) => () => void;
  every: (ms: number, callback: () => void) => () => void;
  after: (ms: number, callback: () => void) => () => void;
  isVisible: () => boolean;
  hasStaleData: () => boolean;
  invalidate: () => Promise<unknown>;
};

/** One coordinator per active workspace: coalesced events, reconnect/focus and polling fallback. */
export function startWorkspaceDataSync(runtime: Runtime) {
  let disposed = false;
  let pending = false;
  let running = false;
  let cancelTimer: (() => void) | null = null;
  function schedule() {
    if (disposed || !runtime.isVisible() || running || cancelTimer) return;
    cancelTimer = runtime.after(120, () => {
      cancelTimer = null;
      if (disposed || !runtime.isVisible()) return;
      pending = false;
      running = true;
      let failed = false;
      void runtime.invalidate().catch(() => { pending = true; failed = true; }).finally(() => {
        running = false;
        // A new event during a fetch needs one more pass. A failed fetch waits for the next wake.
        if (!disposed && pending && !failed) schedule();
      });
    });
  }
  function changed() { pending = true; schedule(); }
  function wake() { if (runtime.isVisible() && (pending || runtime.hasStaleData())) changed(); }
  const unsubscribe = runtime.subscribe(changed);
  const removeWake = runtime.onWake(wake);
  // Also covers tables missing from the deployed Realtime publication and events lost offline.
  const stopPolling = runtime.every(60_000, wake);
  wake();
  return () => { disposed = true; cancelTimer?.(); unsubscribe(); removeWake(); stopPolling(); };
}
