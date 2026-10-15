import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import * as dates from "date-fns";
import { React, act, dom, root, load, createRoot, MemoryRouter, button } from "./lib/web-ui-harness.mjs";
process.env.TZ = "America/Lima";
const { buildDashboardPatterns } = await import(load("src/modules/dashboard/lib/dashboard-patterns.ts"));
const webAnomaly = await import(load("src/modules/dashboard/lib/anomaly-detection.ts")), phoneAnomaly = await import(load("../DarkMoneyApp/services/analytics/anomaly-detection.ts"));
const webCluster = await import(load("src/modules/dashboard/lib/pattern-clustering.ts")), phoneCluster = await import(load("../DarkMoneyApp/services/analytics/pattern-clustering.ts"));
const phoneView = await import(load("../DarkMoneyApp/features/dashboard/lib/patterns-view.ts"));
const aggregations = await import(load("../DarkMoneyApp/features/dashboard/lib/aggregations.ts"));
const source = ts.createSourceFile("AdvancedDashboard.tsx", readFileSync(resolve(root, "../DarkMoneyApp/features/dashboard/components/advanced/AdvancedDashboard.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let riseCallback;
function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(source) === "risingCategoryPatterns") riseCallback = node.initializer.arguments[0].getText(source); ts.forEachChild(node, visit); } visit(source); assert.ok(riseCallback);
const now = new Date("2026-10-15T17:00:00Z"); class Clock extends Date { constructor(...args) { if (args.length) super(...args); else super(now.getTime()); } }
const m = (id, date, amount, extra = {}) => ({ id, description: "Taxi", occurredAt: `${date}T12:00:00-05:00`, movementType: "expense", status: "posted", categoryId: 1, counterpartyId: null, sourceAccountId: 1, sourceAmount: amount, destinationAccountId: null, destinationAmount: null, ...extra });
const movements = [m(1,"2026-09-04",10),m(2,"2026-09-06",10),m(3,"2026-09-07",10),m(4,"2026-09-08",10),m(5,"2026-10-03",120),m(6,"2026-10-03",120),m(7,"2026-10-05",40,{description:"Mercado",categoryId:2}),m(8,"2026-10-06",40,{description:"Mercado",categoryId:2}),m(9,"2026-10-10",100,{description:"Compra",categoryId:null})];
const snapshot = { workspace: { id: 8 }, movements, accounts: [{ id:1,name:"Principal" }], catalogs: { categories: [{ id:1,name:"Transporte" },{id:2,name:"Comida"}] } };
const ctx = { baseCurrency:"PEN", displayCurrency:"PEN", accountCurrencyMap:new Map([[1,"PEN"],[2,"USD"],[3,"EUR"]]), exchangeRateMap:new Map([["USD:PEN",3.7]]) };
const categoryMap = new Map(snapshot.catalogs.categories.map(row=>[row.id,row.name])), accountNames = new Map([[1,"Principal"]]);
const getAmount = row => aggregations.expenseAmt(row,ctx);
const anomalyOptions = { movements, getAmount, limit:4 };
assert.deepEqual(webAnomaly.detectMovementAnomalies(anomalyOptions),phoneAnomaly.detectMovementAnomalies(anomalyOptions));
const clusterOptions = { movements, getAmount, isCashflow:aggregations.isCategorizedCashflow, isIncomeLike:aggregations.isIncome, categoryNames:categoryMap, now, sinceDays:90, limit:movements.length };
assert.deepEqual(webCluster.buildPatternClusters(clusterOptions),phoneCluster.buildPatternClusters(clusterOptions));
const model = buildDashboardPatterns(snapshot,ctx,now); assert.ok(model.anomalies.length>0); assert.ok(model.habits.length>0);
assert.deepEqual(model.anomalies.map(({movement,title,...finding})=>finding),phoneAnomaly.detectMovementAnomalies(anomalyOptions));
const expectedHabits = phoneCluster.buildPatternClusters(clusterOptions).map(cluster=>({...cluster,...phoneView.habitPresentation(cluster,new Map(movements.map(row=>[row.id,row])),accountNames)})).sort((a,b)=>b.total-a.total).slice(0,4);
assert.deepEqual(model.habits.map(row=>[row.title,row.count,row.total,row.average,row.movementIds]),expectedHabits.map(row=>[row.title,row.count,row.total,row.average,row.movementIds]));
const weekly = phoneView.weeklySpendPattern(movements,getAmount,now);
for(let i=0;i<7;i++)for(const key of ["total","average","count"])assert.equal(model.weekdays[i][key],weekly.days[i][key]);
const env = {...dates,...aggregations,Date:Clock,movements,categoryMap,accountCurrencyMap:ctx.accountCurrencyMap,exchangeRateMap:ctx.exchangeRateMap,activeCurrency:"PEN",baseCurrency:"PEN"};
const callback = ts.transpileModule(`const run=${riseCallback};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const expectedRises = new Function(...Object.keys(env),`${callback};return run();`)(...Object.values(env));
assert.deepEqual(model.rises,expectedRises.map(({pct,...row})=>row));
for(const rows of [[],[m(1,"2026-10-02",10)],movements.map(row=>({...row,status:"pending"})),[...movements,m(20,"2026-10-31",99999)], [...movements,m(20,"2026-01-01",99999)], [...movements,m(20,"2026-10-03",99999,{description:"Corrección · Principal"})]]) {
 const result=buildDashboardPatterns({...snapshot,movements:rows},ctx,now); if(rows.length===0)assert.equal(result.habits.length,0); if(rows.length>movements.length) assert.deepEqual(result.rises,model.rises);
}
const unknown=buildDashboardPatterns({...snapshot,movements:[...movements,m(20,"2026-10-04",999,{sourceAccountId:3})]},ctx,now);assert.equal(unknown.complete,false);assert.equal(unknown.anomalies.length,0);assert.equal(unknown.habits.length,0);assert.equal(unknown.categories.length,0);
// The calendar stays in Lima even when the web browser is in another timezone.
const boundaryRows=[m(100,"2026-10-01",30,{occurredAt:"2026-10-01T04:59:59Z"})];process.env.TZ="UTC";const utc=buildDashboardPatterns({...snapshot,movements:boundaryRows},ctx,now);assert.equal(utc.categories.length,0);process.env.TZ="America/Lima";assert.deepEqual(utc,buildDashboardPatterns({...snapshot,movements:boundaryRows},ctx,now));
const { DashboardPatternsPanel } = await import(load("src/modules/dashboard/components/dashboard-patterns-panel.tsx"));
const container=document.createElement("div");document.body.append(container);const renderer=createRoot(container);
async function render(value=model,ready=true){await act(async()=>renderer.render(React.createElement(MemoryRouter,null,React.createElement(DashboardPatternsPanel,{model:value,currency:"PEN",ready}))));}
await render();assert.match(container.textContent,/no errores confirmados/);await act(async()=>button(container,`Revisar los ${model.anomalies.length}`).click());const modal=container.querySelector('[role="dialog"]');assert.ok(modal);assert.equal(modal.querySelectorAll('a').length,model.anomalies.length);assert.match(modal.querySelector('a').getAttribute('href'),/period=all&movement=/);await act(async()=>modal.querySelector('button').click());
const uncategorized=[...container.querySelectorAll('a')].find(node=>node.textContent.startsWith('Sin categoría'));assert.equal(new URL(uncategorized.href).searchParams.get('categoryId'),"none");assert.equal(new URL(uncategorized.href).searchParams.get('from'),"2026-10-01");
await render(unknown);assert.match(container.textContent,/historial monetario parcial/);assert.doesNotMatch(container.textContent,/No hay gastos fuera de costumbre/);await render(model,false);assert.match(container.textContent,/Comprobando/);assert.equal(container.querySelectorAll('a').length,0);
await act(async()=>renderer.unmount());container.remove();dom.window.close();
console.log("Dashboard patterns: original mobile anomaly/clustering/rise/weekly models, status/date/FX/correction guards, Lima boundaries, actual panels and explicit review links passed locally; no automatic changes.");
