import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
import React, { act } from "react";

const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."), mobile = resolve(root, "../DarkMoneyApp");
const require = createRequire(resolve(root, "package.json")), mobileRequire = createRequire(resolve(mobile, "package.json"));
const { JSDOM, VirtualConsole } = mobileRequire("jsdom");
const virtualConsole = new VirtualConsole(); virtualConsole.on("jsdomError", error => { throw new Error(error.message); });
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", virtualConsole, pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "KeyboardEvent", "MutationObserver"]) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter } = await import("react-router-dom");
// Use the same export condition as the TSX loader, so hooks share one QueryClient context.
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
const web = await import(load(resolve(root, "src/services/queries/detection-duplicates.ts")));
const { parseDuplicateVerdict } = await import(load(resolve(root, "src/modules/notifications/lib/duplicate-verdict.ts")));
const phoneVerdict = await import(load(resolve(mobile, "features/notifications/lib/duplicate-verdict.ts")));
const phoneDay = await import(load(resolve(mobile, "features/detected-movements/lib/duplicate-day.ts")));
for (const raw of [null, [], "distinct", {}, { verdict: "yes" }, ...["distinct", "duplicate", "unknown", "skipped"].flatMap(verdict => [{ verdict }, { verdict, reason: "  " }, { verdict, reason: "Remitentes distintos" }])])
  assert.deepEqual(parseDuplicateVerdict(raw), phoneVerdict.parseDuplicateVerdict(raw));
const scope = { userId: "u", workspaceId: 8 };
const accounts = [{ id: 1, workspaceId: 8, isArchived: false, currencyCode: "PEN" }, { id: 2, workspaceId: 8, isArchived: false, currencyCode: "USD" }];
const receipt = { id: 90, ...scope, financialAppKey: "bcp", packageName: "bcp.app", movementType: "expense", status: "pending", amount: 20,
  currencyCode: "PEN", description: "Táxi!", occurredAt: "2026-10-13T12:00:00Z", movementId: null, metadata: null };
const input = { ...scope, description: "Táxi!", occurredAt: receipt.occurredAt, movementType: "expense", status: "posted", sourceAccountId: 1, sourceAmount: 20,
  destinationAccountId: null, destinationAmount: null, categoryId: null, counterpartyId: null };
const movement = { id: 20, workspace_id: 8, movement_type: "expense", status: "posted", description: "Taxi", occurred_at: "2026-10-13T10:00:00Z",
  source_account_id: 1, source_amount: 20, destination_account_id: null, destination_amount: null, metadata: null };
const suggestion = { id: 90, user_id: "u", workspace_id: 8, amount: 20, currency_code: "PEN", movement_type: "expense", status: "pending", occurred_at: receipt.occurredAt };
function fixture(extraMovements = [], extraSuggestions = []) {
  const state = { movements: [structuredClone(movement), ...extraMovements], suggestions: [structuredClone(suggestion), ...extraSuggestions], invocations: [], calls: [],
    verdict: "unknown", error: null, functionError: false, invoke: null, beforeInvoke: null, rpcCalls: 0, writes: 0 };
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.bounds = [0, Infinity]; this.options = {}; this.patch = null; }
    select(columns, options = {}) { this.options = options; state.calls.push([this.table, "select", columns, options]); return this; }
    eq(key, value) { this.filters.push(row => row[key] === value); state.calls.push([this.table, "eq", key, value]); return this; }
    neq(key, value) { this.filters.push(row => row[key] !== value); return this; }
    in(key, values) { this.filters.push(row => values.includes(row[key])); return this; }
    gte(key, value) { this.filters.push(row => Date.parse(row[key]) >= Date.parse(value)); return this; }
    lt(key, value) { this.filters.push(row => Date.parse(row[key]) < Date.parse(value)); return this; }
    lte(key, value) { this.filters.push(row => Date.parse(row[key]) <= Date.parse(value)); return this; }
    order() { return this; }
    range(from, to) { this.bounds = [from, to]; return this; }
    limit(limit) { this.bounds = [0, limit - 1]; return this; }
    abortSignal(signal) { this.signal = signal; return this; }
    update(patch) { state.writes++; this.patch = patch; return this; }
    async execute(single = false) {
      const rows = (this.table === "movements" ? state.movements : this.table === "notification_detected_movement_suggestions" ? state.suggestions : [])
        .filter(row => this.filters.every(test => test(row)));
      if (this.patch) for (const row of rows) Object.assign(row, this.patch);
      const data = rows.slice(this.bounds[0], this.bounds[1] + 1);
      return { data: this.options.head ? null : single ? data[0] ?? null : structuredClone(data), count: this.options.count ? rows.length : null,
        error: this.signal?.aborted || state.error === this.table ? new Error("Read failed") : null };
    }
    maybeSingle() { return this.execute(true); }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
  }
  const client = { from: table => new Query(table), rpc: async () => { state.rpcCalls++; return { data: { resolvedIds: [], candidates: [] }, error: null }; },
    functions: { invoke: async (name, options) => { state.invocations.push({ name, ...options }); state.beforeInvoke?.();
      return state.invoke ? state.invoke(name, options) : { data: { verdict: state.verdict }, error: state.functionError ? new Error("Offline") : null }; } } };
  return { state, client, checker: web.createDetectedDuplicateChecker(client, scope) };
}
const check = (fixture, pro = true, permission = null, changed = {}, signal) => fixture.checker.check(receipt, { ...input, ...changed }, accounts, null, pro, permission, signal);
{
  const f = fixture(); f.state.movements = [];
  assert.equal((await check(f)).allowed, true); assert.equal(f.state.invocations.length, 0, "No AI call without a candidate");
}

// Extract actual mobile query functions without importing native hooks or configuring Supabase.
const source = ts.createSourceFile("notification-detection.ts", readFileSync(resolve(mobile, "services/queries/notification-detection.ts"), "utf8"), ts.ScriptTarget.Latest, true);
const names = ["normalizeDescription", "findPossibleDuplicateMovement", "mapDuplicateMovement", "countSameDayDetectionSignals", "confirmDuplicateWithAi"];
const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
assert.equal(functions.length, names.length);
const extracted = ts.transpileModule(functions.map(node => node.getText(source).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const phone = client => new Function("supabase", "parseDuplicateVerdict", "detectionDuplicateBounds", "offlineRuntime", `const DUPLICATE_AI_TIMEOUT_MS=1;${extracted};return {findPossibleDuplicateMovement,countSameDayDetectionSignals,confirmDuplicateWithAi};`)(client, phoneVerdict.parseDuplicateVerdict, phoneDay.detectionDuplicateBounds, { postedMovementsWithAmount: async () => null });
{
  const f = fixture(); const decision = await check(f, false);
  const reference = await phone(f.client).findPossibleDuplicateMovement({ workspaceId: 8, movementType: "expense", accountId: 1, amount: 20, occurredAt: input.occurredAt, description: input.description });
  assert.equal(decision.candidate.id, reference.id); assert.equal(decision.allowed, false); assert.equal(f.state.invocations.length, 0);
}
for (const verdict of ["duplicate", "unknown", "skipped", "distinct", "yes"]) {
  const f = fixture(); f.state.verdict = verdict;
  const decision = await check(f);
  assert.equal(decision.allowed, verdict === "distinct"); assert.equal(f.state.writes, 0);
  assert.equal(f.state.invocations.length, 1); assert.equal(f.state.invocations[0].name, "movement-duplicate-ai-check");
  const { body } = f.state.invocations[0];
  const counts = await phone(f.client).countSameDayDetectionSignals({ userId: "u", currencyCode: "PEN", workspaceId: 8, movementType: "expense", accountId: 1, amount: 20, occurredAt: input.occurredAt });
  assert.deepEqual(body, { workspaceId: 8, suggestion: { description: input.description, amountLabel: "20", occurredAt: input.occurredAt, sourceApp: "bcp", rawText: receipt.description },
    candidateMovement: { id: 20, description: "Taxi", occurredAt: movement.occurred_at, amount: 20 }, counts });
  assert.deepEqual(await phone(f.client).confirmDuplicateWithAi(body), decision.ai);
}
// Server lookup reaches past 10 candidates and past the 50 visible movements; a failed lookup cannot permit saving.
{
  const unrelated = Array.from({ length: 510 }, (_, index) => ({ ...movement, id: index + 100, description: "Otro comercio" }));
  const f = fixture(); f.state.movements = [...unrelated, movement]; assert.equal((await check(f, false)).candidate.id, 20);
  assert.equal((await phone(f.client).findPossibleDuplicateMovement({ workspaceId: 8, movementType: "expense", accountId: 1, amount: 20, occurredAt: input.occurredAt, description: input.description })).id, 20);
  f.state.error = "movements"; await assert.rejects(check(f), /consultar las coincidencias/); assert.equal(f.state.invocations.length, 0);
}
// Peru day, correct income leg, full transfer pair, and other spaces/currencies/users never become evidence.
assert.deepEqual(web.detectionDuplicateBounds("2026-10-14T04:59:59Z"), { from: "2026-10-13T05:00:00.000Z", to: "2026-10-14T05:00:00.000Z" });
assert.throws(() => web.detectionDuplicateBounds("bad"), /fecha/);
for (const time of ["2026-10-13T04:59:59Z", "2026-10-13T05:00:00Z", "2026-10-14T04:59:59Z", "2026-10-14T05:00:00Z", "2026-12-31T23:59:59-05:00", "2026-01-01"])
  assert.deepEqual(phoneDay.detectionDuplicateBounds(time), web.detectionDuplicateBounds(time));
{
  const f = fixture(); f.state.movements[0].occurred_at = "2026-10-14T04:50:00Z";
  assert.equal((await check(f, false)).candidate.id, 20);
  assert.equal((await phone(f.client).findPossibleDuplicateMovement({ workspaceId: 8, movementType: "expense", accountId: 1, amount: 20, occurredAt: input.occurredAt, description: input.description })).id, 20,
    "Both clients now find the same late-night Peru movement");
}
{
  const excluded = [{ ...suggestion, id: 91, user_id: "other" }, { ...suggestion, id: 92, workspace_id: 9 }, { ...suggestion, id: 93, currency_code: "USD" },
    { ...suggestion, id: 94, movement_type: "income" }, { ...suggestion, id: 95, status: "discarded" }, { ...suggestion, id: 96, status: "duplicate" }];
  const registered = Array.from({ length: 1105 }, (_, index) => ({ ...suggestion, id: index + 100, status: "registered" }));
  const f = fixture([], [...excluded, ...registered]); await check(f);
  assert.deepEqual(f.state.invocations[0].body.counts, { sameDaySuggestions: 1106, sameDayRegisteredFromSuggestions: 1105, sameDayMatchingMovements: 1 });
  assert.deepEqual(await phone(f.client).countSameDayDetectionSignals({ userId: "u", currencyCode: "PEN", workspaceId: 8, movementType: "expense", accountId: 1, amount: 20, occurredAt: input.occurredAt }), f.state.invocations[0].body.counts);
}
{
  const f = fixture(); f.state.error = "notification_detected_movement_suggestions";
  const decision = await check(f); assert.equal(decision.allowed, false); assert.equal(decision.ai.verdict, "unknown"); assert.equal(f.state.invocations.length, 0);
  await assert.rejects(phone(f.client).countSameDayDetectionSignals({ userId: "u", currencyCode: "PEN", workspaceId: 8, movementType: "expense", accountId: 1, amount: 20, occurredAt: input.occurredAt }), /evidencia/);
}
{
  const f = fixture(); f.state.movements[0] = { ...movement, movement_type: "income", source_account_id: null, source_amount: null, destination_account_id: 1, destination_amount: 20 };
  const result = await f.checker.check({ ...receipt, movementType: "income" }, { ...input, movementType: "income", sourceAccountId: null, sourceAmount: null, destinationAccountId: 1, destinationAmount: 20 }, accounts, null, false, null);
  assert.equal(result.candidate.id, 20);
  assert.equal((await phone(f.client).findPossibleDuplicateMovement({ workspaceId: 8, movementType: "income", accountId: 1, amount: 20, occurredAt: input.occurredAt, description: input.description })).id, 20);
  f.state.movements[0] = { ...movement, movement_type: "transfer", destination_account_id: 2, destination_amount: 5 };
  const transfer = { ...input, movementType: "transfer", destinationAccountId: 2, destinationAmount: 5, fxRate: 0.25 };
  assert.equal((await f.checker.check({ ...receipt, movementType: "transfer" }, transfer, accounts, null, false, null)).candidate.id, 20);
  assert.equal((await f.checker.check({ ...receipt, movementType: "transfer" }, { ...transfer, destinationAmount: 6 }, accounts, null, false, null)).candidate, null);
  const mobileTransfer = { workspaceId: 8, movementType: "transfer", accountId: 1, amount: 20, occurredAt: input.occurredAt, description: input.description, destinationAccountId: 2, destinationAmount: 5 };
  assert.equal((await phone(f.client).findPossibleDuplicateMovement(mobileTransfer)).id, 20);
  assert.equal(await phone(f.client).findPossibleDuplicateMovement({ ...mobileTransfer, destinationAmount: 6 }), null);
}
// Explicit override is tied to the candidate and draft, not a blanket bypass of new coincidences.
{
  const f = fixture(); const decision = await check(f, false);
  assert.equal((await check(f, false, decision.permission)).allowed, true);
  assert.equal((await check(f, false, { ...decision.permission, signature: "old draft" })).allowed, false);
  f.state.movements[0].id = 21;
  assert.equal((await check(f, false, decision.permission)).allowed, false);
  await assert.rejects(check(f, false, null, { workspaceId: 9 }), /usuario y espacio/);
}
// Timeout, abort, invalid response, expired entitlement, or a stale candidate cannot authorize a late save.
{
  const f = fixture(); let finish;
  f.state.invoke = () => new Promise(resolve => { finish = resolve; });
  const body = { workspaceId: 8 };
  const result = await web.confirmDuplicateWithAi(f.client, body, undefined, 1);
  assert.equal(result.verdict, "unknown"); assert.equal(f.state.invocations[0].signal.aborted, true);
  finish({ data: { verdict: "distinct" }, error: null }); await Promise.resolve(); assert.equal(result.verdict, "unknown");
  const controller = new AbortController(); const checking = check(f, true, null, {}, controller.signal);
  await new Promise(resolve => setTimeout(resolve, 0)); controller.abort(); await assert.rejects(checking, /canceló/);
}
{
  const f = fixture(); f.state.functionError = true; assert.equal((await check(f)).allowed, false);
  f.state.functionError = false; f.state.verdict = "distinct"; f.state.beforeInvoke = () => { f.state.movements[0].description = "Editado en otro dispositivo"; };
  await assert.rejects(check(f), /coincidencia cambió/); assert.equal(f.state.writes, 0);
}
// The actual store rechecks the canonical detection after the delayed guard, before financial creation.
{
  const { createDetectedMovementStore } = await import(load(resolve(root, "src/services/queries/detected-movement-store.ts")));
  for (const patch of [{ status: "discarded" }, { status: "registered", movement_id: 21 }, { description: "Corregida" }, { updated_at: "2026-10-14T12:00:00Z" }]) {
    const f = fixture(); f.state.suggestions[0] = { ...suggestion, description: receipt.description, financial_app_key: "bcp", package_name: "bcp.app", confidence: "high", metadata: null };
    let creates = 0;
    await assert.rejects(createDetectedMovementStore(f.client, scope).register(90, input, accounts, async () => { creates++; return 20; }, async () => Object.assign(f.state.suggestions[0], patch)), /detección cambió/);
    assert.equal(creates, 0); assert.equal(f.state.writes, 0);
  }
}

// Actual review component and React Query mutation, with a mocked form and network boundaries.
mock("src/services/queries/workspace-data.ts", "export const useCreateMovementMutation=()=>({mutateAsync:async()=>1}),getQueryErrorMessage=(error)=>error.message;");
mock("src/services/queries/detected-movements.ts", "export const useDetectedMovementReviewQuery=()=>globalThis.reviewApi;");
mock("src/services/queries/detection-learning.ts", "export const useDetectionLearningQuery=()=>({data:[],isError:false});");
mock("src/components/ui/toast-provider.tsx", "export const useToast=()=>({showToast:()=>{}});");
mock("src/components/ui/undo-queue.tsx", "export const useUndoQueue=()=>({schedule:()=>{}});");
const h = `import React from "${pathToFileURL(require.resolve("react")).href}";const h=React.createElement;`;
mock("src/modules/movements/components/quick-movement-dialog.tsx", `${h} export const QuickMovementDialog=p=>{globalThis.reviewForm=p;return h('div',null,p.context,h('button',{disabled:p.isSubmitting,onClick:()=>p.submitMovement(globalThis.reviewInput).catch(()=>{})},'Guardar fixture'),h('button',{onClick:p.onDraftChange},'Editar fixture'));};`);
const { DetectedMovementReview } = await import(load(resolve(root, "src/modules/notifications/components/detected-movement-review.tsx")));
globalThis.reviewInput = input;
const snapshot = { workspace: { id: 8, baseCurrencyCode: "PEN" }, accounts, catalogs: { categories: [] } };
let renderer, container, queryClient;
function api(f) {
  const value = { refetches: 0, writes: 0, resolves: 0, duplicateChecker: f.checker,
    review: { data: { suggestion: receipt }, isPending: false, isError: false, refetch: async () => { value.refetches++; } }, settings: { data: [], isPending: false },
    resolve: { isPending: false, mutateAsync: async () => { value.resolves++; return { readingUpdated: true }; } }, undo: { isPending: false }, invalidate: () => {}, invalidateFinances: async () => {},
    store: { register: async (_, draft, __, ___, checkDuplicate) => { await checkDuplicate(receipt, null); value.writes++; return { movementId: 100, readingUpdated: true }; } },
  }; return value;
}
async function render(value, pro = true) {
  globalThis.reviewApi = value;
  if (!renderer) { container = document.createElement("div"); document.body.append(container); renderer = createRoot(container); queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } }); }
  await act(async () => renderer.render(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(MemoryRouter, null,
    React.createElement(DetectedMovementReview, { id: 90, snapshot, userId: "u", proAccessEnabled: pro, onClose: () => {} })))));
}
function button(label) { const node = [...container.querySelectorAll("button")].find(b => b.textContent === label); assert.ok(node, label); return node; }
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); }
async function close() { await act(async () => renderer.unmount()); container.remove(); renderer = null; queryClient.clear(); }
{
  const f = fixture(), value = api(f); await render(value); assert.equal(f.state.invocations.length, 0);
  await act(async () => button("Guardar fixture").click()); await settle(); assert.equal(value.writes, 0);
  assert.match(container.textContent, /No se pudo confirmar con IA/); assert.match(container.textContent, /Es el mismo movimiento/);
  assert.match(container.querySelector("a").href, /movement=20/);
  await act(async () => button("Es otro; permitir guardar").click()); await act(async () => button("Guardar fixture").click()); await settle();
  assert.equal(value.writes, 1); assert.equal(f.state.invocations.length, 1); assert.equal(value.resolves, 0); await close();
}
{
  const f = fixture(), value = api(f); f.state.verdict = "distinct"; await render(value);
  await act(async () => button("Guardar fixture").click()); await settle(); assert.equal(value.writes, 1); assert.equal(value.resolves, 0); await close();
}
{
  const f = fixture(), value = api(f); let finish; f.state.invoke = () => new Promise(resolve => { finish = resolve; }); await render(value);
  await act(async () => button("Guardar fixture").click()); await settle(); assert.match(container.textContent, /Comprobando coincidencias/);
  await act(async () => button("Editar fixture").click()); await settle();
  await act(async () => finish({ data: { verdict: "distinct" }, error: null })); await settle();
  assert.equal(value.writes, 0); assert.equal(value.refetches, 0); await close();
}
{
  const f = fixture(), value = api(f); let finish; f.state.invoke = () => new Promise(resolve => { finish = resolve; }); await render(value);
  await act(async () => button("Guardar fixture").click()); await settle(); await close();
  await act(async () => finish({ data: { verdict: "distinct" }, error: null })); await settle(); assert.equal(value.writes, 0);
}
dom.window.close();
console.log("detection-duplicates: OK (actual mobile verdict/query/edge body comparison, scoped complete ledger/counts, timeout/abort, stale records, actual React review; no network or financial writes)");
