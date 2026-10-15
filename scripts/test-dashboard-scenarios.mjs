import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import ts from "typescript";
import * as dates from "date-fns";
import * as aggregate from "@darkmoney/shared/aggregations";
import {convertParityAmount} from "@darkmoney/shared/currency";
import {React,act,dom,root,load,createRoot,MemoryRouter,button} from "./lib/web-ui-harness.mjs";
process.env.TZ="America/Lima";
const webSimulation=await import(load("src/modules/dashboard/lib/projection/cashflow-forecast.ts"));
const phoneSimulation=await import(load("../DarkMoneyApp/services/analytics/cashflow-forecast.ts"));
const webPriority=await import(load("src/modules/dashboard/lib/projection/payment-optimization.ts"));
const phonePriority=await import(load("../DarkMoneyApp/services/analytics/payment-optimization.ts"));
const {buildLegacyMonthProjection}=await import(load("src/modules/dashboard/lib/projection/legacy-month-scenarios.ts"));
const {buildDashboardCashflow}=await import(load("src/modules/dashboard/lib/projection/build-dashboard-cashflow.ts"));
const {buildDashboardScenarios}=await import(load("src/modules/dashboard/lib/projection/dashboard-scenarios.ts"));
const {parseDisplayDate}=await import(load("../DarkMoneyApp/lib/date.ts"));
const {obligationViewerDirection}=await import(load("src/modules/dashboard/lib/projection/projection-perspective.ts"));

function source(path){return ts.createSourceFile(path,readFileSync(resolve(root,path),"utf8"),ts.ScriptTarget.Latest,true);}
function nodeText(ast,name){const node=ast.statements.find(row=>ts.isFunctionDeclaration(row)&&row.name?.text===name);assert.ok(node,name);return node.getText(ast).replace(/^export /,"");}
function compile(text,env,name){const code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return new Function(...Object.keys(env),`${code};return ${name};`)(...Object.values(env));}
const convert=(amount,currencyCode,targetCurrencyCode,exchangeRateMap,baseCurrencyCode)=>convertParityAmount({amount,currencyCode,targetCurrencyCode,exchangeRateMap,baseCurrencyCode});
const future=compile(nodeText(source("../DarkMoneyApp/features/dashboard/lib/dashboard-builders.ts"),"buildFutureFlowItems"),{addDays:dates.addDays,parseDisplayDate,obligationViewerDirection,convertDashboardCurrency:convert},"buildFutureFlowItems");
const phoneMonth=compile(nodeText(source("../DarkMoneyApp/features/dashboard/lib/advanced-builders.ts"),"buildMonthProjectionModel"),{...dates,...aggregate,buildFutureFlowItems:future,simulateMonthEndCashflow:phoneSimulation.simulateMonthEndCashflow},"buildMonthProjectionModel");
const simulationAst=source("../DarkMoneyApp/services/analytics/cashflow-forecast.ts");
const withSamples=compile(simulationAst.statements.filter(ts.isFunctionDeclaration).map(node=>node.getText(simulationAst).replace(/^export /,"")).join("\n").replace("lowBalance: percentile(balances, 0.1)","samples: balances, lowBalance: percentile(balances, 0.1)"),{},"simulateMonthEndCashflow");
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
let simulations=0,models=0,priorities=0;
for(const currentBalance of [0,500,-300])for(const remainingDays of [0,1,16,30])for(const dailySamples of [[],[{income:0,expense:0}],[{income:0,expense:30},{income:100,expense:0},{income:0,expense:8}]]){
 const input={currentBalance,committedInflow:1200,committedOutflow:800,dailySamples,incomeDailyAverage:15,expenseDailyAverage:8,remainingDays};
 const original=phoneSimulation.simulateMonthEndCashflow(input);assert.deepEqual(webSimulation.simulateMonthEndCashflow(input),original);assert.deepEqual(webSimulation.simulateMonthEndCashflow(input),webSimulation.simulateMonthEndCashflow(input));simulations++;
 const samples=withSamples(input).samples;
 for(const balanceShift of [-2000,500]){
  const result=webSimulation.simulateMonthEndCashflow({...input,balanceShift});
  close(result.lowBalance,original.lowBalance+balanceShift);close(result.medianBalance,original.medianBalance+balanceShift);close(result.highBalance,original.highBalance+balanceShift);
  assert.equal(result.pressureThreshold,original.pressureThreshold);
  assert.equal(result.pressureProbability,Math.round(samples.filter(value=>value+balanceShift<original.pressureThreshold).length/samples.length*100));
 }
}
const now=new Date("2026-10-15T17:00:00Z");
const movement=(id,date,amount,extra={})=>({id,workspaceId:8,movementType:"expense",status:"posted",description:"Compra",occurredAt:`${date}T12:00:00-05:00`,categoryId:1,counterpartyId:null,sourceAccountId:1,sourceAmount:amount,destinationAccountId:null,destinationAmount:null,...extra});
const obligation=(id,direction="receivable",extra={})=>({id,workspaceId:8,title:`Acuerdo ${id}`,direction,status:"active",counterparty:"Lucía",currencyCode:"PEN",principalAmount:400,currentPrincipalAmount:400,pendingAmount:400,startDate:"2026-10-01",dueDate:"2026-10-20",installmentAmount:null,paymentPlan:null,events:[],...extra});
const history=Array.from({length:6},(_,i)=>movement(100+i,`2026-${String(i+4).padStart(2,"0")}-10`,60));
const recent=[movement(1,"2026-10-01",4000,{movementType:"income",sourceAccountId:null,sourceAmount:null,destinationAccountId:1,destinationAmount:4000}),movement(2,"2026-10-05",30),movement(3,"2026-10-10",20)];
const snapshot={workspace:{id:8},accounts:[{id:1,workspaceId:8,name:"Principal",type:"bank",currencyCode:"PEN",isArchived:false,currentBalance:500}],movements:[...history,...recent],obligations:[obligation(10),obligation(20,"payable")],subscriptions:[{id:30,workspaceId:8,name:"Servicio",amount:50,currencyCode:"PEN",status:"active",frequency:"monthly",intervalCount:1,nextDueDate:"2026-10-18"}],recurringIncome:[],catalogs:{categories:[{id:1,name:"Comida"}]}};
const ctx={baseCurrency:"PEN",displayCurrency:"PEN",accountCurrencyMap:new Map([[1,"PEN"],[2,"EUR"],[3,"USD"]]),exchangeRateMap:new Map([["USD:PEN",3.7]])};
const supplement={workspaceId:8,oneOffTypeIds:[],scheduledChanges:[]};
const eligible=snapshot.movements.filter(row=>new Date(row.occurredAt)>=dates.subDays(now,90));
for(const date of [now,new Date("2026-02-01T17:00:00Z"),new Date("2024-02-29T17:00:00Z"),new Date("2026-10-31T17:00:00Z")])for(const balance of [0,500,-300]){
 const args=[eligible,snapshot.obligations,snapshot.subscriptions,[],balance,ctx,date];
 assert.deepEqual(buildLegacyMonthProjection(...args),phoneMonth(...args));models++;
}
for(const pressureProbability of [0,25,45,100])for(const currentBalance of [0,500,-300])for(const dueDate of [null,"2026-10-10T12:00:00","2026-10-15T12:00:00","2026-10-20T12:00:00","2026-12-20T12:00:00"]){
 const input={obligations:[{id:1,title:"Cobro",direction:"receivable",amount:200,dueDate,status:"active",counterparty:"A"},{id:2,title:"Pago",direction:"payable",amount:300,dueDate,status:"active"}],currentBalance,weekExpectedInflow:100,weekExpectedOutflow:300,pressureProbability,today:now};
 assert.deepEqual(webPriority.buildPaymentOptimizationPlan(input),phonePriority.buildPaymentOptimizationPlan(input));priorities++;
}
const before=structuredClone(snapshot),cashflow=buildDashboardCashflow(snapshot,[],supplement,ctx,now,6);
const result=buildDashboardScenarios(snapshot,[],cashflow,ctx,now);assert.equal(result.available,true);assert.deepEqual(snapshot,before);
const original=phoneMonth(eligible,snapshot.obligations,snapshot.subscriptions,[],cashflow.liquid.total,ctx,now),shift=cashflow.monthEnd.expectedBalance-original.expectedBalance;
close(result.model.expectedBalance,cashflow.monthEnd.expectedBalance);close(result.model.conservativeBalance,original.conservativeBalance+shift);close(result.model.optimisticBalance,original.optimisticBalance+shift);
close(result.model.monteCarloLowBalance,original.monteCarloLowBalance+shift);close(result.model.monteCarloMedianBalance,original.monteCarloMedianBalance+shift);close(result.model.monteCarloHighBalance,original.monteCarloHighBalance+shift);
assert.ok(result.model.conservativeBalance<=result.model.expectedBalance);assert.ok(result.model.expectedBalance<=result.model.optimisticBalance);assert.notEqual(result.model.pressureProbability,original.pressureProbability,"Shifted distribution must not retain stale mobile pressure");
assert.equal(result.model.committedInflow,cashflow.monthEnd.committedInflow);assert.equal(result.model.committedOutflow,cashflow.monthEnd.committedOutflow);assert.equal(result.model.variableIncomeProjection,0);
for(const extra of [{status:"pending"},{workspaceId:99},{occurredAt:"2026-10-31T12:00:00Z"},{description:"Corrección · Principal"}]){
 const value=buildDashboardScenarios({...snapshot,movements:[...snapshot.movements,movement(9,"2026-10-14",100000,extra)]},[],cashflow,ctx,now);assert.deepEqual(value,result);
}
const noEvents={...snapshot,movements:[],obligations:[],subscriptions:[]};const emptyFlow=buildDashboardCashflow(noEvents,[],supplement,ctx,now,3);assert.equal(buildDashboardScenarios(noEvents,[],emptyFlow,ctx,now).recommendations.length,0);
const partial=obligation(40,"payable",{principalAmount:200,currentPrincipalAmount:200,pendingAmount:150,dueDate:"2026-11-10",installmentAmount:100,paymentPlan:{mode:"equal",count:2,firstDueDate:"2026-10-10"},events:[{eventType:"payment",amount:50,eventDate:"2026-10-12"}]});
const planSnapshot={...snapshot,obligations:[partial]};const planFlow=buildDashboardCashflow(planSnapshot,[],supplement,ctx,now,6);const plan=buildDashboardScenarios(planSnapshot,[],planFlow,ctx,now);assert.equal(plan.available,true);assert.equal(plan.recommendations[0].amount,50);assert.equal(plan.recommendations[0].daysUntilDue,-5);
const dueToday={...snapshot,obligations:[obligation(50,"payable",{dueDate:"2026-10-15"})]};const todayModel=buildDashboardScenarios(dueToday,[],buildDashboardCashflow(dueToday,[],supplement,ctx,now,6),ctx,now);assert.equal(todayModel.recommendations[0].daysUntilDue,0);
const mobileDateBug=phonePriority.buildPaymentOptimizationPlan({obligations:[{id:50,title:"Hoy",direction:"payable",status:"active",amount:400,dueDate:"2026-10-15"}],currentBalance:500,weekExpectedInflow:0,weekExpectedOutflow:400,pressureProbability:50,today:now});assert.equal(mobileDateBug[0].daysUntilDue,-1);
const shared={...obligation(60),workspaceId:99,viewerMode:"shared_viewer"};const sharedFlow=buildDashboardCashflow(snapshot,[shared],supplement,ctx,now,6);const sharedResult=buildDashboardScenarios(snapshot,[shared],sharedFlow,ctx,now);assert.equal(sharedResult.recommendations.find(row=>row.id===60).direction,"payable");
const dedup=buildDashboardScenarios(snapshot,[{...shared,id:10}],cashflow,ctx,now);assert.equal(dedup.recommendations.find(row=>row.id===10).direction,"receivable");
const inactive={...snapshot,obligations:[...snapshot.obligations,obligation(70,"payable",{status:"cancelled",pendingAmount:999999}),obligation(71,"receivable",{status:"draft",pendingAmount:999999}),obligation(72,"payable",{status:"paid"}),obligation(73,"payable",{workspaceId:99})]};const inactiveResult=buildDashboardScenarios(inactive,[],buildDashboardCashflow({...inactive,obligations:inactive.obligations.filter(row=>row.workspaceId===8)},[],supplement,ctx,now,6),ctx,now);assert.ok(inactiveResult.recommendations.every(row=>![70,71,72,73].includes(row.id)));
const missingMovement={...snapshot,movements:[...snapshot.movements,movement(8,"2026-10-12",30,{sourceAccountId:2})]};const missing=buildDashboardScenarios(missingMovement,[],buildDashboardCashflow(missingMovement,[],supplement,ctx,now,6),ctx,now);assert.equal(missing.available,false);assert.equal(missing.model,null);assert.equal(missing.recommendations.length,0);
const missingDebt={...snapshot,obligations:[...snapshot.obligations,obligation(80,"payable",{currencyCode:"EUR",dueDate:"2028-01-01"})]};assert.equal(buildDashboardScenarios(missingDebt,[],buildDashboardCashflow(missingDebt,[],supplement,ctx,now,6),ctx,now).available,false);
const oldMissing={...snapshot,movements:[...snapshot.movements,movement(9,"2026-04-15",30,{sourceAccountId:2})]};const oldMissingFlow=buildDashboardCashflow(oldMissing,[],supplement,ctx,now,6);assert.equal(oldMissingFlow.typicalSpend.unconvertedCount,1);assert.equal(buildDashboardScenarios(oldMissing,[],oldMissingFlow,ctx,now).available,false);
const correction={...snapshot,movements:[...snapshot.movements,movement(9,"2026-09-15",100000,{description:"Corrección · Principal"})]};assert.equal(buildDashboardCashflow(correction,[],supplement,ctx,now,6).typicalSpend.typical,cashflow.typicalSpend.typical);
const badBalance={...cashflow,liquid:{...cashflow.liquid,total:NaN}};assert.equal(buildDashboardScenarios(snapshot,[],badBalance,ctx,now).available,false);
const otherMonth={...cashflow,projection:{...cashflow.projection,months:cashflow.projection.months.map((row,i)=>i?row:{...row,monthKey:"2026-11"})}};assert.equal(buildDashboardScenarios(snapshot,[],otherMonth,ctx,now).available,false);
// The new adapter retains Lima's local dates even in a UTC browser.
process.env.TZ="UTC";assert.deepEqual(buildDashboardScenarios(planSnapshot,[],planFlow,ctx,now),plan);process.env.TZ="America/Lima";
// Actual calendar too: a UTC month change is still yesterday in Lima; planned timestamps remain exact.
for(const stamp of ["2026-11-01T04:30:00Z","2026-01-01T04:30:00Z","2024-03-01T04:30:00Z","2026-03-29T07:30:00Z"]){
 const time=new Date(stamp),baseline=buildDashboardCashflow(planSnapshot,[],supplement,ctx,time,6);
 for(const zone of ["UTC","Europe/Madrid","America/Los_Angeles"]){process.env.TZ=zone;assert.deepEqual(buildDashboardCashflow(planSnapshot,[],supplement,ctx,time,6),baseline,`${stamp} in ${zone}`);}
 process.env.TZ="America/Lima";
}
const boundaryTime=new Date("2026-11-01T04:30:00Z");
const boundarySnapshot={...snapshot,movements:[...snapshot.movements,movement(90,"2026-10-31",10,{status:"planned",occurredAt:"2026-11-01T04:45:00Z"}),movement(91,"2026-11-01",20,{status:"planned",occurredAt:"2026-11-01T05:15:00Z"}),movement(92,"2026-10-31",30,{status:"planned",occurredAt:"2026-11-01T04:15:00Z"})]};
const boundaryFlow=buildDashboardCashflow(boundarySnapshot,[],supplement,ctx,boundaryTime,3);assert.equal(boundaryFlow.projection.months[0].monthKey,"2026-10");assert.ok(boundaryFlow.projection.months[0].outflows.some(row=>row.kind==="planned_movement"&&row.refId===90));assert.ok(boundaryFlow.projection.months[1].outflows.some(row=>row.kind==="planned_movement"&&row.refId===91));assert.ok(!boundaryFlow.projection.months.flatMap(row=>row.outflows).some(row=>row.refId===92));
process.env.TZ="UTC";assert.deepEqual(buildDashboardCashflow(boundarySnapshot,[],supplement,ctx,boundaryTime,3),boundaryFlow);process.env.TZ="America/Lima";

const {ProjectionHorizonPanel}=await import(load("src/modules/dashboard/components/projection-horizon-panel.tsx"));
const {DashboardScenariosPanel}=await import(load("src/modules/dashboard/components/dashboard-scenarios-panel.tsx"));
const {CashflowMonthPanel}=await import(load("src/modules/dashboard/components/cashflow-month-panel.tsx"));
const container=document.createElement("div");document.body.append(container);const renderer=createRoot(container);let retries=0;
const props={snapshot:planSnapshot,shared:[],supplement,ctx,now,ready:true,onRetry:()=>{retries++}};
async function render(extra={}){await act(async()=>renderer.render(React.createElement(MemoryRouter,null,React.createElement(ProjectionHorizonPanel,{...props,...extra}))));}
await render();assert.match(container.textContent,/Escenarios y prioridades/);const details=[...container.querySelectorAll('details')].find(row=>row.textContent.includes('Comparar escenarios'));assert.ok(details);assert.equal(details.open,false);assert.match(container.textContent,/Solo el cierre de 2026-10/);assert.match(container.textContent,/No es la probabilidad de impago/);assert.match(container.textContent,/no cobra, paga, reserva dinero/i);const link=[...container.querySelectorAll('a')].find(row=>row.getAttribute('href')==='/app/obligations?resource=40');assert.ok(link);assert.match(link.textContent,/50\.00/);assert.match(link.textContent,/5 días vencido/);
await act(async()=>button(container,"12 meses").click());assert.match(container.textContent,/Solo el cierre de 2026-10/);assert.match(container.textContent,/2027-09/);
await render({ready:false});assert.doesNotMatch(container.textContent,/Escenarios y prioridades|Acuerdo 40/);assert.equal(container.querySelectorAll('a').length,0);await act(async()=>button(container,"Reintentar lectura").click());assert.equal(retries,1);
await render({supplement:{...supplement,workspaceId:99}});assert.doesNotMatch(container.textContent,/Escenarios y prioridades/);
await render({snapshot:oldMissing});assert.match(container.textContent,/gastos históricos sin conversión/);assert.doesNotMatch(container.textContent,/Saldo estimado al cerrar|Qué revisar primero/);
await render({snapshot:missingMovement});assert.match(container.textContent,/No mostramos escenarios ni prioridades/);assert.equal(container.querySelectorAll('a').length,0);
await act(async()=>renderer.render(React.createElement(CashflowMonthPanel,{model:oldMissingFlow,currency:"PEN",ready:true,failed:false,onRetry:()=>{}})));assert.match(container.textContent,/Sin estimación/);assert.doesNotMatch(container.textContent,/Caja disponible hoy/);
await act(async()=>renderer.render(React.createElement(MemoryRouter,null,React.createElement(DashboardScenariosPanel,{snapshot:planSnapshot,shared:[],cashflow:planFlow,ctx,now}))));assert.match(container.textContent,/Base estadística/);assert.equal(container.querySelectorAll('button').length,0,"Read-only panels cannot trigger a payment mutation");
await act(async()=>renderer.unmount());container.remove();dom.window.close();
console.log(`Dashboard scenarios: ${simulations} original mobile seeded simulations + translated-sample pressure, ${models} original month models, ${priorities} original priority rankings; native calendar rebasing, actual unpaid plans, date-only/shared/status/FX corrections, local UI and read-only destinations passed.`);
