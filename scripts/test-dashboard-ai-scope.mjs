import assert from "node:assert/strict";
import {React,act,dom,load,mock,createRoot,settle} from "./lib/web-ui-harness.mjs";
globalThis.summaryCalls=[];globalThis.summaryGate=null;
mock("src/services/queries/workspace-data.ts","export const useDashboardAiSummaryMutation=()=>({isPending:false,error:null,mutateAsync:async input=>{globalThis.summaryCalls.push(input);return globalThis.summaryGate?await globalThis.summaryGate:{ok:true,reply:'Scoped explanation',complexTerms:[]}}});");
const {useDashboardAiSummary,getDashboardAiUsageDate}=await import(load("src/modules/dashboard/hooks/use-dashboard-ai-summary.ts"));
const {buildDashboardAiSummaryPayload}=await import(load("src/modules/dashboard/lib/build-ai-summary-payload.ts"));
const props={userId:"u",workspaceId:8,currencyCode:"PEN",isAdmin:true};let renderer,container;
function Host(p){globalThis.summaryHook=useDashboardAiSummary(p);return React.createElement("div",null,globalThis.summaryHook.currentResponse?.reply??"No response");}
async function render(p=props){if(!renderer){container=document.createElement("div");document.body.append(container);renderer=createRoot(container);}await act(async()=>renderer.render(React.createElement(Host,p)));}
const today=getDashboardAiUsageDate();
window.localStorage.setItem("darkmoney.dashboard.aiSummaryCache.u",JSON.stringify({usageDate:today,lastUsedAt:new Date().toISOString(),responses:{personal:{reply:"UNSCOPED_LEGACY",complexTerms:[],generatedAt:new Date().toISOString()}}}));
window.localStorage.setItem("darkmoney.dashboard.aiSummaryCache.u.8.PEN",JSON.stringify({usageDate:today,lastUsedAt:new Date().toISOString(),responses:{personal:{reply:"OLD_NET_WORTH",complexTerms:[],generatedAt:new Date().toISOString()}}}));
await render();assert.doesNotMatch(container.textContent,/UNSCOPED_LEGACY|OLD_NET_WORTH/);
await assert.rejects(globalThis.summaryHook.requestSummary(9,{currency:"PEN"}),/espacio/);assert.equal(globalThis.summaryCalls.length,0);
await act(async()=>globalThis.summaryHook.requestSummary(8,{currency:"PEN"}));assert.match(container.textContent,/Scoped explanation/);
await render({...props,workspaceId:9});assert.doesNotMatch(container.textContent,/Scoped explanation/);
await render({...props,currencyCode:"USD"});assert.doesNotMatch(container.textContent,/Scoped explanation/);
await render(props);assert.match(container.textContent,/Scoped explanation/);
let finish;globalThis.summaryGate=new Promise(resolve=>{finish=resolve;});let pending;
await act(async()=>{pending=globalThis.summaryHook.requestSummary(8,{currency:"PEN"});});
await render({...props,workspaceId:9});assert.equal(globalThis.summaryCalls.at(-1).signal.aborted,true);
await act(async()=>{finish({ok:true,reply:"STALE_REPLY",complexTerms:[]});await pending;});await settle();assert.doesNotMatch(container.textContent,/STALE_REPLY/);
await render({...props,userId:"other"});assert.doesNotMatch(container.textContent,/Scoped explanation|STALE_REPLY/);
const input={workspaceName:"Personal",displayCurrencyCode:"PEN",netWorth:1000,visibleBalance:250,monthEndEstimate:1200,monthEndIncomeToDate:100,monthEndExpenseToDate:50,weekExpectedInflow:80,weekExpectedOutflow:40,weekNet:40,unresolvedIssues:0,readinessScore:80,savingsRate:0.2,uncategorizedCount:0,overdueObligationsCount:0,activeSubscriptionsCount:2,topFocusAction:null,unconvertedAccounts:1};
const payload=buildDashboardAiSummaryPayload(input);assert.match(payload.visibleBalance,/250/);assert.match(payload.monthEndDelta,/950/);assert.equal(payload.projectionBasis,"liquid_cash");assert.equal(payload.cashCushionDays,null);assert.equal(payload.dataCoverage.unconvertedAccounts,1);assert.equal(payload.savingsRatePct,20);
await act(async()=>renderer.unmount());container.remove();dom.window.close();console.log("dashboard-ai-scope: OK (workspace/currency/user cache isolation, legacy quota only, cancelled late reply, source balance/projection basis and missing indicators declared; no live AI)");
