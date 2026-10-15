import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import * as dates from "date-fns";
import { React, act, dom, root, load, createRoot, MemoryRouter } from "./lib/web-ui-harness.mjs";

const { buildAdvancedReadings } = await import(load("src/modules/dashboard/lib/dashboard-advanced-readings.ts"));
const phoneIndex = await import(load("../DarkMoneyApp/features/dashboard/selectors/movements-index.ts"));
const phoneSelectors = await import(load("../DarkMoneyApp/features/dashboard/selectors/dashboard-stats-selectors.ts"));
const phoneAggregations = await import(load("../DarkMoneyApp/features/dashboard/lib/aggregations.ts"));
const phoneHistory = await import(load("../DarkMoneyApp/features/dashboard/lib/history-view.ts"));
const file = resolve(root, "../DarkMoneyApp/features/dashboard/components/advanced/AdvancedDashboard.tsx");
const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), callbacks = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name) && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(source) === "useMemo") callbacks.set(node.name.text, node.initializer.arguments[0].getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
function evaluate(name, env) {
  assert.ok(callbacks.has(name));
  const js = ts.transpileModule(`const run=${callbacks.get(name)};`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  return new Function(...Object.keys(env), `${js};return run();`)(...Object.values(env));
}
const now = new Date(2026, 9, 15, 12);
class Clock extends Date { constructor(...args) { if (args.length) super(...args); else super(now.getTime()); } }
const m = (id, date, kind, amount, categoryId = 1, extra = {}) => ({ id, occurredAt: `${date}T12:00:00-05:00`, movementType: kind, status: "posted", description: "Registro", categoryId, counterpartyId: null,
  sourceAccountId: kind === "expense" ? 1 : null, sourceAmount: kind === "expense" ? amount : null, destinationAccountId: kind === "income" ? 1 : null, destinationAmount: kind === "income" ? amount : null, ...extra });
const movements = [m(1,"2026-10-02","income",1000),m(2,"2026-10-03","expense",300),m(3,"2026-10-04","expense",100,2),m(4,"2025-10-01","income",2000),m(5,"2025-10-15","expense",300),m(6,"2025-10-31","expense",500)];
const snapshot = { workspace: { id: 7 }, movements, catalogs: { categories: [{ id: 1, name: "Comida" }, { id: 2, name: "Transporte" }] } };
const ctx = { baseCurrency: "PEN", displayCurrency: "PEN", exchangeRateMap: new Map([["USD:PEN",3.7]]), accountCurrencyMap: new Map([[1,"PEN"],[2,"USD"],[3,"EUR"]]) };
const model = buildAdvancedReadings(snapshot, ctx, now);
const categoryMap = new Map(snapshot.catalogs.categories.map(c => [c.id,c.name]));
const catTotals = phoneSelectors.selectCategoryTotals(phoneIndex.buildMovementsIndex(movements),dates.startOfMonth(now),now,ctx);
const env = { ...dates, ...phoneAggregations, ...phoneHistory, Date: Clock, historyMovements: movements, advancedStats: { catTotals }, categoryMap,
  COLORS: { storm:"storm", income:"income", expense:"expense" }, accountCurrencyMap: ctx.accountCurrencyMap, exchangeRateMap:ctx.exchangeRateMap, activeCurrency:"PEN", baseCurrency:"PEN" };
const concentration = evaluate("categoryConcentration",env), seasonal = evaluate("seasonalComparison",env);
for (const key of ["hhi","label","topCategoryId","topCategory","topShare"]) assert.equal(model.concentration[key],concentration[key],key);
for (const key of ["curIncome","curExpense","prevIncome","prevExpense","incomeDelta","expenseDelta","hasHistory"]) assert.equal(model.seasonal[key],seasonal[key],key);
assert.equal(model.concentration.hhi,0.625); assert.equal(model.concentration.topShare,75); assert.equal(model.seasonal.expenseDelta,-50);
assert.equal(model.seasonal.previousTo,"2025-10-31");
for (const n of [1,4,5,10]) {
  const data = Array.from({length:n},(_,i)=>m(i,"2026-10-03","expense",10,i+1));
  const result = buildAdvancedReadings({...snapshot,movements:data},ctx,now);
  const reference = evaluate("categoryConcentration",{...env,advancedStats:{catTotals:phoneSelectors.selectCategoryTotals(phoneIndex.buildMovementsIndex(data),dates.startOfMonth(now),now,ctx)}});
  assert.equal(result.concentration.hhi,reference.hhi);assert.equal(result.concentration.label,reference.label);
}
const missing = buildAdvancedReadings({...snapshot,movements:[...movements,m(7,"2026-10-05","expense",30,3,{sourceAccountId:3})]},ctx,now);
assert.equal(missing.concentration.hhi,null);assert.equal(missing.concentration.topShare,null);assert.equal(missing.seasonal.expenseDelta,null);assert.equal(missing.seasonal.complete,false);
const invalid = [m(7,"2026-10-05","expense",999,1,{status:"planned"}),m(8,"2026-10-06","expense",999,1,{status:"voided"}),m(9,"2026-10-20","expense",999),m(10,"2025-10-04","income",999,1,{description:"Corrección · Banco"})];
const filtered = buildAdvancedReadings({...snapshot,movements:[...movements,...invalid]},ctx,now);
assert.equal(filtered.concentration.hhi,model.concentration.hhi);assert.equal(filtered.seasonal.prevIncome,2000);
const insufficient = buildAdvancedReadings({...snapshot,movements:[...movements.filter(m=>m.id<4),m(20,"2025-10-04","income",10),m(21,"2025-10-06","income",100,1,{status:"voided"}),m(22,"2025-10-07","income",100,1,{status:"planned"})]},ctx,now);
assert.equal(insufficient.seasonal.hasHistory,false);assert.equal(insufficient.seasonal.incomeDelta,null);
const empty = buildAdvancedReadings({...snapshot,movements:[]},ctx,now);assert.equal(empty.concentration.hhi,null);assert.equal(empty.seasonal.hasHistory,false);
const noIncomeReference = buildAdvancedReadings({...snapshot,movements:[...movements.filter(m=>m.id!==4),m(4,"2025-10-01","expense",10)]},ctx,now);
assert.equal(noIncomeReference.seasonal.incomeDelta,null);
const leap = buildAdvancedReadings({...snapshot,movements:[]},ctx,new Date(2028,1,29,12));assert.equal(leap.seasonal.previousTo,"2027-02-28");assert.equal(leap.seasonal.currentTo,"2028-02-29");

const { AdvancedReadingsPanel } = await import(load("src/modules/dashboard/components/advanced-readings-panel.tsx"));
const container = document.createElement("div");document.body.append(container);const renderer=createRoot(container);
const render=async model=>act(async()=>renderer.render(React.createElement(MemoryRouter,null,React.createElement(AdvancedReadingsPanel,{model,currency:"PEN"}))));
await render(model);assert.match(container.textContent,/HHI 0.625/);assert.match(container.textContent,/en curso/);assert.match(container.textContent,/mes completo/);assert.match(container.textContent,/-50.0%/);assert.match(container.querySelector("a").getAttribute("href"),/categoryId=1/);
await render(missing);assert.doesNotMatch(container.textContent,/-50.0%/);assert.match(container.textContent,/total parcial/);
await render(insufficient);assert.match(container.textContent,/al menos tres movimientos aplicados/);
await act(async()=>renderer.unmount());container.remove();dom.window.close();
console.log("dashboard-readings: OK (real mobile selectors/memo callbacks, HHI thresholds, seasonal bounds and partial/full disclosure, valid-history/FX guards, leap dates and actual panel; local only)");
