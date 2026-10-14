import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { buildSubscriptionPaymentReceipts } from "../src/modules/subscriptions/lib/payment-receipts.ts";

const mobileRoot=resolve("../DarkMoneyApp");
assert.equal(readFileSync("src/modules/subscriptions/lib/payment-receipts.ts","utf8"),
  readFileSync(resolve(mobileRoot,"features/subscriptions/lib/payment-receipts.ts"),"utf8"));
const owner="11111111-1111-1111-1111-111111111111";
const movement=(id,changes={})=>({id,workspaceId:8,createdByUserId:owner,subscriptionId:7,status:"posted",movementType:"expense",
  occurredAt:"2026-10-01T04:59:59.123456Z",sourceAccountId:20,destinationAccountId:null,sourceAmount:12,destinationAmount:null,
  sourceAmountInBaseCurrency:45.6,sourceCurrencyCode:"USD",description:"Pago (1/2)",metadata:{split_group:"group-a",split_index:1,split_total:2},...changes});
const receipt=[movement(1),movement(2,{sourceAmount:8,sourceAmountInBaseCurrency:30.4,description:"Pago (2/2)",metadata:{split_group:"group-a",split_index:2,split_total:2}})];
const clone=value=>JSON.parse(JSON.stringify(value));
const frozen=clone(receipt); for(const row of frozen) {Object.freeze(row.metadata);Object.freeze(row);} Object.freeze(frozen);
let result=buildSubscriptionPaymentReceipts(frozen,8);
assert.equal(result.payments.length,1); assert.equal(result.issues.length,0);
assert.equal(result.payments[0].sourceAmount,20); assert.equal(result.payments[0].sourceAmountInBaseCurrency,null);
assert.equal(result.payments[0].description,"Pago"); assert.deepEqual(result.payments[0].receiptPartIds,[1,2]);
assert.deepEqual(frozen,receipt,"Never mutate the financial ledger into virtual totals");
result=buildSubscriptionPaymentReceipts([receipt[0],{...receipt[1],subscriptionId:null}],8);
assert.equal(result.payments[0].sourceAmount,20,"Legacy web first-only linkage includes its unlinked part");
assert.equal(buildSubscriptionPaymentReceipts([...receipt,movement(3,{metadata:{},sourceAmount:40})],8).payments.length,2);
assert.equal(buildSubscriptionPaymentReceipts(receipt,9).payments.length,0);
assert.equal(buildSubscriptionPaymentReceipts(receipt.map(row=>({...row,status:"voided"})),8).issues.length,0);
assert.equal(buildSubscriptionPaymentReceipts(receipt.map(row=>({...row,subscriptionId:null})),8).payments.length,0);
assert.equal(buildSubscriptionPaymentReceipts(receipt.map(row=>({...row,sourceAmount:row.id===1?0.1:0.2})),8).payments[0].sourceAmount,0.3);
assert.equal(buildSubscriptionPaymentReceipts([receipt[0],{...receipt[1],sourceAmountInBaseCurrency:null}],8).payments[0].sourceAmountInBaseCurrency,null);
assert.equal(buildSubscriptionPaymentReceipts([receipt[0],{...receipt[1],occurredAt:"2026-09-30T23:59:59.123456-05:00"}],8).payments.length,1);
for(const change of [
  {status:"pending"},{status:"voided"},{movementType:"income"},{createdByUserId:"other"},{createdByUserId:null},
  {sourceAccountId:21},{destinationAccountId:21},{destinationAmount:1},{sourceAmount:null},{sourceAmount:0},{sourceAmount:8.001},
  {sourceAmount:Number.POSITIVE_INFINITY},{subscriptionId:9},{occurredAt:"2026-10-02T04:59:59Z"},
  {occurredAt:"2026-10-01T04:59:59.123457Z"},{occurredAt:"invalid"},
  {metadata:{split_group:"group-a",split_index:1,split_total:2}},
  {metadata:{split_group:"group-a",split_index:2,split_total:3}},
  {metadata:{split_group:"group-a",split_index:3,split_total:2}},
  {metadata:{split_group:"group-a",split_index:2.5,split_total:2}},
]) {
  const bad=buildSubscriptionPaymentReceipts([receipt[0],{...receipt[1],...change}],8);
  assert.equal(bad.payments.length,0,JSON.stringify(change)); assert.equal(bad.issues.length,1);
  assert.ok(bad.issues[0].subscriptionIds.includes(7));
}
assert.equal(buildSubscriptionPaymentReceipts([receipt[0]],8).issues.length,1);
assert.equal(buildSubscriptionPaymentReceipts([...receipt,receipt[1]],8).issues.length,1);

// Load the actual mobile service while substituting only its local I/O boundary.
let localRows=null;
const cache=new Map();
function load(path) {
  const file=[path,`${path}.ts`,`${path}.tsx`].find(existsSync);
  if(cache.has(file))return cache.get(file);
  const module={exports:{}};cache.set(file,module.exports);
  const source=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const req=createRequire(file);
  new Function("require","module","exports",source)((name)=>{
    if(name==="../../lib/offline/instance")return {offlineRuntime:{listRows:async ws=>{assert.equal(ws,8);return localRows;}}};
    return name.startsWith(".")?load(resolve(dirname(file),name)):req(name);
  },module,module.exports);
  cache.set(file,module.exports);return module.exports;
}
const service=load(resolve(mobileRoot,"services/queries/catalog-history.ts"));
const mobileAnalytics=load(resolve(mobileRoot,"features/subscriptions/lib/subscription-analytics.ts"));
const {subscriptionPaymentMoney,subscriptionReceiptHistory}=load(resolve("src/modules/subscriptions/lib/payment-money.ts"));
const {convertAmountToWorkspaceBase}=load(resolve(mobileRoot,"lib/subscription-helpers.ts"));
const {analyticsMonthKey}=load(resolve("src/lib/analytics-money.ts"));
const raw=row=>({id:row.id,workspace_id:row.workspaceId,created_by_user_id:row.createdByUserId,subscription_id:row.subscriptionId,
  category_id:row.id,counterparty_id:null,status:row.status,movement_type:row.movementType,occurred_at:row.occurredAt,
  source_account_id:row.sourceAccountId,destination_account_id:row.destinationAccountId,
  source_amount:row.sourceAmount,destination_amount:row.destinationAmount,metadata:row.metadata});
function client(rows,modify) {
  const calls=[];
  return {calls,from(table){
    assert.equal(table,"movements");const q={filters:[],groups:null,orders:[]};
    const api={
      select(fields){assert.ok(fields.includes("metadata")&&fields.includes("workspace_id")&&fields.includes("created_by_user_id"));return api;},
      eq(key,value){q.filters.push([key,value]);return api;},
      not(key,op,value){assert.equal(op,"is");assert.equal(value,null);q.not=key;return api;},
      in(key,values){assert.equal(key,"metadata->>split_group");q.groups=values;return api;},
      order(key,options){q.orders.push([key,options.ascending]);return api;},
      range:async(from,to)=>{
        calls.push(clone({...q,from,to}));
        assert.ok(q.filters.some(([key,val])=>key==="workspace_id"&&val===8));
        let selected=rows.filter(row=>q.filters.every(([key,value])=>row[key]===value)&&(!q.not||row[q.not]!=null)&&(!q.groups||q.groups.includes(row.metadata?.split_group)));
        selected.sort((a,b)=>{for(const [key,asc] of q.orders){const cmp=a[key]<b[key]?-1:a[key]>b[key]?1:0;if(cmp)return asc?cmp:-cmp;}return 0;});
        const result={data:clone(selected.slice(from,to+1)),error:null};return modify?.(q,from,result)??result;
      },
    };return api;
  }};
}
const rawReceipt=receipt.map(raw);rawReceipt[1].subscription_id=null;
let io=client(rawReceipt);
let data=(await service.fetchCatalogMovementRows(io,8,"subscription_id")).data;
assert.equal(data.length,1);assert.equal(data[0].source_amount,20);assert.deepEqual(data[0].receipt_part_ids,[1,2]);
assert.equal(io.calls.length,2,"Reads all parts without filtering status or subscription on the group read");
assert.deepEqual(io.calls[1].filters,[["workspace_id",8]]);
assert.deepEqual(io.calls[1].groups,["group-a"]);
localRows=clone(rawReceipt);io=client([]);
assert.equal((await service.fetchCatalogMovementRows(io,8,"subscription_id")).data[0].source_amount,20);
assert.equal(io.calls.length,0,"The offline mirror uses the same complete-group rule without network");
localRows.pop();await assert.rejects(service.fetchCatalogMovementRows(io,8,"subscription_id"),/incompleta/);localRows=null;
const many=[];
for(let n=0;n<701;n++) for(let index=1;index<=2;index++) many.push(raw(movement(n*2+index,{subscriptionId:index===1?7:null,sourceAmount:10,
  metadata:{split_group:`group-${n}`,split_index:index,split_total:2}})));
io=client(many);data=(await service.fetchCatalogMovementRows(io,8,"subscription_id")).data;
assert.equal(data.length,701);assert.equal(data.reduce((sum,row)=>sum+row.source_amount,0),14020);
assert.ok(io.calls.filter(call=>!call.groups).some(call=>call.from===500));
assert.ok(io.calls.filter(call=>call.groups).every(call=>call.groups.length<=40));
const hundreds=[];
for(let n=0;n<6;n++) for(let index=1;index<=100;index++) hundreds.push(raw(movement(n*100+index,{subscriptionId:index===1?7:null,sourceAmount:0.2,
  metadata:{split_group:`large-${n}`,split_index:index,split_total:100}})));
assert.equal((await service.fetchCatalogMovementRows(client(hundreds),8,"subscription_id")).data.length,6);
await assert.rejects(service.fetchCatalogMovementRows(client(hundreds,(q,from,res)=>q.groups&&from>0?{data:null,error:new Error("second group page failed")}:res),8,"subscription_id"),/second group page failed/);
await assert.rejects(service.fetchCatalogMovementRows(client(rawReceipt,(q,from,res)=>q.groups?{data:null,error:new Error("group page failed")}:res),8,"subscription_id"),/group page failed/);
await assert.rejects(service.fetchCatalogMovementRows(client(rawReceipt,(q,from,res)=>q.groups?{data:[],error:null}:res),8,"subscription_id"),/no está disponible/);
await assert.rejects(service.fetchCatalogMovementRows(client(rawReceipt,(q,from,res)=>q.groups?{data:res.data.map(row=>({...row,source_amount:5})),error:null}:res),8,"subscription_id"),/cambió/);
await assert.rejects(service.fetchCatalogMovementRows(client(rawReceipt,(q,from,res)=>q.groups?{data:[...res.data,res.data[0]],error:null}:res),8,"subscription_id"),/cambió/);
await assert.rejects(service.fetchCatalogMovementRows(client(rawReceipt,(q,from,res)=>q.groups?{data:res.data.map(row=>({...row,workspace_id:9})),error:null}:res),8,"subscription_id"),/espacio/);

// Actual web history component: sum/count, routing to the head and honest error copy.
const webRequire=createRequire(resolve("package.json"));
const mobileRequire=createRequire(resolve(mobileRoot,"package.json"));
const {JSDOM}=mobileRequire("jsdom");const dom=new JSDOM("<!doctype html><div id='root'></div>",{url:"http://local.test"});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
Object.defineProperty(globalThis,"navigator",{value:dom.window.navigator,configurable:true});
const React=webRequire("react"),{createRoot}=webRequire("react-dom/client");
const {SubscriptionPaymentsHistory}=load(resolve("src/modules/subscriptions/components/subscription-payments-history.tsx"));
const root=createRoot(document.getElementById("root"));let opened;
const props={movements:receipt,workspaceId:8,subscriptionId:7,currencyCode:"USD",onOpenMovement:id=>{opened=id;}};
await React.act(async()=>root.render(React.createElement(SubscriptionPaymentsHistory,props)));
assert.ok(document.body.textContent.includes("Pagos anotados · 1"));assert.ok(document.body.textContent.includes("2 partes"));
assert.match(document.body.textContent,/20[.,]00/);
await React.act(async()=>document.querySelector("button").click());assert.equal(opened,1);
await React.act(async()=>root.render(React.createElement(SubscriptionPaymentsHistory,{...props,movements:[receipt[0]]})));
assert.ok(document.querySelector("[role=alert]"));assert.ok(!document.body.textContent.includes("Ninguno todavía"));
const subscription={id:7,workspaceId:8,name:"Servicio",vendor:"",status:"active",amount:20,currencyCode:"USD",frequency:"monthly",
  intervalCount:1,frequencyLabel:"Mensual",startDate:"2026-01-01",nextDueDate:"2026-10-20",remindDaysBefore:0,autoCreateMovement:false,isPinned:false};
const rates=[{fromCurrencyCode:"USD",toCurrencyCode:"PEN",rate:3.8,effectiveAt:"2026-10-01"}];
const projection=subscriptionReceiptHistory([...receipt,movement(3,{metadata:{},description:"Sin conversión",sourceAmount:4,sourceAmountInBaseCurrency:0})],8,"PEN",rates).payments;
const mobileReport=mobileAnalytics.buildSubscriptionAnalytics(subscription,projection.map(row=>({id:row.id,subscriptionId:row.subscriptionId,
  occurredAt:row.occurredAt,sourceAmount:row.sourceAmount,destinationAmount:row.destinationAmount,amountCurrencyCode:row.sourceCurrencyCode,
  amountInBaseCurrency:row.sourceAmountInBaseCurrency})),"PEN",new Date("2026-10-02T12:00:00Z"));
assert.equal(mobileReport.paymentCount,2);assert.equal(mobileReport.comparableCount,1);assert.equal(mobileReport.comparableTotal,76);
assert.deepEqual(projection.map(row=>subscriptionPaymentMoney(row,"PEN","USD").comparable),[null,76]);
assert.equal(mobileReport.months.find(month=>month.key===analyticsMonthKey(receipt[0].occurredAt)).total,76);
const roundCase=[movement(1,{sourceAmount:0.01}),movement(2,{sourceAmount:1.49,metadata:receipt[1].metadata})];
for(const pair of [
  [{fromCurrencyCode:"USD",toCurrencyCode:"PEN",rate:3.83,effectiveAt:"2026-10-01"}],
  [{fromCurrencyCode:"PEN",toCurrencyCode:"USD",rate:0.27,effectiveAt:"2026-10-01"}],
  [],
]) {
  const payment=subscriptionReceiptHistory(roundCase,8,"PEN",pair).payments[0];
  assert.equal(payment.sourceAmountInBaseCurrency,convertAmountToWorkspaceBase(1.5,"USD","PEN",pair));
}
assert.equal(subscriptionReceiptHistory(roundCase,8,"PEN",[{fromCurrencyCode:"USD",toCurrencyCode:"PEN",rate:3.83}]).payments[0].sourceAmountInBaseCurrency,5.745);
globalThis.HTMLElement=dom.window.HTMLElement;
globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);globalThis.cancelAnimationFrame=clearTimeout;
const {SubscriptionAnalyticsModal}=load(resolve("src/modules/subscriptions/components/subscription-analytics-modal.tsx"));
await React.act(async()=>root.render(React.createElement(SubscriptionAnalyticsModal,{subscription,movements:receipt,baseCurrencyCode:"PEN",exchangeRates:rates,onClose:()=>{}})));
assert.ok(document.body.textContent.includes("Pagos registrados"));assert.match(document.body.textContent,/76[.,]00/);
await React.act(async()=>root.render(React.createElement(SubscriptionAnalyticsModal,{subscription,movements:receipt.map(row=>({...row,sourceAmountInBaseCurrency:null})),baseCurrencyCode:"PEN",exchangeRates:[],onClose:()=>{}})));
assert.ok(document.body.textContent.includes("Sin conversión"));assert.ok(!document.body.textContent.includes("Pagos por mes (12 meses)"));
assert.match(document.body.textContent,/20[.,]00/);
await React.act(async()=>root.render(React.createElement(SubscriptionAnalyticsModal,{subscription,movements:[receipt[0]],baseCurrencyCode:"PEN",exchangeRates:rates,onClose:()=>{}})));
assert.ok(document.querySelector("[role=alert]"));assert.ok(!document.body.textContent.includes("No hay pagos registrados"));
await React.act(async()=>root.render(React.createElement(SubscriptionAnalyticsModal,{subscription:{...subscription,frequency:"custom",intervalCount:30},movements:[],baseCurrencyCode:"PEN",exchangeRates:rates,onClose:()=>{}})));
assert.ok(document.body.textContent.includes("Sin estimación"));
assert.equal(mobileAnalytics.buildSubscriptionAnalytics({...subscription,frequency:"custom",intervalCount:30},[],"PEN").annualEstimate,null);
await React.act(async()=>root.unmount());dom.window.close();
console.log("subscription-receipts: OK (identical real models, complete/partial/legacy groups, native/FX amounts, actual mobile paginated/offline reader and web history render; local fixtures only)");
