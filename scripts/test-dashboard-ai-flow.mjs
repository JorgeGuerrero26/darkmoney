import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, dom, root, load, mock, createRoot, MemoryRouter, button, settle } from "./lib/web-ui-harness.mjs";

process.env.TZ = "America/Lima";
const { buildDashboardCashflow } = await import(load("src/modules/dashboard/lib/projection/build-dashboard-cashflow.ts"));
const { buildDashboardScenarios } = await import(load("src/modules/dashboard/lib/projection/dashboard-scenarios.ts"));
const { buildDashboardFlowDetails } = await import(load("src/modules/dashboard/lib/projection/dashboard-flow-details.ts"));
const { buildDashboardHealth } = await import(load("src/modules/dashboard/lib/dashboard-health.ts"));
const { buildDashboardAiFlowPayload, dashboardAiWeekStatus } = await import(load("src/modules/dashboard/lib/build-ai-flow-payload.ts"));
const { formatCurrency } = await import(load("src/lib/formatting/money.ts"));

const now = new Date("2026-10-15T17:00:00Z");
const movement = (id, date, amount, extra = {}) => ({ id, workspaceId: 8, movementType: "expense", status: "posted", description: "Compra", occurredAt: `${date}T12:00:00-05:00`, categoryId: 1, counterpartyId: null, sourceAccountId: 1, sourceAmount: amount, destinationAccountId: null, destinationAmount: null, ...extra });
const obligation = (id, direction = "receivable", extra = {}) => ({ id, workspaceId: 8, title: `Acuerdo ${id}`, direction, status: "active", counterparty: "Lucía", currencyCode: "PEN", principalAmount: 400, currentPrincipalAmount: 400, pendingAmount: 400, startDate: "2026-10-01", dueDate: "2026-10-20", installmentAmount: null, paymentPlan: null, events: [], ...extra });
const snapshot = { workspace: { id: 8, name: "Personal" },
  accounts: [{ id: 1, workspaceId: 8, name: "Principal", type: "bank", currencyCode: "PEN", isArchived: false, currentBalance: 500 },
    { id: 2, workspaceId: 8, name: "Dólares", type: "bank", currencyCode: "USD", isArchived: false, currentBalance: 10 },
    { id: 3, workspaceId: 8, name: "Inversión", type: "investment", currencyCode: "PEN", isArchived: false, currentBalance: 100000 },
    { id: 4, workspaceId: 8, name: "Tarjeta", type: "credit_card", currencyCode: "PEN", isArchived: false, currentBalance: -300, paymentDay: 20 }],
  movements: [...Array.from({ length: 6 }, (_, i) => movement(100 + i, `2026-${String(i + 4).padStart(2, "0")}-10`, 60)), movement(1, "2026-10-01", 4000, { movementType: "income", sourceAccountId: null, sourceAmount: null, destinationAccountId: 1, destinationAmount: 4000 }), movement(2, "2026-10-05", 30), movement(3, "2026-10-10", 20)],
  obligations: [obligation(10), obligation(20, "payable", { principalAmount: 200, currentPrincipalAmount: 200, pendingAmount: 150, dueDate: "2026-11-10", installmentAmount: 100, paymentPlan: { mode: "equal", count: 2, firstDueDate: "2026-10-10" }, events: [{ eventType: "payment", amount: 50, eventDate: "2026-10-12" }] })],
  subscriptions: [{ id: 30, workspaceId: 8, name: "Servicio", amount: 50, currencyCode: "PEN", status: "active", frequency: "monthly", intervalCount: 1, nextDueDate: "2026-10-18" }],
  recurringIncome: [{ id: 40, workspaceId: 8, name: "Sueldo", amount: 2000, currencyCode: "PEN", status: "active", frequency: "monthly", intervalCount: 1, nextExpectedDate: "2026-10-25" }],
  catalogs: { categories: [{ id: 1, name: "Comida" }], counterparties: [] } };
const shared = [obligation(60, "receivable", { workspaceId: 99, viewerMode: "shared_viewer", dueDate: "2026-10-16" }), obligation(10, "payable", { workspaceId: 99 }),
  ...Array.from({ length: 6 }, (_, i) => obligation(70 + i, "receivable", { workspaceId: 99, viewerMode: "shared_viewer", dueDate: "2028-10-20" }))];
const ctx = { baseCurrency: "PEN", displayCurrency: "PEN", accountCurrencyMap: new Map([[1, "PEN"], [2, "USD"], [3, "PEN"], [4, "PEN"], [5, "EUR"]]), exchangeRateMap: new Map([["USD:PEN", 3.7]]) };
const supplement = { workspaceId: 8, oneOffTypeIds: [], scheduledChanges: [{ id: 40, changes: [{ effectiveDate: "2026-11-01", amount: 2200 }] }] };
function inputs(data = snapshot, horizon = 6, extra = {}) {
  const flow = buildDashboardCashflow(data, shared, supplement, ctx, now, horizon);
  return { snapshot: data, shared, supplement, cashflow: flow, scenarios: buildDashboardScenarios(data, shared, flow, ctx, now),
    details: buildDashboardFlowDetails(data, shared, flow, ctx, now), health: buildDashboardHealth({ snapshot: data, shared, ctx, liquid: flow.liquid, commitmentsOutflow: flow.windows[2].expectedOutflow, obligationsReady: true, now }), currency: ctx.displayCurrency, horizon, ...extra };
}
const base = inputs(); const before = structuredClone(snapshot); const payload = buildDashboardAiFlowPayload(base);
assert.ok(payload); assert.deepEqual(snapshot, before); assert.equal(payload.currentVisibleBalance, formatCurrency(537, "PEN"));
assert.equal(payload.obligationsCount, 9, "Shared payable records beyond the top priorities still count, duplicate owner wins");
assert.equal(payload.horizon.months.length, 6); assert.equal(payload.period.toMonth, "2027-03");
assert.equal(payload.monthEndReading, formatCurrency(base.cashflow.monthEnd.expectedBalance, "PEN"));
assert.notEqual(payload.horizon.endingBalance, payload.monthEndReading);
assert.equal(payload.paymentOptimizationTop.find(row => row.title === "Acuerdo 20").amount, formatCurrency(50, "PEN"));
assert.equal(payload.horizon.months[1].inflow, formatCurrency(2200, "PEN"));
assert.equal(payload.simulation.samples, 800); assert.match(payload.interpretationRules, /no probabilidad de impago/);
assert.ok(JSON.stringify(payload).length < 15000); assert.doesNotMatch(JSON.stringify(payload), /"refId"|"sourceAccountId"|"movementId"/);

// Execute the original mobile payload callback over the same checked canonical inputs.
const mobileFile = "../DarkMoneyApp/features/dashboard/components/advanced/AdvancedDashboard.tsx";
const mobileAst = ts.createSourceFile(mobileFile, readFileSync(resolve(root, mobileFile), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let payloadCallback;
function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(mobileAst) === "dashboardAiFlowPayload") payloadCallback = node.initializer.arguments[0].getText(mobileAst); ts.forEachChild(node, visit); } visit(mobileAst); assert.ok(payloadCallback);
const env = { activeCurrency: "PEN", formatCurrency, currentVisibleBalance: base.cashflow.liquid.total, weekWindow: base.details.windows[0], pressureStatus: payload.weekStatus,
  projectionModel: base.scenarios.model, projectionCommittedNet: base.scenarios.model.committedInflow - base.scenarios.model.committedOutflow,
  projectionVariableNet: base.scenarios.model.variableIncomeProjection - base.scenarios.model.variableExpenseProjection,
  cashCushion: base.health.cashCushion, paymentOptimization: base.scenarios.recommendations, subscriptions: snapshot.subscriptions, obligations: Array.from({ length: payload.obligationsCount }) };
const js = ts.transpileModule(`const run=${payloadCallback}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const mobilePayload = new Function(...Object.keys(env), `${js};return run();`)(...Object.values(env));
for (const key of Object.keys(mobilePayload).filter(key => key !== "workspaceName")) assert.deepEqual(payload[key], mobilePayload[key], key);
const phoneBuildersFile = "../DarkMoneyApp/features/dashboard/lib/dashboard-builders.ts";
const phoneBuilders = ts.createSourceFile(phoneBuildersFile, readFileSync(resolve(root, phoneBuildersFile), "utf8"), ts.ScriptTarget.Latest, true);
const weekFunction = phoneBuilders.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "getWeekCoverageStatus");
const weekJs = ts.transpileModule(weekFunction.getText(phoneBuilders).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const phoneStatus = new Function(`${weekJs};return getWeekCoverageStatus;`)();
let comparisons = 0;
for (const liquid of [0, 50, -50, 1000]) for (const rows of [[], [{ dueDate: "2026-10-16", direction: "inflow", amount: 100 }], [{ dueDate: "2026-10-16", direction: "outflow", amount: 100 }, { dueDate: "2026-10-16", direction: "inflow", amount: 100 }], [{ dueDate: "2026-10-15", direction: "outflow", amount: 100 }, { dueDate: "2026-10-17", direction: "inflow", amount: 500 }]]) {
  assert.equal(dashboardAiWeekStatus({ complete: true, commitments: rows }, liquid), phoneStatus(rows.map(row => ({ ...row, date: new Date(row.dueDate + "T12:00:00") })), liquid)); comparisons++;
}
assert.equal(dashboardAiWeekStatus({ complete: false, commitments: [] }, 1000), "Por revisar");
for (const horizon of [3, 6, 12]) { const data = inputs(snapshot, horizon); const result = buildDashboardAiFlowPayload(data); assert.equal(result.period.horizonMonths, horizon); assert.equal(result.horizon.months.length, horizon); assert.equal(result.monthEndReading, payload.monthEndReading); assert.equal(result.horizon.endingBalance, formatCurrency(data.cashflow.projection.endingBalance, "PEN")); }
for (const data of [
  { ...base, horizon: 12 }, { ...base, currency: "invalid" }, { ...base, supplement: { ...supplement, workspaceId: 99 } },
  { ...base, scenarios: { ...base.scenarios, available: false, model: null } },
  { ...base, scenarios: { ...base.scenarios, model: { ...base.scenarios.model, expectedBalance: 99999 } } },
  { ...base, cashflow: { ...base.cashflow, liquid: { ...base.cashflow.liquid, total: NaN } } },
  { ...base, details: { ...base.details, windows: base.details.windows.map(row => ({ ...row, complete: false })) } },
  { ...base, details: { ...base.details, chargesMissing: 1 } },
  inputs({ ...snapshot, recurringIncome: [{ ...snapshot.recurringIncome[0], nextExpectedDate: "2026-02-30" }] }),
  inputs({ ...snapshot, recurringIncome: [{ ...snapshot.recurringIncome[0], frequency: "invalid" }] }),
  inputs({ ...snapshot, subscriptions: [{ ...snapshot.subscriptions[0], nextDueDate: "2026-02-30" }] }),
  inputs({ ...snapshot, obligations: [obligation(999, "payable", { dueDate: "2026-02-30" })] }),
  inputs({ ...snapshot, movements: [...snapshot.movements, movement(999, "2026-04-15", 30, { sourceAccountId: 5 })] }),
  { ...base, supplement: { ...supplement, scheduledChanges: [{ id: 40, changes: [{ effectiveDate: "invalid", amount: 100 }] }] } },
]) assert.equal(buildDashboardAiFlowPayload(data), null);
const absent = buildDashboardAiFlowPayload({ ...base, health: { ...base.health, cashCushion: { days: null, daysWithCommitments: null, label: "Sin referencia" } } });
assert.equal(absent.cashCushionDays, null); assert.equal(absent.cashCushionLabel, null); assert.deepEqual(absent.dataCoverage.unavailableIndicators, ["cashCushionDays", "cashCushionDaysWithCommitments"]);
const undated = buildDashboardAiFlowPayload(inputs({ ...snapshot, obligations: [obligation(999, "payable", { dueDate: null })], accounts: snapshot.accounts.map(row => row.type === "credit_card" ? { ...row, paymentDay: null } : row) }));
assert.equal(undated.dataCoverage.obligationsWithoutAgreedDate, 1); assert.equal(undated.dataCoverage.cardsWithDebtWithoutPaymentDay, 1);
// Projection dates and scopes must remain Lima dates in other browser zones.
for (const zone of ["UTC", "Europe/Madrid", "America/Los_Angeles"]) {
  process.env.TZ = zone;
  const other = inputs(snapshot, 6, { health: base.health }); assert.deepEqual(buildDashboardAiFlowPayload(other), payload);
} process.env.TZ = "America/Lima";
for (const stamp of ["2026-11-01T04:30:00Z", "2027-01-01T04:30:00Z", "2024-03-01T04:30:00Z"]) {
  let expected;
  for (const zone of ["America/Lima", "UTC", "Europe/Madrid", "America/Los_Angeles"]) {
    process.env.TZ = zone; const time = new Date(stamp);
    const flow = buildDashboardCashflow(snapshot, shared, supplement, ctx, time, 12);
    const candidate = buildDashboardAiFlowPayload({ ...base, cashflow: flow, scenarios: buildDashboardScenarios(snapshot, shared, flow, ctx, time), details: buildDashboardFlowDetails(snapshot, shared, flow, ctx, time), horizon: 12,
      health: { ...base.health, cashCushion: { days: null, daysWithCommitments: null, label: "Sin referencia" } } });
    assert.ok(candidate); assert.equal(candidate.period.from, new Date(time.getTime() - 5 * 3600000).toISOString().slice(0, 10));
    if (expected) assert.deepEqual(candidate, expected); else expected = candidate;
  }
} process.env.TZ = "America/Lima";

globalThis.flowAiCalls = []; globalThis.flowAiGate = null;
mock("src/services/queries/workspace-data.ts", "export const useDashboardAiSummaryMutation=section=>({mutateAsync:async input=>{globalThis.flowAiCalls.push({section,...input});return globalThis.flowAiGate?await globalThis.flowAiGate:{ok:true,reply:'FLOW_EXPLANATION <img src=x>',complexTerms:[]};}});");
const { DashboardFlowSection } = await import(load("src/modules/dashboard/components/dashboard-flow-section.tsx"));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const props = { snapshot, shared, supplement, ctx, now, health: base.health, userId: "flow-ui", isAdmin: true, enabled: true, ready: true, onRetry: () => {} };
async function render(extra = {}) { await act(async () => renderer.render(React.createElement(MemoryRouter, null, React.createElement(DashboardFlowSection, { ...props, ...extra })))); }
await render(); assert.equal(globalThis.flowAiCalls.length, 0); assert.match(container.textContent, /6 meses · Escenarios solo de 2026-10/);
const aiDetails = [...container.querySelectorAll("details")].find(row => row.querySelector("summary")?.textContent === "Explicar mi flujo con IA"); assert.ok(aiDetails);
await act(async () => { aiDetails.open = true; }); assert.equal(globalThis.flowAiCalls.length, 0);
await act(async () => button(container, "Generar explicación").click()); await settle();
assert.equal(globalThis.flowAiCalls.at(-1).section, "flow"); assert.deepEqual(globalThis.flowAiCalls.at(-1).summary, payload); assert.match(container.textContent, /FLOW_EXPLANATION/); assert.equal(aiDetails.querySelector("img"), null);
await act(async () => button(container, "12 meses").click()); assert.doesNotMatch(container.textContent, /FLOW_EXPLANATION/); assert.equal(globalThis.flowAiCalls.length, 1);
await act(async () => button(container, "Generar explicación").click()); assert.equal(globalThis.flowAiCalls.at(-1).summary.period.horizonMonths, 12); assert.equal(globalThis.flowAiCalls.at(-1).summary.horizon.months.length, 12);
await act(async () => button(container, "3 meses").click());
let finish; globalThis.flowAiGate = new Promise(resolve => { finish = resolve; });
await act(async () => { button(container, "Generar explicación").click(); button(container, "Generar explicación").click(); }); assert.equal(globalThis.flowAiCalls.length, 3);
await act(async () => button(container, "12 meses").click()); assert.equal(globalThis.flowAiCalls.at(-1).signal.aborted, true);
await act(async () => button(container, "3 meses").click());
await act(async () => { finish({ ok: true, reply: "STALE_HORIZON" }); }); await settle(); assert.doesNotMatch(container.textContent, /STALE_HORIZON/); globalThis.flowAiGate = null;
await act(async () => button(container, "Generar explicación").click()); assert.match(container.textContent, /FLOW_EXPLANATION/); assert.equal(container.querySelector('[role="alert"]'), null);
for (const extra of [{ ready: false }, { supplement: { ...supplement, workspaceId: 99 } }, { userId: undefined }, { snapshot: { ...snapshot, subscriptions: [{ ...snapshot.subscriptions[0], currencyCode: "EUR" }] } }]) {
  await render(extra); assert.doesNotMatch(container.textContent, /FLOW_EXPLANATION/); assert.equal(button(container, "Generar explicación").disabled, true);
}
await render({ enabled: false }); assert.equal([...container.querySelectorAll("summary")].some(row => row.textContent === "Explicar mi flujo con IA"), false);
for (const change of [{ ready: false }, { enabled: false }, { snapshot: { ...snapshot, accounts: snapshot.accounts.map(row => row.id === 1 ? { ...row, currentBalance: 501 } : row) } }]) {
  await render({ userId: "flow-pending" });
  globalThis.flowAiGate = new Promise(resolve => { finish = resolve; });
  await act(async () => button(container, "Generar explicación").click());
  await render({ userId: "flow-pending", ...change }); assert.equal(globalThis.flowAiCalls.at(-1).signal.aborted, true);
  await act(async () => { finish({ ok: true, reply: "STALE_READING" }); }); await settle();
  assert.doesNotMatch(container.textContent, /STALE_READING/); globalThis.flowAiGate = null;
}
// Daily allowance does not reset when the horizon changes.
await render({ userId: "flow-quota", isAdmin: false }); await act(async () => button(container, "Generar explicación").click());
await act(async () => button(container, "6 meses").click()); assert.equal(button(container, "Consulta de hoy usada").disabled, true);
const count = globalThis.flowAiCalls.length;
await render({ userId: "flow-cached" }); globalThis.flowAiGate = Promise.resolve({ ok: true, cached: true, reply: "UNSCOPED_SERVER_FLOW" });
await act(async () => button(container, "Generar explicación").click()); assert.match(container.querySelector('[role="alert"]').textContent, /caché del servidor/); assert.doesNotMatch(container.textContent, /UNSCOPED_SERVER_FLOW/);
assert.equal(globalThis.flowAiCalls.length, count + 1);
await act(async () => renderer.unmount()); container.remove(); dom.window.close();
console.log(`dashboard-ai-flow: OK (original mobile payload and ${comparisons} chronological week cases; actual 3/6/12-month calendar/scenarios/partial plans/shared perspective; bounded native money, unavailable indicators, schedule/FX/read/Pro gates, explicit UI, quota/stale horizon/server cache guards; no live AI or financial writes)`);
