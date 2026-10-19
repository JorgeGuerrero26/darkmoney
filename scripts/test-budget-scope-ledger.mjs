import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { React, act, createRoot, dom, load, mock, settle, MemoryRouter } from "./lib/web-ui-harness.mjs";
const { readBudgetScopeMovements } = await import(load("src/modules/budgets/lib/budget-scope-reader.ts"));
const { buildBudgetComputedMetrics } = await import(load("src/modules/budgets/lib/budget-metrics.ts"));
const budget = { id: 9, workspaceId: 8, name: "Comida", periodStart: "2026-09-01", periodEnd: "2026-09-30", currencyCode: "PEN", limitAmount: 500, alertPercent: 80, categoryId: null, accountId: null, spendTypeId: null, rolloverEnabled: false, recurrence: "none", isActive: true, isPinned: false, scopeLabel: "Todo el gasto", spentAmount: 999999, remainingAmount: -999999, usedPercent: 99999, movementCount: 1 };
const accounts = [{ id: 1, workspaceId: 8, name: "Principal", currencyCode: "PEN", isArchived: true }, { id: 2, workspaceId: 8, name: "Dólares", currencyCode: "USD", isArchived: false }];
const categories = [{ id: 7, name: "Comida", defaultSpendTypeId: 2, isActive: true, kind: "expense" }];
const input = { workspaceId: 8, userId: "A", budgets: [budget], accounts, categories };
const raw = id => ({ id, workspace_id: 8, status: "posted", movement_type: "expense", occurred_at: new Date(Date.parse("2026-09-01T05:00:00Z") + id * 60_000).toISOString(), description: id % 17 ? "Cena" : null, category_id: 7, spend_type_id: null, category: { id: 7, workspace_id: 8, name: "Comida", default_spend_type_id: 2 }, source_account_id: 1, source_amount: id % 2 ? "1.00" : 1, destination_account_id: null, destination_amount: null, source_account: { name: "Principal", currency_code: "PEN" }, destination_account: null });
let rows, calls, overrides, afterRead;
const client = { from(table) { assert.equal(table, "movements"); return {
  filters: [], orders: [], select(columns, options) { this.columns = columns; this.options = options; return this; }, eq(key, value) { this.filters.push(["eq", key, value]); return this; }, gte(key, value) { this.filters.push(["gte", key, value]); return this; }, lt(key, value) { this.filters.push(["lt", key, value]); return this; }, lte(key, value) { this.filters.push(["lte", key, value]); return this; },
  order(key, value) { this.orders.push([key, value]); return this; }, range(from, to) { this.from = from; this.to = to; return this; }, abortSignal(signal) { this.signal = signal; return this; },
  then(resolve, reject) { return this.execute().then(resolve, reject); }, async execute() { calls.push(this); const normal = { data: rows.slice(this.from, this.to + 1), count: rows.length, error: null }; afterRead?.(this); return overrides.has(this.from) ? overrides.get(this.from)(normal) : normal; },
}; } };
function reset(count = 501) { rows = Array.from({ length: count }, (_, i) => raw(i + 1)).reverse(); calls = []; overrides = new Map(); afterRead = null; }
const read = (signal = new AbortController().signal, patch = {}) => readBudgetScopeMovements(client, { ...input, ...patch }, signal);
for (const count of [0, 1, 499, 500, 501, 1000, 1001, 1500]) {
  reset(count); const actual = await read(); assert.equal(actual.length, count); assert.equal(calls.length, Math.max(1, Math.ceil(count / 500))); assert.equal(actual.filter(row => row.status === "posted" && row.workspaceId === 8).length, count);
  for (const query of calls) { assert.equal(query.options.count, "exact"); assert.ok(query.signal instanceof AbortSignal); assert.deepEqual(query.filters, [["eq", "workspace_id", 8], ["eq", "status", "posted"], ["gte", "occurred_at", "2026-09-01T05:00:00.000Z"], ["lt", "occurred_at", "2026-10-01T05:00:00.000Z"]]); assert.deepEqual(query.orders.map(o => o[0]), ["occurred_at", "id"]); }
  assert.equal(buildBudgetComputedMetrics(budget, actual, { workspaceBaseCurrencyCode: "PEN", exchangeRates: [] }).spentAmount, count);
}
for (const count of [undefined, null, "501", -1, 0.5, Infinity]) { reset(); overrides.set(0, normal => ({ ...normal, count })); await assert.rejects(read(), /conteo completo/); }
reset(); overrides.set(500, normal => ({ ...normal, count: 502 })); await assert.rejects(read(), /conteo completo/);
for (const data of [null, [], [raw(999)], Array.from({ length: 501 }, (_, i) => raw(i + 1))]) { reset(); overrides.set(0, normal => ({ ...normal, data })); await assert.rejects(read(), /conteo completo|incompletos/); }
reset(); overrides.set(500, normal => ({ ...normal, data: [] })); await assert.rejects(read(), /incompletos/);
reset(); rows[500] = { ...rows[0] }; await assert.rejects(read(), /por comprobar/);
reset(2); rows.reverse(); await assert.rejects(read(), /por comprobar/);
for (const patch of [{ id: "1" }, { id: 0 }, { workspace_id: 99 }, { workspace_id: undefined }, { status: "pending" }, { status: undefined }, { movement_type: "mystery" }, { occurred_at: "2026-02-30T12:00:00Z" }, { occurred_at: "2026-09-01T24:00:00Z" }, { occurred_at: "2026-09-01T12:00:00" }, { occurred_at: "2026-08-31T12:00:00Z" }, { occurred_at: "2026-10-01T05:00:00Z" }, { description: {} }, { category_id: 0 }, { spend_type_id: false }, { source_amount: null }, { source_amount: undefined }, { source_amount: true }, { source_amount: "" }, { source_amount: "1PEN" }, { source_amount: 0.001 }, { source_amount: NaN }, { source_amount: Infinity }, { source_amount: 1e20 }, { source_account_id: null }, { source_account_id: 99 }, { destination_account_id: 99 }, { category: null }, { category: [{ id: 7, workspace_id: 8 }] }, { category: { id: 8, workspace_id: 8, default_spend_type_id: 2 } }, { category: { id: 7, workspace_id: 99, default_spend_type_id: 2 } }, { category: { id: 7, workspace_id: 8, default_spend_type_id: 0 } }]) {
  reset(1); rows[0] = { ...rows[0], ...patch }; await assert.rejects(read(), /por comprobar/);
}
reset(1); rows[0].category.default_spend_type_id = 3; await assert.rejects(read(), /categoría cambió/);
for (const patch of [{ workspaceId: 0 }, { workspaceId: 99 }, { userId: "" }, { budgets: [{ ...budget, id: 0 }] }, { budgets: [budget, budget] }, { budgets: [{ ...budget, periodStart: "2026-02-30" }] }, { budgets: [{ ...budget, periodEnd: "2025-01-01" }] }, { accounts: [{ ...accounts[0], workspaceId: 99 }] }, { accounts: [accounts[0], accounts[0]] }, { accounts: [{ ...accounts[0], currencyCode: "??" }] }, { categories: [categories[0], categories[0]] }]) { reset(); await assert.rejects(read(undefined, patch)); assert.equal(calls.length, 0); }
reset(); assert.deepEqual(await read(undefined, { budgets: [] }), []); assert.equal(calls.length, 0);
// No fallback from a failed/absent table/page to a verified empty history.
for (const from of [0, 500]) for (const code of ["42P01", "42501", "NETWORK_ERROR"]) { reset(); const error = { code }; overrides.set(from, () => ({ data: null, error, count: null })); await assert.rejects(read(), actual => actual === error); }
const cancelled = new AbortController(); cancelled.abort(); reset(); await assert.rejects(read(cancelled.signal)); assert.equal(calls.length, 0);
for (const page of [0, 500]) { reset(); const controller = new AbortController(); afterRead = query => { if (query.from === page) controller.abort(); }; await assert.rejects(read(controller.signal)); assert.equal(calls.length, page === 0 ? 1 : 2); }
reset(1); rows[0] = { ...raw(1), source_amount: "-12.30" }; assert.equal((await read())[0].sourceAmount, -12.3); // Native signed adjustment/legacy semantics are not silently recast.
reset(1); rows[0] = { ...raw(1), category_id: null, category: null }; assert.equal((await read())[0].categoryDefaultSpendTypeId, null);
reset(2); rows = [{ ...raw(1), occurred_at: "2026-10-01T04:59:59.999999Z" }, { ...raw(2), occurred_at: "2026-10-01T04:59:59.999000Z" }]; assert.deepEqual((await read()).map(row => row.id), [1, 2]); // Full last microsecond; order is by timestamp precision before ID.
reset(2); rows = [{ ...raw(2), occurred_at: "2026-09-30T23:59:59.900-05:00" }, { ...raw(1), occurred_at: "2026-10-01T04:59:59.900Z" }]; assert.equal((await read()).length, 2);

// Run the actual native online reader and model for valid evidence (read-only source extraction).
function extract(path, names) { const source = readFileSync(new URL(path, import.meta.url), "utf8"), ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true); const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text)); assert.equal(nodes.length, names.length); return ts.transpileModule(nodes.map(n => n.getText(ast).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; }
const nativeDates = new Function("YMD_ONLY_RE", "PERU_OFFSET_MS", `${extract("../../DarkMoneyApp/lib/date.ts", ["filterDateFrom", "filterDateTo", "isoToDateStr"])};return {filterDateFrom,filterDateTo,isoToDateStr};`)(/^\d{4}-\d{2}-\d{2}$/, 5 * 3600_000);
const nativeDirections = new Function(`${extract("../../DarkMoneyApp/lib/movement-amounts.ts", ["toNumber", "movementIsTransfer", "movementActsAsIncome", "movementActsAsExpense"])};return {movementIsTransfer,movementActsAsExpense};`)();
const nativeReader = new Function("offlineRuntime", "buildLocalBudgetScopeMovements", "supabase", "filterDateFrom", "filterDateTo", "displayCategoryName", "PAGE_SIZE", `${extract("../../DarkMoneyApp/services/queries/budget-analytics.ts", ["fetchBudgetScopeMovements"])};return fetchBudgetScopeMovements;`)({ listRows: async () => null }, () => { throw Error("No mobile offline engine is invoked"); }, client, nativeDates.filterDateFrom, nativeDates.filterDateTo, text => text, 500);
const nativeMetrics = new Function("isoToDateStr", "movementIsTransfer", "movementActsAsExpense", `${extract("../../DarkMoneyApp/lib/budget-metrics.ts", ["round2", "normalizeCurrency", "buildRateMap", "resolveRate", "convertAmount", "readExpenseSide", "movementMatchesBudget", "buildBudgetComputedMetrics"])};return buildBudgetComputedMetrics;`)(nativeDates.isoToDateStr, nativeDirections.movementIsTransfer, nativeDirections.movementActsAsExpense);
const projectedKeys = ["id", "movementType", "occurredAt", "description", "categoryId", "categoryName", "spendTypeId", "categoryDefaultSpendTypeId", "sourceAccountId", "sourceAccountName", "sourceCurrencyCode", "sourceAmount", "destinationAccountId", "destinationAccountName", "destinationCurrencyCode", "destinationAmount"];
let comparisons = 0;
for (const count of [0, 1, 500, 501, 1001]) {
  reset(count); const web = await read(), mobile = await nativeReader(8, budget.periodStart, budget.periodEnd);
  assert.deepEqual(web.map(row => Object.fromEntries(projectedKeys.map(key => [key, key === "categoryName" ? row.category : row[key]]))), mobile.map(row => Object.fromEntries(projectedKeys.map(key => [key, key === "description" ? row.description ?? "" : row[key]]))));
  for (const categoryId of [null, 7, 8]) for (const spendTypeId of [null, 1, 2]) for (const accountId of [null, 1, 2]) {
    const target = { ...budget, categoryId, spendTypeId, accountId }, context = { workspaceBaseCurrencyCode: "PEN", exchangeRates: [] };
    assert.deepEqual(buildBudgetComputedMetrics(target, web, context), nativeMetrics(target, mobile, context)); comparisons++;
  }
}

// Actual query configuration: user/period identity, no cross-context placeholder, cancellation.
const hookSource = readFileSync(new URL("../src/modules/budgets/hooks/use-budget-scope-movements.ts", import.meta.url), "utf8"), hookAst = ts.createSourceFile("scope.ts", hookSource, ts.ScriptTarget.Latest, true);
const node = hookAst.statements.find(n => ts.isFunctionDeclaration(n));
const code = ts.transpileModule(node.getText(hookAst).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const hook = new Function("useQuery", "useMemo", "supabase", "readBudgetScopeMovements", `${code};return useBudgetScopeMovements;`)(options => options, fn => fn(), client, readBudgetScopeMovements);
const query = hook({ ...input, refreshKey: 1 }); assert.equal(query.staleTime, 0); assert.equal(query.placeholderData, undefined);
for (const patch of [{ userId: "B" }, { budgets: [{ ...budget, periodEnd: "2026-10-31" }] }, { budgets: [{ ...budget, id: 10 }] }, { refreshKey: 2 }]) assert.notDeepEqual(hook({ ...input, refreshKey: 1, ...patch }).queryKey, query.queryKey);
for (const patch of [{ userId: undefined }, { workspaceId: undefined }, { budgets: [] }]) assert.equal(hook({ ...input, refreshKey: 1, ...patch }).enabled, false);
reset(501); assert.equal((await query.queryFn({ signal: new AbortController().signal })).length, 501);

// Real page/detail/CSV: complete 1001 rows, not the SQL view or the first 50/500; no stale totals.
reset(1001); const ledger = await read(); let retries = 0, exports = 0, csv = "";
globalThis.budgetLedgerQuery = { data: ledger, isSuccess: true, isFetching: false, isPlaceholderData: false, error: null };
globalThis.budgetLedgerSnapshot = { data: { workspace: { id: 8, baseCurrencyCode: "PEN" }, budgets: [budget], accounts, catalogs: { categories }, exchangeRates: [] }, isSuccess: true, isFetching: false, isPlaceholderData: false, dataUpdatedAt: 1, refetch: async () => { retries++; } };
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:{id:'A'}});");
mock("src/modules/workspaces/use-active-workspace.ts", "export const useActiveWorkspace=()=>({activeWorkspace:{id:8,baseCurrencyCode:'PEN',role:'viewer',isArchived:false},isLoading:false,isFetching:false});");
mock("src/modules/budgets/hooks/use-budget-scope-movements.ts", "export const useBudgetScopeMovements=()=>globalThis.budgetLedgerQuery;");
mock("src/services/queries/workspace-data.ts", "const mutation=()=>({isPending:false,mutateAsync:()=>{throw Error('Financial writes forbidden in reader test');}});export const useCreateBudgetMutation=mutation,useUpdateBudgetMutation=mutation,useAdjustBudgetLimitMutation=mutation,useDeleteBudgetMutation=mutation,usePinBudgetMutation=mutation,useDuplicateBudgetMutation=mutation;export const useWorkspaceSnapshotQuery=()=>globalThis.budgetLedgerSnapshot,useBudgetSpendTypesQuery=()=>({data:[],isSuccess:true,isFetching:false});export const getQueryErrorMessage=e=>e?.message??'read failed';");
mock("src/components/ui/undo-queue.tsx", "const cancel=()=>{},schedule=()=>{throw Error('No deletes in reader test');};export const useUndoQueue=()=>({cancel,schedule});");
const { BudgetsPage } = await import(load("src/modules/budgets/pages/budgets-overview-page.tsx"));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const find = label => [...container.querySelectorAll("button")].find(node => node.textContent.trim() === label);
async function render(query = {}) { Object.assign(globalThis.budgetLedgerQuery, query); await act(async () => renderer.render(React.createElement(MemoryRouter, null, React.createElement(BudgetsPage)))); await settle(); }
async function click(label) { assert.ok(find(label), label); await act(async () => find(label).click()); await settle(); }
const originalUrl = URL.createObjectURL, originalRevoke = URL.revokeObjectURL, originalAnchor = dom.window.HTMLAnchorElement.prototype.click;
URL.createObjectURL = blob => { blob.text().then(value => { csv = value; }); return "blob:budgets-test"; }; URL.revokeObjectURL = () => {}; dom.window.HTMLAnchorElement.prototype.click = () => { exports++; };
await render(); await act(async () => container.querySelector('button[aria-label="Más acciones"]').click()); await click("Exportar CSV"); assert.equal(exports, 1); assert.match(csv, /"1001"/); assert.doesNotMatch(csv, /999999/);
const closed = [...container.querySelectorAll("button")].find(node => node.textContent.includes("Períodos cerrados")); await act(async () => closed.click()); await settle();
const rule = [...container.querySelectorAll("button")].find(node => node.querySelector("span span")?.textContent === "Comida"); assert.ok(rule); await act(async () => rule.click()); await settle(); assert.match(container.textContent, /1,001\.00/); assert.doesNotMatch(container.textContent, /999,999/);
await click("Ver los 1001"); assert.equal(container.querySelectorAll('[role="dialog"] button').length > 50, true); assert.match(container.textContent, /951 movimientos más/);
await render({ isFetching: true }); assert.doesNotMatch(container.textContent, /1,001\.00|951 movimientos más/); assert.match(container.textContent, /Comprobando el consumo/);
await act(async () => container.querySelector('button[aria-label="Más acciones"]').click()); assert.equal(find("Exportar CSV").disabled, true); await click("Exportar CSV"); assert.equal(exports, 1);
await render({ isFetching: false, error: new Error("Missing ledger page") }); assert.doesNotMatch(container.textContent, /1,001\.00/); await act(async () => container.querySelector('button[aria-label="Cerrar formulario"]').click()); await settle(); assert.match(container.textContent, /No se pudo calcular el consumo/); await click("Reintentar consumo"); assert.equal(retries, 1);
await render({ error: null }); assert.doesNotMatch(container.textContent, /No se pudo calcular el consumo/);
await act(async () => renderer.unmount()); container.remove(); URL.createObjectURL = originalUrl; URL.revokeObjectURL = originalRevoke; dom.window.HTMLAnchorElement.prototype.click = originalAnchor; dom.window.close();
console.log(`budget-scope-ledger: OK (complete 0–1500 counted pages, invalid/scope/duplicate/reference/order/money/date/abort guards; ${comparisons} actual native reader/model comparisons, microsecond Lima boundary, real page/detail/1001-row CSV/stale/error/retry; local fixtures, not RLS/server snapshot/FX certification)`);
