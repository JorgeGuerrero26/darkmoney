import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
import React, { act } from "react";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobile = resolve(root, "../DarkMoneyApp");
const webRequire = createRequire(resolve(root, "package.json"));
const mobileRequire = createRequire(resolve(mobile, "package.json"));
const virtual = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const mocked = new Map([
  [resolve(root, "src/services/queries/day-attachment-counts.ts"), virtual("export const useDayAttachmentCounts=()=>globalThis.dayAttachments;")],
  [resolve(mobile, "lib/supabase.ts"), virtual("export const supabase=null;")],
]);
function load(file) {
  if (mocked.has(file)) return mocked.get(file);
  let js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  js = js.replace(/from "([^"]+)"/g, (_, specifier) => {
    if (!specifier.startsWith(".")) return `from "${pathToFileURL(webRequire.resolve(specifier)).href}"`;
    const base = resolve(dirname(file), specifier);
    const dependency = [base, `${base}.tsx`, `${base}.ts`].find(existsSync);
    assert.ok(dependency, specifier);
    return `from "${load(dependency)}"`;
  });
  const url = virtual(js); mocked.set(file, url); return url;
}
const modelFile = resolve(root, "src/modules/notifications/lib/day-movements-model.ts");
const mobileModelFile = resolve(mobile, "features/dashboard/lib/day-movements-model.ts");
assert.equal(readFileSync(modelFile, "utf8"), readFileSync(mobileModelFile, "utf8"));
const webModel = await import(load(modelFile));
const mobileModel = await import(load(mobileModelFile));
const mobileDirections = await import(load(resolve(mobile, "lib/movement-amounts.ts")));
const ctx = { displayCurrency: "PEN", baseCurrency: "PEN", exchangeRateMap: new Map([["USD:PEN", 3.75]]) };
const movement = (id, patch = {}) => ({
  id, workspaceId: 8, movementType: "expense", status: "posted", occurredAt: "2026-09-30T17:00:00Z", description: `Pago ${id}`,
  sourceAmount: 10, destinationAmount: null, sourceCurrencyCode: "PEN", destinationCurrencyCode: null,
  sourceAccountName: "Principal", sourceAccountId: 1, destinationAccountName: null, destinationAccountId: null,
  category: "Transporte", counterparty: "", ...patch,
});
const fixtures = [
  movement(1), movement(2, { movementType: "income", sourceAmount: null, destinationAmount: 100, destinationCurrencyCode: "PEN" }),
  movement(3, { movementType: "obligation_payment", sourceAmount: null, destinationAmount: 20, destinationCurrencyCode: "PEN" }),
  movement(4, { movementType: "refund", sourceAmount: null, destinationAmount: 5, destinationCurrencyCode: "PEN" }),
  movement(5, { movementType: "subscription_payment", sourceAmount: 15 }),
  movement(6, { movementType: "transfer", sourceAmount: 1000, destinationAmount: 250, destinationCurrencyCode: "USD", destinationAccountId: 2, destinationAccountName: "Dólares" }),
  movement(7, { sourceAmount: 4, sourceCurrencyCode: "USD" }),
  movement(8, { sourceAmount: 30, sourceCurrencyCode: "EUR" }),
  movement(9, { sourceAmount: null, destinationAmount: 3, destinationCurrencyCode: "PEN" }),
  movement(10, { sourceCurrencyCode: null }), movement(11, { movementType: "obligation_opening", sourceAmount: 900 }),
  movement(12, { status: "pending" }), movement(13, { status: "planned" }), movement(14, { status: "void" }),
  movement(15, { occurredAt: "2026-10-01T04:59:59.999Z" }), movement(16, { occurredAt: "2026-10-01T05:00:00Z" }),
  movement(17, { occurredAt: "bad" }), movement(18, { sourceAmount: NaN }), movement(19, { sourceAmount: 0 }),
];
for (const displayCurrency of ["PEN", "USD", "EUR"]) {
  const input = { ...ctx, displayCurrency, exchangeRateMap: new Map([["USD:PEN", 3.75], ["PEN:EUR", 0.25]]) };
  assert.deepEqual(webModel.buildDayMovements(fixtures, "2026-09-30", input), mobileModel.buildDayMovements(fixtures, "2026-09-30", input));
}
for (const type of ["income", "expense", "transfer", "refund", "subscription_payment", "obligation_payment", "adjustment"]) {
  for (const source of [0, 10, null]) for (const destination of [0, 20, null]) {
    const row = movement(1, { movementType: type, sourceAmount: source, destinationAmount: destination });
    assert.equal(webModel.dayMovementKind(row), type === "transfer" ? "transfer" : mobileDirections.movementActsAsIncome(row) ? "income" : "expense");
  }
}
for (const invalid of ["2026-02-30", "2026-13-01", "bad", "2026-1-1", "2026-01-00"]) assert.throws(() => webModel.dayMovementBounds(invalid), /inválido/);
assert.deepEqual(webModel.dayMovementBounds("2024-02-29"), { from: "2024-02-29T05:00:00.000Z", until: "2024-03-01T05:00:00.000Z" });

// Execute the actual mobile service against paginated, scoped reads, including a failed later page.
const { fetchDashboardDayMovements } = await import(load(resolve(mobile, "services/queries/dashboard-day.ts")));
const databaseRows = Array.from({ length: 1003 }, (_, index) => ({ id: index + 1, movement_type: "expense", status: "posted", occurred_at: "2020-01-01T12:00:00Z", source_amount: "2.10", destination_amount: null, source_account_id: 4, description: "Historical" }));
function clientFor(rows, failAt = -1) {
  const calls = [];
  return { calls, from(table) {
    const call = { table, filters: [], order: [] }; calls.push(call);
    const query = {
      select(value, options) { call.select = value; call.selectOptions = options; return this; }, eq(...v) { call.filters.push(["eq", ...v]); return this; },
      gte(...v) { call.filters.push(["gte", ...v]); return this; }, lt(...v) { call.filters.push(["lt", ...v]); return this; },
      order(...v) { call.order.push(v); return this; }, range(from, to) { call.range = [from, to]; return this; },
      abortSignal(signal) { call.signal = signal; return this; },
      then(ok, fail) { return Promise.resolve({ count: rows.length, data: call.range[0] === failAt ? null : rows.slice(call.range[0], call.range[1] + 1), error: call.range[0] === failAt ? { message: "Network failed" } : null }).then(ok, fail); },
    }; return query;
  } };
}
const db = clientFor(databaseRows); const signal = new AbortController().signal;
const fullDay = await fetchDashboardDayMovements(db, 8, "2020-01-01", signal);
assert.equal(fullDay.length, 1003); assert.equal(fullDay[0].sourceAmount, 2.1); assert.equal(fullDay[0].destinationAmount, null);
assert.equal(db.calls.length, 3);
for (const call of db.calls) {
  assert.equal(call.table, "movements"); assert.equal(call.signal, signal);
  assert.deepEqual(call.selectOptions, { count: "exact" });
  assert.deepEqual(call.filters, [["eq", "workspace_id", 8], ["eq", "status", "posted"], ["gte", "occurred_at", "2020-01-01T05:00:00.000Z"], ["lt", "occurred_at", "2020-01-02T05:00:00.000Z"]]);
}
await assert.rejects(fetchDashboardDayMovements(clientFor(databaseRows, 500), 8, "2020-01-01"), /Network failed/);
await assert.rejects(fetchDashboardDayMovements(db, 0, "2020-01-01"), /Espacio inválido/);
await assert.rejects(fetchDashboardDayMovements(db, 8, "2020-02-30"), /Día inválido/);
const repeatedRows = [...databaseRows]; repeatedRows[502] = repeatedRows[1];
await assert.rejects(fetchDashboardDayMovements(clientFor(repeatedRows), 8, "2020-01-01"), /cambió/);
const changingDb = clientFor(databaseRows);
const originalFrom = changingDb.from.bind(changingDb);
changingDb.from = (table) => {
  const query = originalFrom(table); const then = query.then.bind(query);
  query.then = (ok, fail) => then((response) => ok({ ...response, count: changingDb.calls.length === 1 ? 1003 : 1004 }), fail);
  return query;
};
await assert.rejects(fetchDashboardDayMovements(changingDb, 8, "2020-01-01"), /cambió/);

// Storage counts use the same source and parser as the mobile badges, not a capped table.
const attachmentFile = resolve(root, "src/services/queries/day-attachment-counts.ts");
const attachmentSource = ts.transpileModule(readFileSync(attachmentFile, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import .+;\r?\n/gm, "");
const { fetchDayAttachmentCounts } = await import(virtual(attachmentSource));
const { countEntityAttachmentsById } = await import(load(resolve(mobile, "lib/entity-attachment-counts.ts")));
const objects = [{ key: "8/movement/1/receipt.jpg" }, { name: "receipts/8/movement/1/other.pdf" }, { key: "8/movement/6/transfer.jpg" }, { key: "9/movement/1/other.jpg" }, { key: "8/movement/0/bad.jpg" }, { key: "8/movement/2/" }];
let storageCalls = 0;
const storageClient = { storage: { from(bucket) { assert.equal(bucket, "receipts"); return { async listV2(options) {
  assert.equal(options.prefix, "8/movement/"); storageCalls++;
  return { data: { objects: storageCalls === 1 ? objects.slice(0, 2) : objects.slice(2), hasNext: storageCalls === 1, nextCursor: storageCalls === 1 ? "next" : undefined }, error: null };
} }; } } };
assert.deepEqual(await fetchDayAttachmentCounts(storageClient, 8), countEntityAttachmentsById("8/movement", objects));
assert.equal(storageCalls, 2);
const brokenStorage = { storage: { from: () => ({ listV2: async () => ({ data: { objects, hasNext: true }, error: null }) }) } };
await assert.rejects(fetchDayAttachmentCounts(brokenStorage, 8), /completar/);

// Real web dialog, Modal, rows and Router; only the read hook is mocked. No mutations or real HTTP.
const { JSDOM } = mobileRequire("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "KeyboardEvent", "MutationObserver"]) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter } = await import(pathToFileURL(webRequire.resolve("react-router-dom")).href);
const { NotificationDayDialog } = await import(load(resolve(root, "src/modules/notifications/components/notification-day-dialog.tsx")));
let container, renderer, closed = 0;
async function render(rows, attachments = { data: { 1: 2 }, isError: false }) {
  globalThis.dayAttachments = attachments;
  container = document.createElement("div"); document.body.append(container); renderer = createRoot(container);
  await act(async () => renderer.render(React.createElement(MemoryRouter, null, React.createElement(NotificationDayDialog, {
    day: "2026-09-30", movements: rows, baseCurrency: "PEN", exchangeRateMap: ctx.exchangeRateMap, workspaceId: 8, userId: "u", onClose: () => closed++,
  }))));
}
async function close() { await act(async () => renderer.unmount()); container.remove(); }
await render([...fixtures, movement(999, { workspaceId: 9 })]);
const dialog = document.querySelector('[role="dialog"]');
assert.ok(dialog);
for (const name of ["Ingresos", "Gastos", "Transferencias"]) assert.ok(dialog.querySelector(`section[aria-label="${name}"]`));
assert.match(dialog.textContent, /Ahorro del día \(parcial\)/);
assert.match(dialog.querySelector('[role="status"]').textContent, /sin conversión/);
const ids = [...dialog.querySelectorAll('a[href*="movement="]')].map(node => Number(new URL(node.href).searchParams.get("movement")));
assert.deepEqual(ids.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 18, 19]);
assert.equal(dialog.querySelector('a[href="/app/movements?period=all&movement=1"]').querySelector('[aria-label="2 comprobantes"]').textContent, "2");
assert.match(dialog.querySelector('a[href*="movement=6"]').textContent, /Principal → Dólares/);
assert.match(dialog.querySelector('a[href*="movement=15"]').textContent, /23:59/);
assert.match(dialog.querySelector('a[href*="movement=7"]').textContent, /US\$|USD/);
assert.equal(dialog.querySelector('a[href*="from="]').getAttribute("href"), "/app/movements?from=2026-09-30&to=2026-09-30&status=posted");
await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
assert.equal(closed, 1); await close();
await render([], { isError: false, data: {} });
assert.equal(document.querySelectorAll('section[aria-label] p').length, 3);
assert.doesNotMatch(document.querySelector('[role="dialog"]').textContent, /parcial|sin conversión/);
await close();
await render([movement(1)], { isError: true, data: { 1: 3 } });
assert.match(document.querySelector('[role="dialog"]').textContent, /Comprobantes no disponibles/);
assert.equal(document.querySelector('[aria-label="3 comprobantes"]'), null); await close();
dom.window.close();
console.log("notification-day-ui: OK (actual mobile/web models, directional rules, complete day reads, failed page, Storage badges, React groups/subtotals/links; no network)");
