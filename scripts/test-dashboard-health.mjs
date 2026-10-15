import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import * as dates from "date-fns";
import { es } from "date-fns/locale";
import { buildHealthScore } from "@darkmoney/shared/health";
import { React, act, dom, root, load, createRoot } from "./lib/web-ui-harness.mjs";

const web = await import(load("src/modules/dashboard/lib/dashboard-health.ts"));
const phoneHistory = await import(load("../DarkMoneyApp/features/dashboard/lib/history-view.ts"));
const phoneHealth = await import(load("../DarkMoneyApp/features/dashboard/lib/health-view.ts"));
const phoneAggregations = await import(load("../DarkMoneyApp/features/dashboard/lib/aggregations.ts"));
// Extract actual useMemo callbacks, not a handwritten reference model or the native UI.
const file = resolve(root, "../DarkMoneyApp/features/dashboard/components/advanced/AdvancedDashboard.tsx");
const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = new Map();
function safeVisit(node) {
  if (ts.isVariableDeclaration(node) && node.initializer) {
    if (ts.isIdentifier(node.name) && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(source) === "useMemo") callbacks.set(node.name.text, node.initializer.arguments[0].getText(source));
  }
  ts.forEachChild(node, safeVisit);
}
safeVisit(source);
function evaluate(name, env) {
  assert.ok(callbacks.has(name), name);
  const js = ts.transpileModule(`const run=${callbacks.get(name)};`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  return new Function(...Object.keys(env), `${js};return run();`)(...Object.values(env));
}
const now = new Date(2026, 9, 15, 12);
class Clock extends Date { constructor(...args) { if (args.length) super(...args); else super(now.getTime()); } static now() { return now.getTime(); } }
const movement = (id, month, kind, amount, extra = {}) => ({
  id, workspaceId: 7, movementType: kind, description: "Registro", status: "posted", categoryId: 1, counterpartyId: null,
  occurredAt: `2026-${month}-10T12:00:00-05:00`, sourceAccountId: kind === "expense" ? 1 : null,
  destinationAccountId: kind === "income" ? 1 : null, sourceAmount: kind === "expense" ? amount : null,
  destinationAmount: kind === "income" ? amount : null, ...extra,
});
const movements = [];
const incomes = [1000, 2000, 0, 4000, 500, 2500], expenses = [500, 600, 100, 400, 250, 1250];
for (let i = 0; i < 6; i++) {
  const month = String(i + 4).padStart(2, "0");
  movements.push(movement(i * 2, month, "income", incomes[i]), movement(i * 2 + 1, month, "expense", expenses[i]));
}
movements.push(movement(30, "10", "income", 1600), movement(31, "10", "expense", 600),
  movement(32, "10", "income", 9999, { description: "Corrección · Saldo" }),
  movement(33, "09", "expense", 9999, { movementType: "adjustment" }),
  movement(34, "09", "income", 9999, { status: "planned" }),
  movement(35, "10", "income", 9999, { status: "voided" }),
  movement(36, "10", "income", 9999, { occurredAt: "2026-10-20T12:00:00-05:00" }));
const obligation = (id, direction, status, dueDate, pendingAmount = 600, extra = {}) => ({ id, workspaceId: 7, direction, status, dueDate, pendingAmount, currencyCode: "PEN", ...extra });
const obligations = [obligation(1, "payable", "active", "2026-10-10"), obligation(2, "receivable", "paid", "2026-10-05", 0), obligation(3, "receivable", "active", "2026-10-06"), obligation(4, "receivable", "paid", "2026-09-01", 0), obligation(5, "receivable", "active", "2026-10-30")];
const ctx = { baseCurrency: "PEN", displayCurrency: "PEN", exchangeRateMap: new Map([["USD:PEN", 3.7]]), accountCurrencyMap: new Map([[1, "PEN"], [2, "USD"], [3, "EUR"]]) };
const snapshot = { workspace: { id: 7 }, movements, obligations };
const input = { snapshot, shared: [], ctx, liquid: { total: 2000, unconvertedCount: 0 }, commitmentsOutflow: 300, obligationsReady: true, now };
const model = web.buildDashboardHealth(input);
const env = {
  ...dates, ...phoneHistory, ...phoneHealth, ...phoneAggregations, Date: Clock, es,
  COLORS: { income: "income", expense: "expense", storm: "storm" },
  recentHistoryMovements: movements, movements, projectionHistory: movements,
  accountCurrencyMap: ctx.accountCurrencyMap, exchangeRateMap: ctx.exchangeRateMap, activeCurrency: "PEN", baseCurrency: "PEN",
  currentVisibleBalance: 2000, windows: [{}, {}, { expectedOutflow: 300 }], obligations, obligationsForHealth: obligations,
  obligationViewerDirection: o => "viewerMode" in o ? o.direction === "receivable" ? "payable" : "receivable" : o.direction,
};
env.monthlySavingsRate = evaluate("monthlySavingsRate", env);
env.healthBaseline = evaluate("healthBaseline", env);
env.cashCushion = evaluate("cashCushion", env);
const stability = evaluate("incomeStabilityScore", env), collection = evaluate("collectionEfficiency", env);
assert.deepEqual(model.baseline, env.healthBaseline);
assert.equal(model.savings.averagePct, env.monthlySavingsRate.avgRate); assert.equal(model.savings.averagePct, 69);
assert.equal(model.savings.currentPct, env.monthlySavingsRate.lastRate); assert.equal(model.savings.currentPct, 62.5);
assert.equal(model.savings.trend, env.monthlySavingsRate.trend);
assert.deepEqual(model.savings.months.map(m => [m.income, m.expense, m.rate]), env.monthlySavingsRate.months.map(m => [m.income, m.expense, m.rate]));
assert.equal(model.incomeStability.score, stability.score); assert.equal(model.incomeStability.cvPct, stability.cvPct);
assert.equal(model.cashCushion.days, env.cashCushion.days); assert.equal(model.cashCushion.daysWithCommitments, env.cashCushion.daysWithCommitments);
assert.equal(model.collection.rate, collection.rate); assert.equal(model.collection.rate, 50); assert.equal(model.collection.total, 2);
assert.deepEqual(model.healthInputs, evaluate("healthInputs", env));
assert.equal(model.health.score, buildHealthScore(model.healthInputs).score);
for (const months of [[], [{ income: 0, expense: 0 }], [{ income: 1000, expense: 900 }, { income: 0, expense: 50 }, { income: 100, expense: 0 }]]) {
  assert.deepEqual(web.healthBaselineFromMonths(months), phoneHealth.healthBaselineFromMonths(months));
  assert.equal(web.periodSavingsRate(months), phoneHistory.periodSavingsRate(months));
}
for (const balance of [-200, 0, 1500]) for (const expense of [0, 250, 1000]) assert.equal(web.reserveDays(balance, expense), phoneHealth.reserveDays(balance, expense));
for (const description of ["Corrección · Banco", "Correccion: Banco", "Corrección— Banco", "Mercado"]) {
  const record = { movementType: "income", description }; assert.equal(web.isHistoryBalanceCorrection(record), phoneHistory.isHistoryBalanceCorrection(record));
}
const shared = [obligation(11, "receivable", "active", "2026-10-10", 200, { viewerMode: "shared_viewer" }), obligation(12, "payable", "active", "2026-10-10", 300, { viewerMode: "shared_viewer" }), { ...obligations[0], viewerMode: "shared_viewer" }];
const perspective = web.buildDashboardHealth({ ...input, shared });
assert.equal(perspective.healthInputs.totalPayable, 800); assert.equal(perspective.health.overdueCount, 2); assert.equal(perspective.collection.total, 3); assert.equal(perspective.collection.rate, 33);
// Current mobile grade loop uses stored direction, unlike its collection/projection. Don't copy it.
const mobileSharedInputs = evaluate("healthInputs", { ...env, obligationsForHealth: [...obligations, ...shared.slice(0, 2)] });
assert.equal(mobileSharedInputs.totalPayable, 900); assert.notEqual(mobileSharedInputs.totalPayable, perspective.healthInputs.totalPayable);

const empty = web.buildDashboardHealth({ ...input, snapshot: { ...snapshot, movements: [], obligations: [] } });
assert.equal(empty.health.score, null); assert.equal(empty.cashCushion.days, null); assert.equal(empty.incomeStability.score, null); assert.equal(empty.savings.averagePct, null); assert.equal(empty.collection.rate, null);
const expenseOnly = web.buildDashboardHealth({ ...input, snapshot: { ...snapshot, movements: [movement(1, "09", "expense", 100)] } });
assert.equal(expenseOnly.health.score, null); assert.equal(expenseOnly.cashCushion.days, 600);
const unknownHistory = web.buildDashboardHealth({ ...input, snapshot: { ...snapshot, movements: [...movements, movement(100, "09", "expense", 100, { sourceAccountId: 3 })] } });
assert.equal(unknownHistory.health.score, null); assert.equal(unknownHistory.savings.averagePct, null); assert.equal(unknownHistory.unconvertedHistory, 1);
const unknownCurrent = web.buildDashboardHealth({ ...input, snapshot: { ...snapshot, movements: [...movements, movement(101, "10", "expense", 100, { sourceAccountId: 3 })] } });
assert.equal(unknownCurrent.savings.currentPct, null); assert.equal(unknownCurrent.savings.averagePct, 69); assert.equal(unknownCurrent.health.score, model.health.score);
const unknownDebt = web.buildDashboardHealth({ ...input, snapshot: { ...snapshot, obligations: [...obligations, obligation(20, "payable", "active", "2026-10-05", 100, { currencyCode: "EUR" })] } });
assert.equal(unknownDebt.health.score, null); assert.equal(unknownDebt.health.debtToIncomeRatio, null); assert.equal(unknownDebt.unconvertedPayables, 1);
const unknownLiquid = web.buildDashboardHealth({ ...input, liquid: { total: 2000, unconvertedCount: 1 } });
assert.equal(unknownLiquid.health.score, null); assert.equal(unknownLiquid.cashCushion.days, null);
const unread = web.buildDashboardHealth({ ...input, shared, obligationsReady: false });
assert.equal(unread.health.score, null); assert.equal(unread.collection.rate, null); assert.equal(unread.collection.label, "Sin comprobar");
assert.equal(web.buildDashboardHealth({ ...input, historyAvailable: false }).health.score, null);
const inverse = web.buildDashboardHealth({ ...input, ctx: { ...ctx, displayCurrency: "USD" }, liquid: { total: 2000 / 3.7, unconvertedCount: 0 }, commitmentsOutflow: 300 / 3.7 });
assert.equal(inverse.cashCushion.days, model.cashCushion.days); assert.ok(Math.abs(inverse.savings.averagePct - 69) < 1e-8);
assert.equal(inverse.health.score, model.health.score);
const tight = web.buildDashboardHealth({ ...input, snapshot: { ...snapshot, movements: [movement(1, "09", "income", 1000), movement(2, "09", "expense", 900)] }, liquid: { total: 1800, unconvertedCount: 0 } });
assert.match(tight.health.indicators.find(row => row.key === "savings").interpret, /10% y el 20%/);
assert.match(tight.health.indicators.find(row => row.key === "coverage").interpret, /uno y tres/);

const { DashboardHealthPanel } = await import(load("src/modules/dashboard/components/dashboard-health-panel.tsx"));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const render = async m => act(async () => renderer.render(React.createElement(DashboardHealthPanel, { model: m, currency: "PEN" })));
await render(model); assert.match(container.textContent, /69.0%/); assert.match(container.textContent, /62.5%/); assert.match(container.textContent, /1 de 2/); assert.equal(container.querySelectorAll("tbody tr").length, 7);
await render(empty); assert.match(container.querySelector('[aria-label="Nota de salud"]').textContent, /—/); assert.doesNotMatch(container.textContent, /Finanzas en buen estado/);
await render(unread); assert.match(container.textContent, /Sin comprobar/); assert.doesNotMatch(container.textContent, /2 de 3/);
await render(unknownDebt); assert.match(container.querySelector('[role="status"]').textContent, /1 deudas/);
const page = readFileSync(resolve(root, "src/modules/dashboard/pages/dashboard-page.tsx"), "utf8");
assert.match(page, /<DashboardHealthPanel model=\{dashboardHealth\}/); assert.doesNotMatch(page, /const healthScore = buildHealthScore/);
assert.match(page, /Explicar mi situación con IA/);
const pageAst = ts.createSourceFile("page.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let generateNode;
function findGenerate(node) { if (ts.isVariableDeclaration(node) && node.name.getText(pageAst) === "handleGenerateAiSummary") generateNode = node; ts.forEachChild(node, findGenerate); }
findGenerate(pageAst); assert.ok(generateNode);
const generateJs = ts.transpileModule(`const generate=${generateNode.initializer.getText(pageAst)};`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { buildDashboardAiSummaryPayload } = await import(load("src/modules/dashboard/lib/build-ai-summary-payload.ts"));
const { formatCurrency } = await import(load("src/lib/formatting/money.ts"));
const captured = [];
const pageEnv = {
  activeWorkspace: { id: 7 }, projectionReady: true, projectionAmountsComplete: true, canUseAdvancedDashboard: true,
  snapshot: { workspace: { name: "Personal" }, accounts: [] },
  convertDashboardAmount: () => { throw new Error("no accounts in fixture"); }, baseCurrencyCode: "PEN", displayCurrencyCode: "PEN", exchangeRateMap: new Map(),
  cashflow: { liquid: { total: 2000, unconvertedCount: 0 }, projection: { unconvertedCount: 0 }, typicalSpend: { unconvertedCount: 0 } },
  parityNetWorth: { amount: 9000 }, parityReviewInbox: { subscriptionsAttentionCount: 0 },
  buildDashboardAiSummaryPayload, formatCurrency, monthEndEstimate: { estimatedLiquidAtMonthEnd: 2500 }, dashboardHealth: model,
  futureFlowWindows: [{ expectedInflow: 500, expectedOutflow: 300 }], reviewInboxTotalIssues: 0, parityReadiness: { readinessScore: 80 },
  uncategorizedMovements: [], overdueObligations: [], activeSubscriptions: [], primaryProRecommendation: {},
  dashboardAi: { requestSummary: async (workspaceId, summary) => captured.push({ workspaceId, summary }) },
};
function generate(overrides = {}) { const scope = { ...pageEnv, ...overrides }; return new Function(...Object.keys(scope), `${generateJs};return generate;`)(...Object.values(scope))(); }
generate({ canUseAdvancedDashboard: false }); generate({ projectionReady: false }); generate({ projectionAmountsComplete: false }); assert.equal(captured.length, 0);
generate(); assert.equal(captured.length, 1); assert.equal(captured[0].workspaceId, 7);
assert.equal(captured[0].summary.savingsRatePct,62.5);assert.equal(captured[0].summary.savingsAveragePct,69);assert.equal(captured[0].summary.collectionEfficiencyPct,50);
assert.equal(captured[0].summary.cashCushionDays, model.cashCushion.days);
const { DashboardAiSummaryPanel } = await import(load("src/modules/dashboard/components/dashboard-ai-summary-panel.tsx"));
let requests = 0;
const renderAi = async extra => act(async () => renderer.render(React.createElement(DashboardAiSummaryPanel, { tone: "personal", onToneChange: () => {}, response: null, isPending: false, limitReached: false, errorMessage: null, onGenerate: () => requests++, ...extra })));
await renderAi({}); assert.equal(requests, 0); assert.doesNotMatch(container.innerHTML, /linear-gradient|blur-\[/);
const generateButton = () => [...container.querySelectorAll("button")].find(node => node.textContent.includes("Generar explicación"));
await act(async () => generateButton().click()); assert.equal(requests, 1);
await renderAi({ unavailableReason: "Comprueba la proyección" }); assert.equal(generateButton().disabled,true); await act(async () => generateButton().click()); assert.equal(requests, 1);
await renderAi({ limitReached: true }); assert.ok([...container.querySelectorAll("button")].find(node => node.textContent === "Consulta de hoy usada").disabled);
await act(async () => renderer.unmount()); container.remove(); dom.window.close();
console.log("dashboard-health: OK (real mobile memo callbacks/helpers, six complete months and weighted savings, current-month distinction, reserve/stability/collection, explicit shared-perspective correction, missing data/FX guards and actual panel; local only)");
