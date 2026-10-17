import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { React, act, createRoot, dom, load, mock, settle } from "./lib/web-ui-harness.mjs";
const { readIncomeHistory } = await import(load("src/modules/recurring-income/lib/income-history.ts"));
const { buildIncomeHistoryAnalytics } = await import(load("src/modules/recurring-income/lib/income-history-analytics.ts"));
const raw = id => { const expected = new Date(Date.UTC(2025, 0, 1) + id * 86400000).toISOString().slice(0, 10); return { id, workspace_id: 8, recurring_income_id: 9, expected_date: expected, actual_date: expected, amount: id % 2 ? "100.00" : 100, currency_code: "PEN", movement_id: id + 1000, status: "on_time", notes: null, created_at: `${expected}T12:00:00Z` }; };
let rows, calls, parent, overrides, afterRead;
const client = { from(table) { return { table, filters: [], orders: [],
  select(columns, options) { this.columns = columns; this.options = options; return this; }, eq(key, value) { this.filters.push([key, value]); return this; }, order(key, value) { this.orders.push([key, value]); return this; }, range(from, to) { this.from = from; this.to = to; return this; }, abortSignal(signal) { this.signal = signal; return this; },
  single() { return this.execute(); }, then(resolve, reject) { return this.execute().then(resolve, reject); },
  async execute() { calls.push(this); const normal = table === "recurring_income" ? parent : { data: rows.slice(this.from, this.to + 1), error: null, count: rows.length }; afterRead?.(this); return overrides.has(this.from) && table !== "recurring_income" ? overrides.get(this.from)(normal) : normal; },
}; } };
function reset(count = 501) { rows = Array.from({ length: count }, (_, i) => raw(i + 1)).reverse(); calls = []; parent = { data: { id: 9, workspace_id: 8 }, error: null }; overrides = new Map(); afterRead = null; }
const read = (signal = new AbortController().signal) => readIncomeHistory(client, 8, 9, "A", signal);
reset(); let result = await read(); assert.equal(result.length, 501); assert.deepEqual(calls.map(call => call.table), ["recurring_income", "recurring_income_occurrences", "recurring_income_occurrences"]); assert.equal(calls[2].from, 500);
for (const call of calls.slice(1)) { assert.deepEqual(call.filters, [["workspace_id", 8], ["recurring_income_id", 9]]); assert.equal(call.options.count, "exact"); assert.deepEqual(call.orders.map(order => order[0]), ["actual_date", "created_at", "id"]); assert.ok(call.signal instanceof AbortSignal); }
for (const count of [0, 1, 200, 500, 501, 1001]) { reset(count); assert.equal((await read()).length, count); }
for (const data of [null, { id: 9, workspace_id: 99 }, { id: 10, workspace_id: 8 }]) { reset(); parent.data = data; await assert.rejects(read(), /comprobar el ingreso/); assert.equal(calls.length, 1); }
for (const count of [null, undefined, "501", -1, 0.5]) { reset(); overrides.set(0, normal => ({ ...normal, count })); await assert.rejects(read(), /historial completo/); }
reset(); overrides.set(500, normal => ({ ...normal, count: 502 })); await assert.rejects(read(), /historial completo/);
reset(); overrides.set(500, normal => ({ ...normal, data: [] })); await assert.rejects(read(), /incompleto/);
reset(); rows[500] = { ...rows[500], id: rows[0].id }; await assert.rejects(read(), /referencias por comprobar/);
for (const patch of [{ workspace_id: 99 }, { recurring_income_id: 10 }, { expected_date: "2026-02-30" }, { actual_date: null }, { actual_date: "bad" }, { amount: null }, { amount: true }, { amount: "" }, { amount: -1 }, { amount: 1.001 }, { currency_code: "??" }, { movement_id: 0 }, { status: "unknown" }, { notes: {} }, { created_at: "bad" }]) {
  reset(1); rows[0] = { ...rows[0], ...patch }; await assert.rejects(read(), /por comprobar/);
}
reset(1); rows[0] = { ...rows[0], status: "missed", amount: 0, actual_date: null, movement_id: null, created_at: null }; result = await read(); assert.equal(result[0].amount, 0); assert.equal(result[0].createdAt, ""); assert.equal(result[0].status, "missed");
for (const phase of ["recurring_income", "recurring_income_occurrences"]) { reset(); const error = { code: "42P01", message: "recurring_income_occurrences missing" }; if (phase === "recurring_income") parent = { data: null, error }; else overrides.set(0, () => ({ data: null, error })); await assert.rejects(read(), found => found === error); }
const cancelled = new AbortController(); cancelled.abort(); reset(); await assert.rejects(read(cancelled.signal)); assert.equal(calls.length, 0);
for (const table of ["recurring_income", "recurring_income_occurrences"]) { reset(); const controller = new AbortController(); afterRead = query => { if (query.table === table) controller.abort(); }; await assert.rejects(read(controller.signal)); assert.equal(calls.length, table === "recurring_income" ? 1 : 2); }

// Execute the actual query options as well, not only its reader.
const text = readFileSync(new URL("../src/services/queries/workspace-data.ts", import.meta.url), "utf8"), ast = ts.createSourceFile("workspace.ts", text, ts.ScriptTarget.Latest, true), node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "useRecurringIncomeOccurrencesQuery");
const js = ts.transpileModule(node.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const hook = new Function("useQuery", "getClient", "readIncomeHistory", `${js};return useRecurringIncomeOccurrencesQuery;`)(options => options, () => client, readIncomeHistory);
assert.deepEqual(hook(8, 9, "A").queryKey, ["recurring_income_occurrences", 8, "A", 9]); assert.notDeepEqual(hook(8, 9, "A").queryKey, hook(8, 9, "B").queryKey); assert.equal(hook(8, 9, "A").staleTime, 0);
for (const args of [[8, 9, undefined], [undefined, 9, "A"], [8, 0, "A"], [8, NaN, "A"]]) assert.equal(hook(...args).enabled, false);
reset(501); assert.equal((await hook(8, 9, "A").queryFn({ signal: new AbortController().signal })).length, 501);

// The real mobile analytics/date/currency functions are the comparison source (read-only).
function extract(path, names) { const source = readFileSync(new URL(path, import.meta.url), "utf8"), tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true); return ts.transpileModule(tree.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(tree).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; }
const require = createRequire(new URL("../../DarkMoneyApp/package.json", import.meta.url)), dates = require("date-fns"), es = require("date-fns/locale").es;
const nativeConvert = new Function(`${extract("../../DarkMoneyApp/lib/subscription-helpers.ts", ["convertAmountToWorkspaceBase"])};return convertAmountToWorkspaceBase;`)();
const nativeBreakdown = new Function(`${extract("../../DarkMoneyApp/lib/analytics-currency.ts", ["buildCurrencyBreakdown"])};return buildCurrencyBreakdown;`)();
const nativeDate = new Function("YMD_ONLY_RE", `${extract("../../DarkMoneyApp/lib/date.ts", ["parseDisplayDate"])};return parseDisplayDate;`)(/^\d{4}-\d{2}-\d{2}$/);
const nativeAnalytics = new Function("differenceInCalendarDays", "format", "subMonths", "es", "buildCurrencyBreakdown", "parseDisplayDate", "convertAmountToWorkspaceBase", `${extract("../../DarkMoneyApp/features/recurring-income/lib/buildRecurringIncomeAnalytics.ts", ["buildRecurringIncomeAnalytics"])};return buildRecurringIncomeAnalytics;`)(dates.differenceInCalendarDays, dates.format, dates.subMonths, es, nativeBreakdown, nativeDate, nativeConvert);
const closeNumber = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${label}: ${actual} vs ${expected}`); // Multiplication by an inverse can differ from division by a few binary ULPs, far below a cent.
const sample = [
  { id: 1, workspaceId: 8, recurringIncomeId: 9, expectedDate: "2026-10-02", actualDate: "2026-10-02", amount: 100, currencyCode: "PEN", status: "on_time", createdAt: "2026-10-02T12:00:00Z", notes: null, movementId: 400 },
  { id: 2, workspaceId: 8, recurringIncomeId: 9, expectedDate: "2026-10-01", actualDate: "2026-10-03", amount: 20, currencyCode: "USD", status: "late", createdAt: "2026-10-03T12:00:00Z", notes: null, movementId: 401 },
  { id: 3, workspaceId: 8, recurringIncomeId: 9, expectedDate: "2026-10-04", actualDate: "2026-10-05", amount: 10, currencyCode: "EUR", status: "late", createdAt: "2026-10-05T12:00:00Z", notes: null, movementId: 402 },
];
const rate = { fromCurrencyCode: "USD", toCurrencyCode: "PEN", rate: 3.5, effectiveAt: "2026-10-01" };
let comparisons = 0;
for (const today of ["2026-10-17", "2027-01-01", "2024-02-29"]) for (const base of ["PEN", "USD"]) for (const rates of [[], [rate], [{ ...rate, fromCurrencyCode: "PEN", toCurrencyCode: "USD", rate: 1 / 3.5 }], [rate, { ...rate, fromCurrencyCode: "EUR", rate: 4 }]]) {
  const [y, m, d] = today.split("-").map(Number); const expected = nativeAnalytics(sample, base, rates, new Date(y, m - 1, d, 12)), actual = buildIncomeHistoryAnalytics(sample, base, rates, today);
  for (const key of ["comparableTotal", "comparableCount", "averageBase", "onTimeCount", "lateCount", "averageLateDays", "punctualityPct"]) closeNumber(actual[key], expected[key], key);
  assert.deepEqual(actual.rows.map(row => [row.id, row.latenessDays]), expected.rows.map(row => [row.id, row.latenessDays]));
  actual.rows.forEach((row, index) => { const expectedAmount = expected.rows[index].amountInBaseCurrency; if (expectedAmount === null) assert.equal(row.amountInBaseCurrency, null); else closeNumber(row.amountInBaseCurrency, expectedAmount, "converted row"); });
  assert.deepEqual(actual.months.map(month => [month.key, month.count]), expected.months.map(month => [month.key, month.count])); actual.months.forEach((month, index) => closeNumber(month.amount, expected.months[index].total, "month")); comparisons++;
}
assert.equal(buildIncomeHistoryAnalytics([...sample, { ...sample[0], id: 4, status: "missed", amount: 999, actualDate: null }], "PEN", [rate], "2026-10-17").comparableTotal, 170);
assert.equal(buildIncomeHistoryAnalytics(sample, "PEN", [{ ...rate, rate: Infinity }], "2026-10-17").excludedCount, 2);
assert.equal(buildIncomeHistoryAnalytics([], "PEN", [], "2026-10-31").months.at(-1).key, "2026-10");

// Real dialog: no stale/failed/foreign totals or annotations, no mixed currencies relabelled as soles.
globalThis.historyQuery = { data: sample, isSuccess: true, isFetching: false, isPlaceholderData: false, error: null, refetch: async () => { retries++; } };
mock("src/services/queries/workspace-data.ts", "export const useRecurringIncomeOccurrencesQuery=()=>globalThis.historyQuery;");
const { IncomeHistoryDialog } = await import(load("src/modules/recurring-income/components/income-history-dialog.tsx"));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container); let retries = 0; const opened = [], annotations = [];
const originalNow = Date.now; Date.now = () => Date.parse("2026-10-17T16:00:00Z");
const props = { income: { id: 9, workspaceId: 8, name: "Sueldo", amount: 100, currencyCode: "PEN", frequency: "monthly", intervalCount: 1, status: "active", nextExpectedDate: "2026-10-31" }, workspaceId: 8, userId: "A", baseCurrencyCode: "PEN", exchangeRates: [rate], sourceReady: true, canWrite: false, isPending: false, onClose() {}, onConfirm: date => annotations.push(date), onOpenMovement: id => opened.push(id) };
async function render(patch = {}, query = {}) { Object.assign(globalThis.historyQuery, query); await act(async () => renderer.render(React.createElement(IncomeHistoryDialog, { ...props, ...patch }))); await settle(); }
const button = label => [...container.querySelectorAll("button")].find(node => node.textContent === label);
await render(); assert.match(container.textContent, /170\.00/); assert.match(container.textContent, /1 sin conversión no suma/); assert.equal(button("Anotar llegada"), undefined);
await act(async () => container.querySelector('button[aria-label="Ver movimiento de llegada 3"]').click()); assert.deepEqual(opened, [402]); await act(async () => button("Análisis").click()); assert.match(container.textContent, /85\.00/); assert.match(container.textContent, /1\.5 días/);
const bars = [...container.querySelectorAll("button span")].filter(node => node.style.height); assert.equal(bars.length, 12); assert.ok(bars.some(node => node.style.height === "0px"));
for (const query of [{ error: new Error("failed page") }, { isFetching: true }, { isPlaceholderData: true }, { data: undefined }, { data: [{ ...sample[0], workspaceId: 99 }] }]) {
  await render({ canWrite: true }, { data: sample, error: null, isFetching: false, isPlaceholderData: false, ...query }); assert.doesNotMatch(container.textContent, /Recibido en este historial|Promedio comparable|Anotar llegada/);
}
await render({}, { data: sample, error: new Error("failed") }); await act(async () => button("Reintentar historial").click()); assert.equal(retries, 1);
await render({ sourceReady: false }, { error: null }); assert.match(container.textContent, /Comprobando historial/); assert.doesNotMatch(container.textContent, /Recibido en este historial/);
await render({ canWrite: true, income: { ...props.income, nextExpectedDate: "2026-10-02" } }, { data: sample }); assert.match(container.textContent, /calendario no avanzó/); assert.equal(button("Anotar llegada"), undefined);
await render({ canWrite: true, income: { ...props.income, nextExpectedDate: "2026-09-01" } }); await act(async () => button("Llegadas").click()); await act(async () => button("Anotar llegada").click()); assert.deepEqual(annotations, ["2026-09-01"]);
await act(async () => button("Llegadas").click()); const many = Array.from({ length: 30 }, (_, i) => ({ ...sample[0], id: i + 1, movementId: i + 1000 })); await render({}, { data: many }); assert.ok(button("Ver los 25 restantes")); await act(async () => button("Ver los 25 restantes").click()); assert.equal(container.querySelectorAll('button[aria-label^="Ver movimiento de llegada"]').length, 30);
await act(async () => renderer.unmount()); container.remove(); Date.now = originalNow; dom.window.close();
console.log(`recurring-income-history: OK (actual reader/query/dialog, complete 0–1001 rows and invalid/cancelled pages; ${comparisons} original mobile analytics comparisons, FX/native amounts, Lima/leap/months, missed excluded, no stale/foreign totals, annotation conflict, retry/expansion/links; fake IO, not server/RLS)`);
