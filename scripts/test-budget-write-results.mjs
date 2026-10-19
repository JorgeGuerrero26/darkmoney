import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { dom, load } from "./lib/web-ui-harness.mjs";
const rules = await import(load("src/modules/budgets/lib/budget-write-result.ts"));
const source = readFileSync(new URL("../src/services/queries/workspace-data.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("workspace.ts", source, ts.ScriptTarget.Latest, true);
const names = ["useCreateBudgetMutation", "useUpdateBudgetMutation", "usePinBudgetMutation", "useDuplicateBudgetMutation", "useAdjustBudgetLimitMutation", "useToggleBudgetMutation", "useDeleteBudgetMutation"];
const declarations = [...names, "buildBudgetMutationPayload", "normalizeOptionalText"];
const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node) && declarations.includes(node.name?.text));
assert.equal(nodes.length, declarations.length);
const code = ts.transpileModule(nodes.map(node => node.getText(ast).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
let operations = [], override, failure, finish, gated = false;
const invalidations = [];
const client = { from(table) { assert.equal(table, "budgets"); return {
  kind: "read", filters: [], insert(payload) { this.kind = "insert"; this.payload = payload; return this; }, update(payload) { this.kind = "update"; this.payload = payload; return this; }, delete() { this.kind = "delete"; return this; },
  select(columns) { this.columns = columns; return this; }, eq(key, value) { this.filters.push([key, value]); return this; }, abortSignal(signal) { this.signal = signal; return this; },
  async single() { operations.push(this); if (gated) await new Promise(resolve => { finish = resolve; }); if (failure) return { data: null, error: failure };
    const row = { id: 9, workspace_id: 8, ...this.payload };
    return { data: override === undefined ? row : typeof override === "function" ? override(row) : override, error: null };
  },
}; } };
const hooks = new Function("useQueryClient", "useMutation", "getClient", "invalidateWorkspaceSnapshot", ...Object.keys(rules), `${code};return {${names.join(",")}};`)(() => ({}), options => options, () => client, async (_client, ws, user) => invalidations.push({ ws, user }), ...Object.values(rules));
const form = { name: " Comida ", periodStart: "2026-10-01", periodEnd: "2026-10-31", currencyCode: "PEN", categoryId: 3, accountId: 4, spendTypeId: 5, limitAmount: 400, alertPercent: 80, rolloverEnabled: false, recurrence: "monthly", isActive: true, notes: " Nota " };
const input = { ...form, budgetId: 9, workspaceId: 8, userId: "A", isPinned: true, budget: { ...form, id: 9, workspaceId: 8 } };
function reset() { operations = []; override = undefined; failure = null; gated = false; finish = null; invalidations.length = 0; }
for (const name of names) {
  const hook = hooks[name](8, "A"), creating = /Create|Duplicate/.test(name), deleting = name.includes("Delete");
  reset(); assert.equal(hook.retry, false); assert.equal(hook.onMutate, undefined); assert.equal(hook.onError, undefined);
  assert.deepEqual(await hook.mutationFn(input), { id: 9, workspaceId: 8 }); assert.equal(operations.length, 1);
  const operation = operations[0]; assert.ok(operation.signal instanceof AbortSignal); assert.match(operation.columns, /workspace_id/);
  if (!creating) assert.deepEqual(operation.filters, [["id", 9], ["workspace_id", 8]]);
  if (name.includes("Duplicate")) for (const key of ["category_id", "account_id", "spend_type_id", "recurrence"]) assert.notEqual(operation.payload[key], undefined);
  if (name.includes("Adjust")) assert.deepEqual(Object.keys(operation.payload).sort(), ["alert_percent", "limit_amount", "updated_by_user_id"]);
  if (deleting) assert.equal(operation.kind, "delete");
  await hook.onSettled(); assert.deepEqual(invalidations, [{ ws: 8, user: "A" }]);
  for (const data of [null, {}, [], { id: "9", workspace_id: 8 }, { id: 0, workspace_id: 8 }, { id: 9, workspace_id: 99 }, ...(!creating ? [{ id: 10, workspace_id: 8 }] : [])]) {
    reset(); override = data; await assert.rejects(hook.mutationFn(input), /No se confirmó/); assert.equal(operations.length, 1);
  }
  if (!deleting) for (const key of Object.keys(operation.payload)) {
    if (key === "workspace_id") continue;
    reset(); override = row => ({ ...row, [key]: "wrong" }); await assert.rejects(hook.mutationFn(input), /No se confirmó/);
  }
  for (const [ws, user] of [[undefined, "A"], [8, undefined], ...(/Pin|Adjust/.test(name) ? [] : [[99, "A"]])]) { reset(); await assert.rejects(hooks[name](ws, user).mutationFn(input), rules.BudgetWritePreflightError); assert.equal(operations.length, 0); }
  for (const error of [{ code: "23514" }, { code: "PGRST116" }, new Error("response lost")]) { reset(); failure = error; await assert.rejects(hook.mutationFn(input), found => found === error); assert.equal(operations.length, 1); }
}
for (const name of [names[0], names[1], names[3]]) for (const patch of [{ limitAmount: 0 }, { limitAmount: Infinity }, { limitAmount: 0.001 }, { limitAmount: true }, { alertPercent: 80.5 }, { periodStart: "2026-02-30" }, { periodEnd: "2025-10-01" }, { accountId: -1 }, { categoryId: 0 }, { spendTypeId: NaN }, { rolloverEnabled: "true" }, { recurrence: "bad" }, { name: " " }]) {
  reset(); const value = name.includes("Duplicate") ? { ...input, ...patch, budget: { ...input.budget, ...patch } } : { ...input, ...patch };
  await assert.rejects(hooks[name](8, "A").mutationFn(value), rules.BudgetWritePreflightError); assert.equal(operations.length, 0);
}
for (const name of [names[0], names[1]]) for (const patch of [{ workspaceId: 99 }, { userId: "B" }]) { reset(); await assert.rejects(hooks[name](8, "A").mutationFn({ ...input, ...patch }), rules.BudgetWritePreflightError); assert.equal(operations.length, 0); }
for (const name of [names[1], names[2], names[4], names[5], names[6]]) for (const budgetId of [undefined, 0, "9", NaN]) { reset(); await assert.rejects(hooks[name](8, "A").mutationFn({ ...input, budgetId }), rules.BudgetWritePreflightError); assert.equal(operations.length, 0); }
reset(); override = row => ({ ...row, limit_amount: "400.00", alert_percent: "80" }); assert.equal((await hooks[names[0]](8, "A").mutationFn(input)).id, 9);
for (const amount of ["", true, null, "400USD", "Infinity"]) { reset(); override = row => ({ ...row, limit_amount: amount }); await assert.rejects(hooks[names[0]](8, "A").mutationFn(input), /No se confirmó/); }
assert.equal(rules.isBudgetWriteRejected({ code: "23514" }), true); assert.equal(rules.isBudgetWriteRejected(new rules.BudgetWritePreflightError()), true);
for (const error of [new Error("lost"), { code: "PGRST116" }, { code: 20 }, null]) assert.equal(rules.isBudgetWriteRejected(error), false);
// A lost reply is bounded and not retried, even if the transport returns after abort.
const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout, timers = new Map();
globalThis.setTimeout = (fn, ms, ...args) => { if (ms !== rules.BUDGET_WRITE_TIMEOUT_MS) return originalSet(fn, ms, ...args); const token = {}; timers.set(token, fn); return token; };
globalThis.clearTimeout = id => { if (!timers.delete(id)) originalClear(id); };
for (const name of names) {
  reset(); gated = true; const pending = hooks[name](8, "A").mutationFn(input), rejected = assert.rejects(pending, /tardó demasiado/);
  for (let i = 0; i < 12; i++) await Promise.resolve(); assert.ok(finish); assert.equal(timers.size, 1); [...timers.values()][0](); await rejected;
  assert.ok(operations[0].signal.aborted); finish(); for (let i = 0; i < 12; i++) await Promise.resolve(); assert.equal(operations.length, 1); assert.equal(timers.size, 0);
}
globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear;
// The actual catalog query is user-keyed and abortable; missing auth never reads.
const queryNode = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "useBudgetSpendTypesQuery"); assert.ok(queryNode);
const queryCode = ts.transpileModule(queryNode.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
let read;
const reader = { from(table) { read = { table, filters: [] }; return {
  select() { return this; }, eq(key, value) { read.filters.push([key, value]); return this; }, order() { return this; }, abortSignal(signal) { read.signal = signal; return Promise.resolve({ data: [{ id: 3, name: "Fijo", is_active: true }, { id: 4, name: "Inactivo", is_active: false }], error: null }); },
}; } };
const queryHook = new Function("useQuery", "getClient", `${queryCode};return useBudgetSpendTypesQuery;`)(options => options, () => reader);
const query = queryHook(8, "A"), signal = new AbortController().signal;
assert.deepEqual(query.queryKey, ["budget-spend-types", 8, "A"]); assert.notDeepEqual(queryHook(8, "B").queryKey, query.queryKey); assert.equal(queryHook(8).enabled, false);
await assert.rejects(queryHook(8).queryFn({ signal }), /sesión/); assert.equal(read, undefined);
assert.deepEqual(await query.queryFn({ signal }), [{ id: 3, name: "Fijo" }]); assert.equal(read.table, "spend_types"); assert.deepEqual(read.filters, [["workspace_id", 8]]); assert.equal(read.signal, signal);
// Scope reader likewise includes auth identity and passes AbortSignal to each request.
const scopeSource = readFileSync(new URL("../src/modules/budgets/hooks/use-budget-scope-movements.ts", import.meta.url), "utf8");
const scopeAst = ts.createSourceFile("scope.ts", scopeSource, ts.ScriptTarget.Latest, true), scopeNode = scopeAst.statements.find(node => ts.isFunctionDeclaration(node)); assert.ok(scopeNode);
const scopeCode = ts.transpileModule(scopeNode.getText(scopeAst).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const { readBudgetScopeMovements } = await import(load("src/modules/budgets/lib/budget-scope-reader.ts"));
const ledger = { from(table) { read = { table, filters: [] }; return { select() { return this; }, eq(key, value) { read.filters.push([key, value]); return this; }, gte() { return this; }, lt() { return this; }, order() { return this; }, range() { return this; }, abortSignal(signal) { read.signal = signal; return Promise.resolve({ data: [], count: 0, error: null }); } }; } };
const scopeHook = new Function("useQuery", "useMemo", "supabase", "readBudgetScopeMovements", `${scopeCode};return useBudgetScopeMovements;`)(options => options, fn => fn(), ledger, readBudgetScopeMovements);
const scopeInput = { workspaceId: 8, userId: "A", budgets: [input.budget], accounts: [], categories: [], refreshKey: 1 }, scopeQuery = scopeHook(scopeInput);
assert.notDeepEqual(scopeHook({ ...scopeInput, userId: "B" }).queryKey, scopeQuery.queryKey); assert.equal(scopeHook({ ...scopeInput, userId: undefined }).enabled, false);
assert.deepEqual(await scopeQuery.queryFn({ signal }), []); assert.equal(read.signal, signal); assert.deepEqual(read.filters, [["workspace_id", 8], ["status", "posted"]]);
dom.window.close();
console.log("budget-write-results: OK (seven actual hooks/payloads, scoped identity and changed fields, preflight, timeout/late reply, errors, no retry or snapshot rollback; fake I/O, not RLS/concurrency proof)");
