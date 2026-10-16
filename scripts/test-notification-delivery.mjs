import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, button, change, createRoot, dom, load, mock, root, settle, QueryClient, QueryClientProvider, MemoryRouter } from "./lib/web-ui-harness.mjs";

const base = (user_id = "A", extra = {}) => ({ user_id, is_active: true, push_token: "native-token-private", platform: "android", daily_digest_enabled: true, predictive_alerts_enabled: true, in_app_enabled: true, email_enabled: false, smart_reads: {}, ui_prefs: null, ...extra });
const io = { rows: new Map(), calls: [], readError: null, writeError: null, beforeWrite: null, writeGate: null };
const client = { from(table) {
  assert.equal(table, "notification_preferences");
  const operation = { filters: [], patch: null, signal: null, columns: null, insert: null };
  const chain = {
    select(columns) { operation.columns = columns; return this; },
    eq(key, value) { operation.filters.push([key, value]); return this; },
    is(key, value) { operation.filters.push([key, value]); return this; },
    abortSignal(signal) { operation.signal = signal; return this; },
    update(patch) { operation.patch = patch; return this; },
    insert(patch) { operation.insert = patch; return this; },
    async maybeSingle() {
      const kind = operation.insert ? "insert" : operation.patch ? "write" : "read", userId = operation.insert?.user_id ?? operation.filters.find(([key]) => key === "user_id")?.[1];
      io.calls.push({ kind, ...operation, userId });
      if (operation.signal?.aborted) return { data: null, error: new Error("aborted") };
      if (kind === "read") return { data: structuredClone(io.rows.get(userId) ?? null), error: io.readError };
      if (io.beforeWrite) io.beforeWrite();
      if (io.writeGate) await io.writeGate;
      if (operation.signal?.aborted) return { data: null, error: new Error("aborted") };
      if (io.writeError) return { data: null, error: io.writeError };
      if (operation.insert) {
        if (io.rows.has(userId)) return { data: null, error: new Error("duplicate row") };
        io.rows.set(userId, structuredClone(operation.insert)); return { data: structuredClone(operation.insert), error: null };
      }
      const row = io.rows.get(userId);
      if (!row || operation.filters.some(([key, value]) => (row[key] ?? null) !== value)) return { data: null, error: null };
      Object.assign(row, operation.patch); return { data: structuredClone(row), error: null };
    },
  }; return chain;
} };
globalThis.deliveryClient = client;
mock("src/services/supabase/client.ts", "export const supabase=globalThis.deliveryClient;");
const { readNotificationDelivery, saveNotificationDeliveryTopic, notificationDeliveryState } = await import(load("src/services/queries/notification-delivery.ts"));
function originalFunction(path, name, env) {
  const ast = ts.createSourceFile(path, readFileSync(resolve(root, path), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find(row => ts.isFunctionDeclaration(row) && row.name?.text === name); assert.ok(declaration, name);
  const js = ts.transpileModule(declaration.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(env), `${js};return ${name};`)(...Object.values(env));
}
const mobileState = originalFunction("../DarkMoneyApp/lib/notification-delivery-state.ts", "notificationDeliveryState", {});
const mobileQuery = originalFunction("../DarkMoneyApp/services/queries/notifications.ts", "useNotificationPreferencesQuery", { useQuery: value => value, supabase: client, STALE: { short: 30000 } });
let cases = 0;
for (const active of [true, false, null]) for (const token of [null, "", "   ", "native-token-private"]) for (const daily of [true, false, null]) for (const predictive of [true, false, null]) {
  io.rows.set("A", base("A", { is_active: active, push_token: token, daily_digest_enabled: daily, predictive_alerts_enabled: predictive }));
  const mobile = await mobileQuery("A").queryFn(), web = await readNotificationDelivery(client, "A");
  assert.deepEqual(notificationDeliveryState(web), mobileState(mobile));
  for (const key of ["userId", "pushEnabled", "dailyDigestEnabled", "predictiveAlertsEnabled", "platform"]) assert.deepEqual(web[key], mobile[key]);
  assert.equal("pushToken" in web, false); assert.equal(JSON.stringify(web).includes("native-token-private"), false); cases++;
}
io.rows.clear(); assert.deepEqual(notificationDeliveryState(await readNotificationDelivery(client, "missing")), mobileState(await mobileQuery("missing").queryFn()));
const input = { topic: "dailyDigestEnabled", enabled: false, expectedEnabled: true };
await assert.rejects(saveNotificationDeliveryTopic(client, "missing", input), /Activa los avisos/);
for (const extra of [{ is_active: false }, { push_token: null }, { push_token: "  " }]) { io.rows.set("A", base("A", extra)); const before = io.calls.filter(row => row.kind === "write").length; await assert.rejects(saveNotificationDeliveryTopic(client, "A", input), /Activa los avisos/); assert.equal(io.calls.filter(row => row.kind === "write").length, before); }
io.rows.set("A", base()); io.calls = [];
await saveNotificationDeliveryTopic(client, "A", input);
assert.deepEqual(io.calls.find(row => row.kind === "write").patch, { daily_digest_enabled: false }); assert.equal(io.rows.get("A").predictive_alerts_enabled, true); assert.equal(io.rows.get("A").push_token, "native-token-private");
await assert.rejects(saveNotificationDeliveryTopic(client, "A", input), /otro dispositivo/);
io.rows.set("A", base()); io.beforeWrite = () => { io.rows.get("A").predictive_alerts_enabled = false; };
await saveNotificationDeliveryTopic(client, "A", input); assert.equal(io.rows.get("A").predictive_alerts_enabled, false, "never overwrite the other topic with an old snapshot");
for (const race of [{ is_active: false }, { push_token: "rotated-token" }, { daily_digest_enabled: false }]) {
  io.rows.set("A", base()); io.beforeWrite = () => Object.assign(io.rows.get("A"), race);
  await assert.rejects(saveNotificationDeliveryTopic(client, "A", input), /durante el guardado/);
}
io.beforeWrite = null; io.rows.set("A", base("A", { daily_digest_enabled: null })); await saveNotificationDeliveryTopic(client, "A", input); assert.equal(io.rows.get("A").daily_digest_enabled, false);
io.readError = new Error("missing column predictive_alerts_enabled"); const beforeSchema = io.calls.filter(row => row.kind === "write").length;
await assert.rejects(readNotificationDelivery(client, "A"), /missing column/); await assert.rejects(saveNotificationDeliveryTopic(client, "A", input), /missing column/); assert.equal(io.calls.filter(row => row.kind === "write").length, beforeSchema); io.readError = null;
io.rows.set("A", base("other")); await assert.rejects(readNotificationDelivery(client, "A"), /esta sesión/);
io.rows.set("A", base()); const cancelled = new AbortController(); cancelled.abort(); await assert.rejects(saveNotificationDeliveryTopic(client, "A", { ...input, signal: cancelled.signal }), /no está disponible/);
await assert.rejects(saveNotificationDeliveryTopic(client, "A", { ...input, topic: "pushEnabled" }), /no válida/);

// Execute the legacy web save handler: it must not update either push contract or topics.
const legacySave = originalFunction("src/services/queries/workspace-data.ts", "useSaveNotificationPreferencesMutation", { useMutation: value => value, useQueryClient: () => ({ invalidateQueries: async () => {} }), getClient: () => client });
const legacyRead = originalFunction("src/services/queries/workspace-data.ts", "fetchNotificationPreferences", { getClient: () => client, isMissingRelationError: () => false });
const webFlags = await legacyRead("A"); assert.equal(webFlags.inAppEnabled, true); assert.equal("pushEnabled" in webFlags, false); assert.doesNotMatch(io.calls.at(-1).columns, /push_enabled/);
await legacySave("A").mutationFn({ inAppEnabled: false, emailEnabled: true, pushEnabled: false });
assert.deepEqual(io.calls.at(-1).patch, { in_app_enabled: false, email_enabled: true }); assert.equal(io.rows.get("A").is_active, true);
assert.ok(io.calls.at(-1).filters.some(([key, value]) => key === "user_id" && value === "A"));
await legacySave("new-web").mutationFn({ inAppEnabled: true, emailEnabled: false }); assert.deepEqual(io.rows.get("new-web"), { user_id: "new-web", in_app_enabled: true, email_enabled: false });
io.beforeWrite = () => io.rows.set("racing-web", base("racing-web"));
await assert.rejects(legacySave("racing-web").mutationFn({ inAppEnabled: false, emailEnabled: true }), /duplicate row/); assert.equal(io.rows.get("racing-web").is_active, true); assert.equal(io.rows.get("racing-web").email_enabled, false); io.beforeWrite = null;

// Actual component, native query and mutation with fake transport only.
const { NotificationDeliveryPreferences } = await import(load("src/modules/settings/components/notification-delivery-preferences.tsx"));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
async function render(userId) { await act(async () => renderer.render(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(NotificationDeliveryPreferences, { userId })))); await settle(); }
const topicButton = title => { const node = [...container.querySelectorAll('[role="switch"]')].find(row => row.getAttribute("aria-label") === title); assert.ok(node, title); return node; };
io.rows.set("A", base()); io.calls = []; await render("A"); assert.equal(io.calls.filter(row => row.kind === "write").length, 0); assert.equal(topicButton("Resumen diario").getAttribute("aria-checked"), "true");
let finish; io.writeGate = new Promise(resolve => { finish = resolve; });
await act(async () => { topicButton("Resumen diario").click(); topicButton("Resumen diario").click(); }); await settle();
assert.equal(io.calls.filter(row => row.kind === "write").length, 1); assert.equal(topicButton("Alertas predictivas").disabled, true);
io.writeGate = null; await act(async () => finish()); await settle();
assert.equal(topicButton("Resumen diario").getAttribute("aria-checked"), "false"); assert.equal(topicButton("Alertas predictivas").getAttribute("aria-checked"), "true"); assert.match(container.textContent, /no confirma la entrega/);
io.rows.set("B", base("B", { is_active: false })); await render("B"); assert.equal(topicButton("Resumen diario").disabled, true); assert.equal(topicButton("Resumen diario").getAttribute("aria-checked"), "false"); assert.match(container.textContent, /Preferencia guardada: activada/);
await render(undefined); assert.match(container.textContent, /Inicia sesión/); assert.equal(container.querySelector('[role="switch"]'), null);
io.rows.set("error", base("error")); io.readError = new Error("schema unavailable"); await render("error"); assert.match(container.querySelector('[role="alert"]').textContent, /lectura fallida/); assert.equal(container.querySelector('[role="switch"]'), null);
io.readError = null; await act(async () => button(container, "Actualizar avisos").click()); await settle(); assert.equal(topicButton("Resumen diario").disabled, false);
io.writeError = new Error("write outcome uncertain"); const beforeError = io.calls.filter(row => row.kind === "write").length;
await act(async () => topicButton("Resumen diario").click()); await settle(); assert.match(container.querySelector('[role="alert"]').textContent, /Actualiza antes/); assert.equal(topicButton("Resumen diario").disabled, true);
await settle(); assert.equal(io.calls.filter(row => row.kind === "write").length, beforeError + 1, "no automatic replay after failure");
io.writeError = null; await act(async () => button(container, "Actualizar avisos").click()); await settle(); assert.equal(topicButton("Resumen diario").disabled, false);
io.writeGate = new Promise(resolve => { finish = resolve; }); await act(async () => topicButton("Resumen diario").click()); await settle();
await render("B"); io.writeGate = null; await act(async () => finish()); await settle(); assert.doesNotMatch(container.textContent, /Preferencia guardada para/); assert.equal(topicButton("Resumen diario").disabled, true);
await act(async () => renderer.unmount()); queryClient.clear();

// Full Settings page: topics are available without Pro, and saving profile must not save notification flags.
globalThis.settingsProfile = { id: "page", fullName: "Adrian", email: "adrian@example.test", baseCurrencyCode: "PEN", timezone: "America/Lima" };
globalThis.settingsWrites = [];
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:{id:'page'},profile:globalThis.settingsProfile,saveProfile:async input=>globalThis.settingsWrites.push({kind:'profile',input}),saveAvatar:async()=>{throw new Error('unexpected avatar')}});");
mock("src/modules/workspaces/use-active-workspace.ts", "export const useActiveWorkspace=()=>({activeWorkspace:null,workspaces:[],refetch:async()=>{},setActiveWorkspaceId:()=>{}});");
mock("src/modules/shared/use-pro-feature-access.ts", "export const useProFeatureAccess=()=>({canAccessProFeatures:false,isAdminOverride:false});");
mock("src/components/ui/toast-provider.tsx", "export const useSuccessToast=()=>{};");
mock("src/lib/paddle.ts", "export const isPaddleCheckoutConfigured=()=>false,openPaddleProCheckout=()=>{throw new Error('unexpected billing')};");
mock("src/lib/app-url.ts", "export const getPublicAppUrl=()=>'';");
mock("src/services/queries/workspace-data.ts", `
  const q=()=>({data:null,isSuccess:true,refetch:async()=>({data:null})});
  export const useNotificationPreferencesQuery=q,useCurrentUserEntitlementQuery=q,useCurrentUserBillingHistoryQuery=q,useWorkspaceCollaborationQuery=q,useWorkspaceSnapshotQuery=q;
  const noWrite=()=>({isPending:false,mutateAsync:async()=>{throw new Error('unexpected unrelated mutation')}});
  export const useCreateSharedWorkspaceMutation=noWrite,useCreateWorkspaceInvitationMutation=noWrite,useCreatePaddleCustomerPortalMutation=noWrite,useCancelPaddleSubscriptionMutation=noWrite,useCancelProSubscriptionMutation=noWrite,useReactivatePaddleSubscriptionMutation=noWrite;
  export const useSaveNotificationPreferencesMutation=()=>({isPending:false,mutateAsync:async input=>globalThis.settingsWrites.push({kind:'legacy',input})});
  export const getQueryErrorMessage=error=>error.message;
`);
const { SettingsPage } = await import(load("src/modules/settings/pages/settings-page.tsx"));
const pageRoot = createRoot(container), pageClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } }); io.rows.set("page", base("page"));
await act(async () => pageRoot.render(React.createElement(QueryClientProvider, { client: pageClient }, React.createElement(MemoryRouter, null, React.createElement(SettingsPage))))); await settle();
await act(async () => button(container, "Notificaciones").click()); await settle();
assert.ok(topicButton("Resumen diario")); assert.equal(button(container, "Guardar cambios").disabled, true); assert.doesNotMatch(container.textContent, /Todavía no enviamos push reales/);
const beforePageTopic = io.calls.filter(row => row.kind === "write").length;
await act(async () => topicButton("Alertas predictivas").click()); await settle(); assert.equal(io.calls.filter(row => row.kind === "write").length, beforePageTopic + 1); assert.equal(globalThis.settingsWrites.length, 0);
const legacyInput = container.querySelector('input[type="checkbox"]'); await act(async () => legacyInput.click()); assert.equal(button(container, "Guardar cambios").disabled, false);
await act(async () => button(container, "Guardar cambios").click()); assert.deepEqual(globalThis.settingsWrites, [{ kind: "legacy", input: { inAppEnabled: false, emailEnabled: false } }]);
await act(async () => button(container, "Perfil").click());
const nameInput = [...container.querySelectorAll('input[type="text"]')].find(node => node.value === "Adrian"); await change(nameInput, "Adrian actualizado");
// Reset the still-dirty fake legacy read; actual production invalidation rehydrates it.
await act(async () => legacyInput.click());
await act(async () => button(container, "Guardar cambios").click()); assert.equal(globalThis.settingsWrites.at(-1).kind, "profile"); assert.equal(globalThis.settingsWrites.filter(row => row.kind === "legacy").length, 1);
await act(async () => pageRoot.unmount()); pageClient.clear(); container.remove(); dom.window.close();
console.log(`notification-delivery: OK (${cases} actual mobile query/state comparisons; native partial CAS writes, other topic/token/platform preservation, missing schema/token/session and stale-channel guards; actual query/panel/Settings UI, no automatic writes, double click, explicit refresh after error, session switch, no Pro requirement and profile/legacy separation; fake IO only)`);
