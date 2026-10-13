import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
import React, { act } from "react";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "package.json"));
const mobileRequire = createRequire(resolve(root, "../DarkMoneyApp/package.json"));
const virtual = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const mock = new Map([[resolve(root, "src/services/supabase/client.ts"), virtual("export const supabase=null;")]]);
function load(file) {
  if (mock.has(file)) return mock.get(file);
  let js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  js = js.replace(/from "([^"]+)"/g, (_, specifier) => {
    if (!specifier.startsWith(".")) return `from "${pathToFileURL(require.resolve(specifier)).href}"`;
    const base = resolve(dirname(file), specifier);
    const dependency = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
    assert.ok(dependency, specifier); return `from "${load(dependency)}"`;
  });
  const url = virtual(js); mock.set(file, url); return url;
}
const servicePath = resolve(root, "src/services/queries/notification-destination.ts");
const { fetchNotificationDestination } = await import(load(servicePath));
const { notificationDestinationHref, notificationMatchesActiveSpace } = await import(load(resolve(root, "src/modules/notifications/lib/notification-navigation.ts")));
const workspace = (id) => ({ id, name: `Espacio ${id}`, kind: "shared", role: "member", description: "", baseCurrencyCode: "PEN", ownerUserId: "owner" });
const dbWorkspace = (id) => ({ id, name: `Espacio ${id}`, kind: "shared", description: "", base_currency_code: "PEN", owner_user_id: "owner", is_archived: false });
const notice = (patch = {}) => ({ id: 10, user_id: "u", kind: "negative_balance", status: "sent", related_entity_type: "account", related_entity_id: 7, payload: {}, ...patch });
const seed = (notification = notice(), extra = {}) => ({ notifications: [notification], accounts: [{ id: 7, workspace_id: 2 }], workspaces: [dbWorkspace(1), dbWorkspace(2)], workspace_members: [{ user_id: "u", workspace_id: 1, role: "owner" }, { user_id: "u", workspace_id: 2, role: "member" }], ...extra });
function database(tables, fail = null) {
  const calls = [];
  return { calls, from(table) {
    const call = { table, filters: [] }; calls.push(call); let limit = Infinity;
    return {
      select(columns) { call.select = columns; return this; }, eq(...values) { call.filters.push(values); return this; },
      order() { return this; }, limit(value) { limit = value; return this; },
      async maybeSingle() {
        if (table === fail) return { data: null, error: new Error(`Failed ${table}`) };
        const rows = (tables[table] ?? []).filter((row) => call.filters.every(([field, value]) => row[field] === value)).slice(0, limit);
        assert.ok(rows.length < 2, `Ambiguous ${table}`); return { data: rows[0] ?? null, error: null };
      },
    };
  } };
}
const initialDb = database(seed());
const target = await fetchNotificationDestination(initialDb, "u", 10);
assert.equal(target.workspace.id, 2); assert.equal(target.scope, "workspace");
assert.equal(target.href, "/app/accounts?resource=7"); assert.equal(target.shouldMarkRead, true);
assert.deepEqual(initialDb.calls[0].filters, [["user_id", "u"], ["id", 10]]);
assert.ok(initialDb.calls.every(call => !/insert|update|delete|rpc/.test(call.select)));
await assert.rejects(fetchNotificationDestination(database(seed()), "other-user", 10), /usuario/);
await assert.rejects(fetchNotificationDestination(database(seed(notice({ payload: { workspaceId: 1 } }))), "u", 10), /no pertenece/);
await assert.rejects(fetchNotificationDestination(database(seed(notice({ payload: { workspaceId: -1 } }))), "u", 10), /no es válido/);
await assert.rejects(fetchNotificationDestination(database(seed(notice({ payload: { workspaceId: 2, workspace_id: 1 } }))), "u", 10), /incompatibles/);
await assert.rejects(fetchNotificationDestination(database(seed(notice(), { accounts: [] })), "u", 10), /recurso/);
await assert.rejects(fetchNotificationDestination(database(seed(notice(), { workspace_members: [{ user_id: "u", workspace_id: 1, role: "owner" }] })), "u", 10), /acceso/);
await assert.rejects(fetchNotificationDestination(database(seed(notice(), { workspaces: [{ ...dbWorkspace(2), is_archived: true }] })), "u", 10), /archivado/);
await assert.rejects(fetchNotificationDestination(database(seed(), "workspace_members"), "u", 10), /Failed workspace_members/);
await assert.rejects(fetchNotificationDestination(database(seed(), "accounts"), "u", 10), /Failed accounts/);
await assert.rejects(fetchNotificationDestination(database(seed(notice({ kind: "daily_digest", related_entity_type: null, related_entity_id: null }))), "u", 10), /no identifica/);
const dayTarget = await fetchNotificationDestination(database(seed(notice({ kind: "daily_digest", related_entity_type: "workspace", related_entity_id: 2, payload: { todayKey: "2020-01-01" } }))), "u", 10);
assert.equal(dayTarget.workspace.id, 2); assert.equal(dayTarget.href, "/app?day=2020-01-01");
const invitation = await fetchNotificationDestination(database(seed(notice({ kind: "workspace_invite", related_entity_type: "workspace", related_entity_id: 2 }))), "u", 10);
assert.equal(invitation.scope, "global"); assert.equal(invitation.shouldMarkRead, false);
for (const kind of ["multiple_subscriptions_due", "subscription_cost_heavy", "subscription_reminder", "negative_balance"]) {
  const group = await fetchNotificationDestination(database(seed(notice({ kind, related_entity_type: "workspace", related_entity_id: 2 }))), "u", 10);
  assert.equal(group.workspace.id, 2);
  assert.equal(new URL(group.href, "https://test.invalid").searchParams.get("resource"), null, `workspace ID must not be a resource ID: ${kind}`);
}
for (const [kind, entity, table, path] of [
  ["subscription_reminder", "subscription", "subscriptions", "/app/subscriptions"],
  ["budget_period_ended", "budget", "budgets", "/app/budgets"],
  ["custom", "movement", "movements", "/app/movements"],
  ["category_spending_spike", "category", "categories", "/app/movements"],
  ["recurring_income_reminder", "recurring_income", "recurring_income", "/app/recurring-income"],
]) {
  const result = await fetchNotificationDestination(database(seed(notice({ kind, related_entity_type: entity }), { [table]: [{ id: 7, workspace_id: 2 }] })), "u", 10);
  assert.equal(result.workspace.id, 2); assert.ok(result.href.startsWith(path));
}
const detectionDb = database(seed(notice({ kind: "detected_movement_suggestion", related_entity_type: "detected_movement_suggestion", payload: { suggestionId: 7 } }), { notification_detected_movement_suggestions: [{ id: 7, workspace_id: 2, user_id: "u" }] }));
const detectionTarget = await fetchNotificationDestination(detectionDb, "u", 10);
assert.equal(detectionTarget.workspace.id, 2); assert.equal(detectionTarget.shouldMarkRead, false);
assert.deepEqual(detectionDb.calls.find(row => row.table === "notification_detected_movement_suggestions").filters, [["id", 7], ["user_id", "u"]]);
// An accepted share can be viewed without being a member of its owner's space. No switch to the owner.
const sharedSeed = seed(notice({ kind: "obligation_event_updated", related_entity_type: "obligation", payload: { obligationId: 7, eventId: 3, workspaceId: 2 } }), {
  obligations: [], workspace_members: [{ user_id: "u", workspace_id: 1, role: "owner" }],
  obligation_shares: [{ id: 4, invited_user_id: "u", obligation_id: 7, workspace_id: 2, status: "accepted" }],
});
const shared = await fetchNotificationDestination(database(sharedSeed), "u", 10);
assert.equal(shared.scope, "shared"); assert.equal(shared.workspace, null);
await assert.rejects(fetchNotificationDestination(database({ ...sharedSeed, obligation_shares: [{ ...sharedSeed.obligation_shares[0], status: "revoked" }] }), "u", 10), /acceso/);
const request = await fetchNotificationDestination(database(seed(notice({ kind: "obligation_payment_request", related_entity_type: "obligation", payload: { obligationId: 7, requestId: 3 } }), { obligations: [{ id: 7, workspace_id: 2 }] })), "u", 10);
assert.equal(request.shouldMarkRead, false);
for (const href of ["https://evil.invalid", "//evil.invalid", "/app/../evil"]) assert.equal(notificationDestinationHref(href, 10), "/app/notifications");
assert.equal(notificationDestinationHref("/app/movements?from=2026-09-01&to=2026-09-30", 10), "/app/movements?from=2026-09-01&to=2026-09-30&noticeId=10");
assert.equal(notificationDestinationHref("/share/workspaces/token", 10), "/share/workspaces/token");
assert.equal(notificationMatchesActiveSpace({ source: "smart", workspaceId: 2 }, 1), false);
assert.equal(notificationMatchesActiveSpace({ source: "smart", workspaceId: 2 }, 2), true);
assert.equal(notificationMatchesActiveSpace({ source: "smart" }, 1), true); // Global billing/invitations.
assert.equal(notificationMatchesActiveSpace({ source: "database" }, 1), true); // Uses canonical preflight.

// Actual boundary and QueryClient/Router/UI; only I/O hooks and the local workspace store are mocked.
mock.set(servicePath, virtual("export const useNotificationDestination=()=>globalThis.scopeQuery;"));
mock.set(resolve(root, "src/services/queries/workspace-data.ts"), virtual("export const getQueryErrorMessage=(e,f)=>e?.message??f; export const useMarkNotificationReadMutation=()=>({mutateAsync:async(id)=>{globalThis.readCalls.push(id);if(globalThis.failReading)throw new Error('reading');}});"));
mock.set(resolve(root, "src/stores/workspace-store.ts"), virtual("export const useWorkspaceStore={getState:()=>({activeWorkspaceId:globalThis.scopeActive,setActiveWorkspaceId:(id)=>{globalThis.spaceChanges.push(id);globalThis.scopeActive=id;}})};"));
mock.set(resolve(root, "src/components/ui/toast-provider.tsx"), virtual("export const useToast=()=>({showToast:(toast)=>globalThis.scopeToasts.push(toast)});"));
const { JSDOM } = mobileRequire("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "KeyboardEvent", "MutationObserver"]) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter, useLocation, useNavigate } = await import(pathToFileURL(require.resolve("react-router-dom")).href);
const { QueryClient, QueryClientProvider } = await import(pathToFileURL(require.resolve("@tanstack/react-query")).href);
const { NotificationDestinationBoundary } = await import(load(resolve(root, "src/modules/notifications/components/notification-destination-boundary.tsx")));
let container, renderer, queryClient;
function Probe() {
  globalThis.scopeNavigate = useNavigate(); const location = useLocation();
  return React.createElement("output", { id: "location" }, `${location.pathname}${location.search}`);
}
function Child() {
  React.useEffect(() => { globalThis.childMounts++; }, []);
  return React.createElement("div", { id: "destination" }, "Resource mounted");
}
let props;
function query(data = target) {
  return { data, isPending: false, isFetching: false, isError: false, refetch: async () => ({ data, isError: false }) };
}
async function mount(path = "/app/accounts?resource=7&noticeId=10", data = target) {
  globalThis.scopeQuery = query(data); globalThis.scopeActive = 1;
  globalThis.readCalls = []; globalThis.spaceChanges = []; globalThis.scopeToasts = []; globalThis.childMounts = 0; globalThis.failReading = false;
  queryClient = new QueryClient({ defaultOptions: { mutations: { gcTime: 0 }, queries: { gcTime: Infinity, retry: false } } });
  queryClient.setQueryData(["workspaces", "u"], [workspace(1)]);
  props = { userId: "u", activeWorkspace: workspace(1), snapshotWorkspaceId: 1, snapshotLoading: false, snapshotError: null, onRetrySnapshot: () => {} };
  container = document.createElement("div"); document.body.append(container); renderer = createRoot(container);
  await render(path);
}
async function render(path) {
  await act(async () => renderer.render(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(MemoryRouter, { initialEntries: path ? [path] : undefined }, React.createElement(Probe), React.createElement(NotificationDestinationBoundary, props, React.createElement(Child))))));
}
function button(label) { const result = [...container.querySelectorAll("button")].find(row => row.textContent === label); assert.ok(result, label); return result; }
async function close() { await act(async () => renderer.unmount()); queryClient.clear(); container.remove(); }
await mount();
assert.equal(globalThis.childMounts, 0); assert.deepEqual(globalThis.readCalls, []);
assert.match(container.textContent, /pertenece a Espacio 2/);
let complete;
globalThis.scopeQuery.refetch = () => new Promise(resolve => { complete = resolve; });
await act(async () => { button("Cambiar a Espacio 2").click(); button("Cambiar a Espacio 2").click(); });
assert.deepEqual(globalThis.spaceChanges, []);
await act(async () => complete({ data: target, isError: false }));
assert.deepEqual(globalThis.spaceChanges, [2]); assert.equal(globalThis.childMounts, 0);
assert.equal(queryClient.getQueryData(["workspaces", "u"]).find(row => row.id === 2).role, "member");
props.activeWorkspace = workspace(2); props.snapshotWorkspaceId = 1; props.snapshotLoading = true; await render();
assert.equal(globalThis.childMounts, 0); assert.deepEqual(globalThis.readCalls, []);
props.snapshotWorkspaceId = 2; props.snapshotLoading = false; await render();
assert.equal(globalThis.childMounts, 1); assert.deepEqual(globalThis.readCalls, [10]);
// Consuming resource params after opening must not redirect/reopen the original detail.
await act(async () => globalThis.scopeNavigate("/app/accounts?noticeId=10", { replace: true }));
assert.equal(container.querySelector("#location").textContent, "/app/accounts?noticeId=10");
assert.equal(globalThis.childMounts, 1); await close();

await mount();
globalThis.scopeQuery.refetch = async () => ({ data: undefined, isError: true, error: new Error("Access revoked") });
await act(async () => button("Cambiar a Espacio 2").click());
assert.deepEqual(globalThis.spaceChanges, []); assert.equal(globalThis.childMounts, 0); assert.match(container.textContent, /Access revoked/);
await act(async () => button("Volver a Avisos").click());
assert.equal(container.querySelector("#location").textContent, "/app/notifications"); assert.deepEqual(globalThis.readCalls, []); await close();

// Late responses cannot switch after cancelling or changing user, notice, or selected space.
for (const change of ["cancel", "user", "space", "notice"]) {
  await mount(); let finish;
  globalThis.scopeQuery.refetch = () => new Promise(resolve => { finish = resolve; });
  await act(async () => button("Cambiar a Espacio 2").click());
  if (change === "cancel") await act(async () => button("Volver a Avisos").click());
  if (change === "user") { props.userId = "other-user"; globalThis.scopeQuery = query(undefined); await render(); }
  if (change === "space") globalThis.scopeActive = 3;
  if (change === "notice") { globalThis.scopeQuery = query({ ...target, id: 20 }); await act(async () => globalThis.scopeNavigate("/app/accounts?resource=7&noticeId=20")); }
  await act(async () => finish({ data: target, isError: false }));
  assert.deepEqual(globalThis.spaceChanges, [], change); assert.deepEqual(globalThis.readCalls, [], change); await close();
}
await mount();
globalThis.scopeQuery.refetch = async () => ({ data: { ...target, workspace: workspace(3) }, isError: false });
await act(async () => button("Cambiar a Espacio 2").click());
assert.deepEqual(globalThis.spaceChanges, []); assert.match(container.textContent, /destino del aviso cambió/); await close();
await mount(); let afterUnmount;
globalThis.scopeQuery.refetch = () => new Promise(resolve => { afterUnmount = resolve; });
await act(async () => button("Cambiar a Espacio 2").click());
await close(); await act(async () => afterUnmount({ data: target, isError: false }));
assert.deepEqual(globalThis.spaceChanges, []);
await mount("/app/accounts?resource=7&noticeId=10", { ...target, workspace: workspace(1) });
assert.equal(globalThis.childMounts, 1); assert.deepEqual(globalThis.readCalls, [10]); await close();
await mount("/app/accounts?resource=7&noticeId=10&noticeId=11", { ...target, workspace: workspace(1) });
assert.equal(globalThis.childMounts, 0); assert.deepEqual(globalThis.readCalls, []); await close();
await mount("/app/accounts?resource=7&noticeId=bad");
assert.match(container.textContent, /Aviso no válido/); assert.equal(globalThis.childMounts, 0); await close();
await mount(); globalThis.scopeQuery = { ...query(), isError: true, error: new Error("Offline") }; await render();
assert.match(container.textContent, /Offline/); assert.equal(globalThis.childMounts, 0); await close();
await mount(); globalThis.scopeQuery = { ...query(), isPending: true, isFetching: true }; await render();
assert.match(container.textContent, /Comprobando/); assert.equal(globalThis.childMounts, 0); await close();
await mount("/app/accounts?resource=7&noticeId=10", { ...target, workspace: workspace(1) });
props.snapshotError = new Error("Snapshot failed"); await render();
assert.equal(container.querySelector("#destination"), null); assert.match(container.textContent, /datos anteriores/); await close();
await mount("/app/obligations?resource=7&event=3&notificationKind=obligation_event_updated&noticeId=10", shared);
assert.equal(globalThis.childMounts, 1); assert.deepEqual(globalThis.spaceChanges, []); await close();
await mount("/app/obligations?resource=7&paymentRequest=3&notificationKind=obligation_payment_request&noticeId=10", { ...request, workspace: workspace(1) });
assert.equal(globalThis.childMounts, 1); assert.deepEqual(globalThis.readCalls, []); await close();
// Canonical changes while away replace stale destination fields before a child is mounted.
await mount("/app/accounts?resource=999&noticeId=10", { ...target, workspace: workspace(1) });
assert.equal(container.querySelector("#location").textContent, "/app/accounts?resource=7&noticeId=10");
assert.equal(globalThis.childMounts, 1); await close();
await mount("/app/accounts?noticeId=10", { ...target, workspace: workspace(1) });
assert.equal(container.querySelector("#location").textContent, "/app/accounts?noticeId=10");
assert.equal(globalThis.childMounts, 1); await close();
dom.window.close();
const shell = readFileSync(resolve(root, "src/app/layouts/app-shell.tsx"), "utf8");
assert.match(shell, /<NotificationDestinationBoundary[\s\S]*?<Outlet \/>[\s\S]*?<\/NotificationDestinationBoundary>/);
const inboxSource = readFileSync(resolve(root, "src/modules/notifications/use-notification-inbox.ts"), "utf8");
assert.match(inboxSource, /notificationDestinationHref\(notificationHref\(notification\), notification.id\)/);
console.log("notification-destination: OK (canonical scoped reads, membership, shared access, actual React gate, confirmation/races, delayed reading, correct snapshot; no network or financial writes)");
