import assert from "node:assert/strict";
import { React, act, dom, load, createRoot, MemoryRouter, button } from "./lib/web-ui-harness.mjs";
process.env.TZ="America/Lima";
const { buildDashboardCashflow }=await import(load("src/modules/dashboard/lib/projection/build-dashboard-cashflow.ts"));
const mobile=await import(load("../DarkMoneyApp/features/projection/lib/cashflow-calendar.ts"));
const mobileView=await import(load("../DarkMoneyApp/features/dashboard/lib/flow-view.ts"));
const { ProjectionHorizonPanel }=await import(load("src/modules/dashboard/components/projection-horizon-panel.tsx"));
const now=new Date("2026-10-15T17:00:00Z");
const sub={id:10,name:"Internet",workspaceId:8,amount:80,currencyCode:"PEN",frequency:"monthly",intervalCount:1,nextDueDate:"2026-10-20",status:"active"};
const salary={id:20,name:"Sueldo",workspaceId:8,amount:2000,currencyCode:"PEN",frequency:"monthly",intervalCount:1,nextExpectedDate:"2026-10-25",status:"active"};
const snapshot={workspace:{id:8},accounts:[{id:1,workspaceId:8,name:"Principal",type:"bank",isArchived:false,currencyCode:"PEN",currentBalance:5000}],movements:[],obligations:[],subscriptions:[sub],recurringIncome:[salary],catalogs:{categories:[],counterparties:[]}};
const supplement={workspaceId:8,oneOffTypeIds:[],scheduledChanges:[]};
const ctx={baseCurrency:"PEN",displayCurrency:"PEN",accountCurrencyMap:new Map([[1,"PEN"]]),exchangeRateMap:new Map()};
for(const horizon of [3,6,12]){
  const model=buildDashboardCashflow(snapshot,[],supplement,ctx,now,horizon);
  const expected=mobile.buildCashflowCalendar({startingBalance:5000,fromDate:"2026-10-15",months:horizon,typicalDiscretionarySpend:0,convert:(amount,currency)=>currency==="PEN"?amount:null,subscriptions:[sub],recurringIncome:[salary],obligations:[],plannedMovements:[],creditCards:[]});
  assert.deepEqual(model.projection,expected);assert.equal(model.projection.months.length,horizon);assert.equal(model.projection.endingBalance,5000+horizon*1920);assert.equal(mobileView.firstNegativeMonth(model.projection.months),null);assert.equal(mobileView.visibleProjectionMonths(model.projection.months,false).length,3);assert.equal(mobileView.visibleProjectionMonths(model.projection.months,true).length,horizon);
}
const container=document.createElement('div');document.body.append(container);const renderer=createRoot(container);let retries=0;
async function render(extra={}){await act(async()=>renderer.render(React.createElement(MemoryRouter,null,React.createElement(ProjectionHorizonPanel,{snapshot,shared:[],supplement,ctx,now,ready:true,onRetry:()=>{retries++},...extra}))));}
await render();
const chart=container.querySelector('[aria-label="Saldos proyectados por mes"]');assert.ok(chart);assert.equal(chart.querySelectorAll('button').length,6);
await act(async()=>chart.querySelector('button').click());assert.ok(container.querySelector('[role="dialog"]'));await act(async()=>container.querySelector('[role="dialog"] button').click());
const layout=container.querySelector('[aria-label="Proyección de caja"] > div');assert.match(layout.className,/lg:grid-cols-2/);
const calculation=[...container.querySelectorAll('details')].find(node=>node.querySelector('summary')?.textContent==='Cómo se calcula');assert.ok(calculation);assert.equal(calculation.open,false);calculation.open=true;assert.match(calculation.textContent,/no una promesa de saldo/);
assert.match(container.textContent,/2027-03/);assert.match(container.textContent,/16,520/);assert.match(container.textContent,/dentro de un mes todavía puede haber días sin cobertura/);assert.equal([...container.querySelectorAll('button')].filter(node=>node.textContent.startsWith('202')).length,3);
await act(async()=>button(container,'Ver los 6 meses').click());assert.equal([...container.querySelectorAll('button')].filter(node=>node.textContent.startsWith('202')).length,6);
await act(async()=>button(container,'12 meses').click());assert.match(container.textContent,/2027-09/);assert.match(container.textContent,/28,040/);const month=[...container.querySelectorAll('button')].find(node=>node.textContent.startsWith('2026-10'));await act(async()=>month.click());const modal=container.querySelector('[role="dialog"]');assert.ok(modal);assert.match(modal.textContent,/no cobra, paga ni altera/);assert.ok([...modal.querySelectorAll('a')].some(node=>node.getAttribute('href')==='/app/subscriptions?resource=10'));assert.ok([...modal.querySelectorAll('a')].some(node=>node.getAttribute('href')==='/app/recurring-income?resource=20'));
await act(async()=>button(container,'3 meses').click());assert.equal(container.querySelector('[role="dialog"]'),null);assert.match(container.textContent,/2026-12/);assert.match(container.textContent,/10,760/);
await render({snapshot:{...snapshot,accounts:[{...snapshot.accounts[0],currentBalance:-3000}]}});assert.match(container.textContent,/primer cierre mensual negativo/);
assert.ok([...container.querySelectorAll('[aria-label="Saldos proyectados por mes"] span')].some(node=>node.className.includes('bg-[#E2A07E]')));
await render({snapshot:{...snapshot,subscriptions:[{...sub,currencyCode:'EUR'}]}});assert.match(container.textContent,/sin conversión/);assert.doesNotMatch(container.textContent,/Saldo estimado al cerrar/);assert.equal(container.querySelector('[aria-label="Saldos proyectados por mes"]'),null);assert.equal(container.querySelector('[aria-label="Escenarios y prioridades"]'),null);assert.ok(container.querySelector('[aria-label="Cobros de suscripciones"] a[href="/app/subscriptions?resource=10"]'));
await render({ready:false});assert.match(container.textContent,/Falta comprobar/);assert.doesNotMatch(container.textContent,/10,760/);await act(async()=>button(container,'Reintentar lectura').click());assert.equal(retries,1);
await render({supplement:{...supplement,workspaceId:9}});assert.match(container.textContent,/Falta comprobar/);assert.doesNotMatch(container.textContent,/Saldo estimado al cerrar/);
await act(async()=>renderer.unmount());container.remove();dom.window.close();
console.log('Dashboard horizon: actual mobile calendar at 3/6/12 months, full-horizon headline, first-negative month, expandable ledger, dated source links, FX/read/scope gates passed locally.');
