import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
import React, { act } from "react";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobile = resolve(root, "../DarkMoneyApp");
const virtual = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const webRequire = createRequire(resolve(root, "package.json"));
const mobileRequire = createRequire(resolve(mobile, "package.json"));
const { JSDOM, VirtualConsole } = mobileRequire("jsdom");
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", error => { throw new Error(error.message); });
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true, virtualConsole });
for (const key of ["window", "document", "HTMLElement", "KeyboardEvent", "MutationObserver"]) globalThis[key] = dom.window[key];
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const mocks = new Map();
function mock(path, source) { mocks.set(resolve(root, path), virtual(source)); }
mock("src/services/supabase/client.ts", "export const supabase=null;");
mocks.set(resolve(mobile, "lib/supabase.ts"), virtual("export const supabase={from:(table)=>globalThis.learningClient.from(table)};"));
mocks.set(resolve(mobile, "lib/query-client.ts"), virtual("export const STALE={medium:60000};"));
function load(file) {
  if (mocks.has(file)) return mocks.get(file);
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const js = source.replace(/from "([^"]+)"/g, (_, specifier) => {
    if (!specifier.startsWith(".")) return `from "${pathToFileURL(webRequire.resolve(specifier)).href}"`;
    const base = resolve(dirname(file), specifier), dependency = [base, `${base}.tsx`, `${base}.ts`].find(existsSync);
    assert.ok(dependency, `Missing dependency ${specifier}`);
    return `from "${load(dependency)}"`;
  });
  const url = virtual(js); mocks.set(file, url); return url;
}
const learningPath = resolve(root, "src/lib/detection-personal-learning.ts");
const referencePath = resolve(mobile, "features/detected-movements/lib/personal-learning.ts");
const web = await import(load(learningPath));
const reference = await import(load(referencePath));
// Run the reference suite against both implementations; failures retain each original case name.
let originalCases = 0;
globalThis.it = (name, test) => { try { test(); originalCases++; } catch (error) { throw new Error(name, { cause: error }); } };
globalThis.expect = (value) => ({ toBe: expected => assert.equal(value, expected), toBeNull: () => assert.equal(value, null),
  toMatchObject: expected => { for (const key of Object.keys(expected)) assert.deepEqual(value[key], expected[key]); } });
const suite = readFileSync(resolve(mobile, "features/detected-movements/lib/__tests__/personal-learning.test.ts"), "utf8");
let suiteRun = 0;
for (const target of [load(referencePath), load(learningPath)]) {
  const js = ts.transpileModule(suite, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  await import(virtual(js.replace('from "../personal-learning"', `from "${target}"`) + `\n// suite ${++suiteRun}`));
}
delete globalThis.it; delete globalThis.expect;
const { applyPersonalSelection, detectionLearningDecision } = await import(load(resolve(root, "src/lib/detection-learning-draft.ts")));
const { applyPersonalProposal } = await import(load(resolve(mobile, "features/detected-movements/lib/review-draft.ts")));
const empty = { accountId: null, destinationAccountId: null, categoryId: null };
const proposal = { accountId: 1, destinationAccountId: 3, categoryId: 10, accountEvidence: "history", destinationEvidence: "history" };
// Exact precedence/retraction, including explicit manual clearing, receipt evidence and transfers.
let selectionCases = 0;
for (const kind of ["expense", "income", "transfer"]) for (const manual of [[], ["account"], ["destination"], ["category"], ["account", "destination", "category"]])
for (const meta of [{}, { accountId: 2, destinationAccountId: 2 }, { accountHints: { source: { kind: "card", last4: "9999" }, destination: { kind: "account", last4: "1111" } } }])
for (const proposed of [proposal, { ...proposal, accountEvidence: "receipt", destinationEvidence: "receipt" }, { ...proposal, ...empty }]) {
  const current = { ...empty, destinationAccountId: 2 }, baseline = { accountId: 2, destinationAccountId: 3, categoryId: 12 };
  const webResult = applyPersonalSelection(current, kind, new Set(manual), baseline, proposed, proposal, meta);
  const mobileResult = applyPersonalProposal({ ...current, movementType: kind, manualFields: manual }, baseline, proposed, proposal, meta);
  assert.deepEqual(webResult.draft, Object.fromEntries(Object.keys(current).map(key => [key, mobileResult.draft[key]])));
  assert.deepEqual(webResult.applied, mobileResult.applied); selectionCases++;
}
const webFx = await import(load(resolve(root, "src/lib/detection-exchange-rate.ts")));
const mobileFx = await import(load(resolve(mobile, "features/movements/lib/movement-creation-rules.ts")));
const rates = [
  { fromCurrencyCode: "USD", toCurrencyCode: "PEN", rate: 3.7, effectiveAt: "2026-10-01" },
  { fromCurrencyCode: "PEN", toCurrencyCode: "USD", rate: 0.25, effectiveAt: "2026-10-02" },
  { fromCurrencyCode: "EUR", toCurrencyCode: "PEN", rate: 4.2, effectiveAt: "2026-10-03" },
];
for (const from of ["PEN", "USD", "EUR", "JPY"]) for (const to of ["PEN", "USD", "EUR", "JPY"])
  assert.deepEqual(webFx.resolveExchangeRate(rates, from, to), mobileFx.resolveExchangeRate(rates, from, to));

function split(expression) {
  const result = []; let depth = 0, start = 0;
  for (let i = 0; i < expression.length; i++) { if (expression[i] === "(") depth++; if (expression[i] === ")") depth--;
    if (expression[i] === "," && depth === 0) { result.push(expression.slice(start, i)); start = i + 1; } }
  return [...result, expression.slice(start)];
}
function condition(row, expression) {
  const group = /^(and|or)\((.*)\)$/.exec(expression);
  if (group) return group[1] === "and" ? split(group[2]).every(item => condition(row, item)) : split(group[2]).some(item => condition(row, item));
  const [, key, op, value] = /^([^\.]+)\.(eq|is)\.(.+)$/.exec(expression) ?? [];
  assert.ok(key, `Unsupported filter ${expression}`);
  return op === "is" ? row[key] == null : String(row[key]) === value;
}
function client(options = {}) {
  const own = { workspace_id: 8, status: "posted", created_by_user_id: "u", updated_by_user_id: null, metadata: {}, movement_type: "expense", description: "Tambo", source_account_id: 1 };
  const data = {
    workspaces: [{ id: 8, kind: options.shared ? "shared" : "personal", owner_user_id: options.owner ?? "u" }],
    workspace_members: [{ workspace_id: 8, user_id: "u" }, ...(options.member ? [{ workspace_id: 8, user_id: "other" }] : [])],
    movements: [
      { ...own, id: 1 }, { ...own, id: 2, created_by_user_id: null }, { ...own, id: 3, created_by_user_id: "other" },
      { ...own, id: 4, updated_by_user_id: "other" }, { ...own, id: 5, workspace_id: 9 }, { ...own, id: 6, status: "voided" },
      { ...own, id: 7, created_by_user_id: null, updated_by_user_id: "other" },
    ],
    notification_detected_movement_suggestions: [
      { workspace_id: 8, user_id: "u", movement_id: 1, description: "Alias", status: "registered", metadata: {} },
      { workspace_id: 8, user_id: "other", movement_id: 1, description: "Other", status: "registered", metadata: {} },
      { workspace_id: 9, user_id: "u", movement_id: 1, description: "Other space", status: "registered", metadata: {} },
      { workspace_id: 8, user_id: "u", movement_id: 1, description: "Omitted", status: "discarded", metadata: {} },
    ],
  };
  const calls = [];
  return { calls, from(table) {
    const filters = []; let limit = Infinity, single = false;
    const query = { select(value) { calls.push([table, "select", value]); return query; },
      eq(key, value) { calls.push([table, "eq", key, value]); filters.push(row => row[key] === value); return query; },
      in(key, values) { calls.push([table, "in", key, values]); filters.push(row => values.includes(row[key])); return query; },
      or(value) { calls.push([table, "or", value]); filters.push(row => condition(row, `or(${value})`)); return query; },
      order(key, value) { calls.push([table, "order", key, value]); return query; },
      limit(value) { calls.push([table, "limit", value]); limit = value; return query; },
      maybeSingle() { single = true; return query; },
      then(resolve) { const rows = data[table].filter(row => filters.every(filter => filter(row))).slice(0, limit);
        return Promise.resolve({ data: single ? rows[0] : rows, error: options.error === table ? new Error(`Failed ${table}`) : null }).then(resolve); },
    }; return query;
  } };
}
const { fetchDetectionLearning } = await import(load(resolve(root, "src/services/queries/detection-learning.ts")));
const mobileQuery = await import(load(resolve(mobile, "services/queries/detection-learning.ts")));
for (const options of [{}, { shared: true }, { member: true }, { owner: "other" }, { error: "workspaces" }, { error: "workspace_members" }]) {
  const actualClient = client(options), referenceClient = client(options); globalThis.learningClient = referenceClient;
  const actual = await fetchDetectionLearning(actualClient, "u", 8), expected = await mobileQuery.fetchDetectionLearning("u", 8);
  assert.deepEqual(actual, expected); assert.deepEqual(actualClient.calls, referenceClient.calls);
  assert.deepEqual(actual.map(m => m.id), Object.keys(options).length ? [1] : [1, 2]);
  assert.deepEqual(actual[0].metadata.learningReceipts.map(row => row.description), ["Alias"]);
}
for (const table of ["movements", "notification_detected_movement_suggestions"]) await assert.rejects(fetchDetectionLearning(client({ error: table }), "u", 8), new RegExp(`Failed ${table}`));
// Test the real common invalidation boundary after editing/voiding/deleting resources.
const workspaceSource = ts.createSourceFile("workspace-data.ts", readFileSync(resolve(root, "src/services/queries/workspace-data.ts"), "utf8"), ts.ScriptTarget.Latest, true);
const invalidateNode = workspaceSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "invalidateWorkspaceSnapshot");
assert.ok(invalidateNode);
const invalidateJs = ts.transpileModule(invalidateNode.getText(workspaceSource), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const invalidate = new Function(`${invalidateJs};return invalidateWorkspaceSnapshot;`)();
const invalidations = []; await invalidate({ invalidateQueries: async value => invalidations.push(value) }, 8, "u");
const learningInvalidation = invalidations.find(value => value.predicate);
assert.ok(learningInvalidation);
assert.equal(learningInvalidation.predicate({ queryKey: ["detection-learning", "u", 8] }), true);
assert.equal(learningInvalidation.predicate({ queryKey: ["detection-learning", "u", 9] }), false);
assert.equal(learningInvalidation.predicate({ queryKey: ["other", "u", 8] }), false);

// Actual shared form state/effects and event handlers; only leaf UI and network hooks are substituted.
globalThis.learningSaves = [];
const h = 'import React from "' + pathToFileURL(webRequire.resolve("react")).href + '";const h=React.createElement;';
mock("src/services/queries/workspace-data.ts", `const mutation=()=>({isPending:false,mutateAsync:async value=>{throw new Error("Unexpected mutation")}});
  export const useCreateMovementMutation=mutation,useCreateAttachmentRecordMutation=mutation,useCreateCategoryMutation=mutation,useCreateCounterpartyMutation=mutation,
  useCreateRecurringIncomeMutation=mutation,useCreateSubscriptionMutation=mutation;
  export const useBudgetSpendTypesQuery=()=>({data:[]}),usePersistLearningFeedbackMutation=()=>({mutateAsync:async()=>{}}),getQueryErrorMessage=(error)=>error.message;`);
mock("src/modules/attachments/use-receipt-feature-access.ts", "export const useReceiptFeatureAccess=()=>({canUploadReceipts:false});");
mock("src/modules/attachments/receipt-utils.ts", "export const deleteStoredReceipt=()=>{},prepareReceiptUpload=()=>{throw Error('No upload')},uploadPreparedReceipt=()=>{};");
mock("src/modules/movements/hooks/use-movement-suggestions.ts", "export const useMovementSuggestions=()=>({});");
mock("src/modules/movements/hooks/use-movement-insights.ts", "export const useMovementInsights=()=>({});");
mock("src/modules/contacts/components/contact-quick-create-dialog.tsx", "export const ContactQuickCreateDialog=()=>null;");
mock("src/modules/movements/components/movement-split-panel.tsx", "export const MovementSplitPanel=()=>null;");
mock("src/components/ui/searchable-picker.tsx", `${h} export const SearchablePicker=p=>h('select',{'aria-label':p.placeholderLabel,value:p.value,onChange:e=>p.onChange(e.target.value)},h('option',{value:''},'Sin asignar'),...p.options.map(o=>h('option',{key:o.value,value:o.value},o.label)));`);
mock("src/modules/movements/components/movement-details-panel.tsx", `${h}
  export const MovementDetailsNavigationRow=p=>h('button',{type:'button',onClick:p.onClick},'Detalles');
  export const MovementDetailsPanel=p=>h('div',null,h('input',{'aria-label':'Descripción',value:p.description,onChange:e=>p.onDescriptionChange(e.target.value)}),h('input',{'aria-label':'Importe destino',value:p.destinationAmount??'',onChange:e=>p.onDestinationAmountChange(e.target.value)}),h('button',{type:'button',onClick:p.onOpenCategory},'Elegir categoría'),p.receiptRows);
  export const MovementDetailOptionsPanel=p=>h('select',{'aria-label':'Categoría',value:p.value,onChange:e=>p.onChange(e.target.value)},...p.options.map(o=>h('option',{key:o.value,value:o.value},o.label)));
  export const MovementDetailsReceiptRow=p=>h('div',null,p.children),PendingMovementReceiptControl=()=>null,MovementInsightRow=()=>null,MovementSuggestionRow=()=>null;`);
const { QuickMovementDialog } = await import(load(resolve(root, "src/modules/movements/components/quick-movement-dialog.tsx")));
const accounts = [{ id: 1, name: "Principal", currencyCode: "PEN", currentBalance: 100, isArchived: false },
  { id: 2, name: "Ahorro", currencyCode: "PEN", currentBalance: 50, isArchived: false },
  { id: 3, name: "USD", currencyCode: "USD", currentBalance: 10, isArchived: false }];
const categories = [{ id: 10, name: "Comida", kind: "expense", isActive: true }];
const movement = id => ({ id, description: "Tambo", movement_type: "expense", status: "posted", source_account_id: 1, destination_account_id: null,
  category_id: 10, metadata: {}, created_at: "2026-10-01", updated_at: "2026-10-01" });
const initialDraft = { amount: "21.30", description: "Tambo", occurredAt: "2026-10-13T10:00", accountId: "2" };
const context = { history: [], baseline: { accountId: 2, destinationAccountId: null, categoryId: null }, originalDescription: "Tambo", movementType: "expense", financialAppKey: "bcp", currencyCode: "PEN", metadata: {} };
const snapshot = { workspace: { id: 8, baseCurrencyCode: "PEN" }, accounts, catalogs: { categories, counterparties: [] }, movements: [], budgets: [], subscriptions: [], recurringIncome: [], exchangeRates: rates };
let renderer, container;
async function render(learning, extra = {}) {
  if (!renderer) { container = document.createElement("div"); document.body.append(container); renderer = createRoot(container); }
  await act(async () => renderer.render(React.createElement(QuickMovementDialog, { initialKind: "expense", initialDraft, detectionLearning: learning,
    snapshot, userId: "u", workspaceId: 8, allowSplit: false, postedOnly: true, sourceCurrencyCode: "PEN", onClose: () => {}, onCreated: () => {},
    submitMovement: async input => { globalThis.learningSaves.push(input); return 100; }, ...extra })));
}
async function change(node, value) {
  await act(async () => { Object.getOwnPropertyDescriptor(node.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype, "value").set.call(node, value);
    node.dispatchEvent(new dom.window.Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
}
function button(text) { const node = [...container.querySelectorAll("button")].find(b => b.textContent === text || b.querySelector("span")?.textContent === text); assert.ok(node, text); return node; }
const accountSelect = () => container.querySelector('select[aria-label="Selecciona una cuenta"]');
async function close() { await act(async () => renderer.unmount()); container.remove(); renderer = null; }
// Late data applies without resetting amount/description; disappearance retracts to baseline.
await render(context); assert.equal(accountSelect().value, "2");
await render({ ...context, history: [movement(1), movement(2)] }); assert.equal(accountSelect().value, "1");
assert.match(container.textContent, /Según tus movimientos anteriores/); assert.equal(container.querySelector('input[inputmode="decimal"]').value, "21.30");
await render(context); assert.equal(accountSelect().value, "2"); assert.doesNotMatch(container.textContent, /Según tus movimientos anteriores/);
assert.equal(globalThis.learningSaves.length, 0); await close();
// A manual category clear is an explicit decision, even when the proposal arrives later.
await render(context);
await act(async () => button("Detalles").click()); await act(async () => button("Elegir categoría").click());
await change(container.querySelector('select[aria-label="Categoría"]'), "");
await render({ ...context, history: [movement(1), movement(2)] });
await act(async () => button("Elegir categoría").click());
assert.equal(container.querySelector('select[aria-label="Categoría"]').value, "");
await close();
// Explicit same choice and clearing survive new data/refetch; metadata is written only on Save.
await render(context); await change(accountSelect(), "2");
await render({ ...context, history: [movement(1), movement(2)] }); assert.equal(accountSelect().value, "2");
await change(accountSelect(), ""); await render({ ...context, history: [movement(1), movement(2)] }); assert.equal(accountSelect().value, "");
await change(accountSelect(), "2");
await act(async () => button("Guardar").click());
assert.equal(globalThis.learningSaves.length, 1);
assert.equal(globalThis.learningSaves[0].sourceAccountId, 2);
assert.deepEqual(globalThis.learningSaves[0].metadata.detectionLearning, detectionLearningDecision(context, new Set(["account"])));
await close();
// Unknown explicit receipt reference clears the app default until learned, not to another currency.
await render({ ...context, metadata: { accountHints: { source: { kind: "card", last4: "9999" } } } }); assert.equal(accountSelect().value, ""); await close();
// Currency mismatch in history never converts or changes the detected amount.
await render({ ...context, history: [movement(1), movement(2)].map(m => ({ ...m, source_account_id: 3 })) }); assert.equal(accountSelect().value, "2"); await close();
// Learned transfer pair uses the latest stored rate, and amount edits keep that rate (not the rounded ratio).
const transfers = [movement(1), movement(2)].map(m => ({ ...m, movement_type: "transfer", description: "Ahorro vacaciones", category_id: null, destination_account_id: 3 }));
const transferDraft = { ...initialDraft, description: "Ahorro vacaciones", accountId: "", sourceAccountId: "2" };
const transferContext = { ...context, history: transfers, originalDescription: "Ahorro vacaciones", movementType: "transfer" };
await render(transferContext, { initialKind: "transfer", initialDraft: transferDraft });
assert.equal(container.querySelector('select[aria-label="Cuenta de origen"]').value, "1");
assert.equal(container.querySelector('select[aria-label="Cuenta de destino"]').value, "3");
await change(container.querySelector('input[inputmode="decimal"]'), "30");
await act(async () => button("Guardar").click());
assert.equal(globalThis.learningSaves.at(-1).sourceAmount, 30);
assert.equal(globalThis.learningSaves.at(-1).destinationAmount, 7.5);
assert.equal(globalThis.learningSaves.at(-1).fxRate, 0.25);
await close();
// Choosing the same source/destination clears the conflict rather than retaining stale converted amounts.
await render(transferContext, { initialKind: "transfer", initialDraft: transferDraft });
await change(container.querySelector('select[aria-label="Cuenta de destino"]'), "1");
assert.equal(container.querySelector('select[aria-label="Cuenta de destino"]').value, "");
const count = globalThis.learningSaves.length;
await act(async () => button("Guardar").click()); assert.equal(globalThis.learningSaves.length, count);
await close();
// The ordinary movement form does not silently start applying detection learning.
await render(undefined); assert.equal(accountSelect().value, "2"); assert.doesNotMatch(container.textContent, /Según tus movimientos anteriores/); await close();
// The review's scoped React key prevents a manual decision from leaking into another review/user/space.
await render(context, { key: "u:8:1" }); await change(accountSelect(), "");
await render({ ...context, history: [movement(1), movement(2)] }, { key: "other:9:2", userId: "other", workspaceId: 9 });
assert.equal(accountSelect().value, "1"); await close();
dom.window.close();
console.log(`detection-learning: OK (${originalCases} original mobile test runs, ${selectionCases} selection comparisons, FX, scoped queries, actual form late/manual/retracted proposals; no network)`);
