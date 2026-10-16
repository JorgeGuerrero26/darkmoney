import assert from "node:assert/strict";
import { React, act, createRoot, dom, load, mock, h, settle, change, MemoryRouter, QueryClient, QueryClientProvider } from "./lib/web-ui-harness.mjs";

const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const subscription = (id, extra = {}) => ({ id, workspaceId: 8, name: `Servicio ${id}`, vendor: "", vendorPartyId: null, accountId: 1, accountName: "Principal", categoryId: null, currencyCode: "PEN", amount: 30, amountInBaseCurrency: 30, frequency: "monthly", intervalCount: 1, dayOfMonth: 16, dayOfWeek: null, startDate: "2026-01-01", nextDueDate: today, endDate: null, status: "active", autoCreateMovement: false, remindDaysBefore: 3, description: "", notes: "", isPinned: false, ...extra });
const fixtures = [subscription(1), subscription(2, { status: "paused" }), subscription(3, { workspaceId: 99, name: "Servicio ajeno" })];
const accounts = [{ id: 1, workspaceId: 8, name: "Principal", currencyCode: "PEN", isArchived: false }, { id: 2, workspaceId: 8, name: "USD", currencyCode: "USD", isArchived: false }, { id: 9, workspaceId: 99, name: "Cuenta ajena", currencyCode: "PEN", isArchived: false }];
globalThis.subScope = { userId: "A", workspaceId: 8, role: "owner", archived: false, fetching: false };
const data = () => ({ workspace: { id: globalThis.subScope.workspaceId, baseCurrencyCode: "PEN" }, subscriptions: fixtures, accounts, catalogs: { categories: [{ id: 11, name: "Gasto", isActive: true, kind: "expense" }, { id: 12, name: "Ingreso", isActive: true, kind: "income" }], counterparties: [] }, movements: [], exchangeRates: [] });
globalThis.subSnapshot = { data: data(), isSuccess: true, isFetching: false, isPlaceholderData: false, refetch: async () => ({ data: globalThis.subSnapshot.data }) };
globalThis.subWrites = []; globalThis.subReads = []; globalThis.subGate = null; globalThis.subFailure = null; globalThis.subOverride = undefined;
globalThis.subUndo = new Map(); globalThis.subCancelled = []; let sequence = 0;
globalThis.subClient = { from(table) {
  return { table, kind: "read", payload: null, filters: [], signal: null,
    select() { return this; }, range(from, to) { this.start = from; this.end = to; return this; }, update(payload) { this.kind = "update"; this.payload = payload; return this; }, insert(payload) { this.kind = "insert"; this.payload = payload; return this; },
    eq(key, value) { this.filters.push([key, value]); return this; }, is(key, value) { this.filters.push([key, value]); return this; }, abortSignal(signal) { this.signal = signal; return this; }, order() { return this; },
    single() { return this.execute(); }, maybeSingle() { return this.execute(); }, then(resolve, reject) { return this.execute().then(resolve, reject); },
    async execute() {
      const id = this.filters.find(([key]) => key === "id")?.[1], ws = this.filters.find(([key]) => key === "workspace_id")?.[1];
      const row = (globalThis.subSnapshot.data?.subscriptions ?? []).find(item => item.id === id && (ws == null || item.workspaceId === ws));
      if (this.kind === "read") {
        globalThis.subReads.push({ table, filters: this.filters, signal: this.signal, from: this.start });
        if (table === "subscriptions") return { data: row ? { id: row.id, workspace_id: globalThis.subBadParent ? 99 : row.workspaceId } : null, error: null };
        const occurrences = globalThis.subOccurrences ?? [], result = occurrences.slice(this.start ?? 0, (this.end ?? occurrences.length) + 1);
        return { data: globalThis.subShortPage && this.start === 500 ? [] : result, count: globalThis.subUnknownCount ? null : occurrences.length, error: null };
      }
      globalThis.subWrites.push({ kind: this.kind, table, payload: this.payload, filters: this.filters });
      if (globalThis.subGate) await globalThis.subGate;
      if (globalThis.subFailure) return { data: null, error: globalThis.subFailure };
      if (globalThis.subNoAdvance) return { data: null, error: null };
      return { data: table === "subscriptions" && row ? { id: row.id, workspace_id: row.workspaceId, ...this.payload } : globalThis.subBadInsert ? {} : { id: 400, workspace_id: this.payload.workspace_id, subscription_id: this.payload.subscription_id, source_account_id: this.payload.source_account_id, source_amount: this.payload.source_amount, status: this.payload.status }, error: null };
    },
  };
} };
mock("src/services/supabase/client.ts", "export const supabase=globalThis.subClient;");
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:globalThis.subScope.userId?{id:globalThis.subScope.userId}:null,profile:null});");
mock("src/modules/workspaces/use-active-workspace.ts", "export const useActiveWorkspace=()=>({activeWorkspace:{id:globalThis.subScope.workspaceId,baseCurrencyCode:'PEN',role:globalThis.subScope.role,isArchived:globalThis.subScope.archived},isFetching:globalThis.subScope.fetching,isLoading:false});");
mock("src/services/queries/workspace-data.ts", `
  export const useWorkspaceSnapshotQuery=()=>globalThis.subSnapshot;
  const mutation=kind=>({isPending:false,mutateAsync:async input=>{globalThis.subWrites.push({kind,input});if(globalThis.subGate)await globalThis.subGate;if(globalThis.subFailure)throw globalThis.subFailure;return globalThis.subOverride??{id:input.subscriptionId??88,workspaceId:input.workspaceId};}});
  export const useCreateSubscriptionMutation=()=>mutation('create'),useUpdateSubscriptionMutation=()=>mutation('update'),useDeleteSubscriptionMutation=()=>mutation('delete');
  export const getQueryErrorMessage=(error,fallback)=>error?.message??fallback??'fixture error';
`);
mock("src/components/ui/toast-provider.tsx", "export const useSuccessToast=()=>{};");
globalThis.subSchedule = item => { const id = `undo-${++sequence}`; globalThis.subUndo.set(id, item); return id; };
globalThis.subCancel = id => { const entry = globalThis.subUndo.get(id); globalThis.subUndo.delete(id); globalThis.subCancelled.push(id); entry?.onUndo?.(); };
mock("src/components/ui/undo-queue.tsx", "export const useUndoQueue=()=>({schedule:globalThis.subSchedule,cancel:globalThis.subCancel});");
mock("src/modules/subscriptions/components/subscription-analytics-modal.tsx", `${h} export const SubscriptionAnalyticsModal=p=>{globalThis.subAnalysis=p;return h('button',{onClick:p.onClose},'Cerrar análisis');};`);
const editorUrl = load("src/modules/subscriptions/components/subscription-editor-dialog.tsx");
mock("src/modules/subscriptions/components/subscription-editor-dialog.tsx", `${h} import {SubscriptionEditorDialog as Real} from '${editorUrl}';export const SubscriptionEditorDialog=p=>{globalThis.subEditor=p;return h(Real,p);};`);
const detailUrl = load("src/modules/subscriptions/components/subscription-detail-dialog.tsx");
mock("src/modules/subscriptions/components/subscription-detail-dialog.tsx", `${h} import {SubscriptionDetailDialog as Real} from '${detailUrl}';export const SubscriptionDetailDialog=p=>{globalThis.subDetail=p;return h(Real,p);};`);
const { SubscriptionsPage } = await import(load("src/modules/subscriptions/pages/subscriptions-page.tsx"));
const { markSubscriptionPaid } = await import(load("src/modules/subscriptions/lib/subscription-actions.ts"));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const find = label => [...container.querySelectorAll("button")].find(node => node.textContent.trim() === label);
const aria = label => { const node = container.querySelector(`button[aria-label="${label}"]`); assert.ok(node, label); return node; };
const newButton = () => container.querySelector('[data-tour="create-subscription"]');
async function click(label) { const node = find(label); assert.ok(node, label); await act(async () => node.click()); await settle(); }
async function render(scope = {}, query = {}) { Object.assign(globalThis.subScope, scope); Object.assign(globalThis.subSnapshot, query); await act(async () => renderer.render(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(MemoryRouter, null, React.createElement(SubscriptionsPage))))); await settle(); }
async function menu(id = 1) { await act(async () => aria(`Opciones de Servicio ${id}`).click()); }
async function openNew() { assert.ok(newButton()); await act(async () => newButton().click()); }
async function formValues() { await change(container.querySelector('input[placeholder="Ej. Internet de casa"]'), "Servicio nuevo"); await change(container.querySelector('input[placeholder="0.00"]'), "25"); }
async function discard() { await act(async () => globalThis.subEditor.closeEditor()); if (find("Sí, descartar")) await click("Sí, descartar"); }
let csv = "", exported = 0;
const oldClick = dom.window.HTMLAnchorElement.prototype.click, oldUrl = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
dom.window.HTMLAnchorElement.prototype.click = () => { exported++; }; URL.createObjectURL = blob => { blob.text().then(value => { csv = value; }); return "blob:test"; }; URL.revokeObjectURL = () => {};

await render({ role: "viewer" }); assert.equal(newButton().disabled, true); assert.match(container.textContent, /solo lectura/); assert.doesNotMatch(container.textContent, /Servicio ajeno/);
await menu(); for (const label of ["Editar", "Eliminar", "Registrar pago", "Reactivar"]) assert.equal(find(label), undefined);
await click("Ver detalle"); assert.equal(find("Editar"), undefined); assert.equal(find("Registrar pago"), undefined);
assert.deepEqual(queryClient.getQueryData(["subscription-occurrences", 8, "A", 1]), []); assert.equal(queryClient.getQueryData(["subscription-occurrences", 1]), undefined);
const occurrenceReads = globalThis.subReads.filter(read => read.table === "subscription_occurrences").length;
globalThis.subBadParent = true; await act(async () => queryClient.invalidateQueries({ queryKey: ["subscription-occurrences", 8, "A", 1] })); await settle(); assert.match(container.textContent, /Por comprobar/); assert.equal(globalThis.subReads.filter(read => read.table === "subscription_occurrences").length, occurrenceReads);
globalThis.subBadParent = false; await act(async () => queryClient.invalidateQueries({ queryKey: ["subscription-occurrences", 8, "A", 1] })); await settle();
globalThis.subOccurrences = Array.from({ length: 501 }, (_, index) => ({ id: index + 1, subscription_id: 1, due_date: today, expected_amount: 30, status: "paid" }));
await act(async () => queryClient.invalidateQueries({ queryKey: ["subscription-occurrences", 8, "A", 1] })); await settle(); assert.equal(queryClient.getQueryData(["subscription-occurrences", 8, "A", 1]).length, 501); assert.ok(globalThis.subReads.some(read => read.from === 500));
globalThis.subShortPage = true; await act(async () => queryClient.invalidateQueries({ queryKey: ["subscription-occurrences", 8, "A", 1] })); await settle(); assert.match(container.textContent, /Por comprobar/);
globalThis.subShortPage = false; globalThis.subOccurrences = []; await act(async () => queryClient.invalidateQueries({ queryKey: ["subscription-occurrences", 8, "A", 1] })); await settle();
globalThis.subUnknownCount = true; await act(async () => queryClient.invalidateQueries({ queryKey: ["subscription-occurrences", 8, "A", 1] })); await settle(); assert.match(container.textContent, /Por comprobar/); globalThis.subUnknownCount = false;
for (const invalid of [[{ id: 1, subscription_id: 1, due_date: today, expected_amount: 30, status: "paid" }, { id: 1, subscription_id: 1, due_date: today, expected_amount: 30, status: "paid" }], [{ id: 1, subscription_id: 99, due_date: today, expected_amount: 30, status: "paid" }], [{ id: 1, subscription_id: 1, due_date: today, expected_amount: "", status: "paid" }]]) {
  globalThis.subOccurrences = invalid; await act(async () => queryClient.invalidateQueries({ queryKey: ["subscription-occurrences", 8, "A", 1] })); await settle(); assert.match(container.textContent, /Por comprobar/);
}
globalThis.subOccurrences = []; await act(async () => queryClient.invalidateQueries({ queryKey: ["subscription-occurrences", 8, "A", 1] })); await settle();
globalThis.subOccurrences = [{ id: 1, subscription_id: 1, due_date: "2026-01-01", expected_amount: 40, status: "overdue" }];
await render({}, { data: { ...data(), subscriptions: fixtures.map(item => item.id === 1 ? { ...item, nextDueDate: "2027-02-16" } : item) } }); await act(async () => queryClient.invalidateQueries({ queryKey: ["subscription-occurrences", 8, "A", 1] })); await settle(); assert.match(container.textContent, /Suscripción · Atrasada/); assert.match(container.textContent, /1 cobro sin anotar/);
globalThis.subOccurrences = []; await render({}, { data: data() }); await act(async () => queryClient.invalidateQueries({ queryKey: ["subscription-occurrences", 8, "A", 1] })); await settle();
await act(async () => aria("Más acciones de suscripción").click()); assert.equal(find("Fijar en la lista"), undefined); await click("Ver analítica"); assert.deepEqual(globalThis.subAnalysis.movements, []); await click("Cerrar análisis"); await click("Cerrar");
assert.ok(globalThis.subReads.some(read => read.table === "subscriptions" && read.filters.some(([key, value]) => key === "workspace_id" && value === 8) && read.signal));
await act(async () => aria("Más acciones").click()); await click("Exportar las 2"); assert.equal(exported, 1); assert.doesNotMatch(csv, /Servicio ajeno/);
await act(async () => container.querySelector('input[aria-label="Seleccionar todas"]').click()); assert.equal(find("Pausar"), undefined); assert.equal(find("Eliminar"), undefined); await click("Exportar CSV"); assert.equal(exported, 2); assert.equal(globalThis.subWrites.length, 0);
await render({ role: "owner", archived: true }); assert.equal(newButton().disabled, true);
await render({ archived: false, fetching: true }); assert.equal(newButton().disabled, true); await render({ fetching: false }, { isFetching: true }); assert.equal(newButton().disabled, true);
await render({}, { isFetching: false, isPlaceholderData: true }); assert.equal(newButton(), null); await render({}, { isPlaceholderData: false });
await render({}, { data: undefined, error: new Error("failed snapshot") }); assert.match(container.textContent, /failed snapshot/); await render({}, { data: data(), error: null });

await openNew(); const staleSave = globalThis.subEditor.onSubmit; await render({ role: "viewer" }); assert.equal(container.querySelector("form"), null); await render({ role: "owner" }); await act(async () => staleSave({ preventDefault() {} })); assert.equal(globalThis.subWrites.length, 0);
await openNew(); await formValues(); let finish; globalThis.subGate = new Promise(resolve => { finish = resolve; }); const save = find("Crear suscripción"); await act(async () => { save.click(); save.click(); }); assert.equal(globalThis.subWrites.length, 1); globalThis.subGate = null; await act(async () => finish()); await settle(); assert.equal(container.querySelector("form"), null);
await openNew(); await formValues(); globalThis.subFailure = new Error("Failed to fetch"); await click("Crear suscripción"); assert.match(container.textContent, /Resultado por comprobar/); const beforeReplay = globalThis.subWrites.length; await act(async () => globalThis.subEditor.onSubmit({ preventDefault() {} })); assert.equal(globalThis.subWrites.length, beforeReplay); assert.ok(find("Comprueba el resultado").disabled); globalThis.subFailure = null; await discard();

// Both editors require the ID and space returned by the actual mutation contract.
for (const mode of ["create", "edit"]) for (const result of [{}, { id: 1, workspaceId: 99 }, { id: "1", workspaceId: 8 }, ...(mode === "edit" ? [{ id: 88, workspaceId: 8 }] : [])]) {
  if (mode === "create") { await openNew(); await formValues(); } else { await menu(); await click("Editar"); }
  globalThis.subOverride = result; const beforeInvalidSave = globalThis.subWrites.length;
  await click(mode === "create" ? "Crear suscripción" : "Guardar cambios"); assert.equal(globalThis.subWrites.length, beforeInvalidSave + 1); assert.match(container.textContent, /Resultado por comprobar/);
  await render(); await act(async () => globalThis.subEditor.onSubmit({ preventDefault() {} })); assert.equal(globalThis.subWrites.length, beforeInvalidSave + 1); assert.ok(find("Comprueba el resultado").disabled);
  globalThis.subOverride = undefined; await discard();
}
await menu(); await click("Editar"); globalThis.subFailure = { code: "23514", message: "SQL rejected" }; await click("Guardar cambios"); assert.match(container.textContent, /No pudimos guardar/); assert.equal(find("Comprueba el resultado"), undefined);
globalThis.subFailure = null; await click("Guardar cambios"); assert.equal(container.querySelector("form"), null);

// All action shortcuts revalidate the current same-space resource and eligible catalogs.
await menu(); await click("Ver detalle"); const stalePin = globalThis.subDetail.onPin, invalidAccount = globalThis.subDetail.onAssignAccount, invalidCategory = globalThis.subDetail.onAssignCategory;
const beforeInvalid = globalThis.subWrites.length; await act(async () => { invalidAccount(2); invalidAccount(9); invalidCategory(12); }); await settle(); assert.equal(globalThis.subWrites.length, beforeInvalid); assert.match(container.textContent, /activa|activo/);
await render({ role: "viewer" }); await render({ role: "owner" }); await act(async () => stalePin()); assert.equal(globalThis.subWrites.length, beforeInvalid); await act(async () => globalThis.subDetail.onClose());
await menu(); await click("Editar"); const removedSave = globalThis.subEditor.onSubmit; await render({}, { data: { ...data(), subscriptions: fixtures.filter(item => item.id !== 1) } }); await act(async () => removedSave({ preventDefault() {} })); assert.equal(globalThis.subWrites.length, beforeInvalid); await render({ userId: "B" }, { data: data() });

// Native payment sequence: one advance + one movement, guarded between phases and by returned evidence.
await menu(); await click("Registrar pago"); const pay = find("Confirmar pago"); assert.ok(pay); let finishPay; globalThis.subGate = new Promise(resolve => { finishPay = resolve; }); const beforePay = globalThis.subWrites.length;
await act(async () => { pay.click(); pay.click(); }); assert.equal(globalThis.subWrites.length, beforePay + 1); assert.equal(globalThis.subWrites.at(-1).table, "subscriptions"); globalThis.subGate = null; await act(async () => finishPay()); await settle(); assert.equal(globalThis.subWrites.length, beforePay + 2); assert.equal(globalThis.subWrites.at(-1).payload.metadata.paid_for_due_date, today);
await menu(); await click("Registrar pago"); await render({}, { data: { ...data(), subscriptions: fixtures.map(item => item.id === 1 ? { ...item, nextDueDate: "2027-02-16" } : item) } }); assert.ok(find("Revisa el próximo cobro").disabled); await render({}, { data: data() }); assert.ok(find("Revisa el próximo cobro").disabled); await act(async () => globalThis.subDetail.onClose());
await menu(); await click("Registrar pago"); let stopAfterAdvance; globalThis.subGate = new Promise(resolve => { stopAfterAdvance = resolve; }); const beforeScopeLoss = globalThis.subWrites.length; await click("Confirmar pago"); await render({ role: "viewer" }); await render({ role: "owner" }); globalThis.subGate = null; await act(async () => stopAfterAdvance()); await settle(); assert.equal(globalThis.subWrites.length, beforeScopeLoss + 1); await act(async () => globalThis.subDetail.onClose());
globalThis.subNoAdvance = true; const beforeNoAdvance = globalThis.subWrites.length; await assert.rejects(markSubscriptionPaid(fixtures[0], { paidDate: today, amount: 30, accountId: 1 }), /No se confirmó el avance/); assert.equal(globalThis.subWrites.length, beforeNoAdvance + 1); globalThis.subNoAdvance = false;
globalThis.subBadInsert = true; const beforeBadInsert = globalThis.subWrites.length; await assert.rejects(markSubscriptionPaid(fixtures[0], { paidDate: today, amount: 30, accountId: 1 }), /no se confirmó el movimiento esperado/); assert.equal(globalThis.subWrites.length, beforeBadInsert + 2); globalThis.subBadInsert = false;

// Multi-actions cannot double-send or continue the next item after permission ABA.
await render({ userId: "Batch" }, { data: { ...data(), subscriptions: [fixtures[0], subscription(4), fixtures[1]] } }); await act(async () => container.querySelector('input[aria-label="Seleccionar todas"]').click());
const pause = find("Pausar"), beforeBatch = globalThis.subWrites.length; let finishBatch; globalThis.subGate = new Promise(resolve => { finishBatch = resolve; }); await act(async () => { pause.click(); pause.click(); }); assert.equal(globalThis.subWrites.length, beforeBatch + 1);
await render({ role: "viewer" }); await render({ role: "owner" }); globalThis.subGate = null; await act(async () => finishBatch()); await settle(); assert.equal(globalThis.subWrites.length, beforeBatch + 1); await render({ userId: "B" }, { data: data() });

// Deferred delete cancellation, current references, single completion/failure and context changes.
async function scheduleDelete() { await menu(2); await click("Eliminar"); await click("Eliminar definitivamente"); const [id, job] = [...globalThis.subUndo.entries()].at(-1); assert.match(job.label, /pendiente de eliminar/); return { id, job }; }
let job = await scheduleDelete(), beforeDelete = globalThis.subWrites.length;
await render({}, { isFetching: true }); assert.ok(globalThis.subCancelled.includes(job.id)); await render({}, { isFetching: false }); await act(async () => job.job.onCommit()); assert.equal(globalThis.subWrites.length, beforeDelete);
job = await scheduleDelete(); await render({}, { data: { ...data(), movements: [{ workspaceId: 8, subscriptionId: 2 }] } }); await act(async () => job.job.onCommit()); assert.equal(globalThis.subWrites.length, beforeDelete); assert.match(container.textContent, /pagos asociados/); await render({}, { data: data() });
job = await scheduleDelete(); await act(async () => { await job.job.onCommit(); await job.job.onCommit(); }); assert.equal(globalThis.subWrites.length, beforeDelete + 1);
await render({ userId: "C" }); job = await scheduleDelete(); globalThis.subFailure = new Error("partial delete outcome"); await act(async () => job.job.onCommit()); assert.ok(aria("Opciones de Servicio 2")); assert.match(container.textContent, /partial delete outcome/); globalThis.subFailure = null;
job = await scheduleDelete(); await render({ workspaceId: 9 }, { data: { ...data(), workspace: { id: 9 }, subscriptions: [subscription(9, { workspaceId: 9 })] } }); assert.ok(globalThis.subCancelled.includes(job.id)); await render({ workspaceId: 8 }, { data: { ...data(), workspace: { id: 8 } } }); const beforeOldCommit = globalThis.subWrites.length; await act(async () => job.job.onCommit()); assert.equal(globalThis.subWrites.length, beforeOldCommit);
job = await scheduleDelete(); await act(async () => renderer.unmount()); assert.ok(globalThis.subCancelled.includes(job.id)); await act(async () => job.job.onCommit()); assert.equal(globalThis.subWrites.length, beforeOldCommit);
queryClient.clear(); dom.window.HTMLAnchorElement.prototype.click = oldClick; URL.createObjectURL = oldUrl; URL.revokeObjectURL = oldRevoke; container.remove(); dom.window.close();
console.log("subscription-permissions: OK (actual page/table/detail/editor/payment/actions/query; roles/archive/reads/ABA, scoped CSV/catalogs, duplicate/uncertain saves, payment due-date latch/CAS/phase guards, parent-verified occurrence reads, deferred cancellation/references/once/errors; fake transport, not server atomicity/RLS)");
