import assert from "node:assert/strict";
import { React, act, createRoot, dom, load, mock, h, settle, change, MemoryRouter } from "./lib/web-ui-harness.mjs";

const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const income = (id, extra = {}) => ({ id, workspaceId: 8, name: `Ingreso ${id}`, payerPartyId: null, payer: "", accountId: 1, accountName: "Principal", categoryId: null, categoryName: "", currencyCode: "PEN", amount: 100, amountInBaseCurrency: 100, grossAmount: null, deductions: [], frequency: "monthly", frequencyLabel: "Mensual", intervalCount: 1, dayOfMonth: 1, dayOfWeek: null, startDate: "2026-01-01", nextExpectedDate: today, endDate: null, status: "active", remindDaysBefore: 3, description: "", notes: "", isPinned: false, ...extra });
const fixtures = [income(1), income(2, { status: "paused" }), income(3, { workspaceId: 99, name: "Ingreso ajeno" })];
const accounts = [{ id: 1, workspaceId: 8, name: "Principal", currencyCode: "PEN", isArchived: false }, { id: 2, workspaceId: 8, name: "Dólares", currencyCode: "USD", isArchived: false }, { id: 9, workspaceId: 99, name: "Cuenta ajena", currencyCode: "PEN", isArchived: false }];
globalThis.riScope = { userId: "A", workspaceId: 8, role: "owner", archived: false, fetching: false };
const data = () => ({ workspace: { id: globalThis.riScope.workspaceId, baseCurrencyCode: "PEN" }, recurringIncome: fixtures, accounts, movements: [], exchangeRates: [], catalogs: { categories: [{ id: 11, name: "Sueldo", kind: "income", isActive: true }, { id: 12, name: "Gasto", kind: "expense", isActive: true }], counterparties: [] } });
globalThis.riQuery = { data: data(), isSuccess: true, isFetching: false, isPlaceholderData: false, refetch: async () => ({ data: globalThis.riQuery.data }) };
globalThis.riWrites = []; globalThis.riReads = []; globalThis.riGate = null; globalThis.riFailure = null; globalThis.riResult = undefined;
globalThis.riUndo = new Map(); globalThis.riCancelled = []; let sequence = 0;
globalThis.riSchedule = item => { const id = `undo-${++sequence}`; globalThis.riUndo.set(id, item); return id; };
globalThis.riCancel = id => { globalThis.riCancelled.push(id); const entry = globalThis.riUndo.get(id); globalThis.riUndo.delete(id); entry?.onUndo?.(); };
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:globalThis.riScope.userId?{id:globalThis.riScope.userId}:null,profile:null});");
mock("src/modules/workspaces/use-active-workspace.ts", "export const useActiveWorkspace=()=>({activeWorkspace:{id:globalThis.riScope.workspaceId,baseCurrencyCode:'PEN',role:globalThis.riScope.role,isArchived:globalThis.riScope.archived},isLoading:false,isFetching:globalThis.riScope.fetching});");
mock("src/services/queries/workspace-data.ts", `
 export const useWorkspaceSnapshotQuery=()=>globalThis.riQuery;
 const mutation=kind=>({isPending:false,mutateAsync:async input=>{globalThis.riWrites.push({kind,input});if(globalThis.riGate)await globalThis.riGate;if(globalThis.riFailure)throw globalThis.riFailure;return globalThis.riResult??(kind==='arrival'?{movementId:400,occurrenceId:500,nextExpectedDate:input.nextExpectedDate,updatedBaseAmount:input.newBaseAmount!==input.currentBaseAmount?input.newBaseAmount:null}:{id:input.recurringIncomeId??88});}});
 export const useCreateRecurringIncomeMutation=()=>mutation('create'),useUpdateRecurringIncomeMutation=()=>mutation('update'),useDeleteRecurringIncomeMutation=()=>mutation('delete'),useConfirmRecurringIncomeArrivalMutation=()=>mutation('arrival'),useSetRecurringIncomeFlagsMutation=()=>mutation('flags');
 export const useRecurringIncomeOccurrencesQuery=(workspaceId,id,userId)=>{globalThis.riReads.push({workspaceId,id,userId});return {data:[],isSuccess:true,isLoading:false,isFetching:false};};
 export const getQueryErrorMessage=(error,fallback)=>error?.message??fallback??'Fixture failure';
`);
mock("src/components/ui/toast-provider.tsx", "export const useSuccessToast=()=>{};");
mock("src/components/ui/undo-queue.tsx", "export const useUndoQueue=()=>({schedule:globalThis.riSchedule,cancel:globalThis.riCancel});");
const editorUrl = load("src/modules/recurring-income/components/recurring-income-editor-dialog.tsx");
mock("src/modules/recurring-income/components/recurring-income-editor-dialog.tsx", `${h} export * from '${editorUrl}';import {RecurringIncomeEditorDialog as Real} from '${editorUrl}';export const RecurringIncomeEditorDialog=p=>{globalThis.riEditor=p;return h(Real,p);};`);
const listUrl = load("src/modules/recurring-income/components/recurring-income-list.tsx");
mock("src/modules/recurring-income/components/recurring-income-list.tsx", `${h} import {RecurringIncomeList as Real} from '${listUrl}';export const RecurringIncomeList=p=>{globalThis.riList=p;return h(Real,p);};`);
const { RecurringIncomePage } = await import(load("src/modules/recurring-income/pages/recurring-income-page.tsx"));
const { validateArrivalInput } = await import(load("src/modules/recurring-income/lib/arrival-input.ts"));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const find = label => [...container.querySelectorAll("button")].find(node => node.textContent.trim() === label);
const aria = label => { const node = container.querySelector(`button[aria-label="${label}"]`); assert.ok(node, label); return node; };
const newButton = () => container.querySelector('[data-tour="create-recurring-income"]');
async function click(label) { const node = find(label); assert.ok(node, label); await act(async () => node.click()); await settle(); }
async function render(scope = {}, query = {}, route = "/app/recurring-income") { Object.assign(globalThis.riScope, scope); Object.assign(globalThis.riQuery, query); await act(async () => renderer.render(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(RecurringIncomePage)))); await settle(); }
async function menu(id = 1) { await act(async () => aria(`Acciones de Ingreso ${id}`).click()); }
async function openNew() { await act(async () => newButton().click()); }
async function values() { await change(container.querySelector('input[placeholder="Ej. Sueldo mensual"]'), "Sueldo nuevo"); await change(container.querySelector('input[placeholder="0.00"]'), "120"); await act(async () => { globalThis.riEditor.updateFormState("accountId", "1"); globalThis.riEditor.updateFormState("nextExpectedDate", today); }); }
async function discard() { await act(async () => globalThis.riEditor.closeEditor()); if (find("Sí, descartar")) await click("Sí, descartar"); }
async function closeArrival() { const button = container.querySelector('button[aria-label="Cerrar formulario"],button[aria-label="Cerrar"]'); assert.ok(button); await act(async () => button.click()); }
async function submit() { await act(async () => container.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))); await settle(); }
let csv = "", exported = 0;
const oldClick = dom.window.HTMLAnchorElement.prototype.click, oldUrl = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
dom.window.HTMLAnchorElement.prototype.click = () => { exported++; }; URL.createObjectURL = blob => { blob.text().then(value => { csv = value; }); return "blob:test"; }; URL.revokeObjectURL = () => {};

await render({ role: "viewer" }); assert.equal(newButton().disabled, true); assert.match(container.textContent, /solo lectura/); assert.doesNotMatch(container.textContent, /Ingreso ajeno/);
await menu(); for (const label of ["Editar", "Eliminar", "Fijar", "Confirmar llegada"]) assert.equal(find(label), undefined);
await click("Ver historial"); assert.equal(find("Anotar llegada"), undefined); assert.deepEqual(globalThis.riReads.at(-1), { workspaceId: 8, id: 1, userId: "A" }); await closeArrival();
await act(async () => aria("Más acciones").click()); await click("Exportar los 2"); assert.equal(exported, 1); assert.doesNotMatch(csv, /Ingreso ajeno/);
await act(async () => container.querySelector('input[aria-label="Seleccionar todas"]').click()); assert.equal(find("Pausar activos"), undefined); assert.equal(find("Eliminar"), undefined); await click("Exportar CSV"); assert.equal(exported, 2); assert.equal(globalThis.riWrites.length, 0);
await render({ role: "owner", archived: true }); assert.equal(newButton().disabled, true); await render({ archived: false, fetching: true }); assert.equal(newButton().disabled, true);
await render({ fetching: false }, { isFetching: true }); assert.equal(newButton().disabled, true); await render({}, { isFetching: false, isPlaceholderData: true }); assert.equal(newButton(), null);
await render({}, { isPlaceholderData: false, error: new Error("failed snapshot"), data: undefined }); assert.match(container.textContent, /failed snapshot/); await render({}, { data: data(), error: null });

await openNew(); const oldSave = globalThis.riEditor.onSubmit; await render({ role: "viewer" }); assert.equal(container.querySelector("form"), null); await render({ role: "owner" }); await act(async () => oldSave({ preventDefault() {} })); assert.equal(globalThis.riWrites.length, 0);
await openNew(); await values(); let finish; globalThis.riGate = new Promise(resolve => { finish = resolve; }); const save = find("Crear ingreso fijo"); await act(async () => { save.click(); save.click(); }); assert.equal(globalThis.riWrites.length, 1); globalThis.riGate = null; await act(async () => finish()); await settle(); assert.equal(container.querySelector("form"), null);
await openNew(); await values(); globalThis.riFailure = new Error("Failed to fetch"); await click("Crear ingreso fijo"); assert.match(container.textContent, /Resultado por comprobar/); const beforeReplay = globalThis.riWrites.length; await render(); await act(async () => globalThis.riEditor.onSubmit({ preventDefault() {} })); assert.equal(globalThis.riWrites.length, beforeReplay); assert.ok(find("Comprueba el resultado").disabled); globalThis.riFailure = null; await discard();
await menu(); await click("Editar"); const removedSave = globalThis.riEditor.onSubmit; await render({}, { data: { ...data(), recurringIncome: [fixtures[1]] } }); await act(async () => removedSave({ preventDefault() {} })); assert.equal(globalThis.riWrites.length, beforeReplay); await render({ userId: "B" }, { data: data() });

// Confirming an arrival is a separate, frozen financial intention; errors never replay it.
await menu(); await click("Confirmar llegada"); let finishArrival; globalThis.riGate = new Promise(resolve => { finishArrival = resolve; }); const beforeArrival = globalThis.riWrites.length; const confirm = find("Confirmar llegada"); await act(async () => { confirm.click(); confirm.click(); }); assert.equal(globalThis.riWrites.length, beforeArrival + 1); globalThis.riGate = null; await act(async () => finishArrival()); await settle(); assert.equal(container.querySelector("form"), null);
await menu(); await click("Confirmar llegada"); globalThis.riFailure = { code: "23514", message: "second phase SQL failure" }; await submit(); assert.match(container.textContent, /No repitas la llegada/); const beforeArrivalReplay = globalThis.riWrites.length; await render(); await submit(); assert.equal(globalThis.riWrites.length, beforeArrivalReplay); assert.ok(find("Comprueba la llegada en el historial").disabled); globalThis.riFailure = null; await closeArrival();
await menu(); await click("Confirmar llegada"); globalThis.riResult = {}; await submit(); assert.ok(find("Comprueba la llegada en el historial").disabled); const beforeMissingReply = globalThis.riWrites.length; await submit(); assert.equal(globalThis.riWrites.length, beforeMissingReply); globalThis.riResult = undefined; await closeArrival();
for (const forever of [false, true]) {
  await menu(); await click("Confirmar llegada"); const details = [...container.querySelectorAll("button")].find(node => node.textContent.startsWith("Llegó distinto")); assert.ok(details); await act(async () => details.click());
  await change(container.querySelector('input[placeholder="0.00"]'), "130"); await change(container.querySelector("textarea"), "Cambio confirmado");
  if (forever) await act(async () => container.querySelectorAll('input[name="baseChangeMode"]')[1].click());
  await submit(); const sent = globalThis.riWrites.at(-1).input; assert.equal(sent.amount, 130); assert.equal(sent.newBaseAmount, forever ? 130 : null); assert.equal(sent.notes, "Cambio confirmado"); assert.equal(container.querySelector("form"), null);
}
await menu(); await click("Confirmar llegada"); let finishOld; globalThis.riGate = new Promise(resolve => { finishOld = resolve; }); await submit(); const oldContext = globalThis.riWrites.at(-1).input.isCurrent;
await render({ role: "viewer" }); await render({ role: "owner" }); assert.equal(oldContext(), false); globalThis.riGate = null; await act(async () => finishOld()); await settle(); assert.equal(container.querySelector("form"), null);
await menu(); await click("Confirmar llegada"); await render({}, { data: { ...data(), recurringIncome: fixtures.map(row => row.id === 1 ? { ...row, nextExpectedDate: "2027-02-01" } : row) } }); assert.ok(find("Revisa la próxima llegada").disabled); await render({}, { data: data() }); assert.ok(find("Revisa la próxima llegada").disabled); await closeArrival();
await menu(); await click("Confirmar llegada"); await render({ role: "viewer" }); assert.equal(container.querySelector("form"), null); await render({ role: "owner" });
const validInput = globalThis.riWrites.find(row => row.kind === "arrival").input;
for (const patch of [{ amount: 1.001 }, { actualDate: "2026-02-30" }, { accountId: 2 }, { accountId: 9 }, { nextExpectedDate: "2028-01-01" }, { newBaseAmount: 99 }]) assert.throws(() => validateArrivalInput(fixtures[0], accounts, { ...validInput, ...patch }));

// Fresh resource and access checks protect action callbacks and every item in a batch.
const stalePin = globalThis.riList.onPin; await render({ role: "viewer" }); await render({ role: "owner" }); const beforePin = globalThis.riWrites.length; await act(async () => stalePin(fixtures[0])); assert.equal(globalThis.riWrites.length, beforePin);
await render({ userId: "Batch" }, { data: { ...data(), recurringIncome: [fixtures[0], income(4), fixtures[1]] } }); await act(async () => container.querySelector('input[aria-label="Seleccionar todas"]').click());
let finishBatch; globalThis.riGate = new Promise(resolve => { finishBatch = resolve; }); const beforeBatch = globalThis.riWrites.length; const pause = find("Pausar activos"); await act(async () => { pause.click(); pause.click(); }); assert.equal(globalThis.riWrites.length, beforeBatch + 1); await render({ role: "viewer" }); await render({ role: "owner" }); globalThis.riGate = null; await act(async () => finishBatch()); await settle(); assert.equal(globalThis.riWrites.length, beforeBatch + 1); await render({ userId: "B" }, { data: data() });

async function scheduleDelete() { await menu(2); await click("Eliminar"); await click("Eliminar"); const [id, job] = [...globalThis.riUndo.entries()].at(-1); assert.match(job.label, /pendiente de eliminar/); return { id, job }; }
let job = await scheduleDelete(); await render({ role: "viewer" }); assert.ok(globalThis.riCancelled.includes(job.id)); await render({ role: "owner" }); const beforeDelete = globalThis.riWrites.length; await act(async () => job.job.onCommit()); assert.equal(globalThis.riWrites.length, beforeDelete);
job = await scheduleDelete(); await act(async () => { await job.job.onCommit(); await job.job.onCommit(); }); assert.equal(globalThis.riWrites.length, beforeDelete + 1);
await render({ userId: "C" }); job = await scheduleDelete(); globalThis.riFailure = new Error("delete unknown"); await act(async () => job.job.onCommit()); assert.ok(aria("Acciones de Ingreso 2")); assert.match(container.textContent, /delete unknown/); globalThis.riFailure = null;
job = await scheduleDelete(); await render({ workspaceId: 9 }, { data: { ...data(), workspace: { id: 9 }, recurringIncome: [income(9, { workspaceId: 9 })] } }); assert.ok(globalThis.riCancelled.includes(job.id)); await render({ workspaceId: 8 }, { data: { ...data(), workspace: { id: 8 } } }); const beforeOldCommit = globalThis.riWrites.length; await act(async () => job.job.onCommit()); assert.equal(globalThis.riWrites.length, beforeOldCommit);
job = await scheduleDelete(); await act(async () => renderer.unmount()); assert.ok(globalThis.riCancelled.includes(job.id)); await act(async () => job.job.onCommit()); assert.equal(globalThis.riWrites.length, beforeOldCommit);
dom.window.HTMLAnchorElement.prototype.click = oldClick; URL.createObjectURL = oldUrl; URL.revokeObjectURL = oldRevoke; container.remove(); dom.window.close();
console.log("recurring-income-permissions: OK (actual page/list/editor/arrival/history; readonly/archive/read/scope/ABA, scoped CSV, duplicate and uncertain saves/arrivals, due-date latch, account/money/date checks, batch interruption and deferred cancellation/once/failure; fake I/O, not server phases/RLS)");
