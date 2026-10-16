import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, change, createRoot, dom, h, load, mock, root, settle, QueryClient, QueryClientProvider } from "./lib/web-ui-harness.mjs";

const contact = (id, extra = {}) => ({ id, workspaceId: 8, name: `Contacto ${id}`, type: "person", isArchived: false, isPinned: false, roles: [], movementCount: 0, receivableCount: 0, payableCount: 0, ...extra });
const all = [contact(1, { phone: "+51 999111222", email: "persona@example.test" }), contact(2), contact(3, { movementCount: 1 }), contact(4, { workspaceId: 99, name: "Fuera del espacio" })];
const snapshot = () => ({ workspace: { id: 8 }, movements: [{ id: 1, workspaceId: 99, counterpartyId: 1, description: "FOREIGN", sourceAmount: 999999 }], obligations: [{ id: 8, workspaceId: 8, counterpartyId: 3, status: "active", direction: "receivable", pendingAmount: 50, currencyCode: "USD" }, { id: 9, workspaceId: 99, counterpartyId: 1, status: "active", direction: "receivable", pendingAmount: 999999, currencyCode: "PEN" }], subscriptions: [], recurringIncome: [{ id: 4, workspaceId: 8, payerPartyId: 2, status: "paused", amount: 200, currencyCode: "PEN" }, { id: 5, workspaceId: 99, payerPartyId: 1, status: "active", amount: 999999, currencyCode: "PEN" }] });
globalThis.contactScope = { userId: "user-A", workspaceId: 8, role: "owner", archived: false, fetching: false };
globalThis.contactOverview = { data: all, isSuccess: true, isFetching: false, isPlaceholderData: false };
globalThis.contactSnapshot = { data: snapshot(), isSuccess: true, isFetching: false, isPlaceholderData: false };
globalThis.contactWrites = []; globalThis.contactWriteGate = null; globalThis.contactFailure = null;
globalThis.contactUndo = new Map(); globalThis.contactCancelled = []; globalThis.contactScheduleId = 0;
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:globalThis.contactScope.userId?{id:globalThis.contactScope.userId}:null,profile:null});");
mock("src/modules/workspaces/use-active-workspace.ts", "export const useActiveWorkspace=()=>({activeWorkspace:{id:globalThis.contactScope.workspaceId,role:globalThis.contactScope.role,isArchived:globalThis.contactScope.archived,baseCurrencyCode:'PEN'},isFetching:globalThis.contactScope.fetching,isPlaceholderData:false});");
mock("src/components/ui/undo-queue.tsx", `
  const cancel=id=>{const item=globalThis.contactUndo.get(id);globalThis.contactUndo.delete(id);globalThis.contactCancelled.push(id);item?.onUndo?.();};
  const schedule=item=>{const id='undo-'+(++globalThis.contactScheduleId);globalThis.contactUndo.set(id,item);return id;};
  export const useUndoQueue=()=>({schedule,cancel});
`);
mock("src/services/queries/workspace-data.ts", `
  export const useCounterpartiesOverviewQuery=()=>globalThis.contactOverview,useWorkspaceSnapshotQuery=()=>globalThis.contactSnapshot;
  const mutation=kind=>({mutateAsync:async input=>{globalThis.contactWrites.push({kind,input});if(globalThis.contactWriteGate)await globalThis.contactWriteGate;if(globalThis.contactFailure)throw globalThis.contactFailure;return {id:77};}});
  export const useCreateCounterpartyMutation=()=>mutation('create'),useUpdateCounterpartyMutation=()=>mutation('update'),useArchiveCounterpartyMutation=()=>mutation('archive'),usePinCounterpartyMutation=()=>mutation('pin'),useDeleteCounterpartyMutation=()=>mutation('delete');
  export const getQueryErrorMessage=error=>error?.message??'fixture error';
`);
mock("src/modules/contacts/components/contact-analytics-modal.tsx", `${h} export const ContactAnalyticsModal=p=>{globalThis.contactAnalytics=p;return h('div',{'data-testid':'analytics'},h('button',{onClick:p.onClose},'Cerrar análisis'));};`);
const editorUrl = load("src/modules/contacts/components/contact-editor-dialog.tsx");
mock("src/modules/contacts/components/contact-editor-dialog.tsx", `${h} import {ContactEditorDialog as Real} from '${editorUrl}';export const ContactEditorDialog=p=>{globalThis.contactEditor=p;return h(Real,p);};`);
const { ContactsPage } = await import(load("src/modules/contacts/pages/contacts-redesign-page.tsx"));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const anchorClick = dom.window.HTMLAnchorElement.prototype.click, createUrl = URL.createObjectURL; let exported = 0, lastCsv;
dom.window.HTMLAnchorElement.prototype.click = () => { exported++; }; URL.createObjectURL = blob => { lastCsv = blob; return createUrl(blob); };
async function render(scope = {}, overview = {}, ledger = {}) {
  Object.assign(globalThis.contactScope, scope); Object.assign(globalThis.contactOverview, overview); Object.assign(globalThis.contactSnapshot, ledger);
  await act(async () => renderer.render(React.createElement(ContactsPage))); await settle();
}
const findButton = label => [...container.querySelectorAll("button")].find(node => node.textContent.trim() === label);
const ariaButton = label => { const found = container.querySelector(`button[aria-label="${label}"]`); assert.ok(found, label); return found; };
async function click(label) { const node = findButton(label); assert.ok(node, label); await act(async () => node.click()); await settle(); }
async function menu(id = 1) { await act(async () => ariaButton(`Acciones de Contacto ${id}`).click()); }
await render({ role: "viewer" }); assert.equal(findButton("Nuevo contacto").disabled, true); assert.match(container.textContent, /solo lectura/); assert.doesNotMatch(container.textContent, /Fuera del espacio/);
await menu(); for (const label of ["Fijar", "Editar", "Archivar", "Eliminar"]) assert.equal(findButton(label), undefined);
await click("Ver detalle"); assert.equal(findButton("Editar contacto"), undefined); assert.ok(container.querySelector('a[href="mailto:persona@example.test"]')); await click("Ver análisis completo"); assert.ok(globalThis.contactAnalytics.movements.every(row => row.workspaceId === 8)); await click("Cerrar análisis");
await act(async () => ariaButton("Más acciones").click()); await click("Seleccionar varios"); await click("Seleccionar todos");
assert.equal(findButton("Archivar").disabled, true); assert.equal(findButton("Eliminar sin relaciones").disabled, true); assert.equal(findButton("CSV").disabled, false);
await click("CSV"); assert.equal(exported, 1); assert.doesNotMatch(await lastCsv.text(), /Fuera del espacio|999,999|999999/); assert.equal(globalThis.contactWrites.length, 0); await click("Cancelar");
await render({ role: "owner", archived: true }); assert.equal(findButton("Nuevo contacto").disabled, true);
await render({ archived: false, fetching: true }); assert.equal(findButton("Nuevo contacto").disabled, true);
await render({ fetching: false }, { isFetching: true }); assert.equal(findButton("Nuevo contacto").disabled, true);
await render({}, { isFetching: false, isPlaceholderData: true }); assert.equal(findButton("Nuevo contacto").disabled, true);
await render({}, { isPlaceholderData: false }, { isFetching: true }); assert.equal(findButton("Nuevo contacto").disabled, false); await menu(); assert.equal(findButton("Eliminar"), undefined); await click("Ver detalle"); assert.match(container.querySelector('[role="dialog"]').textContent, /Por comprobar/); assert.equal(findButton("Ver análisis completo").disabled, true); await act(async () => container.querySelector('button[aria-label="Cerrar formulario"]').click());
await render({}, {}, { isFetching: false, data: { ...snapshot(), workspace: { id: 99 } } }); await menu(); assert.equal(findButton("Eliminar"), undefined); await click("Ver detalle"); assert.match(container.querySelector('[role="dialog"]').textContent, /Por comprobar/); await act(async () => container.querySelector('button[aria-label="Cerrar formulario"]').click());
await render({}, {}, { data: snapshot() });
await render({}, {}, { data: { ...snapshot(), recurringIncomeAvailable: false } }); await menu(); assert.equal(findButton("Eliminar"), undefined); assert.match(container.textContent, /No pudimos comprobar todas/); await click("Ver detalle"); assert.match(container.querySelector('[role="dialog"]').textContent, /Por comprobar/); await act(async () => container.querySelector('button[aria-label="Cerrar formulario"]').click()); await render({}, {}, { data: snapshot() });
await menu(2); assert.equal(findButton("Eliminar"), undefined, "paused recurring income still references its payer"); await click("Ver detalle"); await act(async () => container.querySelector('button[aria-label="Cerrar formulario"]').click());
await click("Nuevo contacto"); const staleSave = globalThis.contactEditor.onSave;
await render({ role: "viewer" }); assert.equal(container.querySelector('form'), null); await render({ role: "owner" }); await assert.rejects(staleSave({ name: "stale" }), /permisos cambiaron/); assert.equal(globalThis.contactWrites.length, 0);
await click("Nuevo contacto"); await change(container.querySelector('form input'), "Nuevo real"); let finish; globalThis.contactWriteGate = new Promise(resolve => { finish = resolve; });
const submit = findButton("Crear contacto"); await act(async () => { submit.click(); submit.click(); }); assert.equal(globalThis.contactWrites.length, 1); assert.equal(globalThis.contactWrites[0].kind, "create");
globalThis.contactWriteGate = null; await act(async () => finish()); await settle();
await menu(); await click("Editar"); const editSave = globalThis.contactEditor.onSave;
await render({}, { data: all.filter(row => row.id !== 1) }); await assert.rejects(editSave({ name: "Removed" }), /no está disponible/);
await render({ workspaceId: 9 }, { data: [contact(10, { workspaceId: 9 })] }); assert.equal(container.querySelector('form'), null); await assert.rejects(editSave({ name: "Other workspace" }), /permisos cambiaron/);

async function scheduleDelete() { await menu(); await click("Eliminar"); await click("Eliminar definitivamente"); const [id, job] = [...globalThis.contactUndo.entries()].at(-1); return { id, job }; }
await render({ workspaceId: 8 }, { data: all }); const first = await scheduleDelete(), beforeDelete = globalThis.contactWrites.length;
assert.match(first.job.label, /pendiente de eliminar/); await render({ workspaceId: 9 }, { data: [contact(10, { workspaceId: 9 })] }); assert.ok(globalThis.contactCancelled.includes(first.id)); await render({ workspaceId: 8 }, { data: all }); await act(async () => first.job.onCommit()); assert.equal(globalThis.contactWrites.length, beforeDelete);
const second = await scheduleDelete(); await render({ role: "viewer" }); assert.ok(globalThis.contactCancelled.includes(second.id)); await render({ role: "owner" }); await act(async () => second.job.onCommit()); assert.equal(globalThis.contactWrites.length, beforeDelete);
const third = await scheduleDelete(); await render({}, {}, { isFetching: true }); assert.ok(globalThis.contactCancelled.includes(third.id)); await render({}, {}, { isFetching: false }); await act(async () => third.job.onCommit()); assert.equal(globalThis.contactWrites.length, beforeDelete);
for (const field of ["subscriptions", "recurringIncome", "movements", "obligations"]) {
  await render({ userId: `references-${field}` }, { data: all }, { data: snapshot() }); const intent = await scheduleDelete();
  const data = snapshot(); data[field] = [...data[field], { id: 100, workspaceId: 8, vendorPartyId: 1, payerPartyId: 1, counterpartyId: 1 }];
  await render({}, {}, { data }); const before = globalThis.contactWrites.length; await act(async () => intent.job.onCommit()); assert.equal(globalThis.contactWrites.length, before); assert.match(container.querySelector('[role="alert"]').textContent, /relaciones nuevas/);
}
await render({ userId: "successful-delete" }, {}, { data: snapshot() }); const fourth = await scheduleDelete(); await act(async () => fourth.job.onCommit()); assert.equal(globalThis.contactWrites.at(-1).kind, "delete"); assert.deepEqual(globalThis.contactWrites.at(-1).input, { counterpartyId: 1, workspaceId: 8 }); const once = globalThis.contactWrites.length; await act(async () => fourth.job.onCommit()); assert.equal(globalThis.contactWrites.length, once);
await render({ userId: "failed-delete" }); const failed = await scheduleDelete(); globalThis.contactFailure = new Error("delete outcome uncertain"); await act(async () => failed.job.onCommit()); assert.ok(ariaButton("Acciones de Contacto 1")); assert.match(container.querySelector('[role="alert"]').textContent, /outcome uncertain/); globalThis.contactFailure = null;
await render({ userId: "bulk" }); await act(async () => ariaButton("Más acciones").click()); await click("Seleccionar varios"); await click("Seleccionar todos"); await click("Eliminar sin relaciones"); await click("Eliminar definitivamente"); assert.equal([...globalThis.contactUndo.values()].filter(item => /Contacto [23] pendiente/.test(item.label)).length, 0); assert.equal([...globalThis.contactUndo.values()].filter(item => /Contacto 1 pendiente/.test(item.label)).length > 0, true);
await render({ userId: "bulk-archive" }); await act(async () => ariaButton("Más acciones").click()); await click("Seleccionar varios"); await click("Seleccionar todos"); await click("Archivar"); globalThis.contactWriteGate = new Promise(resolve => { finish = resolve; }); const beforeBulk = globalThis.contactWrites.length;
const confirm = findButton("Eliminar definitivamente"); await act(async () => { confirm.click(); confirm.click(); }); assert.equal(globalThis.contactWrites.length, beforeBulk + 3); assert.equal(new Set(globalThis.contactWrites.slice(beforeBulk).map(row => row.input.counterpartyId)).size, 3);
globalThis.contactWriteGate = null; await act(async () => finish()); await settle();
await render({ userId: "unmount" }); const last = await scheduleDelete(); await act(async () => renderer.unmount()); assert.ok(globalThis.contactCancelled.includes(last.id)); const beforeUnmount = globalThis.contactWrites.length; await act(async () => last.job.onCommit()); assert.equal(globalThis.contactWrites.length, beforeUnmount);

// Execute the real delete mutation: every reference must have a complete scoped count.
const source = readFileSync(resolve(root, "src/services/queries/workspace-data.ts"), "utf8"), ast = ts.createSourceFile("workspace-data.ts", source, ts.ScriptTarget.Latest, true);
function original(name, env) { const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name); assert.ok(node); const js = ts.transpileModule(node.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText; return new Function(...Object.keys(env), `${js};return ${name};`)(...Object.values(env)); }
let reads = [], deletes = [], results = {};
const deleteClient = { from(table) { const filters = [], query = { select(_columns, options) { assert.deepEqual(options, { count: "exact", head: true }); return this; }, eq(key, value) { filters.push([key, value]); return this; }, delete() { query.deleting = true; return this; }, then(resolve) {
  assert.ok(filters.some(([key, value]) => key === "workspace_id" && value === 8));
  if (query.deleting) { deletes.push(table); resolve({ error: null }); }
  else { reads.push(table); assert.ok(filters.some(([key, value]) => key === (table === "subscriptions" ? "vendor_party_id" : table === "recurring_income" ? "payer_party_id" : "counterparty_id") && value === 1)); resolve({ count: 0, error: null, ...results[table] }); }
} }; return query; } };
const deleteHook = original("useDeleteCounterpartyMutation", { useMutation: value => value, useQueryClient: () => ({}), getClient: () => deleteClient, optimisticDelete: () => ({}) });
const mutate = () => deleteHook(8, "A").mutationFn({ counterpartyId: 1, workspaceId: 8 });
for (const table of ["movements", "obligations", "subscriptions", "recurring_income"]) {
  results = { [table]: { count: 1 } }; deletes = []; await assert.rejects(mutate(), /asociad/); assert.equal(deletes.length, 0);
  results = { [table]: { error: new Error("missing relation") } }; await assert.rejects(mutate(), /missing relation/); assert.equal(deletes.length, 0);
}
for (const count of [null, undefined, -1, NaN, Infinity, "0", 0.5]) { results = { recurring_income: { count } }; await assert.rejects(mutate(), /comprobar todas/); assert.equal(deletes.length, 0); }
results = {}; reads = []; await mutate(); assert.deepEqual(reads.sort(), ["movements", "obligations", "subscriptions", "recurring_income"].sort()); assert.deepEqual(deletes, ["counterparty_roles", "counterparties"]);

// The native snapshot's legacy missing-table fallback must declare that [] is unverified.
let incomeReadError = null;
const snapshotClient = { from(table) {
  const result = () => ({ data: [], error: table === "recurring_income" ? incomeReadError : null });
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; }, range() { return this; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); }, then(resolve) { resolve(result()); } }; return query;
} };
const nativeSnapshot = original("fetchWorkspaceSnapshot", { getClient: () => snapshotClient, normalizeCurrencyCode: value => value, buildExchangeRateMap: () => new Map(), buildCashflow: () => [], isMissingRelationError: (error, name) => error?.code === "42P01" && error.message.includes(name) });
assert.equal((await nativeSnapshot({ id: 8, baseCurrencyCode: "PEN" }, "A")).recurringIncomeAvailable, true);
incomeReadError = { code: "42P01", message: "relation recurring_income missing" };
const partialSnapshot = await nativeSnapshot({ id: 8, baseCurrencyCode: "PEN" }, "A"); assert.equal(partialSnapshot.recurringIncomeAvailable, false); assert.deepEqual(partialSnapshot.recurringIncome, []);
incomeReadError = new Error("network failed"); await assert.rejects(nativeSnapshot({ id: 8, baseCurrencyCode: "PEN" }, "A"), /network failed/);

// Actual overview hook: no cross-user/workspace placeholder rows or signed-out query.
const { useQuery } = createRequire(resolve(root, "package.json"))("@tanstack/react-query"), fetches = [];
const actualQuery = original("useCounterpartiesOverviewQuery", { useQuery, fetchCounterpartiesOverview: workspaceId => new Promise(resolve => fetches.push({ workspaceId, resolve })) });
let query; function QueryProbe({ ws, userId }) { query = actualQuery(ws, userId); return React.createElement("div", null, JSON.stringify({ status: query.status, data: query.data })); }
const queryRoot = createRoot(container), client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
async function queryRender(ws, userId) { await act(async () => queryRoot.render(React.createElement(QueryClientProvider, { client }, React.createElement(QueryProbe, { ws, userId })))); await settle(); }
await queryRender(8, "A"); await act(async () => fetches.at(-1).resolve([contact(1)])); await settle(); assert.equal(query.data.length, 1);
await queryRender(9, "A"); assert.equal(query.data, undefined); assert.equal(query.isPlaceholderData, false); await act(async () => fetches.at(-1).resolve([contact(9, { workspaceId: 9 })])); await settle();
await queryRender(9, "B"); assert.equal(query.data, undefined); const readsBeforeLogout = fetches.length; await queryRender(9, undefined); assert.equal(query.data, undefined); assert.equal(fetches.length, readsBeforeLogout);
await act(async () => queryRoot.unmount()); client.clear(); dom.window.HTMLAnchorElement.prototype.click = anchorClick; URL.createObjectURL = createUrl; container.remove(); dom.window.close();
console.log("contact-permissions: OK (actual page/editor/hooks and delete mutation; readonly/archive/session/read/ABA guards, complete same-space financial evidence, CSV and unknowns, four reference sources incl recurring payers, partial/missing count rejection, bulk/double submit, deferred-delete cancellation/revalidation/commit once; fake IO only, not server RLS or atomicity)");
