import assert from "node:assert/strict";
import { React, act, createRoot, dom, load, mock, h, settle, change, MemoryRouter } from "./lib/web-ui-harness.mjs";
const now = new Date();
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima" }).format(now);
const budget = (id, extra = {}) => ({ id, workspaceId: 8, name: `Presupuesto ${id}`, periodStart: today.slice(0, 7) + "-01", periodEnd: today.slice(0, 7) + "-31", currencyCode: "PEN", limitAmount: 400, alertPercent: 80, recurrence: "none", rolloverEnabled: false, isActive: true, isPinned: false, notes: null, categoryId: null, accountId: null, spendTypeId: null, scopeLabel: "Todo el gasto", movementCount: 0, spentAmount: 0, usedPercent: 0, ...extra });
// End of the actual month, including February, not a fabricated 31st.
const end = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).toISOString().slice(0, 10);
const fixtures = [budget(1, { periodEnd: end }), budget(2, { periodEnd: end }), budget(3, { workspaceId: 99, name: "Ajeno", periodEnd: end })];
globalThis.budgetScope = { userId: "A", workspaceId: 8, role: "owner", archived: false, fetching: false };
const snapshot = () => ({ workspace: { id: globalThis.budgetScope.workspaceId, baseCurrencyCode: "PEN" }, budgets: fixtures, accounts: [], movements: [], catalogs: { categories: [], counterparties: [] }, exchangeRates: [] });
globalThis.budgetSnapshot = { data: snapshot(), isSuccess: true, isFetching: false, isPlaceholderData: false, dataUpdatedAt: 1 };
globalThis.budgetSpend = { data: [], isSuccess: true, isFetching: false };
globalThis.budgetMovements = { data: [], isSuccess: true, isFetching: false };
globalThis.budgetWrites = []; globalThis.budgetGate = null; globalThis.budgetFailure = null; globalThis.budgetUndo = new Map(); globalThis.budgetQueueId = 0; globalThis.budgetCancelled = [];
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:globalThis.budgetScope.userId?{id:globalThis.budgetScope.userId}:null});");
mock("src/modules/workspaces/use-active-workspace.ts", "export const useActiveWorkspace=()=>({activeWorkspace:{id:globalThis.budgetScope.workspaceId,role:globalThis.budgetScope.role,isArchived:globalThis.budgetScope.archived,baseCurrencyCode:'PEN'},isFetching:globalThis.budgetScope.fetching,isLoading:false});");
mock("src/services/queries/workspace-data.ts", `export const useWorkspaceSnapshotQuery=()=>globalThis.budgetSnapshot,useBudgetSpendTypesQuery=()=>globalThis.budgetSpend;
const mutation=kind=>({isPending:false,mutateAsync:async input=>{globalThis.budgetWrites.push({kind,input});if(globalThis.budgetGate)await globalThis.budgetGate;if(globalThis.budgetFailure)throw globalThis.budgetFailure;return globalThis.budgetResult??{id:input.budgetId??77,workspaceId:8};}});
export const useCreateBudgetMutation=()=>mutation('create'),useUpdateBudgetMutation=()=>mutation('update'),useAdjustBudgetLimitMutation=()=>mutation('adjust'),useDeleteBudgetMutation=()=>mutation('delete'),usePinBudgetMutation=()=>mutation('pin'),useDuplicateBudgetMutation=()=>mutation('duplicate');export const getQueryErrorMessage=(e,f)=>e?.message??f;`);
mock("src/modules/budgets/hooks/use-budget-scope-movements.ts", "export const useBudgetScopeMovements=p=>{globalThis.budgetReadInput=p;return globalThis.budgetMovements;};");
mock("src/components/ui/undo-queue.tsx", "const cancel=id=>{const job=globalThis.budgetUndo.get(id);globalThis.budgetUndo.delete(id);globalThis.budgetCancelled.push(id);job?.onUndo?.();};const schedule=job=>{const id='undo-'+(++globalThis.budgetQueueId);globalThis.budgetUndo.set(id,job);return id;};export const useUndoQueue=()=>({schedule,cancel});");
mock("src/components/ui/date-picker-field.tsx", `${h} export const DatePickerField=p=>h('input',{value:p.value,onChange:e=>p.onChange(e.target.value)});`);
const editorUrl = load("src/modules/budgets/components/budget-editor-dialog.tsx");
mock("src/modules/budgets/components/budget-editor-dialog.tsx", `${h} export {initialBudgetEditorValue} from '${editorUrl}';import {BudgetEditorDialog as Real} from '${editorUrl}';export const BudgetEditorDialog=p=>{globalThis.budgetEditor=p;return h(Real,p);};`);
const detailUrl = load("src/modules/budgets/components/budget-detail-dialog.tsx");
mock("src/modules/budgets/components/budget-detail-dialog.tsx", `${h} import {BudgetDetailDialog as Real} from '${detailUrl}';export const BudgetDetailDialog=p=>{globalThis.budgetDetail=p;return h(Real,p);};`);
const { BudgetsPage } = await import(load("src/modules/budgets/pages/budgets-overview-page.tsx"));
const container = document.createElement("div"); document.body.append(container); let renderer = createRoot(container);
const find = text => [...container.querySelectorAll("button")].find(node => node.textContent.trim() === text || (text === "Nuevo presupuesto" && node.textContent.endsWith(text)));
const aria = text => { const node = container.querySelector(`button[aria-label="${text}"]`); assert.ok(node, text); return node; };
async function click(text) { const node = find(text); assert.ok(node, text); await act(async () => node.click()); await settle(); }
async function render(scope = {}, query = {}) { Object.assign(globalThis.budgetScope, scope); Object.assign(globalThis.budgetSnapshot, query); await act(async () => renderer.render(React.createElement(MemoryRouter, null, React.createElement(BudgetsPage)))); await settle(); }
async function menu(id = 1) { await act(async () => aria(`Acciones de Presupuesto ${id}`).click()); await settle(); }
async function resetIntent() { await render({ userId: globalThis.budgetScope.userId + "x" }); }
async function submitTwice() { const submit = globalThis.budgetEditor.onSubmit; await act(async () => { submit({ preventDefault() {} }); submit({ preventDefault() {} }); }); await settle(); }
await render({ role: "viewer" }); assert.equal(find("Nuevo presupuesto").disabled, true); assert.match(container.textContent, /Solo lectura/); assert.doesNotMatch(container.textContent, /Ajeno/);
assert.equal(globalThis.budgetReadInput.userId, "A"); assert.deepEqual(globalThis.budgetReadInput.budgets.map(b => b.id), [1, 2]);
await menu(); assert.equal(find("Editar"), undefined); assert.equal(find("Fijar"), undefined); await click("Ver detalle"); assert.equal(find("Ajustar límite").disabled, true); assert.equal(find("Editar").disabled, true); await act(async () => aria("Cerrar formulario").click());
for (const patch of [{ role: "owner", archived: true }, { archived: false, role: "unknown" }, { role: "owner", fetching: true }]) { await render(patch); assert.equal(find("Nuevo presupuesto").disabled, true); }
await render({ fetching: false });
for (const query of [{ isFetching: true }, { isSuccess: false }, { isPlaceholderData: true }]) { await render({}, query); assert.ok(!find("Nuevo presupuesto") || find("Nuevo presupuesto").disabled); await render({}, { isSuccess: true, isFetching: false, isPlaceholderData: false }); }
for (const read of [globalThis.budgetSpend, globalThis.budgetMovements]) { read.isFetching = true; await render(); assert.equal(find("Nuevo presupuesto").disabled, true); read.isFetching = false; await render(); }
await render({}, { data: { ...snapshot(), workspace: { id: 99 } } }); assert.doesNotMatch(container.textContent, /Presupuesto 1/); await render({}, { data: snapshot() });
for (const role of ["owner", "admin", "member"]) { await render({ role }); assert.equal(find("Nuevo presupuesto").disabled, false); }
await click("Nuevo presupuesto"); const stale = globalThis.budgetEditor.onSubmit;
await render({ role: "viewer" }); assert.ok(container.querySelector("fieldset").disabled); await render({ role: "owner" });
await act(async () => stale({ preventDefault() {} })); assert.equal(globalThis.budgetWrites.length, 0);
// Real edit flow: double submission, immutable fields during a send, target identity.
await resetIntent(); await menu(); await click("Editar"); let finish; globalThis.budgetGate = new Promise(resolve => { finish = resolve; });
await submitTwice(); assert.equal(globalThis.budgetWrites.length, 1); assert.equal(globalThis.budgetWrites[0].kind, "update"); assert.equal(globalThis.budgetWrites[0].input.budgetId, 1); assert.ok(container.querySelector("fieldset").disabled);
globalThis.budgetGate = null; await act(async () => finish()); await settle(); assert.equal(container.querySelector("form"), null);
// A refetch may not overwrite typed quick adjustment; observed remote changes block it.
await menu(); await click("Ver detalle"); await click("Ajustar límite"); await change(container.querySelector('input[inputmode="decimal"]'), "420");
Object.assign(globalThis.budgetMovements, { data: undefined, isSuccess: false, isFetching: true, isLoading: true }); await render(); assert.equal(container.querySelector('input[inputmode="decimal"]').value, "420"); assert.equal(find("Guardar").disabled, true); assert.match(container.textContent, /Tu ajuste se conserva/);
Object.assign(globalThis.budgetMovements, { data: [], isSuccess: true, isFetching: false, isLoading: false }); await render();
await render({}, { data: { ...snapshot(), budgets: fixtures.map(b => b.id === 1 ? { ...b, limitAmount: 450 } : b) } }); assert.equal(container.querySelector('input[inputmode="decimal"]').value, "420"); assert.equal(find("Guardar").disabled, true); assert.match(container.textContent, /presupuesto cambió/);
await act(async () => aria("Cerrar formulario").click()); await render({}, { data: snapshot() });
await menu(); await click("Ver detalle"); await click("Ajustar límite"); await change(container.querySelector('input[inputmode="decimal"]'), "410"); const beforeQuick = globalThis.budgetWrites.length;
await act(async () => { find("Guardar").click(); find("Guardar").click(); }); await settle(); assert.equal(globalThis.budgetWrites.length, beforeQuick + 1); assert.equal(globalThis.budgetWrites.at(-1).kind, "adjust"); await act(async () => aria("Cerrar formulario").click());
// Uncertain response locks replay even through refresh; explicit SQL rejection permits correction.
for (const result of ["network", "missing", "wrong-target"]) {
  await resetIntent(); await menu(); await click("Editar"); const before = globalThis.budgetWrites.length;
  globalThis.budgetFailure = result === "network" ? new Error("lost reply") : null; globalThis.budgetResult = result === "missing" ? {} : result === "wrong-target" ? { id: 999, workspaceId: 8 } : undefined;
  await submitTwice(); assert.equal(globalThis.budgetWrites.length, before + 1); assert.ok(find("Guardar cambios").disabled); assert.match(container.textContent, /sin confirmar/);
  await render({}, { isFetching: true }); await render({}, { isFetching: false }); await submitTwice(); assert.equal(globalThis.budgetWrites.length, before + 1);
  globalThis.budgetFailure = null; globalThis.budgetResult = undefined;
}
await resetIntent(); await menu(); await click("Editar"); globalThis.budgetFailure = { code: "23514", message: "SQL rejection" }; await submitTwice(); assert.equal(find("Guardar cambios").disabled, false);
globalThis.budgetFailure = null; await submitTwice(); assert.equal(container.querySelector("form"), null);
// A batch re-reads each source after its own invalidation, but stops after permission loss.
async function selectBoth() { await act(async () => aria("Más acciones").click()); await click("Seleccionar varios"); await act(async () => { container.querySelector('input[aria-label="Seleccionar Presupuesto 1"]').click(); container.querySelector('input[aria-label="Seleccionar Presupuesto 2"]').click(); }); }
await resetIntent(); await selectBoth(); globalThis.budgetGate = new Promise(resolve => { finish = resolve; }); const beforeBatch = globalThis.budgetWrites.length;
await click("Duplicar"); assert.equal(globalThis.budgetWrites.length, beforeBatch + 1); await render({}, { isFetching: true }); await render({}, { isFetching: false }); globalThis.budgetGate = null; await act(async () => finish()); await settle(); assert.equal(globalThis.budgetWrites.length, beforeBatch + 2);
await resetIntent(); await selectBoth(); globalThis.budgetGate = new Promise(resolve => { finish = resolve; }); const beforePartial = globalThis.budgetWrites.length;
await click("Duplicar"); await render({ role: "viewer" }); await render({ role: "owner" }); globalThis.budgetGate = null; await act(async () => finish()); await settle(); assert.equal(globalThis.budgetWrites.length, beforePartial + 1);
await resetIntent();
// Deferred deletes: restore visual rows on failure, cancel on context/access loss, consume once.
async function scheduleDelete() { await menu(); await click("Eliminar"); const confirmation = [...container.querySelectorAll('button')].find(b => /Eliminar/.test(b.textContent) && b.closest('[role="dialog"]')); assert.ok(confirmation); await act(async () => confirmation.click()); await settle(); return [...globalThis.budgetUndo.entries()].at(-1); }
let [jobId, job] = await scheduleDelete(); const beforeDelete = globalThis.budgetWrites.length; assert.match(job.label, /pendiente de eliminar/);
await render({ role: "viewer" }); assert.ok(globalThis.budgetCancelled.includes(jobId)); await render({ role: "owner" }); await act(async () => job.onCommit()); assert.equal(globalThis.budgetWrites.length, beforeDelete);
[jobId, job] = await scheduleDelete(); await act(async () => { await job.onCommit(); await job.onCommit(); }); assert.equal(globalThis.budgetWrites.length, beforeDelete + 1);
await resetIntent(); [jobId, job] = await scheduleDelete(); globalThis.budgetFailure = new Error("uncertain delete"); await act(async () => job.onCommit()); assert.ok(aria("Acciones de Presupuesto 1")); const count = globalThis.budgetWrites.length; await act(async () => job.onCommit()); assert.equal(globalThis.budgetWrites.length, count); globalThis.budgetFailure = null;
// Old callbacks cannot announce success after access ABA; keyed identity discards the old editor.
await resetIntent(); await menu(); await click("Editar"); const original = globalThis.budgetEditor.onSubmit; globalThis.budgetGate = new Promise(resolve => { finish = resolve; }); await submitTwice();
await render({ role: "viewer" }); await render({ role: "owner" }); globalThis.budgetGate = null; await act(async () => finish()); await settle(); assert.ok(container.querySelector("form")); assert.ok(find("Guardar cambios").disabled);
const beforeOld = globalThis.budgetWrites.length; await render({ workspaceId: 9 }, { data: { ...snapshot(), workspace: { id: 9 }, budgets: [] } }); assert.equal(container.querySelector("form"), null); await act(async () => original({ preventDefault() {} })); assert.equal(globalThis.budgetWrites.length, beforeOld);
// Merely viewing a renewable expired rule is not authorization for viewer/archive writes.
const last = { ...fixtures[0], periodStart: "2026-01-01", periodEnd: "2026-01-31", recurrence: "monthly" };
await render({ workspaceId: 8, role: "viewer" }, { data: { ...snapshot(), workspace: { id: 8 }, budgets: [last] } }); const beforeRenew = globalThis.budgetWrites.length; assert.equal(globalThis.budgetWrites.length, beforeRenew);
await render({ role: "owner", archived: true }); assert.equal(globalThis.budgetWrites.length, beforeRenew);
await render({ archived: false }); assert.equal(globalThis.budgetWrites.length, beforeRenew + 1); assert.equal(globalThis.budgetWrites.at(-1).kind, "duplicate"); assert.ok(globalThis.budgetWrites.at(-1).input.periodStart <= today); assert.ok(globalThis.budgetWrites.at(-1).input.periodEnd >= today);
const afterRenew = globalThis.budgetWrites.length; await render(); assert.equal(globalThis.budgetWrites.length, afterRenew, "One mounted attempt per rule/period, not a repeated automatic insert");
await render({ userId: "OldRule" }, { data: { ...snapshot(), budgets: [{ ...last, periodStart: "1970-01-01", periodEnd: "1970-01-07", recurrence: "weekly" }] } }); assert.equal(globalThis.budgetWrites.length, afterRenew, "Never insert a still-expired period after the 400-step cap");
await act(async () => renderer.unmount()); container.remove(); dom.window.close();
console.log("budget-permissions: OK (actual routed page/editor/detail, roles/archive/scope/freshness, user-scoped reader, double submit, changed source, verified response/uncertain latch, quick adjustment, deferred delete cancellation/once/restore, renewal writer gate; fake I/O only)");
