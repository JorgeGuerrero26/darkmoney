import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, dom, root, load, mock, createRoot, MemoryRouter, button, settle } from "./lib/web-ui-harness.mjs";

process.env.TZ = "America/Lima";
function sourceVariable(file, name) {
  const source = ts.createSourceFile(file, readFileSync(resolve(root, file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) result = node.initializer.arguments[0].getText(source); ts.forEachChild(node, visit); }
  visit(source); assert.ok(result, name); return result;
}
function callback(source, env) {
  const js = ts.transpileModule(`const run=${source}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(env), `${js};return run();`)(...Object.values(env));
}
// Execute the actual web transport mutation, not a parallel implementation.
const queriesFile = "src/services/queries/workspace-data.ts";
const queries = ts.createSourceFile(queriesFile, readFileSync(resolve(root, queriesFile), "utf8"), ts.ScriptTarget.Latest, true);
const mutation = queries.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === "useDashboardAiSummaryMutation");
const mutationJs = ts.transpileModule(mutation.getText(queries).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const transportCalls = [];
const useTransport = new Function("useMutation", "invokeAuthenticatedFunction", `${mutationJs};return useDashboardAiSummaryMutation;`)(options => options,
  async (...args) => { transportCalls.push(args); return { ok: true, reply: "Transport verified" }; });
const mobileQueries = readFileSync(resolve(root, "../DarkMoneyApp/services/queries/workspace-data.ts"), "utf8");
const signal = new AbortController().signal;
for (const section of ["summary", "patterns", "flow", "history", "health"]) {
  const endpoint = `dashboard-advanced-ai-${section}`;
  assert.ok(mobileQueries.includes(`"${endpoint}"`));
  const options = useTransport(section);
  await options.mutationFn({ workspaceId: 8, summary: { currency: "PEN" }, tone: "personal", signal });
  assert.deepEqual(options.mutationKey, ["dashboard-ai", section]);
  assert.deepEqual(transportCalls.at(-1), [endpoint, { workspaceId: 8, summary: { currency: "PEN" }, tone: "personal" }, { signal }]);
}
for (const invalid of [{ workspaceId: null }, { workspaceId: -1 }, { workspaceId: 0.5 }, { summary: null }, { summary: [] }, { tone: "invalid" }]) {
  await assert.rejects(useTransport().mutationFn({ workspaceId: 8, summary: {}, tone: "personal", ...invalid }));
}
await assert.rejects(useTransport("not-a-section").mutationFn({ workspaceId: 8, summary: {}, tone: "personal" }));
assert.equal(transportCalls.length, 5);

globalThis.aiSectionCalls = [];
globalThis.aiSectionGate = null;
mock(queriesFile, "export const useDashboardAiSummaryMutation=(section='summary')=>({isPending:false,mutateAsync:async input=>{globalThis.aiSectionCalls.push({section,...input});return globalThis.aiSectionGate?await globalThis.aiSectionGate:{ok:true,reply:'EXPLANATION '+section,complexTerms:[]};}});");
const { buildDashboardPatterns } = await import(load("src/modules/dashboard/lib/dashboard-patterns.ts"));
const { buildDashboardAiPatternsPayload } = await import(load("src/modules/dashboard/lib/build-ai-patterns-payload.ts"));
const { formatCurrency } = await import(load("src/lib/formatting/money.ts"));
const now = new Date("2026-10-15T17:00:00Z");
const movement = (id, day, amount, extra = {}) => ({ id, workspaceId: 8, description: "Taxi", occurredAt: `${day}T12:00:00-05:00`, movementType: "expense", status: "posted", categoryId: 1, counterpartyId: null, sourceAccountId: 1, sourceAmount: amount, destinationAccountId: null, destinationAmount: null, ...extra });
const snapshot = { workspace: { id: 8, name: "Personal" }, accounts: [{ id: 1, name: "Principal" }], catalogs: { categories: [{ id: 1, name: "Transporte" }, { id: 2, name: "Alimentación" }] }, movements: [
  movement(1, "2026-09-05", 10), movement(2, "2026-09-07", 10), movement(3, "2026-09-09", 10), movement(4, "2026-09-11", 10),
  movement(5, "2026-10-03", 120), movement(6, "2026-10-03", 120), movement(7, "2026-10-05", 40, { description: "Mercado", categoryId: 2 }),
  movement(8, "2026-10-06", 40, { description: "Mercado", categoryId: 2 }), movement(9, "2026-10-10", 100, { description: "Compra", categoryId: null }),
] };
const ctx = { baseCurrency: "PEN", displayCurrency: "PEN", accountCurrencyMap: new Map([[1, "PEN"], [2, "EUR"]]), exchangeRateMap: new Map() };
const model = buildDashboardPatterns(snapshot, ctx, now);
const payload = buildDashboardAiPatternsPayload(model, "PEN", snapshot.workspace.name);
assert.ok(payload); assert.ok(model.habits.length && model.anomalies.length && model.rises.length);
const mobileFile = "../DarkMoneyApp/features/dashboard/components/advanced/AdvancedDashboard.tsx";
const categoryConcentration = callback(sourceVariable(mobileFile, "categoryConcentration"), {
  advancedStats: { catTotals: new Map(model.categories.map(row => [row.id, row.amount])) },
  categoryMap: new Map(snapshot.catalogs.categories.map(row => [row.id, row.name])), COLORS: {},
});
const topDay = model.weekdays.reduce((best, row) => row.average > best.average ? row : best, model.weekdays[0]);
const mobilePayload = callback(sourceVariable(mobileFile, "dashboardAiPatternsPayload"), {
  activeCurrency: "PEN", formatCurrency,
  repeatedPatterns: model.habits.map(row => ({ ...row, lastLabel: new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", timeZone: "America/Lima" }).format(new Date(row.lastAt)) })),
  risingCategoryPatterns: model.rises.map(row => ({ ...row, pct: row.previous > 0 ? row.delta / row.previous * 100 : null })),
  anomalySignals: model.anomalies.map(row => ({ ...row, body: "mobile presentation", meta: "mobile presentation" })),
  patternMovementMap: new Map(snapshot.movements.map(row => [row.id, row])), accountMap: new Map([[1, "Principal"]]),
  movementDisplayAccountId: row => row.sourceAccountId, expenseTitle: value => value,
  patternQuickRead: {}, weeklyPatternInsight: { dayLabel: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][topDay.index], share: Math.round(topDay.total / model.weekdays.reduce((sum, row) => sum + row.total, 0) * 100) }, categoryConcentration,
});
for (const key of ["repeatedPatternsCount", "risingCategoriesCount", "anomalySignalsCount", "topHabit", "topRise", "risingCategoriesTop", "weeklyPatternInsight", "categoryConcentration"]) assert.deepEqual(payload[key], mobilePayload[key], key);
assert.deepEqual(payload.repeatedPatternsTop.map(({ lastSeen, ...row }) => row), mobilePayload.repeatedPatternsTop.map(({ lastSeen, ...row }) => row));
assert.deepEqual(payload.anomalySignalsTop.map(({ title, level, reasons }) => ({ title, level, reasons })), mobilePayload.anomalySignalsTop.map(({ title, level, reasons }) => ({ title, level, reasons })));
assert.equal(payload.period.timezone, "America/Lima"); assert.equal(payload.period.categoriesFrom, "2026-10-01");
assert.ok(JSON.stringify(payload).length < 12000); assert.equal(payload.repeatedPatternsTop.length <= 4, true);
assert.equal(JSON.stringify(payload).includes('"sourceAccountId"'), false);
assert.equal(buildDashboardAiPatternsPayload({ ...model, complete: false }, "PEN", "Personal"), null);
assert.equal(buildDashboardAiPatternsPayload({ ...model, movements: [{ amount: NaN }] }, "PEN", "Personal"), null);
const empty = buildDashboardAiPatternsPayload(buildDashboardPatterns({ ...snapshot, movements: [] }, ctx, now), "PEN", "Personal");
assert.equal(empty.weeklyPatternInsight, null); assert.equal(empty.categoryConcentration.hhi, null); assert.equal(empty.topHabit, null);
const unknown = buildDashboardPatterns({ ...snapshot, movements: [...snapshot.movements, movement(20, "2026-10-04", 999, { sourceAccountId: 2 })] }, ctx, now);
assert.equal(buildDashboardAiPatternsPayload(unknown, "PEN", "Personal"), null);
for (const timezone of ["UTC", "Europe/Madrid", "America/Los_Angeles"]) {
  process.env.TZ = timezone; assert.deepEqual(buildDashboardAiPatternsPayload(buildDashboardPatterns(snapshot, ctx, now), "PEN", "Personal"), payload);
}
process.env.TZ = "America/Lima";

const { useDashboardAiSummary, getDashboardAiUsageDate } = await import(load("src/modules/dashboard/hooks/use-dashboard-ai-summary.ts"));
let renderer, container;
function HookHost(props) { globalThis.aiHook = useDashboardAiSummary(props); return React.createElement("div", null, globalThis.aiHook.currentResponse?.reply ?? "NO_REPLY"); }
async function render(element) {
  if (!renderer) { container = document.createElement("div"); document.body.append(container); renderer = createRoot(container); }
  await act(async () => renderer.render(element));
}
const base = { userId: "sections", workspaceId: 8, currencyCode: "PEN", section: "patterns", contextKey: "period-A", enabled: true, isAdmin: false };
const hook = props => render(React.createElement(HookHost, { ...base, ...props }));
const request = () => globalThis.aiHook.requestSummary(8, { currency: "PEN" });
const rejects = (fn, pattern) => act(async () => { await assert.rejects(fn, pattern); });
await hook(); assert.equal(globalThis.aiSectionCalls.length, 0);
await act(async () => request()); assert.match(container.textContent, /EXPLANATION patterns/); assert.equal(globalThis.aiHook.limitReached, true);
await hook({ contextKey: "period-B" }); assert.equal(globalThis.aiHook.currentResponse, null); assert.equal(globalThis.aiHook.limitReached, true);
await rejects(request, /hoy/); assert.equal(globalThis.aiSectionCalls.length, 1);
await hook({ section: "flow" }); assert.equal(globalThis.aiHook.limitReached, false); assert.equal(globalThis.aiHook.currentResponse, null);
await act(async () => request()); assert.equal(globalThis.aiSectionCalls.at(-1).section, "flow");
await hook({ section: "summary" }); assert.equal(globalThis.aiHook.limitReached, false);
await hook({ workspaceId: 9 }); assert.equal(globalThis.aiHook.currentResponse, null); assert.equal(globalThis.aiHook.limitReached, true);
await rejects(() => globalThis.aiHook.requestSummary(8, { currency: "PEN" }), /espacio/);
await hook({ currencyCode: "USD" }); assert.equal(globalThis.aiHook.currentResponse, null); assert.equal(globalThis.aiHook.limitReached, true);
await hook({ userId: "another" }); assert.equal(globalThis.aiHook.limitReached, false); assert.equal(globalThis.aiHook.currentResponse, null);
await hook({ enabled: false }); await rejects(request, /espacio/); assert.equal(globalThis.aiHook.currentResponse, null);

let finish; let pending;
globalThis.aiSectionGate = new Promise(resolve => { finish = resolve; });
await hook({ userId: "late", isAdmin: true });
const oldRequest = globalThis.aiHook.requestSummary;
await act(async () => { pending = request(); }); assert.equal(globalThis.aiHook.isPending, true);
await rejects(request, /en curso/);
const count = globalThis.aiSectionCalls.length;
await hook({ userId: "late", isAdmin: true, contextKey: "period-B" }); assert.equal(globalThis.aiSectionCalls.at(-1).signal.aborted, true); assert.equal(globalThis.aiHook.isPending, false);
await rejects(() => oldRequest(8, { currency: "PEN" }), /espacio/);
await hook({ userId: "late", isAdmin: true });
await act(async () => { finish({ ok: true, reply: "LATE_REPLY", complexTerms: [] }); await pending; });
assert.doesNotMatch(container.textContent, /LATE_REPLY/);
globalThis.aiSectionGate = null;

// A tab unmount/remount still shares the immediate per-user/section flight lock.
await hook({ userId: "remount", isAdmin: true });
globalThis.aiSectionGate = new Promise(resolve => { finish = resolve; });
await act(async () => { pending = request(); });
await act(async () => renderer.unmount()); container.remove(); renderer = null;
await hook({ userId: "remount", isAdmin: true });
await rejects(request, /en curso/);
await act(async () => { finish({ ok: true, reply: "UNMOUNTED_REPLY" }); await pending; });
assert.doesNotMatch(container.textContent, /UNMOUNTED_REPLY/);
globalThis.aiSectionGate = null;

await hook({ userId: "access-loss", isAdmin: true });
globalThis.aiSectionGate = new Promise(resolve => { finish = resolve; });
await act(async () => { pending = request(); });
await hook({ userId: "access-loss", isAdmin: true, enabled: false });
assert.equal(globalThis.aiSectionCalls.at(-1).signal.aborted, true);
await act(async () => { finish({ ok: true, reply: "AFTER_ACCESS_LOSS" }); await pending; });
await hook({ userId: "access-loss", isAdmin: true }); assert.equal(globalThis.aiHook.currentResponse, null);
globalThis.aiSectionGate = null;

// Unscoped server cache cannot be relabelled with the current currency/year/user.
await hook({ userId: "server-cache", isAdmin: true });
globalThis.aiSectionGate = Promise.resolve({ ok: true, cached: true, reply: "OTHER_CONTEXT" });
await act(async () => { await assert.rejects(request(), /caché del servidor/); });
assert.equal(globalThis.aiHook.currentResponse, null); assert.doesNotMatch(container.textContent, /OTHER_CONTEXT/);
assert.match(globalThis.aiHook.error.message, /moneda o período/); globalThis.aiSectionGate = null;
const today = getDashboardAiUsageDate();
window.localStorage.setItem("darkmoney.dashboard.aiSummaryCache.legacy-v3.8.PEN.lima-calendar-v3", JSON.stringify({ usageDate: today, lastUsedAt: new Date().toISOString(), responses: { personal: { reply: "UNVERIFIED_V3", generatedAt: new Date().toISOString(), complexTerms: [] } } }));
await hook({ userId: "legacy-v3", section: "summary" }); assert.equal(globalThis.aiHook.currentResponse, null); assert.equal(globalThis.aiHook.limitReached, true); await rejects(request, /hoy/);
await hook({ userId: "legacy-v3", section: "summary", workspaceId: 9 }); assert.equal(globalThis.aiHook.limitReached, true);
window.localStorage.setItem("darkmoney.dashboard.aipatternsCache.corrupt.8.PEN.section-context-v4", JSON.stringify({ usageDate: today, contextKey: "period-A", responses: { personal: { reply: "CORRUPT_REPLY", generatedAt: "invalid-date", complexTerms: [] } } }));
await hook({ userId: "corrupt" }); assert.equal(globalThis.aiHook.currentResponse, null);
assert.equal(getDashboardAiUsageDate(new Date("2026-10-16T04:59:59Z")), "2026-10-15");
assert.equal(getDashboardAiUsageDate(new Date("2026-10-16T05:00:00Z")), "2026-10-16");

// Storage failure must not grant another daily request in this running client.
const storagePrototype = Object.getPrototypeOf(window.localStorage), setItem = storagePrototype.setItem;
storagePrototype.setItem = () => { throw new Error("Storage blocked"); };
try {
  await hook({ userId: "blocked-storage" }); await act(async () => request());
  await hook({ userId: "blocked-storage", workspaceId: 9 }); assert.equal(globalThis.aiHook.limitReached, true);
} finally { storagePrototype.setItem = setItem; }
// A handler captured before Lima midnight cannot retain yesterday's quota tomorrow.
await hook({ userId: "midnight" }); await act(async () => request());
const yesterdayHandler = globalThis.aiHook.requestSummary, RealDate = globalThis.Date;
const tomorrow = RealDate.now() + 86400000;
globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [tomorrow])); } static now() { return tomorrow; } };
try { await act(async () => yesterdayHandler(8, { currency: "PEN" })); } finally { globalThis.Date = RealDate; }


// Actual section, shared explanation panel and hook: explicit generation, no writes.
const { DashboardPatternsSection } = await import(load("src/modules/dashboard/components/dashboard-patterns-section.tsx"));
const props = { snapshot, ctx, now, userId: "panel", isAdmin: true, ready: true, enabled: true };
const section = values => render(React.createElement(MemoryRouter, null, React.createElement(DashboardPatternsSection, { ...props, ...values })));
await section(); const beforeOpen = globalThis.aiSectionCalls.length;
await act(async () => { container.querySelector("details").open = true; });
assert.equal(globalThis.aiSectionCalls.length, beforeOpen); assert.match(container.textContent, /Tus patrones explicados/);
await act(async () => button(container, "Generar explicación").click()); await settle();
assert.equal(globalThis.aiSectionCalls.length, beforeOpen + 1); assert.equal(globalThis.aiSectionCalls.at(-1).section, "patterns");
assert.deepEqual(globalThis.aiSectionCalls.at(-1).summary, payload); assert.match(container.textContent, /EXPLANATION patterns/); assert.match(container.textContent, /lectura guardada/);
await section({ ready: false }); assert.doesNotMatch(container.textContent, /EXPLANATION patterns/); assert.equal(button(container, "Generar explicación").disabled, true);
await section({ snapshot: { ...snapshot, movements: [...snapshot.movements, movement(20, "2026-10-04", 999, { sourceAccountId: 2 })] } });
assert.equal(button(container, "Generar explicación").disabled, true); assert.match(container.textContent, /no enviamos un historial monetario parcial/);
await section({ enabled: false }); assert.equal(container.querySelector("details"), null);
assert.equal(globalThis.aiSectionCalls.length, beforeOpen + 1);
await act(async () => renderer.unmount()); container.remove(); dom.window.close();
console.log(`dashboard-ai-sections: OK (five native transports; original mobile Patterns payload/concentration; bounded native context; quota, scope, cancellation, remount, Pro/read/FX guards, unsafe server cache and real UI; ${count} pre-cancellation calls; no live AI or financial writes)`);
