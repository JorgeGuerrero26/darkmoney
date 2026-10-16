import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, button, change, createRoot, dom, h, load, mock, root, settle, QueryClient, QueryClientProvider } from "./lib/web-ui-harness.mjs";

const category = (id, extra = {}) => ({ id, workspaceId: 8, name: `Categoría ${id}`, kind: "expense", isActive: true, isPinned: false, isSystem: false, sortOrder: id, movementCount: 0, subscriptionCount: 0, ...extra });
const all = [category(1), category(2, { isSystem: true }), category(3, { movementCount: 2 }), category(4, { workspaceId: 99, name: "Fuera del espacio" })];
globalThis.categoryScope = { userId: "user-A", workspaceId: 8, role: "owner", archived: false, fetching: false };
globalThis.categoryOverview = { data: all, isSuccess: true, isFetching: false, isPlaceholderData: false };
globalThis.categorySnapshot = { data: { workspace: { id: 8 }, movements: [] }, isSuccess: true };
globalThis.categoryWrites = []; globalThis.categoryWriteGate = null; globalThis.categoryFailure = null;
globalThis.categoryUndo = new Map(); globalThis.categoryCancelled = [];
globalThis.categoryScheduleId = 0;
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:globalThis.categoryScope.userId?{id:globalThis.categoryScope.userId}:null,profile:null});");
mock("src/modules/workspaces/use-active-workspace.ts", "export const useActiveWorkspace=()=>({activeWorkspace:{id:globalThis.categoryScope.workspaceId,role:globalThis.categoryScope.role,isArchived:globalThis.categoryScope.archived,baseCurrencyCode:'PEN'},isFetching:globalThis.categoryScope.fetching,isPlaceholderData:false});");
mock("src/components/ui/undo-queue.tsx", `
  const cancel=id=>{const item=globalThis.categoryUndo.get(id);globalThis.categoryUndo.delete(id);globalThis.categoryCancelled.push(id);item?.onUndo?.();};
  const schedule=item=>{const id='undo-'+(++globalThis.categoryScheduleId);globalThis.categoryUndo.set(id,item);return id;};
  export const useUndoQueue=()=>({schedule,cancel});
`);
mock("src/services/queries/workspace-data.ts", `
  export const useCategoriesOverviewQuery=()=>globalThis.categoryOverview,useWorkspaceSnapshotQuery=()=>globalThis.categorySnapshot,useBudgetSpendTypesQuery=()=>({data:[]});
  const mutation=kind=>({mutateAsync:async input=>{globalThis.categoryWrites.push({kind,input});if(globalThis.categoryWriteGate)await globalThis.categoryWriteGate;if(globalThis.categoryFailure)throw globalThis.categoryFailure;return {id:77};}});
  export const useCreateCategoryMutation=()=>mutation('create'),useUpdateCategoryMutation=()=>mutation('update'),useToggleCategoryMutation=()=>mutation('toggle'),usePinCategoryMutation=()=>mutation('pin'),useDeleteCategoryMutation=()=>mutation('delete');
  export const getQueryErrorMessage=error=>error?.message??'fixture error';
`);
mock("src/modules/categories/components/category-analytics-modal.tsx", `${h} export const CategoryAnalyticsModal=p=>h('div',{'data-testid':'analytics'},'Análisis comprobado');`);
const editorUrl = load("src/modules/categories/components/category-editor-dialog.tsx");
mock("src/modules/categories/components/category-editor-dialog.tsx", `${h} import {CategoryEditorDialog as Real} from '${editorUrl}';export const CategoryEditorDialog=p=>{globalThis.categoryEditor=p;return h(Real,p);};`);
const { CategoriesPage } = await import(load("src/modules/categories/pages/categories-redesign-page.tsx"));
const { canWriteWorkspaceCatalog } = await import(load("src/modules/shared/use-catalog-write-scope.ts"));
for (const role of ["owner", "admin", "member", "viewer", "unknown"]) for (const archived of [true, false]) for (const ready of [true, false]) {
  assert.equal(canWriteWorkspaceCatalog({ id: 8, role, isArchived: archived }, "A", ready), ["owner", "admin", "member"].includes(role) && !archived && ready);
}
assert.equal(canWriteWorkspaceCatalog({ id: 8, role: "owner" }, undefined, true), false);
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const anchorClick = dom.window.HTMLAnchorElement.prototype.click; let exported = 0;
dom.window.HTMLAnchorElement.prototype.click = () => { exported++; };
async function render(scope = {}, overview = {}) {
  Object.assign(globalThis.categoryScope, scope); Object.assign(globalThis.categoryOverview, overview);
  await act(async () => renderer.render(React.createElement(CategoriesPage))); await settle();
}
const findButton = label => [...container.querySelectorAll("button")].find(node => node.textContent.trim() === label);
const ariaButton = label => { const found = container.querySelector(`button[aria-label="${label}"]`); assert.ok(found, label); return found; };
async function click(label) { const node = findButton(label); assert.ok(node, label); await act(async () => node.click()); await settle(); }
async function menu(id = 1) { await act(async () => ariaButton(`Acciones de Categoría ${id}`).click()); }
await render({ role: "viewer" }); assert.equal(findButton("Nueva categoría").disabled, true); assert.match(container.textContent, /solo lectura/); assert.doesNotMatch(container.textContent, /Fuera del espacio/);
await menu(); for (const label of ["Fijar", "Editar", "Desactivar", "Eliminar"]) assert.equal(findButton(label), undefined);
await click("Ver actividad"); assert.equal(findButton("Editar categoría"), undefined); await click("Cerrar");
await act(async () => ariaButton("Más acciones").click()); await click("Seleccionar varias"); await click("Seleccionar todas");
assert.equal(button(container, "Activar / desactivar").disabled, true); assert.equal(button(container, "Eliminar sin relaciones").disabled, true); assert.equal(button(container, "CSV").disabled, false);
await click("CSV"); assert.equal(exported, 1); assert.equal(globalThis.categoryWrites.length, 0);
await click("Cancelar");
await render({ role: "owner", archived: true }); assert.equal(findButton("Nueva categoría").disabled, true); assert.match(container.textContent, /archivado/);
await render({ archived: false, fetching: true }); assert.equal(findButton("Nueva categoría").disabled, true);
await render({ fetching: false }, { isFetching: true }); assert.equal(findButton("Nueva categoría").disabled, true);
await render({}, { isFetching: false, isPlaceholderData: true }); assert.equal(findButton("Nueva categoría").disabled, true);
await render({}, { isPlaceholderData: false }); assert.equal(findButton("Nueva categoría").disabled, false);

// Keep the real editor; invoke its previously captured callback after a permission ABA.
await click("Nueva categoría"); const staleSave = globalThis.categoryEditor.onSave;
await render({ role: "viewer" }); assert.equal(container.querySelector('form'), null);
await render({ role: "owner" }); await assert.rejects(staleSave({ name: "stale" }), /permisos cambiaron/); assert.equal(globalThis.categoryWrites.length, 0);
await click("Nueva categoría");
const input = container.querySelector('input[placeholder="Ej. Alimentación"]') ?? container.querySelector('form input'); await change(input, "Nueva real");
let finish; globalThis.categoryWriteGate = new Promise(resolve => { finish = resolve; });
const submit = button(container, "Crear categoría"); await act(async () => { submit.click(); submit.click(); });
assert.equal(globalThis.categoryWrites.length, 1); assert.equal(globalThis.categoryWrites[0].kind, "create");
globalThis.categoryWriteGate = null; await act(async () => finish()); await settle();
await menu(2); assert.equal(findButton("Editar"), undefined); assert.equal(findButton("Eliminar"), undefined); await click("Fijar"); assert.equal(globalThis.categoryWrites.at(-1).kind, "pin");
await menu(); await click("Editar"); const editSave = globalThis.categoryEditor.onSave;
await render({}, { data: all.filter(row => row.id !== 1) }); await assert.rejects(editSave({ name: "Removed" }), /no está disponible/);
await render({ workspaceId: 9 }, { data: [category(10, { workspaceId: 9 })] }); assert.equal(container.querySelector('form'), null);
await assert.rejects(editSave({ name: "Other workspace" }), /permisos cambiaron/);

// Deferred deletes: never cross workspaces, access loss, failed reads or new relationships.
async function scheduleDelete() { await menu(); await click("Eliminar"); await click("Eliminar definitivamente"); const [id, job] = [...globalThis.categoryUndo.entries()].at(-1); return { id, job }; }
await render({ workspaceId: 8, role: "owner" }, { data: all });
const first = await scheduleDelete(), beforeDelete = globalThis.categoryWrites.length;
assert.match(first.job.label, /pendiente de eliminar/); assert.equal(globalThis.categoryWrites.length, beforeDelete);
await render({ workspaceId: 9 }, { data: [category(10, { workspaceId: 9 })] }); assert.ok(globalThis.categoryCancelled.includes(first.id));
await render({ workspaceId: 8 }, { data: all }); await act(async () => first.job.onCommit()); assert.equal(globalThis.categoryWrites.length, beforeDelete); assert.ok(ariaButton("Acciones de Categoría 1"));
const second = await scheduleDelete(); await render({ role: "viewer" }); assert.ok(globalThis.categoryCancelled.includes(second.id));
await render({ role: "owner" }); await act(async () => second.job.onCommit()); assert.equal(globalThis.categoryWrites.length, beforeDelete);
const third = await scheduleDelete(); await render({}, { isFetching: true }); assert.ok(globalThis.categoryCancelled.includes(third.id)); await render({}, { isFetching: false }); await act(async () => third.job.onCommit()); assert.equal(globalThis.categoryWrites.length, beforeDelete);
const fourth = await scheduleDelete(); await render({}, { data: all.map(row => row.id === 1 ? { ...row, subscriptionCount: 1 } : row) }); await act(async () => fourth.job.onCommit()); assert.equal(globalThis.categoryWrites.length, beforeDelete); assert.match(container.querySelector('[role="alert"]').textContent, /relaciones nuevas/);
await render({}, { data: all }); const fifth = await scheduleDelete(); await act(async () => fifth.job.onCommit()); assert.equal(globalThis.categoryWrites.at(-1).kind, "delete"); assert.deepEqual(globalThis.categoryWrites.at(-1).input, { categoryId: 1, workspaceId: 8 });
const beforeRepeatedCommit = globalThis.categoryWrites.length; await act(async () => fifth.job.onCommit()); assert.equal(globalThis.categoryWrites.length, beforeRepeatedCommit);
await render({ userId: "user-B" }, { data: all }); assert.ok(ariaButton("Acciones de Categoría 1")); assert.equal(container.querySelector('[role="alert"]'), null);
const failed = await scheduleDelete(); globalThis.categoryFailure = new Error("delete outcome uncertain"); await act(async () => failed.job.onCommit()); assert.ok(ariaButton("Acciones de Categoría 1")); assert.match(container.querySelector('[role="alert"]').textContent, /outcome uncertain/); const beforeReplay = globalThis.categoryWrites.length; await act(async () => failed.job.onCommit()); assert.equal(globalThis.categoryWrites.length, beforeReplay); globalThis.categoryFailure = null;
const sixth = await scheduleDelete(); await act(async () => renderer.unmount()); assert.ok(globalThis.categoryCancelled.includes(sixth.id)); const beforeUnmountCommit = globalThis.categoryWrites.length; await act(async () => sixth.job.onCommit()); assert.equal(globalThis.categoryWrites.length, beforeUnmountCommit);

// Real query hook: identity in the key and no placeholder rows from another space/user.
const source = readFileSync(resolve(root, "src/services/queries/workspace-data.ts"), "utf8"), ast = ts.createSourceFile("workspace-data.ts", source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "useCategoriesOverviewQuery"); assert.ok(declaration);
const js = ts.transpileModule(declaration.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const { useQuery } = createRequire(resolve(root, "package.json"))("@tanstack/react-query"), fetches = [];
const actualQuery = new Function("useQuery", "fetchCategoriesOverview", `${js};return useCategoriesOverviewQuery;`)(useQuery, workspaceId => new Promise(resolve => fetches.push({ workspaceId, resolve })));
let query; function QueryProbe({ ws, userId }) { query = actualQuery(ws, userId); return React.createElement("div", null, JSON.stringify({ status: query.status, data: query.data })); }
const queryRoot = createRoot(container), client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
async function queryRender(ws, userId) { await act(async () => queryRoot.render(React.createElement(QueryClientProvider, { client }, React.createElement(QueryProbe, { ws, userId })))); await settle(); }
await queryRender(8, "A"); await act(async () => fetches.at(-1).resolve([category(1)])); await settle(); assert.equal(query.data.length, 1);
await queryRender(9, "A"); assert.equal(query.data, undefined); assert.equal(query.isPlaceholderData, false);
await act(async () => fetches.at(-1).resolve([category(9, { workspaceId: 9 })])); await settle();
await queryRender(9, "B"); assert.equal(query.data, undefined); const readsBeforeLogout = fetches.length;
await queryRender(9, undefined); assert.equal(query.data, undefined); assert.equal(fetches.length, readsBeforeLogout);
await act(async () => queryRoot.unmount()); client.clear(); dom.window.HTMLAnchorElement.prototype.click = anchorClick; container.remove(); dom.window.close();
console.log("category-permissions: OK (actual page/editor/hooks; explicit roles/archive/session/read guards, query identity, filtered workspace rows, readonly review/export, double submit, stale save ABA, delayed delete cancellation and fresh relationship checks; fake IO only, not server RLS)");
