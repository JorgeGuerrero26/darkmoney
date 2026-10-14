import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
import React, { act } from "react";

const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."), require = createRequire(resolve(root, "package.json"));
const { JSDOM } = createRequire(resolve(root, "../DarkMoneyApp/package.json"))("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true });
for (const name of ["window", "document", "HTMLElement", "KeyboardEvent", "MutationObserver", "File"]) globalThis[name] = dom.window[name];
globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client"), { MemoryRouter } = await import("react-router-dom");
const { QueryClient, QueryClientProvider } = await import(pathToFileURL(require.resolve("@tanstack/react-query")).href);
const virtual = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const mocks = new Map();
function mock(path, source) { mocks.set(resolve(root, path), virtual(source)); }
function load(file) {
  if (mocks.has(file)) return mocks.get(file);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText.replace(/from "([^"]+)"/g, (_, specifier) => {
    if (!specifier.startsWith(".")) return `from "${pathToFileURL(require.resolve(specifier)).href}"`;
    const base = resolve(dirname(file), specifier), dependency = [base, `${base}.tsx`, `${base}.ts`].find(existsSync);
    assert.ok(dependency, specifier); return `from "${load(dependency)}"`;
  });
  const url = virtual(js); mocks.set(file, url); return url;
}
const { createDetectedMovementStore, mapDetectedMovement } = await import(load(resolve(root, "src/services/queries/detected-movement-store.ts")));
const { createDetectedDuplicateChecker } = await import(load(resolve(root, "src/services/queries/detection-duplicates.ts")));
const { detectionSplitRequest } = await import(load(resolve(root, "src/modules/notifications/lib/detection-split-submission.ts")));
const { validateMovementSplit } = await import(load(resolve(root, "src/modules/movements/lib/split-movement.ts")));
assert.equal(validateMovementSplit([{ categoryId: "1", amount: "0.1" }, { categoryId: "2", amount: "0.2" }], 0.3), null);
assert.match(validateMovementSplit([{ categoryId: "1", amount: "0.101" }, { categoryId: "2", amount: "0.199" }], 0.3), /dos decimales/);
assert.match(validateMovementSplit([{ categoryId: "01", amount: "1" }, { categoryId: "1", amount: "1" }], 2), /No repitas/);
assert.match(validateMovementSplit(Array.from({ length: 101 }, (_, i) => ({ categoryId: String(i+1), amount: "1" })), 101), /100 partes/);
const scope = { userId: "u", workspaceId: 8 }, version = "2026-10-14T12:00:00.123456Z";
const accounts = [{ id: 1, workspaceId: 8, name: "Principal", currentBalance: 100, currencyCode: "PEN", isArchived: false }];
const categories = [{ id: 10, name: "Comida", kind: "expense", isActive: true }, { id: 11, name: "Taxi", kind: "both", isActive: true }];
const input = { ...scope, movementType: "expense", status: "posted", description: "Compra", occurredAt: "2026-10-13T12:00:00Z",
  sourceAccountId: 1, sourceAmount: 20, destinationAccountId: null, destinationAmount: null, subscriptionId: null, metadata: null };
const submission = () => ({ input: structuredClone(input), parts: [{ amount: 12, categoryId: 10 }, { amount: 8, categoryId: 11 }] });
function movement(id, patch = {}) {
  return { id, workspace_id: 8, created_by_user_id: "u", movement_type: "expense", status: "posted", description: "Compra", occurred_at: input.occurredAt,
    source_account_id: 1, source_amount: 20, destination_account_id: null, destination_amount: null, subscription_id: null, metadata: null, ...patch };
}
function group(name = "g") {
  return [movement(21, { source_amount: 12, description: "Compra (1/2)", metadata: { split_group: name, split_index: 1, split_total: 2 } }),
    movement(22, { source_amount: 8, description: "Compra (2/2)", metadata: { split_group: name, split_index: 2, split_total: 2 } })];
}
function fixture(rows = []) {
  const state = { rows, calls: [], queries: [], writes: 0, readFail: false, error: null, beforeQuery: null, gate: null,
    suggestion: { id: 90, user_id: "u", workspace_id: 8, financial_app_key: "bcp", package_name: "bcp.app", app_label: "BCP", movement_type: "expense",
      amount: 20, currency_code: "PEN", description: "Compra", occurred_at: input.occurredAt, confidence: "high", status: "pending", movement_id: null, metadata: null, updated_at: version } };
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.offset = 0; this.end = Infinity; this.options = {}; }
    select(_, options = {}) { this.options = options; return this; }
    eq(k, v) { this.filters.push(row => row[k] === v); return this; }
    neq(k, v) { this.filters.push(row => row[k] !== v); return this; }
    in(k, vs) { this.filters.push(row => vs.includes(k === "metadata->>split_group" ? row.metadata?.split_group : row[k])); return this; }
    gte(k, v) { this.filters.push(row => Date.parse(row[k]) >= Date.parse(v)); return this; }
    lt(k, v) { this.filters.push(row => Date.parse(row[k]) < Date.parse(v)); return this; }
    order() { return this; }
    range(a, b) { this.offset = a; this.end = b; return this; }
    abortSignal(signal) { this.signal = signal; return this; }
    update(patch) { this.patch = patch; return this; }
    async execute(single = false) {
      state.queries.push([this.table, this.offset]);
      if (state.gate && this.table === "movements") await state.gate;
      state.beforeQuery?.(this);
      if (this.signal?.aborted) return { data: null, count: null, error: Error("Cancelled") };
      if (state.error === this.table || (this.table === "notifications" && state.readFail)) return { data: null, count: null, error: Error("Offline") };
      const rows = (this.table === "movements" ? state.rows : this.table === "notification_detected_movement_suggestions" ? [state.suggestion] : []).filter(row => this.filters.every(fn => fn(row)));
      if (this.patch) { state.writes++; rows.forEach(row => Object.assign(row, this.patch)); }
      const data = rows.slice(this.offset, this.end + 1);
      return { data: single ? structuredClone(data[0] ?? null) : structuredClone(data), count: this.options.count ? rows.length : null, error: null };
    }
    maybeSingle() { return this.execute(true); }
    then(a, b) { return this.execute().then(a, b); }
  }
  const client = { from: table => new Query(table), rpc: async (name, args) => {
    state.calls.push({ name, args });
    if (name === "has_email_detection_pro_access") return { data: true, error: null };
    if (state.error === "rpc") return { data: null, error: { code: "PGRST202" } };
    if (name !== "register_detected_movement_split") throw Error(`Unexpected RPC ${name}`);
    state.suggestion.status = "registered"; state.suggestion.movement_id = 100;
    return { data: { workspaceId: 8, suggestionId: 90, status: "registered", movementId: 100, movementIds: [100, 101], alreadyRegistered: false }, error: null };
  }, functions: { invoke: () => { throw Error("Grouped evidence must not be sent to row-count AI"); } } };
  return { state, store: createDetectedMovementStore(client, scope), checker: createDetectedDuplicateChecker(client, scope) };
}
const suggestion = f => mapDetectedMovement(f.state.suggestion);
const check = (f, permission = null, value = submission(), signal) => f.checker.checkSplit(suggestion(f), value, permission, signal);
// Native grouped totals and explicit permission, bound to every part and the exact edited draft.
{
  const f = fixture(group()), result = await check(f);
  assert.equal(result.candidate.id, 21); assert.equal(result.candidate.sourceAmount, 20); assert.equal(result.allowed, false);
  assert.equal((await check(f, result.permission)).allowed, true);
  const changed = submission(); changed.parts[0].categoryId = 11; changed.parts[1].categoryId = 10;
  assert.equal((await check(f, result.permission, changed)).allowed, false);
  f.state.rows[1].updated_at = "later"; assert.equal((await check(f, result.permission)).allowed, false);
}
// Single receipts too; never treat a part amount as the whole grouped receipt.
assert.equal((await check(fixture([movement(31)]))).candidate.id, 31);
{
  const f = fixture(group().map(row => ({ ...row, movement_type: "income", source_account_id: null, source_amount: null,
    destination_account_id: 1, destination_amount: row.source_amount })));
  f.state.suggestion.movement_type = "income";
  const value = submission(); Object.assign(value.input, { movementType: "income", sourceAccountId: null, sourceAmount: null,
    destinationAccountId: 1, destinationAmount: 20 });
  const result = await check(f, null, value); assert.equal(result.candidate.destinationAmount, 20); assert.equal(result.candidate.sourceAmount, null);
}
{
  const f = fixture(group()); f.state.rows[0].source_amount = 20; f.state.rows[1].source_amount = 5;
  assert.equal((await check(f)).candidate, null);
}
for (const patch of [{ status: "voided" }, { source_account_id: 2 }, { occurred_at: "2026-10-14T12:00:00Z" },
  { created_by_user_id: "other" }, { metadata: { split_group: "g", split_index: 1, split_total: 2 } }]) {
  const f = fixture(group()); Object.assign(f.state.rows[1], patch); await assert.rejects(check(f), /incompleta|incompatible/);
}
await assert.rejects(check(fixture([group()[0]])), /incompleta/);
{
  const f = fixture(group()); let reads = 0;
  f.state.beforeQuery = query => { if (query.table === "movements" && ++reads === 2) f.state.rows = []; };
  await assert.rejects(check(f), /cambió/);
}
{
  const f = fixture(Array.from({ length: 501 }, (_, i) => movement(i + 1000, { description: "Otro" })).concat(group()));
  assert.equal((await check(f)).candidate.id, 21); assert.ok(f.state.queries.some(([, offset]) => offset === 500));
  f.state.error = "movements"; await assert.rejects(check(f), /historial completo/);
}
{
  const f = fixture(group()); f.state.gate = new Promise(resolve => { f.finish = resolve; }); const controller = new AbortController();
  const pending = check(f, null, submission(), controller.signal); controller.abort(); f.finish(); await assert.rejects(pending, /canceló/);
}
// Actual store capture/version guard, one RPC, failure without individual inserts or resolving fallback.
const noop = () => {};
{
  const f = fixture(), value = submission();
  const pending = f.store.registerSplit(90, version, value, accounts, categories, async () => {}, noop);
  value.parts[0].amount = 1;
  const result = await pending; assert.equal(result.movementId, 100);
  assert.equal(f.state.calls.length, 1); assert.equal(f.state.calls[0].args.p_expected_updated_at, version);
  assert.equal(f.state.calls[0].args.p_parts[0].amount, 12); assert.equal(f.state.writes, 1); // only the notice read
}
for (const patch of [{ updated_at: "2026-10-15T12:00:00Z" }, { status: "discarded" }, { description: "Changed" }]) {
  const f = fixture(); await assert.rejects(f.store.registerSplit(90, version, submission(), accounts, categories,
    async () => Object.assign(f.state.suggestion, patch), noop), /detección cambió/); assert.equal(f.state.calls.length, 0);
}
{
  const f = fixture(); f.state.error = "rpc";
  await assert.rejects(f.store.registerSplit(90, version, submission(), accounts, categories, async () => {}, noop), /servidor aún/);
  assert.equal(f.state.calls.length, 1); assert.equal(f.state.writes, 0);
  f.state.error = null; f.state.readFail = true;
  assert.equal((await f.store.registerSplit(90, version, submission(), accounts, categories, async () => {}, noop)).readingUpdated, false);
}
for (const patch of [{ status: "planned" }, { fxRate: 2 }, { obligationId: 8 }]) {
  const value = submission(); Object.assign(value.input, patch);
  assert.throws(() => detectionSplitRequest(value, 90, version, "PEN"), /Solo se/);
}
{
  const value = submission(); value.parts[0].amount = 12.001; value.parts[1].amount = 7.999;
  assert.throws(() => detectionSplitRequest(value, 90, version, "PEN"), /Revisa/);
  const f = fixture(); value.parts[0].amount = 12; value.parts[1].amount = 8; value.input.userId = "other";
  await assert.rejects(f.store.registerSplit(90, version, value, accounts, categories, async()=>{}, noop), /otro espacio o usuario/);
  assert.equal(f.state.calls.length, 0);
}

// Actual review + actual shared form + split panel + store + duplicate checker. Only I/O hooks
// and peripheral date/search controls are mocked; no detected registrations hit the network.
const h = `import React from "${pathToFileURL(require.resolve("react")).href}";const h=React.createElement;`;
mock("src/services/queries/workspace-data.ts", `const mutation=()=>({isPending:false,mutateAsync:async()=>{globalThis.splitUnexpected++;throw Error('Unexpected individual mutation')}});
 export const useCreateMovementMutation=mutation,useCreateAttachmentRecordMutation=mutation,useCreateCategoryMutation=mutation,useCreateCounterpartyMutation=mutation,useCreateRecurringIncomeMutation=mutation,useCreateSubscriptionMutation=mutation;
 export const useBudgetSpendTypesQuery=()=>({data:[]}),usePersistLearningFeedbackMutation=()=>({mutateAsync:async()=>{}}),getQueryErrorMessage=e=>e.message;`);
mock("src/services/queries/detected-movements.ts", "export const useDetectedMovementReviewQuery=()=>globalThis.splitApi;");
mock("src/services/queries/detection-learning.ts", "export const useDetectionLearningQuery=()=>({data:[],isError:false});");
mock("src/components/ui/toast-provider.tsx", "export const useToast=()=>({showToast:v=>globalThis.splitToasts.push(v)});");
mock("src/components/ui/undo-queue.tsx", "export const useUndoQueue=()=>({schedule:v=>globalThis.splitUndo.push(v)});");
mock("src/modules/attachments/use-receipt-feature-access.ts", "export const useReceiptFeatureAccess=()=>({canUploadReceipts:true});");
mock("src/modules/attachments/receipt-utils.ts", "export const deleteStoredReceipt=()=>{},createReceiptSignedUrl=async()=>'',prepareReceiptUpload=()=>{throw Error('Fixture upload failed')},uploadPreparedReceipt=()=>{};");
mock("src/modules/movements/hooks/use-movement-suggestions.ts", "export const useMovementSuggestions=()=>({});");
mock("src/modules/movements/hooks/use-movement-insights.ts", "export const useMovementInsights=()=>({});");
mock("src/modules/contacts/components/contact-quick-create-dialog.tsx", "export const ContactQuickCreateDialog=()=>null;");
mock("src/components/ui/date-picker-field.tsx", `${h} export const DatePickerField=p=>h('input',{value:p.value,onChange:e=>p.onChange(e.target.value)});`);
mock("src/components/ui/searchable-picker.tsx", `${h} export const SearchablePicker=p=>h('select',{'aria-label':p.placeholderLabel,value:p.value,onChange:e=>p.onChange(e.target.value)},h('option',{value:''},'Sin asignar'),...p.options.map(o=>h('option',{key:o.value,value:o.value},o.label)));`);
const { DetectedMovementReview } = await import(load(resolve(root, "src/modules/notifications/components/detected-movement-review.tsx")));
const { QuickMovementDialog } = await import(load(resolve(root, "src/modules/movements/components/quick-movement-dialog.tsx")));
const snapshot = { workspace: { id: 8, baseCurrencyCode: "PEN" }, accounts, catalogs: { categories, counterparties: [] }, movements: [], budgets: [], subscriptions: [], recurringIncome: [], exchangeRates: [] };
let renderer, container, queryClient, closes;
function api(f) {
  const value = { store: f.store, duplicateChecker: f.checker, review: { data: { suggestion: suggestion(f) }, refetch: async () => {}, isPending: false },
    settings: { data: [], isPending: false }, resolve: { isPending: false }, undo: { isPending: false }, invalidate: () => {}, invalidateFinances: async () => {} };
  globalThis.splitApi = value; return value;
}
async function render(f, props) {
  globalThis.splitUnexpected = 0; globalThis.splitToasts = []; globalThis.splitUndo = []; closes = 0; api(f);
  container = document.createElement("div"); document.body.append(container); renderer = createRoot(container);
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  await act(async () => renderer.render(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(MemoryRouter, null,
    props ? React.createElement(QuickMovementDialog, { initialKind: "expense", initialDraft: { accountId: "1", amount: "20", description: "Compra", occurredAt: "2026-10-13T07:00" },
      snapshot, userId: "u", workspaceId: 8, onClose: () => { closes++; }, onCreated: () => {}, submitMovement: async () => { globalThis.splitUnexpected++; return 1; }, ...props }) :
      React.createElement(DetectedMovementReview, { id: 90, snapshot, userId: "u", proAccessEnabled: true, onClose: () => { closes++; } })))));
}
function button(label) { const found = [...container.querySelectorAll("button")].find(node => node.textContent === label || node.querySelector("span")?.textContent === label); assert.ok(found, label); return found; }
async function click(label) { await act(async () => button(label).click()); }
async function change(node, value) {
  assert.ok(node); await act(async () => {
    Object.getOwnPropertyDescriptor(node.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype, "value").set.call(node, value);
    node.dispatchEvent(new dom.window.Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
async function split() {
  await click("Detalles"); await click("Dividir en categorías");
  const category = i => [...container.querySelectorAll("label")].find(node => node.textContent.startsWith(`Categoría de la parte ${i}`))?.querySelector("select");
  await change(category(1), "10"); await change(category(2), "11");
  await act(async () => container.querySelector('[aria-label^="Usar"][aria-label$="parte 1"]').click());
  await change(container.querySelector('[aria-label="Monto de la parte 1"]'), "12");
  await act(async () => container.querySelector('[aria-label^="Usar"][aria-label$="parte 2"]').click());
  await click("Guardar división");
}
async function close() { await act(async () => renderer.unmount()); container.remove(); queryClient.clear(); }
{
  const f = fixture(); await render(f); await split(); await click("Guardar");
  assert.equal(f.state.calls.length, 1); assert.equal(f.state.calls[0].name, "register_detected_movement_split");
  assert.deepEqual(f.state.calls[0].args.p_parts.map(p => p.amount), [12, 8]);
  assert.equal(globalThis.splitUnexpected, 0); assert.equal(closes, 2); assert.equal(globalThis.splitUndo.length, 1); await close();
}
{
  const f = fixture(group()); await render(f); await split(); await click("Guardar");
  assert.equal(f.state.calls.length, 0); assert.match(container.textContent, /recibo completo/);
  await click("Es otro; permitir guardar"); await click("Guardar"); assert.equal(f.state.calls.length, 1); await close();
}
{
  const f = fixture(); f.state.error = "rpc"; await render(f); await split(); await click("Guardar");
  assert.match(container.textContent, /servidor aún/); assert.equal(closes, 0); assert.equal(globalThis.splitUnexpected, 0); await close();
}
{
  const f = fixture(); f.state.readFail = true; await render(f); await split();
  const fileInput = container.querySelector('input[type="file"]'); assert.ok(fileInput);
  Object.defineProperty(fileInput, "files", { value: [new File(["fixture"], "recibo.png", { type: "image/png" })], configurable: true });
  await act(async () => fileInput.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
  await click("Guardar");
  assert.equal(f.state.calls.length, 1); assert.equal(f.state.suggestion.status, "registered");
  assert.match(globalThis.splitUndo[0].label, /comprobante quedó pendiente/);
  assert.match(globalThis.splitToasts[0].description, /no pudo marcarse leído/);
  assert.equal(globalThis.splitUnexpected, 0); await close();
}
{
  const f = fixture(); await render(f); await split(); let finish; f.state.gate = new Promise(resolve => { finish = resolve; });
  const form = container.querySelector("form");
  await act(async () => { form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });
  await close(); await act(async () => finish()); assert.equal(f.state.calls.length, 0);
}
{
  const f = fixture(); await render(f); await split(); let finish; f.state.gate = new Promise(resolve => { finish = resolve; });
  await act(async () => container.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
  // Inputs remain editable while the read is pending. The draft guard invalidates the in-flight authorization.
  await change(container.querySelector('input[inputmode="decimal"]'), "21");
  await act(async () => finish()); assert.equal(f.state.calls.length, 0); await close();
}
{
  const f = fixture(); await render(f, {}); await split(); await click("Guardar");
  assert.equal(globalThis.splitUnexpected, 0); assert.match(container.textContent, /guardado atómico/); await close();
}
dom.window.close();
console.log("detected-split-web: OK (complete grouped candidates, draft/part permission, pagination/errors, actual store and review/form/panel, one RPC, missing contract, duplicate confirmation, cancel/no fallback; local fixtures only)");
