import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { React, act, createRoot, dom, load, mock, root, settle, QueryClient, QueryClientProvider } from "./lib/web-ui-harness.mjs";
const { useQuery } = createRequire(resolve(root, "package.json"))("@tanstack/react-query");

globalThis.localStorage = dom.window.localStorage;
globalThis.preferenceWrites = [];
globalThis.preferenceGate = null;
mock("src/services/queries/workspace-data.ts", `
  const mutation=(kind,userId)=>({mutateAsync:async value=>{
    globalThis.preferenceWrites.push({kind,userId,value:structuredClone(value)});
    if(globalThis.preferenceGate)await globalThis.preferenceGate;
  }});
  export const useSaveUiPrefsMutation=userId=>mutation('ui',userId);
  export const useSaveSmartNotificationReadsMutation=userId=>mutation('reads',userId);
`);
const { UserPreferencesProvider, useUserPreferences } = await import(load("src/modules/notifications/user-preferences-context.tsx"));
const { NotificationReadsProvider, useNotificationReads } = await import(load("src/modules/notifications/notification-reads-context.tsx"));
const { normalizeUiPreferences, normalizeSmartReads, uiPreferencesStorageKey } = await import(load("src/modules/notifications/lib/personal-preferences.ts"));
const empty = { view_modes: {}, column_visibility: {} }, stamp = "2026-10-16T12:00:00Z";
const remoteA = { view_modes: { accounts: "grid" }, column_visibility: { dm_col_accounts: { type: true } } };
const remoteB = { view_modes: { contacts: "list" }, column_visibility: { dm_col_contacts: { email: false } } };
assert.deepEqual(normalizeUiPreferences(JSON.parse('{"view_modes":{"accounts":"table","bad":"evil","__proto__":"grid"},"column_visibility":{"x":{"valid":false,"wrong":"false"},"array":[]}}')), { view_modes: { accounts: "table" }, column_visibility: { x: { valid: false } } });
assert.deepEqual(normalizeSmartReads({ "smart:budget:1": stamp, "smart:invite:token": stamp, "smart:bad": "invalid", arbitrary: stamp }), { "smart:budget:1": stamp });
assert.deepEqual(normalizeUiPreferences(null), empty);
assert.deepEqual(normalizeUiPreferences({ view_modes: { hostile: { toString: 5 } } }), empty);

// Deterministic two-second debounce without delaying the test or changing production code.
const originalTimeout = globalThis.setTimeout, originalClear = globalThis.clearTimeout, delayed = new Map();
globalThis.setTimeout = (callback, delay, ...args) => {
  if (delay !== 2000) return originalTimeout(callback, delay, ...args);
  const id = { preferenceTimer: true }; delayed.set(id, () => callback(...args)); return id;
};
globalThis.clearTimeout = id => { if (!delayed.delete(id)) originalClear(id); };
async function flushUi() { const jobs = [...delayed.values()]; delayed.clear(); await act(async () => jobs.forEach(run => run())); await settle(); }
const writes = kind => globalThis.preferenceWrites.filter(row => row.kind === kind);
let preferences, reads;
function Probe() {
  preferences = useUserPreferences(); reads = useNotificationReads();
  return React.createElement("pre", null, JSON.stringify({ views: preferences.viewModes, columns: preferences.columnVisibility, reads: reads.smartReadMap }));
}
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
async function render(userId, initialUiPrefs, initialSmartReads, strict = false) {
  const tree = React.createElement(NotificationReadsProvider, { userId, initialSmartReads }, React.createElement(UserPreferencesProvider, { userId, initialUiPrefs }, React.createElement(Probe)));
  await act(async () => renderer.render(strict ? React.createElement(React.StrictMode, null, tree) : tree)); await settle();
}
localStorage.setItem("dm_view_accounts", "grid"); localStorage.setItem("dm_col_accounts", '{"secret":true}');
await render("A", undefined, undefined);
assert.deepEqual(preferences.viewModes, {}); assert.deepEqual(preferences.columnVisibility, {}); assert.deepEqual(reads.smartReadMap, {});
await act(async () => { preferences.setViewMode("accounts", "table"); preferences.setColumnVisibility("dm_col_accounts", { type: false }); reads.markSmartAsRead(["smart:budget:local", "smart:invite:do-not-read"]); });
await flushUi(); assert.equal(globalThis.preferenceWrites.length, 0, "pending first read cannot overwrite unseen server preferences");
await render("A", remoteA, { "smart:budget:server": stamp });
assert.equal(preferences.viewModes.accounts, "table"); assert.equal(preferences.columnVisibility.dm_col_accounts.type, false);
assert.ok(reads.smartReadMap["smart:budget:local"]); assert.equal(reads.smartReadMap["smart:budget:server"], stamp); assert.equal(reads.smartReadMap["smart:invite:do-not-read"], undefined);
await flushUi(); assert.equal(writes("ui").length, 1); assert.equal(writes("reads").length, 1);
assert.equal(writes("ui")[0].userId, "A"); assert.equal(writes("ui")[0].value.view_modes.accounts, "table");
assert.equal(localStorage.getItem("dm_view_accounts"), "grid", "legacy data is preserved, never assigned to an unknown owner");
assert.equal(JSON.parse(localStorage.getItem(uiPreferencesStorageKey("A"))).view_modes.accounts, "table");

// A server refresh after a confirmed save must not cause an endless write/invalidate loop.
await render("A", structuredClone(writes("ui")[0].value), structuredClone(writes("reads")[0].value)); await flushUi();
assert.equal(writes("ui").length, 1); assert.equal(writes("reads").length, 1);
await render("A", { ...remoteA, view_modes: { accounts: "list" } }, { "smart:budget:new-server": stamp });
assert.equal(preferences.viewModes.accounts, "list"); assert.deepEqual(reads.smartReadMap, { "smart:budget:new-server": stamp });

const stalePreferences = preferences, staleReads = reads;
await act(async () => preferences.setViewMode("budgets", "table"));
const beforeSwitch = globalThis.preferenceWrites.length;
await render("B", undefined, undefined); await flushUi();
assert.deepEqual(preferences.viewModes, {}); assert.deepEqual(reads.smartReadMap, {});
assert.equal(globalThis.preferenceWrites.length, beforeSwitch, "switch cancels A's queued save");
await act(async () => { stalePreferences.setViewMode("leaked", "grid"); staleReads.markSmartAsRead(["smart:leaked"]); }); await flushUi();
assert.equal(globalThis.preferenceWrites.length, beforeSwitch, "callbacks from an unmounted account cannot save");
await render("B", remoteB, {});
assert.deepEqual(preferences.viewModes, remoteB.view_modes); assert.deepEqual(preferences.columnVisibility, remoteB.column_visibility);
assert.equal(localStorage.getItem(uiPreferencesStorageKey("B"))?.includes("accounts"), false);
await render(undefined, null, {});
await act(async () => { preferences.setViewMode("accounts", "list"); reads.markSmartAsRead(["smart:signed-out"]); }); await flushUi();
assert.deepEqual(preferences.viewModes, {}); assert.deepEqual(reads.smartReadMap, {}); assert.equal(globalThis.preferenceWrites.length, beforeSwitch);
await render("A", undefined, undefined); assert.equal(preferences.viewModes.budgets, "table", "only A restores A's unsent local preferences");

// Corrupt or blocked browser storage must not break the UI or pick up another account.
localStorage.setItem(uiPreferencesStorageKey("corrupt"), "{bad"); await render("corrupt", null, {}); assert.deepEqual(preferences.viewModes, {});
const realStorage = globalThis.localStorage;
globalThis.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
await render("private", null, {});
await act(async () => preferences.setViewMode("accounts", "list")); await flushUi();
assert.equal(preferences.viewModes.accounts, "list"); assert.equal(writes("ui").at(-1).userId, "private"); globalThis.localStorage = realStorage;

// Serial writes preserve the latest local edit when an older request is slow.
await render("serial", null, {});
let finish; globalThis.preferenceGate = new Promise(resolve => { finish = resolve; });
await act(async () => preferences.setViewMode("accounts", "grid")); await flushUi(); const firstSerial = writes("ui").length;
await act(async () => preferences.setViewMode("accounts", "table")); await flushUi(); assert.equal(writes("ui").length, firstSerial);
globalThis.preferenceGate = null; await act(async () => finish()); await flushUi();
assert.equal(writes("ui").length, firstSerial + 1); assert.equal(writes("ui").at(-1).value.view_modes.accounts, "table");

await render("read-serial", null, {});
globalThis.preferenceGate = new Promise(resolve => { finish = resolve; });
await act(async () => reads.markSmartAsRead(["smart:first"])); await settle(); const firstReadSerial = writes("reads").length;
await act(async () => reads.markSmartAsRead(["smart:second"])); await settle(); assert.equal(writes("reads").length, firstReadSerial);
globalThis.preferenceGate = null; await act(async () => finish()); await settle();
assert.equal(writes("reads").length, firstReadSerial + 1); assert.ok(writes("reads").at(-1).value["smart:first"]); assert.ok(writes("reads").at(-1).value["smart:second"]);

await render("old-flight", null, {}); globalThis.preferenceGate = new Promise(resolve => { finish = resolve; });
await act(async () => reads.markSmartAsRead(["smart:already-sent"])); await settle();
await act(async () => reads.markSmartAsRead(["smart:queued"])); await settle(); const beforeLate = writes("reads").length;
await render("new-flight", null, {}); globalThis.preferenceGate = null; await act(async () => finish()); await settle();
assert.equal(writes("reads").length, beforeLate, "already sent old-user requests cannot flush queued work after account change"); assert.deepEqual(reads.smartReadMap, {});

// StrictMode cannot duplicate writes from a state updater; no automatic retry after failure.
await render("strict", null, {}, true); const beforeStrict = writes("reads").length;
await act(async () => reads.markSmartAsRead(["smart:strict"])); await settle(); assert.equal(writes("reads").length, beforeStrict + 1);
let fail; globalThis.preferenceGate = new Promise((_, reject) => { fail = reject; });
await act(async () => preferences.setViewMode("accounts", "grid")); await flushUi(); const beforeFailure = writes("ui").length;
await act(async () => fail(new Error("offline"))); globalThis.preferenceGate = null; await flushUi();
assert.equal(writes("ui").length, beforeFailure); assert.equal(preferences.viewModes.accounts, "grid");
await render("strict", structuredClone(remoteB), {}, true); await flushUi(); assert.equal(writes("ui").length, beforeFailure, "background reads must not retry a failed write"); assert.equal(preferences.viewModes.accounts, "grid");
await act(async () => preferences.setViewMode("accounts", "list")); await flushUi(); assert.equal(writes("ui").length, beforeFailure + 1);
await act(async () => preferences.setViewMode("contacts", "table")); const beforeUnmount = writes("ui").length;
await act(async () => renderer.unmount()); await flushUi(); assert.equal(writes("ui").length, beforeUnmount);

// Execute the actual web hook with real React Query to catch cross-user placeholder reuse.
const source = readFileSync(resolve(root, "src/services/queries/workspace-data.ts"), "utf8");
const shell = readFileSync(resolve(root, "src/app/layouts/app-shell.tsx"), "utf8");
assert.match(shell, /initialSmartReads=\{notificationPreferencesQuery\.isSuccess \? notificationPreferencesQuery\.data\?\.smartReads \?\? \{\} : undefined\}/);
assert.match(shell, /initialUiPrefs=\{notificationPreferencesQuery\.isSuccess \? notificationPreferencesQuery\.data\?\.uiPrefs \?\? null : undefined\}/);
const ast = ts.createSourceFile("workspace-data.ts", source, ts.ScriptTarget.Latest, true); const node = ast.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === "useNotificationPreferencesQuery"); assert.ok(node);
const js = ts.transpileModule(node.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const fetches = new Map();
const actualHook = new Function("useQuery", "fetchNotificationPreferences", `${js}; return useNotificationPreferencesQuery;`)(useQuery, userId => new Promise((resolve, reject) => fetches.set(userId, { resolve, reject })));
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const queryRoot = createRoot(container); let query;
function QueryProbe({ userId }) { query = actualHook(userId); return React.createElement("pre", null, JSON.stringify({ status: query.status, data: query.data ?? null })); }
async function renderQuery(userId) { await act(async () => queryRoot.render(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(QueryProbe, { userId })))); await settle(); }
await renderQuery("A"); await act(async () => fetches.get("A").resolve({ smartReads: { "smart:A": stamp }, uiPrefs: remoteA })); await settle(); assert.equal(query.data.uiPrefs.view_modes.accounts, "grid");
await renderQuery("B"); assert.equal(query.data, undefined); assert.equal(query.isPlaceholderData, false);
await act(async () => fetches.get("B").reject(new Error("no access"))); await settle(); assert.equal(query.data, undefined); assert.equal(query.isError, true);
await renderQuery(undefined); assert.equal(query.data, undefined);
await act(async () => queryRoot.unmount()); queryClient.clear(); container.remove(); dom.window.close();
globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear;
console.log("personal-preferences: OK (actual providers/hooks, account-keyed storage, no legacy import, pending-read merge, serial writes, debounce/unmount/old callback guards, A-B-A/logout, StrictMode, blocked/corrupt storage, failure without retry, real query without cross-user placeholder; fake IO only)");
