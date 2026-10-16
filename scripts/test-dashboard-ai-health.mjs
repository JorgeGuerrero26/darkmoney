import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { buildReadiness } from "@darkmoney/shared/readiness";
import { buildReviewInboxSnapshot } from "@darkmoney/shared/review-inbox";
import { React, act, dom, root, load, mock, createRoot, MemoryRouter, QueryClient, QueryClientProvider, button, settle } from "./lib/web-ui-harness.mjs";

process.env.TZ = "America/Lima";
const { buildDashboardHealth } = await import(load("src/modules/dashboard/lib/dashboard-health.ts"));
const { buildDashboardHealthReview } = await import(load("src/modules/dashboard/lib/dashboard-health-review.ts"));
const { buildDashboardAiHealthPayload } = await import(load("src/modules/dashboard/lib/build-ai-health-payload.ts"));
const { buildDashboardCategorySuggestions } = await import(load("src/modules/dashboard/lib/dashboard-category-suggestions.ts"));
const { buildDashboardCashflow } = await import(load("src/modules/dashboard/lib/projection/build-dashboard-cashflow.ts"));
const { buildDashboardScenarios } = await import(load("src/modules/dashboard/lib/projection/dashboard-scenarios.ts"));
const { formatCurrency } = await import(load("src/lib/formatting/money.ts"));
const now = new Date("2026-10-15T17:00:00Z");
const m = (id, date, amount, extra = {}) => ({ id, workspaceId: 8, description: "Taxi al trabajo", occurredAt: `${date}T12:00:00-05:00`, movementType: "expense", status: "posted", categoryId: 1, counterpartyId: null, sourceAccountId: 1, sourceAmount: amount, destinationAccountId: null, destinationAmount: null, ...extra });
const obligation = (id, extra = {}) => ({ id, workspaceId: 8, direction: "payable", status: "active", pendingAmount: 100, principalAmount: 100, currencyCode: "PEN", dueDate: "2026-10-10", startDate: "2026-10-01", lastPaymentDate: null, title: "Acuerdo", events: [], ...extra });
const snapshot = { workspace: { id: 8, name: "Personal", role: "owner", isArchived: false },
  accounts: [{ id: 1, workspaceId: 8, name: "Principal", type: "bank", currencyCode: "PEN", currentBalance: 2000, isArchived: false }],
  movements: [...Array.from({ length: 6 }, (_, index) => [m(100 + index * 2, `2026-${String(index + 4).padStart(2, "0")}-10`, 100), m(101 + index * 2, `2026-${String(index + 4).padStart(2, "0")}-10`, 1000, { description: "Sueldo", movementType: "income", sourceAccountId: null, sourceAmount: null, destinationAccountId: 1, destinationAmount: 1000 })]).flat(),
    m(1, "2026-10-01", 10), m(2, "2026-10-02", 10), m(3, "2026-10-03", 10, { categoryId: null }), m(4, "2026-10-04", 10, { categoryId: null }),
    m(50, "2026-10-06", 20, { description: "Compra duplicada", categoryId: 2 }), m(51, "2026-10-06", 20, { description: "Compra duplicada", categoryId: 2 }), m(52, "2026-10-07", 10, { status: "pending" })],
  obligations: [obligation(1), obligation(2, { direction: "receivable", status: "paid", pendingAmount: 0 }), obligation(3, { direction: "receivable", dueDate: "2026-10-13" })],
  subscriptions: [{ id: 10, workspaceId: 8, name: "Servicio", amount: 30, currencyCode: "PEN", status: "active", frequency: "monthly", intervalCount: 1, nextDueDate: "2026-10-18", accountId: 1 }], recurringIncome: [],
  catalogs: { categories: [{ id: 1, name: "Transporte", kind: "expense", isActive: true }, { id: 2, name: "Comida", kind: "both", isActive: true }], counterparties: [] } };
const shared = [obligation(20, { workspaceId: 99, direction: "receivable", viewerMode: "shared_viewer" }), obligation(1, { workspaceId: 99, direction: "receivable", viewerMode: "shared_viewer" })];
const ctx = { baseCurrency: "PEN", displayCurrency: "PEN", accountCurrencyMap: new Map([[1, "PEN"], [2, "EUR"]]), exchangeRateMap: new Map() };
const evidence = { feedback: [{ feedbackKind: "manual_category_change", acceptedCategoryId: 1, normalizedDescription: "taxi al trabajo", createdAt: "2026-10-14T12:00:00Z" }], signals: [], unavailable: [] };
const supplement = { workspaceId: 8, oneOffTypeIds: [], scheduledChanges: [] };
function inputs(data = snapshot, time = now) {
  const cashflow = buildDashboardCashflow(data, shared, supplement, ctx, time, 3), scenarios = buildDashboardScenarios(data, shared, cashflow, ctx, time);
  const health = buildDashboardHealth({ snapshot: data, shared, ctx, liquid: cashflow.liquid, commitmentsOutflow: cashflow.windows[2].expectedOutflow, obligationsReady: true, now: time });
  const categories = buildDashboardCategorySuggestions(data, ctx, evidence, time);
  return { snapshot: data, health, reading: { suggestions: categories.suggestions, evidence, ready: true, failed: false, applying: false, unconvertedCount: categories.unconvertedCount },
    review: buildDashboardHealthReview(data, shared, time), projectionConfidence: scenarios.model ? { score: scenarios.model.confidence, label: scenarios.model.confidenceLabel } : null, currency: "PEN", cashflow };
}
const base = inputs(), payload = buildDashboardAiHealthPayload(base), before = structuredClone(snapshot);
assert.ok(payload); assert.equal(payload.categorySuggestionsCount, 2); assert.equal(payload.acceptedFeedbackCount, 1); assert.deepEqual(snapshot, before);
assert.equal(payload.financialHealth.payableAmount, formatCurrency(200, "PEN"));
const countKeys = ["uncategorizedCount", "pendingMovementsCount", "duplicateExpenseGroups", "subscriptionsAttentionCount", "obligationsWithoutPlanCount", "staleObligationsCount", "overdueObligationsCount"];
assert.equal(payload.totalIssues, countKeys.reduce((sum, key) => sum + payload.reviewBreakdown[key], 0));
assert.ok(payload.duplicateExpenseCount >= payload.reviewBreakdown.duplicateExpenseGroups); assert.equal(payload.financialHealth.historicalSavingsPct, 90);
assert.ok(JSON.stringify(payload).length < 15000); assert.doesNotMatch(JSON.stringify(payload), /"movementId"|"suggestedCategoryId"|"accountId"/);
const native = snapshot.movements.filter(row => new Date(row.occurredAt).getTime() >= now.getTime() - 90 * 86400000).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
assert.deepEqual(base.review.readiness, buildReadiness(native, now));
const nativeReview = buildReviewInboxSnapshot(native, snapshot.subscriptions, [...snapshot.obligations, shared[0]], now); assert.deepEqual(base.review.review, nativeReview);

// The actual mobile serializer, over the same checked model and visible suggestions.
const file = "../DarkMoneyApp/features/dashboard/components/advanced/AdvancedDashboard.tsx";
const ast = ts.createSourceFile(file, readFileSync(resolve(root, file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let callback;
function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "dashboardAiHealthPayload") callback = node.initializer.arguments[0].getText(ast); ts.forEachChild(node, visit); } visit(ast); assert.ok(callback);
const env = { activeCurrency: "PEN", formatCurrency, review: base.review.review, duplicateExpenseReviewMovements: Array(payload.duplicateExpenseCount), qualitySnapshot: base.review,
  categorySuggestions: base.reading.suggestions, collectionEfficiency: base.health.collection, learning: base.review.readiness,
  projectionModel: { confidence: base.projectionConfidence.score, confidenceLabel: base.projectionConfidence.label }, acceptedFeedbackCount: 1, cashCushion: base.health.cashCushion, panelCoachChips: payload.coachSignals.map(label => ({ label })) };
const js = ts.transpileModule(`const run=${callback}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const expected = new Function(...Object.keys(env), `${js};return run();`)(...Object.values(env));
for (const key of Object.keys(expected).filter(key => key !== "workspaceName")) assert.deepEqual(payload[key], expected[key], key);
for (const extra of [{ ready: false }, { failed: true }, { applying: true }, { unconvertedCount: 1 }, { evidence: null }, { evidence: { ...evidence, unavailable: ["missing"] } }]) assert.equal(buildDashboardAiHealthPayload({ ...base, reading: { ...base.reading, ...extra } }), null);
assert.equal(buildDashboardAiHealthPayload({ ...base, health: { ...base.health, workspaceId: 99 } }), null);
assert.equal(buildDashboardAiHealthPayload({ ...base, health: { ...base.health, currency: "USD" } }), null);
const noForecast = buildDashboardAiHealthPayload({ ...base, projectionConfidence: null }); assert.equal(noForecast.projectionConfidence.score, null);
const oldMissing = { ...snapshot, movements: [...snapshot.movements, m(999, "2026-04-15", 10, { sourceAccountId: 2 })] }, missingPayload = buildDashboardAiHealthPayload(inputs(oldMissing));
assert.ok(missingPayload); assert.equal(missingPayload.financialHealth.score, null); assert.equal(missingPayload.cashCushion.days, null); assert.equal(missingPayload.cashCushion.label, null);
assert.ok(missingPayload.dataCoverage.unavailableIndicators.includes("financialHealthScore")); assert.doesNotMatch(missingPayload.coachSignals.join(" "), /Base sana/);
const undatedPlan = { ...snapshot, obligations: [obligation(99, { dueDate: null, paymentPlan: { mode: "equal", count: 2, firstDueDate: "2026-10-20" } })] };
assert.equal(buildDashboardHealthReview(undatedPlan, [], now).review.obligationsWithoutPlanCount, 0);
for (const extra of [{ workspaceId: 99 }, { occurredAt: "2026-10-31T12:00:00Z" }, { description: "Corrección · Cuenta" }, { movementType: "adjustment" }, { occurredAt: "2026-01-01T12:00:00Z" }]) {
  assert.deepEqual(buildDashboardHealthReview({ ...snapshot, movements: [...snapshot.movements, m(999, "2026-10-10", 99999, extra)] }, shared, now), base.review);
}
const badDate = { ...snapshot, subscriptions: [{ ...snapshot.subscriptions[0], nextDueDate: "invalid" }] }; assert.equal(buildDashboardHealthReview(badDate, shared, now).invalidDates, 1); assert.equal(buildDashboardAiHealthPayload(inputs(badDate)), null);
for (const stamp of [now.toISOString(), "2026-10-01T04:30:00Z", "2027-01-01T04:30:00Z", "2024-03-01T04:30:00Z", "2026-03-29T07:30:00Z"]) {
  let baseline;
  for (const zone of ["America/Lima", "UTC", "Europe/Madrid", "America/Los_Angeles"]) { process.env.TZ = zone; const result = inputs(snapshot, new Date(stamp)); const output = { review: result.review, payload: buildDashboardAiHealthPayload(result) }; if (baseline) assert.deepEqual(output, baseline); else baseline = output; }
} process.env.TZ = "America/Lima";

globalThis.healthAiCalls = []; globalThis.healthAiGate = null; globalThis.healthEvidence = evidence; globalThis.healthReads = 0; globalThis.healthEvidenceGate = null; globalThis.healthWrites = []; globalThis.healthApplyGate = null;
mock("src/services/supabase/client.ts", "export const supabase={};");
mock("src/services/queries/dashboard-categories.ts", "export class CategoryApplyError extends Error{};export const readDashboardCategoryEvidence=async()=>{globalThis.healthReads++;if(globalThis.healthEvidenceGate)await globalThis.healthEvidenceGate;return globalThis.healthEvidence;};export const applyDashboardCategory=async(client,input)=>{globalThis.healthWrites.push(input);if(globalThis.healthApplyGate)await globalThis.healthApplyGate;return {movementId:input.movement.id,learningSaved:true};};");
mock("src/services/queries/workspace-data.ts", "export const useDashboardAiSummaryMutation=section=>({mutateAsync:async input=>{globalThis.healthAiCalls.push({section,...input});return globalThis.healthAiGate?await globalThis.healthAiGate:{ok:true,reply:'HEALTH_EXPLANATION <img src=x>',complexTerms:[]};}});");
const { DashboardHealthSection } = await import(load("src/modules/dashboard/components/dashboard-health-section.tsx"));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const props = { snapshot, shared, ctx, now, userId: "health-ui", ready: true, healthReady: true, enabled: true, isAdmin: true, canEdit: true, health: base.health, cashflow: base.cashflow };
async function render(extra = {}) { await act(async () => renderer.render(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(MemoryRouter, null, React.createElement(DashboardHealthSection, { ...props, ...extra }))))); await settle(); }
await render(); assert.equal(globalThis.healthAiCalls.length, 0); assert.equal(globalThis.healthWrites.length, 0); assert.equal(globalThis.healthReads, 1, "AI reuses the category panel's existing read");
const details = [...container.querySelectorAll("details")].find(row => row.querySelector("summary")?.textContent === "Explicar mi salud financiera con IA"); assert.ok(details);
await act(async () => { details.open = true; }); assert.equal(globalThis.healthAiCalls.length, 0);
await act(async () => button(container, "Generar explicación").click()); assert.equal(globalThis.healthAiCalls.at(-1).section, "health"); assert.deepEqual(globalThis.healthAiCalls.at(-1).summary, payload); assert.equal(details.querySelector("img"), null); assert.equal(globalThis.healthWrites.length, 0); assert.equal(globalThis.healthReads, 1);
let finish; globalThis.healthAiGate = new Promise(resolve => { finish = resolve; });
await act(async () => { button(container, "Actualizar explicación").click(); button(container, "Actualizar explicación").click(); }); assert.equal(globalThis.healthAiCalls.length, 2);
const filteredEvidence = { ...evidence, feedback: [], signals: [] };
await act(async () => queryClient.setQueryData(["dashboard-category-evidence", "health-ui", 8], filteredEvidence));
await settle();
assert.equal(globalThis.healthAiCalls.at(-1).signal.aborted, true);
await act(async () => { finish({ ok: true, reply: "OLD_SUGGESTIONS" }); }); await settle(); assert.doesNotMatch(container.textContent, /OLD_SUGGESTIONS/); globalThis.healthAiGate = null;
await act(async () => queryClient.setQueryData(["dashboard-category-evidence", "health-ui", 8], evidence));
await settle();
// Only the existing explicit category confirmation can write. IA is cancelled while it runs.
globalThis.healthAiGate = new Promise(resolve => { finish = resolve; });
await act(async () => button(container, "Actualizar explicación").click());
await act(async () => [...container.querySelectorAll("button")].find(node => node.textContent === "Revisar categoría").click());
let finishApply; globalThis.healthApplyGate = new Promise(resolve => { finishApply = resolve; });
await act(async () => button(container, "Aplicar categoría").click()); assert.equal(globalThis.healthWrites.length, 1); assert.equal(globalThis.healthAiCalls.at(-1).signal.aborted, true);
await act(async () => { finish({ ok: true, reply: "DURING_WRITE" }); finishApply(); }); await settle(); assert.doesNotMatch(container.textContent, /DURING_WRITE/); globalThis.healthAiGate = null; globalThis.healthApplyGate = null;
await act(async () => button(container, "Cerrar").click());
for (const extra of [{ ready: false }, { healthReady: false }, { userId: undefined }]) { await render(extra); assert.equal(button(container, "Generar explicación").disabled, true); assert.doesNotMatch(container.textContent, /HEALTH_EXPLANATION/); }
await render({ enabled: false }); assert.equal([...container.querySelectorAll("summary")].some(node => node.textContent === "Explicar mi salud financiera con IA"), false);
await render({ userId: "health-refresh" });
let finishRead, refresh; globalThis.healthEvidenceGate = new Promise(resolve => { finishRead = resolve; });
await act(async () => { refresh = queryClient.refetchQueries({ queryKey: ["dashboard-category-evidence", "health-refresh", 8] }); }); await settle();
assert.equal(button(container, "Generar explicación").disabled, true, "evidence refresh must block AI even with previous evidence cached");
await act(async () => { finishRead(); await refresh; }); await settle(); globalThis.healthEvidenceGate = null;
assert.equal(button(container, "Generar explicación").disabled, false);
await render({ userId: "health-viewer", canEdit: false, snapshot: { ...snapshot, workspace: { ...snapshot.workspace, role: "viewer" } } });
assert.ok([...container.querySelectorAll("button")].filter(node => node.textContent === "Revisar categoría").every(node => node.disabled));
await act(async () => button(container, "Generar explicación").click()); assert.equal(globalThis.healthWrites.length, 1, "read-only explanation cannot apply categories");
await render({ userId: "health-quota", isAdmin: false }); await act(async () => button(container, "Generar explicación").click()); await render({ userId: "health-quota", isAdmin: false, ctx: { ...ctx, displayCurrency: "USD" }, health: { ...base.health, currency: "USD" } }); assert.equal(button(container, "Consulta de hoy usada").disabled, true);
await render({ userId: "health-partial" }); await act(async () => queryClient.setQueryData(["dashboard-category-evidence", "health-partial", 8], { ...evidence, unavailable: ["missing"] })); await settle(); assert.equal(button(container, "Generar explicación").disabled, true);
await render({ userId: "health-server" }); globalThis.healthAiGate = Promise.resolve({ ok: true, cached: true, reply: "UNSCOPED_HEALTH" }); await act(async () => button(container, "Generar explicación").click()); assert.match(container.querySelector('[role="alert"]').textContent, /caché del servidor/); assert.doesNotMatch(container.textContent, /UNSCOPED_HEALTH/);
await act(async () => renderer.unmount()); queryClient.clear(); container.remove(); dom.window.close();
console.log("dashboard-ai-health: OK (original mobile serializer/shared review/readiness; six complete Lima months, real visible suggestions and one evidence query; overlapping totals vs unique duplicate rows, scope/FX/dates/nulls, heuristic labels, explicit AI and category-only confirmation, quotas/stale evidence/write/server-cache guards; fake IO only)");
