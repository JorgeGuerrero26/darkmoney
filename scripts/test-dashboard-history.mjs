import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import * as dates from "date-fns";
import { es } from "date-fns/locale";
import { React, act, dom, root, load, createRoot, MemoryRouter, change, button } from "./lib/web-ui-harness.mjs";
process.env.TZ = "America/Lima";
const { buildDashboardHistory, dashboardHistoryYears } = await import(load("src/modules/dashboard/lib/dashboard-history.ts"));
const web = await import(load("src/modules/dashboard/lib/history-view.ts"));
const phone = await import(load("../DarkMoneyApp/features/dashboard/lib/history-view.ts"));
const factor = await import(load("src/modules/dashboard/lib/history-factor-analysis.ts"));
const mobileFactor = await import(load("../DarkMoneyApp/services/analytics/history-factor-analysis.ts"));
const aggregations = await import(load("../DarkMoneyApp/features/dashboard/lib/aggregations.ts"));
const source = ts.createSourceFile("AdvancedDashboard.tsx", readFileSync(resolve(root, "../DarkMoneyApp/features/dashboard/components/advanced/AdvancedDashboard.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = new Map();
function visit(node) { if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name) && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(source) === "useMemo") callbacks.set(node.name.text, node.initializer.arguments[0].getText(source)); ts.forEachChild(node, visit); } visit(source);
const now = new Date("2026-10-15T17:00:00Z");
class Clock extends Date { constructor(...args) { if (args.length) super(...args); else super(now.getTime()); } }
function evaluate(name, env) { assert.ok(callbacks.has(name)); const code = ts.transpileModule(`const run=${callbacks.get(name)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; return new Function(...Object.keys(env), `${code};return run();`)(...Object.values(env)); }
const m = (id, date, kind, amount, categoryId = 1, extra = {}) => ({ id, workspaceId: 8, description: "Registro", occurredAt: `${date}T12:00:00-05:00`, movementType: kind, status: "posted", categoryId, counterpartyId: null, sourceAccountId: kind === "expense" ? 1 : null, sourceAmount: kind === "expense" ? amount : null, destinationAccountId: kind === "income" ? 1 : null, destinationAmount: kind === "income" ? amount : null, ...extra });
const movements = Array.from({ length: 9 }, (_, i) => [m(i * 3, `2026-${String(i + 1).padStart(2, "0")}-02`, "income", 1000 + i * 200), m(i * 3 + 1, `2026-${String(i + 1).padStart(2, "0")}-03`, "expense", 200 + i * 25), m(i * 3 + 2, `2026-${String(i + 1).padStart(2, "0")}-04`, "expense", 100 + i * 30, 2)]).flat();
movements.push(m(100, "2026-10-01", "expense", 50), m(101, "2025-02-01", "expense", 60), m(102, "2026-10-31", "income", 99999), m(103, "2026-11-01", "income", 99999), m(104, "2026-03-02", "expense", 99999, 1, { status: "voided" }), m(105, "2026-03-02", "income", 99999, 1, { description: "Corrección · Sueldo" }), m(106, "2026-03-02", "transfer", 99999), m(107, "2026-03-02", "adjustment", 99999), m(108, "2026-01-31", "expense", 10, 2, { occurredAt: "2026-02-01T04:59:59Z" }));
const snapshot = { workspace: { id: 8 }, movements, catalogs: { categories: [{ id: 1, name: "Comida" }, { id: 2, name: "Transporte" }] } };
const ctx = { baseCurrency: "PEN", displayCurrency: "PEN", exchangeRateMap: new Map([["USD:PEN", 3.7]]), accountCurrencyMap: new Map([[1, "PEN"], [2, "USD"], [3, "EUR"]]) };
const categoryMap = new Map(snapshot.catalogs.categories.map(row => [row.id, row.name]));
const env = { ...dates, ...aggregations, ...phone, Date: Clock, es, historyMovements: movements, accountCurrencyMap: ctx.accountCurrencyMap, exchangeRateMap: ctx.exchangeRateMap, activeCurrency: "PEN", baseCurrency: "PEN", categoryMap, buildHistoryFactorAnalysis: mobileFactor.buildHistoryFactorAnalysis };
for (const year of [2025, 2026, 2027]) {
  const model = buildDashboardHistory(snapshot, ctx, year, now), expected = evaluate("annualHistory", { ...env, selectedHistoryYear: year });
  for (let i = 0; i < 12; i++) for (const key of ["income", "expense", "net", "cumulativeNet", "dateFrom", "dateTo", "isFuture"]) assert.equal(model.months[i][key], expected[i][key], year + ":" + i + ":" + key);
  assert.deepEqual(model.totals, phone.historyYearTotals(expected)); assert.deepEqual(web.historyYearTotals(model.months), phone.historyYearTotals(model.months)); assert.deepEqual(web.recentNetComparison(model.months), phone.recentNetComparison(model.months));
  for (const month of model.months) assert.equal(web.monthReading(month, model.months, month.dateFrom.startsWith("2026-10")), phone.monthReading(month, model.months, month.dateFrom.startsWith("2026-10")));
  const analysis = evaluate("historyFactorAnalysis", { ...env, selectedHistoryYear: year });
  for (const key of ["title", "body", "explainedVariancePct", "topCategories"]) assert.deepEqual(model.factors?.[key], analysis?.[key]);
  assert.deepEqual(model.factors, factor.buildHistoryFactorAnalysis({ months: model.months }));
}
const model = buildDashboardHistory(snapshot, ctx, 2026, now); assert.equal(model.months[0].expense, 310); assert.equal(model.months[9].dateTo, "2026-10-15"); assert.equal(model.months[10].income, 0); assert.equal(model.months[2].correctionIds.length, 2); assert.equal(model.months[2].totalCount, 6);
assert.deepEqual(dashboardHistoryYears(snapshot, now), [2026, 2025]);
const unconverted = buildDashboardHistory({ ...snapshot, movements: [...movements, m(200, "2026-01-02", "expense", 20, 1, { sourceAccountId: 3 })] }, ctx, 2026, now); assert.equal(unconverted.complete, false); assert.equal(unconverted.totals, null); assert.equal(unconverted.factors, null); assert.equal(unconverted.comparison, null); assert.equal(unconverted.unconvertedCount, 1);
const leap = buildDashboardHistory(snapshot, ctx, 2028, new Date("2028-02-29T17:00:00Z")); assert.equal(leap.months[1].dateTo, "2028-02-29"); assert.throws(() => buildDashboardHistory(snapshot, ctx, NaN, now));
const empty = buildDashboardHistory({ ...snapshot, movements: [] }, ctx, 2026, now); assert.equal(empty.factors, null); assert.equal(empty.comparison, null); assert.equal(empty.totals.income, 0);

const { DashboardHistoryPanel } = await import(load("src/modules/dashboard/components/dashboard-history-panel.tsx"));
const container = document.createElement('div'); document.body.append(container); const renderer = createRoot(container); let retries = 0;
async function render(value = snapshot, ready = true) { await act(async () => renderer.render(React.createElement(MemoryRouter, null, React.createElement(DashboardHistoryPanel, { snapshot: value, ctx, now, ready, onRetry: () => { retries++; } })))); }
await render();
const chart=container.querySelector('[aria-label="Neto de cada mes"]');assert.ok(chart);assert.equal(chart.querySelectorAll('button').length,12);
const marchBar=[...chart.querySelectorAll('button')].find(node=>node.getAttribute('aria-label').startsWith(model.months[2].label+':'));assert.equal(marchBar.disabled,false);
await act(async()=>marchBar.click());assert.match(container.querySelector('[role="dialog"]').textContent,/2 correcciones excluidas/);await act(async()=>container.querySelector('[role="dialog"] button').click());
assert.match(container.textContent, /Neto de 2026/); assert.match(container.textContent, /asociación estadística/); const factorLink = [...container.querySelectorAll('a')].find(node => node.getAttribute('href').includes('categoryId=')); assert.ok(factorLink); assert.equal(new URL(factorLink.href).searchParams.get('from'), "2026-01-01");
await act(async () => button(container, "Ver los 10 meses").click()); const march = [...container.querySelectorAll('button')].find(node => node.textContent.toLowerCase().startsWith('marzo')); assert.ok(march, [...container.querySelectorAll('button')].map(node => node.textContent).join('|')); await act(async () => march.click()); const modal = container.querySelector('[role="dialog"]'); assert.match(modal.textContent, /2 correcciones excluidas/); assert.match(modal.textContent, /2026-03-01 a 2026-03-31/); const monthLink = [...modal.querySelectorAll('a')].find(node => node.textContent === 'Ver movimientos del mes'); assert.equal(new URL(monthLink.href).searchParams.get('status'), "posted");
await change(container.querySelector('select[aria-label="Año del historial"]'), "2025"); assert.equal(container.querySelector('[role="dialog"]'), null); assert.match(container.textContent, /Neto de 2025/);
await change(container.querySelector('select[aria-label="Año del historial"]'), "2026"); await render({ ...snapshot, movements: [...movements, m(200, "2026-01-02", "expense", 20, 1, { sourceAccountId: 3 })] }); assert.match(container.textContent, /No mostramos un total anual/); assert.doesNotMatch(container.textContent, /Neto de 2026/);
const unknownMonth=container.querySelector('[aria-label="Neto de cada mes"] button[aria-label$="faltan conversiones"]');assert.ok(unknownMonth);assert.equal(unknownMonth.disabled,true);
await render(snapshot, false); assert.doesNotMatch(container.textContent, /Neto de 2026/); await act(async () => button(container, "Reintentar lectura").click()); assert.equal(retries, 1);
// The destination's exact missing-category predicate, extracted from the actual Movements page.
const movementSource = ts.createSourceFile('movements.tsx', readFileSync(resolve(root, 'src/modules/movements/pages/movements-page.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let categoryPredicate;
function findCategory(node) { if (ts.isVariableDeclaration(node) && node.name.getText(movementSource) === 'matchesCategory') categoryPredicate = node.initializer.getText(movementSource); ts.forEachChild(node, findCategory); } findCategory(movementSource); assert.ok(categoryPredicate);
const matches = new Function('movement', 'normalizedCategory', 'linkedCategoryId', 'linkedUncategorized', 'return ' + categoryPredicate);
assert.equal(matches({ category: 'Sin categoria', categoryId: null }, '', null, true), true); assert.equal(matches({ category: 'Sin categoria', categoryId: 99 }, '', null, true), false); assert.equal(matches({ category: 'Comida', categoryId: 1 }, '', 1, false), true); assert.equal(matches({ category: 'Comida', categoryId: 2 }, '', 1, false), false);
await act(async () => renderer.unmount()); container.remove(); dom.window.close();
console.log("Dashboard history: actual mobile annual/factor callbacks and presentation rules, complete native ledger, year/month scope, corrections/transfers/future/FX guards, leap/Lima boundaries, React detail and exact category links passed locally.");
