import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { buildReadiness } from "@darkmoney/shared/readiness";
import { React, act, dom, root, load, mock, createRoot, MemoryRouter, button, change, settle } from "./lib/web-ui-harness.mjs";

process.env.TZ = "America/Lima";
const { buildDashboardHistory, dashboardHistoryYears } = await import(load("src/modules/dashboard/lib/dashboard-history.ts"));
const { buildDashboardAiHistoryPayload } = await import(load("src/modules/dashboard/lib/build-ai-history-payload.ts"));
const { detectHistoryChangePoint } = await import(load("src/modules/dashboard/lib/history-change-points.ts"));
const { clusterHistoryMonths } = await import(load("src/modules/dashboard/lib/month-clustering.ts"));
const phoneChange = await import(load("../DarkMoneyApp/services/analytics/history-change-points.ts"));
const phoneCluster = await import(load("../DarkMoneyApp/services/analytics/month-clustering.ts"));
const phoneView = await import(load("../DarkMoneyApp/features/dashboard/lib/history-view.ts"));
const { formatCurrency } = await import(load("src/lib/formatting/money.ts"));
let comparisons = 0;
for (const count of [0, 1, 2, 3, 5, 6, 9, 12]) for (const scale of [0, 1, 10]) {
  const rows = Array.from({ length: count }, (_, index) => ({ label: `Mes ${index}`, income: index < 3 ? 100 * scale : 300 * scale,
    expense: index % 4 === 0 ? 250 * scale : 50 * scale, net: ((index < 3 ? 100 : 300) - (index % 4 === 0 ? 250 : 50)) * scale,
    dateFrom: `2025-${String(index + 1).padStart(2, "0")}-01`, dateTo: `2025-${String(index + 1).padStart(2, "0")}-28`, isFuture: index === 11 }));
  assert.deepEqual(detectHistoryChangePoint(rows), phoneChange.detectHistoryChangePoint(rows));
  assert.deepEqual(clusterHistoryMonths(rows), phoneCluster.clusterHistoryMonths(rows)); comparisons++;
}
const now = new Date("2026-10-15T17:00:00Z");
const m = (id, date, amount, income = false, extra = {}) => ({ id, workspaceId: 8, description: "Registro", occurredAt: `${date}T12:00:00-05:00`, movementType: income ? "income" : "expense", status: "posted", categoryId: 1, counterpartyId: null,
  sourceAccountId: income ? null : 1, sourceAmount: income ? null : amount, destinationAccountId: income ? 1 : null, destinationAmount: income ? amount : null, ...extra });
const rowsOf = (year, count, idBase) => Array.from({ length: count }, (_, i) => {
  const month = `${year}-${String(i + 1).padStart(2, "0")}`;
  return [m(idBase + i * 3, month + "-02", year === 2025 ? 1000 : 1000 + i * 200, true), m(idBase + i * 3 + 1, month + "-03", year === 2025 ? 200 : 100 + i * 30), m(idBase + i * 3 + 2, month + "-04", year === 2025 ? 100 : 50 + i * 15, false, { categoryId: 2 })];
}).flat();
const snapshot = { workspace: { id: 8, name: "Personal" }, catalogs: { categories: [{ id: 1, name: "Comida" }, { id: 2, name: "Transporte" }] }, movements: [...rowsOf(2025, 12, 100), ...rowsOf(2026, 9, 200),
  m(300, "2026-10-01", 50), m(301, "2026-10-31", 99999, true), m(302, "2026-11-01", 99999, true),
  m(303, "2026-03-01", 99999, true, { description: "Corrección · Sueldo" }), m(304, "2026-03-01", 99999, false, { movementType: "transfer" }),
  m(305, "2026-01-01", 99999, true, { workspaceId: 99 }), m(306, "2026-01-01", 99999, true, { status: "voided" }),
  m(307, "2026-04-02", 10, false, { sourceAccountId: 2 }), m(308, "2026-03-01", 99999, false, { movementType: "adjustment" })] };
const ctx = { baseCurrency: "PEN", displayCurrency: "PEN", accountCurrencyMap: new Map([[1, "PEN"], [2, "USD"], [3, "EUR"]]), exchangeRateMap: new Map([["USD:PEN", 3.7]]) };
const model = year => buildDashboardHistory(snapshot, ctx, year, now);
const build = (year, extra = {}) => buildDashboardAiHistoryPayload(snapshot, { ...model(year), ...extra }, "PEN", now);
const before = structuredClone(snapshot), payload = build(2026), past = build(2025);
assert.deepEqual(snapshot, before); assert.ok(payload && past); assert.equal(past.annualIncome, formatCurrency(12000, "PEN")); assert.equal(past.annualNet, formatCurrency(8400, "PEN"));
assert.equal(past.savingsRate.avgRate, 70); assert.equal(past.incomeStability.score, 100); assert.equal(past.savingsRate.lastRate, 70);
assert.equal(past.period.to, "2025-12-31"); assert.equal(past.period.partialMonth, null); assert.equal(past.period.trendAndStabilityMonths.length, 12);
assert.equal(payload.period.to, "2026-10-15"); assert.equal(payload.period.partialMonth, "2026-10"); assert.equal(payload.period.trendAndStabilityMonths.length, 9);
assert.equal(payload.savingsRate.lastRate, null); assert.equal(payload.dataCoverage.correctionCount, 2); assert.equal(payload.expenseCategoryCount, 2);
assert.equal(payload.movementCount, 30, "Only posted records of this year/space through now, without corrections, including a non-cashflow transfer");
assert.ok(model(2026).months[3].expense >= 37); assert.equal(payload.seasonalComparison.expenseLabel, null);
assert.ok(JSON.stringify(payload).length < 15000); assert.doesNotMatch(JSON.stringify(payload), /"movementId"|"categoryId"|"accountId"|"occurredAt"/);
for (const year of [2025, 2026]) { assert.deepEqual(model(year).changePoint, phoneChange.detectHistoryChangePoint(model(year).months)); assert.deepEqual(model(year).clusters, phoneCluster.clusterHistoryMonths(model(year).months)); }

// Actual mobile callback contract, supplied with explicitly selected-year indicators.
const mobileFile = "../DarkMoneyApp/features/dashboard/components/advanced/AdvancedDashboard.tsx";
const source = ts.createSourceFile(mobileFile, readFileSync(resolve(root, mobileFile), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let callback;
function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(source) === "dashboardAiHistoryPayload") callback = node.initializer.arguments[0].getText(source); ts.forEachChild(node, visit); } visit(source); assert.ok(callback);
const runJs = ts.transpileModule(`const run=${callback}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
for (const year of [2025, 2026]) {
  const annual = model(year), data = build(year), reference = year === 2025 ? new Date("2026-01-01T04:59:59.999Z") : now;
  const native = snapshot.movements.filter(row => row.workspaceId === 8 && row.status === "posted" && row.occurredAt.startsWith(String(year)) && new Date(row.occurredAt) <= reference && row.id !== 303 && row.movementType !== "adjustment").sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)).map(row => ({ ...row, categoryId: row.categoryId ?? null }));
  const quality = buildReadiness(native, reference); for (const key of ["historyDays", "readinessScore", "usefulCount"]) assert.equal(data[key], quality[key]);
  const env = { annualHistory: annual.months, activeCurrency: "PEN", selectedHistoryYear: year, historyReadiness: { observedMonths: data.observedMonths, movementCount: native.length, expenseCategoryCount: 2 },
    learning: quality, formatCurrency, historyChangePoint: phoneChange.detectHistoryChangePoint(annual.months), monthClusters: phoneCluster.clusterHistoryMonths(annual.months), historyFactorAnalysis: annual.factors,
    monthlySavingsRate: { avgRate: phoneView.periodSavingsRate(annual.months.filter(row => !row.isFuture)), lastRate: data.savingsRate.lastRate, trend: data.savingsRate.trend }, incomeStabilityScore: data.incomeStability,
    seasonalComparison: { hasHistory: false, expenseDelta: null, incomeDelta: null, expenseLabel: null } };
  const expected = new Function(...Object.keys(env), `${runJs};return run();`)(...Object.values(env));
  for (const key of Object.keys(expected).filter(key => key !== "workspaceName")) assert.deepEqual(data[key], expected[key], key);
}
assert.equal(build(2027), null); assert.equal(build(2026, { year: 2025 }), null); assert.equal(build(2026, { currency: "USD" }), null); assert.equal(build(2026, { workspaceId: 99 }), null);
assert.equal(build(2026, { totals: { ...model(2026).totals, net: NaN } }), null);
const foreign = { ...snapshot, movements: [...snapshot.movements, m(999, "2026-01-01", 10000000, true, { workspaceId: 99 })] };
assert.deepEqual(buildDashboardAiHistoryPayload(foreign, buildDashboardHistory(foreign, ctx, 2026, now), "PEN", now), payload);
assert.deepEqual(dashboardHistoryYears({ ...snapshot, movements: [...snapshot.movements, m(999, "1999-01-01", 1, false, { workspaceId: 99 })] }, now), [2026, 2025]);
const unknown = { ...snapshot, movements: [...snapshot.movements, m(999, "2026-01-01", 1, false, { sourceAccountId: 3 })] };
assert.equal(buildDashboardAiHistoryPayload(unknown, buildDashboardHistory(unknown, ctx, 2026, now), "PEN", now), null);
assert.deepEqual(buildDashboardAiHistoryPayload(unknown, buildDashboardHistory(unknown, ctx, 2025, now), "PEN", now), past, "FX missing in another year must not invalidate this year");
const invalid = { ...snapshot, movements: [...snapshot.movements, m(999, "2026-01-01", NaN)] }; assert.equal(buildDashboardHistory(invalid, ctx, 2026, now).complete, false);
const tiny = { ...snapshot, movements: [m(1, "2026-01-01", 100)] }; const tinyPayload = buildDashboardAiHistoryPayload(tiny, buildDashboardHistory(tiny, ctx, 2026, now), "PEN", now);
assert.equal(tinyPayload.dataCoverage.changePointStatus, "insufficient_history"); assert.equal(tinyPayload.incomeStability.score, null); assert.equal(tinyPayload.savingsRate.avgRate, null);
for (const stamp of [now.toISOString(), "2027-01-01T04:59:59Z", "2024-03-01T04:30:00Z"]) {
  let expected;
  for (const zone of ["America/Lima", "UTC", "Europe/Madrid", "America/Los_Angeles"]) {
    process.env.TZ = zone; const time = new Date(stamp), year = stamp.startsWith("2024") ? 2024 : 2026;
    const fixture = year === 2024 ? { ...snapshot, movements: [m(1, "2024-02-29", 100)] } : snapshot;
    const result = buildDashboardAiHistoryPayload(fixture, buildDashboardHistory(fixture, ctx, year, time), "PEN", time); assert.ok(result);
    if (expected) assert.deepEqual(result, expected); else expected = result;
  }
} process.env.TZ = "America/Lima";

globalThis.historyAiCalls = []; globalThis.historyAiGate = null;
mock("src/services/queries/workspace-data.ts", "export const useDashboardAiSummaryMutation=section=>({mutateAsync:async input=>{globalThis.historyAiCalls.push({section,...input});return globalThis.historyAiGate?await globalThis.historyAiGate:{ok:true,reply:'HISTORY_EXPLANATION <img src=x>',complexTerms:[]};}});");
const { DashboardHistorySection } = await import(load("src/modules/dashboard/components/dashboard-history-section.tsx"));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const props = { snapshot, ctx, now, ready: true, onRetry: () => {}, userId: "history-ui", isAdmin: true, enabled: true };
async function render(extra = {}) { await act(async () => renderer.render(React.createElement(MemoryRouter, null, React.createElement(DashboardHistorySection, { ...props, ...extra })))); }
const choose = year => change(container.querySelector('[aria-label="Año del historial"]'), String(year));
await render(); assert.equal(globalThis.historyAiCalls.length, 0); assert.match(container.textContent, /Cambios y tipos de meses de 2026/);
const details = [...container.querySelectorAll("details")].find(row => row.querySelector("summary")?.textContent === "Explicar mi historial con IA"); assert.ok(details);
await act(async () => { details.open = true; }); assert.equal(globalThis.historyAiCalls.length, 0);
await act(async () => button(container, "Generar explicación").click()); assert.equal(globalThis.historyAiCalls.at(-1).section, "history"); assert.deepEqual(globalThis.historyAiCalls.at(-1).summary, payload); assert.equal(details.querySelector("img"), null);
await choose(2025); assert.doesNotMatch(container.textContent, /HISTORY_EXPLANATION/); assert.match(container.textContent, /Tu 2025, explicado/);
await act(async () => button(container, "Generar explicación").click()); assert.deepEqual(globalThis.historyAiCalls.at(-1).summary, past);
await choose(2026); let finish; globalThis.historyAiGate = new Promise(resolve => { finish = resolve; });
await act(async () => { button(container, "Generar explicación").click(); button(container, "Generar explicación").click(); }); assert.equal(globalThis.historyAiCalls.length, 3);
await choose(2025); assert.equal(globalThis.historyAiCalls.at(-1).signal.aborted, true); await choose(2026);
await act(async () => { finish({ ok: true, reply: "LATE_YEAR" }); }); await settle(); assert.doesNotMatch(container.textContent, /LATE_YEAR/); globalThis.historyAiGate = null;
for (const extra of [{ ready: false }, { snapshot: unknown }, { userId: undefined }, { snapshot: { ...snapshot, movements: [] } }]) { await render(extra); assert.equal(button(container, "Generar explicación").disabled, true); }
await render({ enabled: false }); assert.equal([...container.querySelectorAll("summary")].some(row => row.textContent === "Explicar mi historial con IA"), false);
await render({ userId: "history-quota", isAdmin: false }); await act(async () => button(container, "Generar explicación").click()); await choose(2025); assert.equal(button(container, "Consulta de hoy usada").disabled, true);
for (const extra of [{ ready: false }, { enabled: false }, { ctx: { ...ctx, displayCurrency: "USD" } }]) {
  await render({ userId: "history-late" }); globalThis.historyAiGate = new Promise(resolve => { finish = resolve; });
  await act(async () => button(container, "Generar explicación").click()); await render({ userId: "history-late", ...extra });
  assert.equal(globalThis.historyAiCalls.at(-1).signal.aborted, true);
  await act(async () => { finish({ ok: true, reply: "LATE_SCOPE" }); }); await settle(); assert.doesNotMatch(container.textContent, /LATE_SCOPE/); globalThis.historyAiGate = null;
}
await render({ userId: "history-server" }); globalThis.historyAiGate = Promise.resolve({ ok: true, cached: true, reply: "UNSCOPED_YEAR" });
await act(async () => button(container, "Generar explicación").click()); assert.match(container.querySelector('[role="alert"]').textContent, /caché del servidor/); assert.doesNotMatch(container.textContent, /UNSCOPED_YEAR/);
await act(async () => renderer.unmount()); container.remove(); dom.window.close();
console.log(`dashboard-ai-history: OK (${comparisons} original change/cluster models; original mobile payload on declared selected-year inputs; native annual/quality/count/FX/scope guards and partial-year/leap/Lima dates; real year selector/shared AI UI, explicit generation, quotas, stale-year/Pro/read/currency/server-cache guards; no live AI or financial writes)`);
