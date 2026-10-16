import assert from "node:assert/strict";
import { React, act, createRoot, dom, load, mock, h, settle, change, MemoryRouter } from "./lib/web-ui-harness.mjs";

const account = (id, extra = {}) => ({ id, workspaceId: 8, name: `Cuenta ${id}`, type: "cash", currencyCode: "PEN", openingBalance: 0, currentBalance: 100 * id, currentBalanceInBaseCurrency: 100 * id, includeInNetWorth: true, lastActivity: "2026-10-01T12:00:00Z", color: "#1b6a58", icon: "wallet", isArchived: false, ...extra });
const fixtures = [account(1), account(2, { isArchived: true }), account(3, { workspaceId: 99, name: "Cuenta ajena" })];
globalThis.accountScope = { userId: "A", workspaceId: 8, role: "owner", archived: false, fetching: false };
globalThis.accountSnapshot = { isSuccess: true, isFetching: false, isPlaceholderData: false, data: { workspace: { id: 8, baseCurrencyCode: "PEN" }, accounts: fixtures, movements: [], exchangeRates: [{ fromCurrencyCode: "PEN", toCurrencyCode: "USD", rate: 0.25 }] } };
globalThis.accountWrites = []; globalThis.accountGate = null; globalThis.accountFailure = null; globalThis.accountUndo = new Map(); globalThis.accountCancelled = []; globalThis.accountQueueId = 0; globalThis.accountMovementRequests = [];
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:globalThis.accountScope.userId?{id:globalThis.accountScope.userId}:null,profile:null});");
mock("src/modules/workspaces/use-active-workspace.ts", "export const useActiveWorkspace=()=>({activeWorkspace:{id:globalThis.accountScope.workspaceId,baseCurrencyCode:'PEN',role:globalThis.accountScope.role,isArchived:globalThis.accountScope.archived},isFetching:globalThis.accountScope.fetching,isLoading:false});");
mock("src/services/queries/workspace-data.ts", `
  export const useWorkspaceSnapshotQuery=()=>globalThis.accountSnapshot;
  const mutation=kind=>({isPending:false,mutateAsync:async input=>{globalThis.accountWrites.push({kind,input});if(globalThis.accountGate)await globalThis.accountGate;if(globalThis.accountFailure)throw globalThis.accountFailure;return globalThis.accountResultOverride??{id:input.accountId??77,workspaceId:input.workspaceId,isArchived:input.isArchived??false};}});
  export const useCreateAccountMutation=()=>mutation('create'),useUpdateAccountMutation=()=>mutation('update'),useArchiveAccountMutation=()=>mutation('archive'),useDeleteAccountMutation=()=>mutation('delete');
  export const getQueryErrorMessage=(e,f)=>e?.message??f;
`);
mock("src/modules/notifications/user-preferences-context.tsx", "export const useUserPreferences=()=>({columnVisibility:{},setColumnVisibility:()=>{}});");
mock("src/components/ui/toast-provider.tsx", "export const useSuccessToast=()=>{};");
mock("src/components/ui/undo-queue.tsx", `
  const cancel=id=>{const entry=globalThis.accountUndo.get(id);globalThis.accountUndo.delete(id);globalThis.accountCancelled.push(id);entry?.onUndo?.();};
  const schedule=item=>{const id='undo-'+(++globalThis.accountQueueId);globalThis.accountUndo.set(id,item);return id;};
  export const useUndoQueue=()=>({schedule,cancel});
`);
mock("src/modules/movements/lib/quick-movement-event.ts", "export const requestQuickMovement=value=>globalThis.accountMovementRequests.push(value);");
mock("src/modules/accounts/components/account-analytics-modal.tsx", `${h} export const AccountAnalyticsModal=p=>{globalThis.accountAnalysis=p;return h('div',null,h('button',{onClick:p.onClose},'Cerrar análisis'));};`);
const editorUrl = load("src/modules/accounts/components/account-editor-dialog.tsx");
mock("src/modules/accounts/components/account-editor-dialog.tsx", `${h} import {AccountEditorDialog as Real} from '${editorUrl}';export const AccountEditorDialog=p=>{globalThis.accountEditor=p;return h(Real,p);};`);
const detailUrl = load("src/modules/accounts/components/account-detail-dialog.tsx");
mock("src/modules/accounts/components/account-detail-dialog.tsx", `${h} import {AccountDetailDialog as Real} from '${detailUrl}';export const AccountDetailDialog=p=>{globalThis.accountDetail=p;return h(Real,p);};`);
const { AccountsPage } = await import(load("src/modules/accounts/pages/accounts-page.tsx"));
const { accountEditorDraftKey } = await import(load("src/modules/accounts/hooks/use-account-editor.ts"));
const container = document.createElement("div"); document.body.append(container); let renderer = createRoot(container);
const find = label => [...container.querySelectorAll("button")].find(node => node.textContent.trim() === label);
const aria = label => { const node = container.querySelector(`button[aria-label="${label}"]`); assert.ok(node, label); return node; };
async function click(label) { const node = find(label) ?? (label === "Detalles" ? [...container.querySelectorAll("button")].find(node => node.firstElementChild?.textContent === label) : undefined); assert.ok(node, label); await act(async () => node.click()); await settle(); }
async function render(scope = {}, query = {}) {
  Object.assign(globalThis.accountScope, scope); Object.assign(globalThis.accountSnapshot, query);
  await act(async () => renderer.render(React.createElement(MemoryRouter, { initialEntries: ["/app/accounts?status=all"] }, React.createElement(AccountsPage)))); await settle();
}
async function menu(id = 1) { await act(async () => aria(`Más opciones de Cuenta ${id}`).click()); }
async function pageMenu() { await act(async () => aria("Más opciones de cuentas").click()); }
async function row(id = 1) { const node = [...container.querySelectorAll('[role="button"]')].find(node => node.textContent.includes(`Cuenta ${id}`)); assert.ok(node); await act(async () => node.click()); await settle(); }
const snapshotData = () => ({ workspace: { id: globalThis.accountScope.workspaceId, baseCurrencyCode: "PEN" }, accounts: fixtures, movements: [], exchangeRates: [{ fromCurrencyCode: "PEN", toCurrencyCode: "USD", rate: 0.25 }] });
let csv = "", exports = 0;
const originalAnchor = dom.window.HTMLAnchorElement.prototype.click, originalUrl = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
URL.createObjectURL = blob => { blob.text().then(value => { csv = value; }); return "blob:test"; }; URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = () => { exports++; };

// Readonly users retain review, valid analytics and CSV, but no financial/editor shortcuts.
await render({ role: "viewer" }); assert.equal(find("Nueva cuenta").disabled, true); assert.match(container.textContent, /solo lectura/); assert.doesNotMatch(container.textContent, /Cuenta ajena/);
await menu(); assert.equal(find("Editar"), undefined); assert.equal(find("Archivar"), undefined); await click("Analizar"); assert.deepEqual(globalThis.accountAnalysis.movements, []); await click("Cerrar análisis");
await row(); assert.equal(find("Editar cuenta"), undefined); assert.equal(find("Nuevo gasto"), undefined); assert.equal(find("Transferir"), undefined); await click("Cerrar");
await pageMenu(); await click("Exportar las 2"); assert.equal(exports, 1); assert.match(csv, /Cuenta 1/); assert.doesNotMatch(csv, /Cuenta ajena/);
await act(async () => container.querySelector('input[aria-label="Seleccionar todas las cuentas"]').click()); assert.equal(find("Archivar activas"), undefined); assert.equal(find("Restaurar archivadas"), undefined); await click("Exportar CSV"); assert.equal(exports, 2); assert.equal(globalThis.accountWrites.length, 0);

await render({ role: "owner", archived: true }); assert.equal(find("Nueva cuenta").disabled, true); assert.match(container.textContent, /espacio está archivado/);
await render({ archived: false, role: "unknown" }); assert.equal(find("Nueva cuenta").disabled, true);
await render({ role: "admin" }); assert.equal(find("Nueva cuenta").disabled, false);
await render({ role: "member" }); assert.equal(find("Nueva cuenta").disabled, false);
await render({ role: "owner", userId: undefined }); assert.equal(find("Nueva cuenta"), undefined); assert.equal(container.querySelector("form"), null); await render({ userId: "A" });
for (const query of [{ isFetching: true }, { isPlaceholderData: true }]) { await render({ archived: false }, query); assert.ok(!find("Nueva cuenta") || find("Nueva cuenta").disabled); await render({}, { isFetching: false, isPlaceholderData: false }); }
await render({ fetching: true }); assert.equal(find("Nueva cuenta").disabled, true); await render({ fetching: false });
await render({}, { data: { ...snapshotData(), workspace: { id: 99 }, accounts: [account(4, { workspaceId: 99, name: "Otro snapshot" })] } }); assert.doesNotMatch(container.textContent, /Otro snapshot|Cuenta 1/); await render({}, { data: snapshotData() });

// Real editor/hook; old callbacks cannot write after permission ABA or a resource removal.
await click("Nueva cuenta"); const staleSubmit = globalThis.accountEditor.onSubmit;
await render({ role: "viewer" }); assert.equal(container.querySelector("form"), null); await render({ role: "owner" });
await act(async () => staleSubmit({ preventDefault() {} })); assert.equal(globalThis.accountWrites.length, 0);
await click("Nueva cuenta"); await change(container.querySelector('input[placeholder="Ej. Cuenta Principal"]'), "Cuenta nueva");
let finish; globalThis.accountGate = new Promise(resolve => { finish = resolve; });
const submit = find("Crear cuenta"); await act(async () => { submit.click(); submit.click(); }); assert.equal(globalThis.accountWrites.length, 1); assert.equal(globalThis.accountWrites[0].input.workspaceId, 8);
globalThis.accountGate = null; await act(async () => finish()); await settle(); assert.equal(container.querySelector("form"), null);
await menu(); await click("Editar"); const removedSubmit = globalThis.accountEditor.onSubmit;
await render({}, { data: { ...snapshotData(), accounts: fixtures.filter(item => item.id !== 1) } });
const beforeRemoved = globalThis.accountWrites.length; await act(async () => removedSubmit({ preventDefault() {} })); assert.equal(globalThis.accountWrites.length, beforeRemoved);
await render({ workspaceId: 9 }, { data: { ...snapshotData(), workspace: { id: 9 }, accounts: [account(9, { workspaceId: 9 })] } }); assert.equal(container.querySelector("form"), null);
await act(async () => removedSubmit({ preventDefault() {} })); assert.equal(globalThis.accountWrites.length, beforeRemoved);
await render({ workspaceId: 8 }, { data: { ...snapshotData(), workspace: { id: 8 } } });

// Single-write result evidence: lost/invalid response blocks this intent, explicit SQL rejection permits correction.
for (const failure of [new Error("Failed to fetch"), { code: "20", message: "aborted response" }, null]) {
  await click("Nueva cuenta"); await change(container.querySelector('input[placeholder="Ej. Cuenta Principal"]'), "Cuenta por comprobar");
  globalThis.accountFailure = failure; globalThis.accountResultOverride = failure ? undefined : {};
  const originalSave = globalThis.accountEditor.onSubmit, beforeUncertain = globalThis.accountWrites.length;
  await click("Crear cuenta"); assert.match(container.textContent, /Resultado por comprobar/); assert.ok(find("Comprueba el resultado").disabled);
  assert.ok(container.querySelector('form fieldset').disabled); assert.equal(aria("Cerrar formulario").disabled, false);
  await act(async () => originalSave({ preventDefault() {} })); assert.equal(globalThis.accountWrites.length, beforeUncertain + 1);
  await render({}, { isFetching: true }); await render({}, { isFetching: false }); assert.ok(find("Comprueba el resultado").disabled);
  globalThis.accountFailure = null; globalThis.accountResultOverride = undefined;
  await act(async () => globalThis.accountEditor.onClose()); await click("Sí, descartar");
}
await click("Nueva cuenta"); await change(container.querySelector('input[placeholder="Ej. Cuenta Principal"]'), "Corregible"); globalThis.accountFailure = { code: "23514", message: "SQL validation rejection" };
await click("Crear cuenta"); assert.match(container.textContent, /SQL validation rejection/); assert.equal(find("Crear cuenta").disabled, false); assert.equal(container.querySelector('form fieldset').disabled, false);
globalThis.accountFailure = null; await change(container.querySelector('input[placeholder="Ej. Cuenta Principal"]'), "Corregida"); await click("Crear cuenta"); assert.equal(container.querySelector("form"), null);
await menu(); await click("Editar"); globalThis.accountResultOverride = { id: 999, workspaceId: 8, isArchived: false }; await click("Guardar cambios"); assert.ok(find("Comprueba el resultado").disabled); globalThis.accountResultOverride = undefined; await act(async () => globalThis.accountEditor.onClose()); if (find("Sí, descartar")) await click("Sí, descartar");

// Cancel old delete intents on context/read/access loss; revalidate current archived status.
async function scheduleDelete() {
  await menu(2); await click("Editar"); await click("Detalles"); await click("Eliminar permanentemente"); await click("Eliminar definitivamente");
  const [id, job] = [...globalThis.accountUndo.entries()].at(-1); assert.match(job.label, /pendiente de eliminar/); return { id, job };
}
let job = await scheduleDelete(); const beforeDelete = globalThis.accountWrites.length;
await render({ role: "viewer" }); assert.ok(globalThis.accountCancelled.includes(job.id)); await render({ role: "owner" }); await act(async () => job.job.onCommit()); assert.equal(globalThis.accountWrites.length, beforeDelete);
job = await scheduleDelete(); await render({}, { isFetching: true }); assert.ok(globalThis.accountCancelled.includes(job.id)); await render({}, { isFetching: false }); await act(async () => job.job.onCommit()); assert.equal(globalThis.accountWrites.length, beforeDelete);
job = await scheduleDelete(); await render({ workspaceId: 9 }, { data: { ...snapshotData(), workspace: { id: 9 }, accounts: [account(9, { workspaceId: 9 })] } }); assert.ok(globalThis.accountCancelled.includes(job.id)); await render({ workspaceId: 8 }, { data: { ...snapshotData(), workspace: { id: 8 } } }); await act(async () => job.job.onCommit()); assert.equal(globalThis.accountWrites.length, beforeDelete);
job = await scheduleDelete(); await render({}, { data: { ...snapshotData(), accounts: fixtures.map(item => item.id === 2 ? { ...item, isArchived: false } : item) } }); await act(async () => job.job.onCommit()); assert.equal(globalThis.accountWrites.length, beforeDelete); assert.match(container.textContent, /reactivada/);
await render({}, { data: snapshotData() }); job = await scheduleDelete(); await act(async () => { await job.job.onCommit(); await job.job.onCommit(); job.job.onUndo(); }); assert.equal(globalThis.accountWrites.length, beforeDelete + 1); assert.deepEqual(globalThis.accountWrites.at(-1), { kind: "delete", input: { accountId: 2, workspaceId: 8 } });
await render({ userId: "B" }); job = await scheduleDelete(); globalThis.accountFailure = new Error("resultado incierto"); await act(async () => job.job.onCommit()); assert.ok(aria("Más opciones de Cuenta 2")); assert.match(container.textContent, /resultado incierto/); const failedCount = globalThis.accountWrites.length; await act(async () => job.job.onCommit()); assert.equal(globalThis.accountWrites.length, failedCount); globalThis.accountFailure = null;

// Mobile's two bulk directions: only change accounts whose archive state differs.
await act(async () => container.querySelector('input[aria-label="Seleccionar todas las cuentas"]').click());
assert.ok(find("Archivar activas")); assert.ok(find("Restaurar archivadas"));
await click("Restaurar archivadas"); const restore = find("Restaurar"); const beforeBulk = globalThis.accountWrites.length;
let finishBulk; globalThis.accountGate = new Promise(resolve => { finishBulk = resolve; }); await act(async () => { restore.click(); restore.click(); }); assert.equal(globalThis.accountWrites.length, beforeBulk + 1); assert.deepEqual(globalThis.accountWrites.at(-1).input, { accountId: 2, isArchived: false, userId: "B", workspaceId: 8 }); globalThis.accountGate = null; await act(async () => finishBulk()); await settle();
await act(async () => container.querySelector('input[aria-label="Seleccionar todas las cuentas"]').click()); await click("Archivar activas"); await click("Archivar"); assert.equal(globalThis.accountWrites.at(-1).input.accountId, 1); assert.equal(globalThis.accountWrites.at(-1).input.isArchived, true);

// A partially completed batch must not continue after losing permission, even if access returns.
await render({ userId: "Bulk" }, { data: { ...snapshotData(), accounts: [account(1), account(5)] } });
await act(async () => container.querySelector('input[aria-label="Seleccionar todas las cuentas"]').click()); await click("Archivar activas");
let finishPartial; globalThis.accountGate = new Promise(resolve => { finishPartial = resolve; }); const beforePartial = globalThis.accountWrites.length;
await click("Archivar"); assert.equal(globalThis.accountWrites.length, beforePartial + 1);
await render({ role: "viewer" }); await render({ role: "owner" }); globalThis.accountGate = null; await act(async () => finishPartial()); await settle(); assert.equal(globalThis.accountWrites.length, beforePartial + 1);
await render({ userId: "B" }, { data: snapshotData() });

// Real detail dispatches immediately via guarded parent; stale shortcuts cannot cross an identity.
await row(); const staleMovement = globalThis.accountDetail.onCreateMovement; await click("Nuevo gasto"); assert.deepEqual(globalThis.accountMovementRequests.at(-1), { kind: "expense", accountId: 1 });
await render({ userId: "C" }); staleMovement("transfer"); assert.equal(globalThis.accountMovementRequests.length, 1);

// Scoped grouping/currency and draft keys, legacy global preferences are not imported.
dom.window.localStorage.setItem("darkmoney-accounts-group-by-type", "true");
await pageMenu(); assert.ok(find("Agrupar por tipo").querySelector("svg").classList.contains("opacity-0")); await click("Agrupar por tipo");
assert.equal(dom.window.localStorage.getItem("darkmoney.accounts-group.v1.C.8"), "true");
await click("Nueva cuenta"); await change(container.querySelector('input[placeholder="Ej. Cuenta Principal"]'), "Borrador C");
assert.match(dom.window.sessionStorage.getItem(accountEditorDraftKey("C", 8)), /Borrador C/);
await render({ userId: "D" }); assert.equal(container.querySelector("form"), null); assert.match(dom.window.sessionStorage.getItem(accountEditorDraftKey("C", 8)), /Borrador C/);
await render({ userId: "C" }); assert.equal(container.querySelector('input[placeholder="Ej. Cuenta Principal"]').value, "Borrador C");
await act(async () => globalThis.accountEditor.onClose()); assert.match(container.textContent, /cambios/i); await click("Sí, descartar");
assert.equal(dom.window.sessionStorage.getItem(accountEditorDraftKey("C", 8)), null);

// Corrupt / blocked storage does not crash the module or import another user's draft.
await render({ userId: "E" }); const prototype = dom.window.Storage.prototype, originalGet = prototype.getItem, originalSet = prototype.setItem, originalRemove = prototype.removeItem;
prototype.getItem = () => { throw new Error("blocked storage"); }; prototype.setItem = () => { throw new Error("blocked storage"); }; prototype.removeItem = () => { throw new Error("blocked storage"); };
await render({ userId: "F" }); await pageMenu(); await click("Agrupar por tipo"); await click("Nueva cuenta"); await change(container.querySelector('input[placeholder="Ej. Cuenta Principal"]'), "Solo memoria"); await act(async () => globalThis.accountEditor.onClose()); await click("Sí, descartar");
prototype.getItem = originalGet; prototype.setItem = originalSet; prototype.removeItem = originalRemove;
dom.window.sessionStorage.setItem(accountEditorDraftKey("G", 8), JSON.stringify({ editorMode: "edit", isEditorOpen: true, savedAt: Date.now(), userId: "G", workspaceId: 8, selectedAccountId: 1, formState: { name: false } }));
await render({ userId: "G" }); assert.equal(container.querySelector("form"), null);

job = await scheduleDelete(); await act(async () => renderer.unmount()); assert.ok(globalThis.accountCancelled.includes(job.id)); const beforeUnmount = globalThis.accountWrites.length; await act(async () => job.job.onCommit()); assert.equal(globalThis.accountWrites.length, beforeUnmount);
dom.window.HTMLAnchorElement.prototype.click = originalAnchor; URL.createObjectURL = originalUrl; URL.revokeObjectURL = originalRevoke; container.remove(); dom.window.close();
console.log("account-permissions: OK (actual page/table/detail/editor/hook; readonly/archive/read/session/ABA guards, scoped rows/CSV/drafts/preferences, blocked storage, double submit, both bulk directions, deferred cancellation/revalidation/once/error; fake transport, not server RLS or transactions)");
