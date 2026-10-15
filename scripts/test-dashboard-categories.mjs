import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, dom, root, load, mock, createRoot, MemoryRouter, QueryClient, QueryClientProvider, button, settle } from "./lib/web-ui-harness.mjs";
import * as aggregation from "@darkmoney/shared/aggregations";
import { movementActsAsIncome } from "@darkmoney/shared/movement-amounts";
import { normalizeAnalyticsText } from "@darkmoney/shared/movement-features";

const { buildDashboardCategorySuggestions, dashboardLearnedCategorySuggestions } = await import(load("src/modules/dashboard/lib/dashboard-category-suggestions.ts"));
const { applyDashboardCategory, CategoryApplyError, readDashboardCategoryEvidence } = await import(load("src/services/queries/dashboard-categories.ts"));
const phoneCandidates = await import(load("../DarkMoneyApp/services/analytics/category-suggestions.ts"));
const now = new Date("2026-10-15T17:00:00Z"), realNow = Date.now; Date.now = () => now.getTime();
const movement = (id, categoryId = null, extra = {}) => ({ id, workspaceId: 8, movementType: "expense", status: "posted", description: "Taxi al trabajo", occurredAt: `2026-10-${String(id).padStart(2,"0")}T12:00:00-05:00`, sourceAccountId: 1, sourceAmount: 10, destinationAccountId: null, destinationAmount: null, categoryId, counterpartyId: null, ...extra });
const categories = [{ id: 1, name: "Transporte", kind: "expense", isActive: true }, { id: 2, name: "Comida", kind: "both", isActive: true }, { id: 3, name: "Sueldo", kind: "income", isActive: true }, { id: 4, name: "Archivada", kind: "expense", isActive: false }];
const rows = [movement(1,1), movement(2,1), movement(3), movement(4)];
const snapshot = { workspace: { id: 8, name: "Personal", role: "owner", isArchived: false }, movements: rows, accounts: [{ id: 1, currencyCode: "PEN" }], catalogs: { categories } };
const ctx = { baseCurrency: "PEN", displayCurrency: "PEN", accountCurrencyMap: new Map([[1,"PEN"],[2,"EUR"],[3,"USD"]]), exchangeRateMap: new Map([["USD:PEN",3.7]]) };
const empty = { feedback: [], signals: [], unavailable: [] };
const generated = buildDashboardCategorySuggestions(snapshot, ctx, empty, now);
assert.equal(generated.suggestions.length, 2);
const expectedGenerated = phoneCandidates.buildCategorySuggestionCandidates({ movements: rows, categories, isCashflow: aggregation.isCategorizedCashflow, isIncomeLike: movementActsAsIncome, getAmount: row => row.sourceAmount, limit: 4, targetLimit: 10 }).sort((a,b)=>b.amount-a.amount || b.confidence-a.confidence);
assert.deepEqual(generated.suggestions, expectedGenerated);

// Execute the original mobile feedback builder and helper, not a rewritten expected formula.
const source = ts.createSourceFile("advanced-builders.ts", readFileSync(resolve(root,"../DarkMoneyApp/features/dashboard/lib/advanced-builders.ts"),"utf8"), ts.ScriptTarget.Latest, true);
const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && ["textSimilarity", "buildLearningFeedbackCategorySuggestions"].includes(node.name?.text)).map(node => node.getText(source).replace(/^export /,""));
assert.equal(functions.length, 2);
const executable = ts.transpileModule(functions.join("\n"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const mobileLearned = new Function("normalizeAnalyticsText","isCategorizedCashflow","movementActsAsIncome","incomeAmt","expenseAmt",`${executable};return buildLearningFeedbackCategorySuggestions;`)(normalizeAnalyticsText, aggregation.isCategorizedCashflow, movementActsAsIncome, aggregation.incomeAmt, aggregation.expenseAmt);
const feedback = [{ feedbackKind: "manual_category_change", acceptedCategoryId: 2, normalizedDescription: "taxi al trabajo", createdAt: "2026-10-14T12:00:00Z" }];
const names = new Map(categories.map(row=>[row.id,row.name]));
assert.deepEqual(dashboardLearnedCategorySuggestions(rows, feedback, names, row=>row.sourceAmount), mobileLearned(rows, feedback, names, ctx));
const evidence = { ...empty, feedback, signals: [{ movementId: 3, suggestedCategoryId: 1, confidence: .95, reasons: ["Guardado"] }] };
assert.ok(buildDashboardCategorySuggestions(snapshot,ctx,evidence,now).suggestions.every(row=>row.suggestedCategoryId===2));
const persisted = buildDashboardCategorySuggestions(snapshot,ctx,{...evidence,feedback:[]},now);
assert.equal(persisted.suggestions.find(row=>row.movementId===3).confidence,.95);
for(const categoryId of [3,4,999]) {
 const invalid=buildDashboardCategorySuggestions({...snapshot,movements:[movement(3)]},ctx,{...empty,signals:[{movementId:3,suggestedCategoryId:categoryId,confidence:.9,reasons:[]}]},now);
 assert.equal(invalid.suggestions.length,0);
}
for(const extra of [{workspaceId:99},{status:"pending"},{movementType:"transfer"},{movementType:"adjustment"},{description:"Corrección · Banco"},{occurredAt:"2026-10-31T12:00:00Z"},{occurredAt:"2026-01-01T12:00:00Z"},{categoryId:2}]) {
 const model=buildDashboardCategorySuggestions({...snapshot,movements:[...rows.slice(0,2),movement(3,null,extra)]},ctx,empty,now);
 assert.equal(model.suggestions.length,0,JSON.stringify(extra));
}
assert.equal(buildDashboardCategorySuggestions({...snapshot,movements:[...rows,movement(5,null,{sourceAccountId:2})]},ctx,empty,now).unconvertedCount,1);
assert.equal(buildDashboardCategorySuggestions({...snapshot,movements:[...rows,movement(5,null,{sourceAccountId:2})]},ctx,empty,now).suggestions.length,0);
const dollars=buildDashboardCategorySuggestions({...snapshot,movements:[movement(3,null,{sourceAccountId:3})]},ctx,{...empty,signals:[{movementId:3,suggestedCategoryId:1,confidence:.9,reasons:[]}]},now);
assert.equal(dollars.suggestions[0].amount,37);
Date.now = realNow;

function deferred() { let resolve; const promise=new Promise(done=>{resolve=done;});return {promise,resolve}; }
function dbRow(row) { return {id:row.id,workspace_id:row.workspaceId,movement_type:row.movementType,status:row.status,description:row.description,occurred_at:row.occurredAt,source_account_id:row.sourceAccountId,source_amount:row.sourceAmount,destination_account_id:row.destinationAccountId,destination_amount:row.destinationAmount,counterparty_id:row.counterpartyId,category_id:row.categoryId,updated_at:"2026-10-15T16:00:00Z",obligation_id:77,subscription_id:88,notes:"preserve",metadata:{keep:true}}; }
class FakeClient {
 constructor() { this.reset(); this.auth={getUser:async()=>({data:{user:{id:this.user}},error:null})}; }
 reset() { this.user="u"; this.role="owner"; this.archived=false;this.calls=[]; this.movements=rows.map(dbRow);this.categories=categories.map(row=>({id:row.id,name:row.name,kind:row.kind,is_active:row.isActive,workspace_id:8}));this.feedback=[];this.signals=[];this.learningError=false;this.updateError=false;this.lostReply=false;this.conflict=false;this.tableError=null;this.gate=null;this.readGate=null;this.stopScope=null; }
 from(table) {
  const client=this, query={table,op:"read",filters:[],payload:null,columns:null};let executed;
  const builder={
   select(columns){query.columns=columns;return builder;},eq(key,value){query.filters.push([key,value]);return builder;},is(key,value){query.filters.push([key,value]);return builder;},order(){return builder;},limit(){return builder;},
   update(payload){query.op="update";query.payload=payload;return builder;},insert(payload){query.op="insert";query.payload=payload;return builder;},
   maybeSingle(){return run(true);},then(resolve,reject){return run(false).then(resolve,reject);},
  };
  function run(single) {return executed??= (async()=>{
   client.calls.push(structuredClone(query));
   if(client.tableError?.table===table)return {data:null,error:client.tableError.error};
   if(query.op==="read"){
    if(table==="movements" && client.readGate)await client.readGate.promise;
    if(client.stopScope && table==="movements")client.stopScope();
    const source=table==="workspace_members"?[{workspace_id:8,user_id:"u",role:client.role}]:table==="workspaces"?[{id:8,is_archived:client.archived}]:table==="categories"?client.categories:table==="movements"?client.movements:table==="movement_learning_feedback"?client.feedback:client.signals;
    const data=source.filter(row=>query.filters.every(([key,value])=>row[key]===value));return {data:structuredClone(single?data[0]??null:data),error:null};
   }
   if(table==="movements"){
    if(client.gate)await client.gate.promise;
    if(client.updateError)return {data:null,error:{code:"42501",message:"Denied"}};
    if(client.conflict)return {data:null,error:null};
    const row=client.movements.find(row=>query.filters.every(([key,value])=>row[key]===value));
    if(!row)return {data:null,error:null};Object.assign(row,query.payload);
    if(client.lostReply)throw new Error("Reply lost after commit");
    return {data:{id:row.id,category_id:row.category_id},error:null};
   }
   if(table==="movement_learning_feedback") {if(client.learningError)throw new Error("Learning unavailable");client.feedback.push(query.payload);return {data:null,error:null};}
   throw new Error("Unexpected write "+table);
  })();}
  return builder;
 }
}
const client=new FakeClient(), input={workspaceId:8,userId:"u",movement:rows[2],category:categories[0],confidence:.9,canContinue:()=>true};
const original=structuredClone(client.movements[2]);
const saved=await applyDashboardCategory(client,input);assert.deepEqual(saved,{movementId:3,categoryId:1,learningSaved:true});
const patch=client.calls.find(row=>row.op==="update");assert.deepEqual(patch.payload,{category_id:1,updated_by_user_id:"u"});assert.ok(patch.filters.some(row=>row[0]==="updated_at"));assert.ok(patch.filters.some(row=>row[0]==="category_id"&&row[1]===null));
for(const [key,value] of Object.entries(original))if(key!=="category_id")assert.deepEqual(client.movements[2][key],value);
assert.equal(client.calls.filter(row=>row.op!=="read").length,2);assert.equal(client.feedback[0].source,"dashboard-salud");
await assert.rejects(applyDashboardCategory(client,input),/cambió/);assert.equal(client.calls.filter(row=>row.op==="update").length,1);
for(const mutate of [c=>c.user="other",c=>c.role="viewer",c=>c.archived=true,c=>c.categories[0].is_active=false,c=>c.categories[0].kind="income",c=>c.categories[0].name="Renamed",c=>c.movements[2].source_amount=20,c=>c.movements[2].category_id=2,c=>c.movements[2].counterparty_id=1,c=>c.movements[2].status="pending",c=>c.movements[2].description="Changed",c=>c.movements[2].updated_at=null]) {
 client.reset();mutate(client);await assert.rejects(applyDashboardCategory(client,input));assert.equal(client.calls.filter(row=>row.op==="update").length,0);
}
client.reset();await assert.rejects(applyDashboardCategory(client,{...input,workspaceId:9}));assert.equal(client.calls.length,0);
client.reset();let scope=true;client.stopScope=()=>{scope=false;};await assert.rejects(applyDashboardCategory(client,{...input,canContinue:()=>scope}));assert.equal(client.calls.filter(row=>row.op!=="read").length,0);
client.reset();client.conflict=true;await assert.rejects(applyDashboardCategory(client,input),error=>error instanceof CategoryApplyError&&!error.uncertain);assert.equal(client.feedback.length,0);
for(const key of ["updateError","lostReply"]) {client.reset();client[key]=true;await assert.rejects(applyDashboardCategory(client,input),error=>error.uncertain);assert.equal(client.feedback.length,0);}
client.reset();client.learningError=true;assert.equal((await applyDashboardCategory(client,input)).learningSaved,false);assert.equal(client.movements[2].category_id,1);assert.equal(client.calls.filter(row=>row.op==="update").length,1);
client.reset();const bundle=await readDashboardCategoryEvidence(client,8);assert.deepEqual(bundle,empty);assert.ok(client.calls.every(call=>call.filters.some(([key,value])=>key==="workspace_id"&&value===8)));
client.reset();client.tableError={table:"movement_analytics_signals",error:{code:"PGRST205",message:"Missing movement_analytics_signals"}};assert.deepEqual((await readDashboardCategoryEvidence(client,8)).unavailable,["movement_analytics_signals"]);
client.reset();client.tableError={table:"movement_learning_feedback",error:{code:"42501",message:"RLS denied"}};await assert.rejects(readDashboardCategoryEvidence(client,8),error=>error.code==="42501");

// Real panel, real services, fake transport. Never touches the user's data.
globalThis.categoryClient=client;mock("src/services/supabase/client.ts","export const supabase=globalThis.categoryClient;");
const { DashboardCategorySuggestionsPanel }=await import(load("src/modules/dashboard/components/dashboard-category-suggestions-panel.tsx"));
const container=document.createElement("div");document.body.append(container);const renderer=createRoot(container);
let queryClient, invalidations=[];
const props={snapshot,ctx,userId:"u",ready:true,canEdit:true,now};
async function reset() {await act(async()=>renderer.render(null));queryClient?.clear();client.reset();queryClient=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});const invalidate=queryClient.invalidateQueries.bind(queryClient);invalidations=[];queryClient.invalidateQueries=options=>{invalidations.push(options.queryKey);return invalidate(options);};}
async function render(p=props){await act(async()=>renderer.render(React.createElement(QueryClientProvider,{client:queryClient},React.createElement(MemoryRouter,null,React.createElement(DashboardCategorySuggestionsPanel,p)))));await settle();}
const updates=()=>client.calls.filter(row=>row.op==="update");
const exactButton=(text)=>button(container,text);
await reset();await render();assert.match(container.textContent,/Categorías por completar/);assert.equal(updates().length,0);
await act(async()=>exactButton("Revisar categoría").click());assert.equal(updates().length,0);assert.equal(container.querySelector('[role="dialog"]').querySelectorAll('a').length,1);await act(async()=>exactButton("Aplicar categoría").click());await settle();assert.equal(updates().length,1);assert.match(container.textContent,/Categoría aplicada/);
await reset();await render();
await act(async()=>exactButton("Revisar las 2 sugerencias").click());assert.equal(updates().length,0);assert.ok(container.querySelector('[role="dialog"]'));await act(async()=>exactButton("Cancelar").click());assert.equal(updates().length,0);
await act(async()=>exactButton("Revisar las 2 sugerencias").click());client.gate=deferred();await act(async()=>{exactButton("Aplicar 2 categorías").click();exactButton("Aplicar 2 categorías").click();});assert.equal(updates().length,1);await act(async()=>client.gate.resolve());await settle();assert.equal(updates().length,2);assert.equal(client.feedback.length,2);assert.match(container.textContent,/Categoría aplicada/);assert.equal([...container.querySelectorAll('button')].some(node=>node.textContent==="Aplicar 2 categorías"),false);assert.ok(invalidations.some(key=>key.join(":")==="workspace-snapshot:8:u"));
await reset();await render();await act(async()=>exactButton("Revisar las 2 sugerencias").click());client.learningError=true;await act(async()=>exactButton("Aplicar 2 categorías").click());await settle();assert.equal(updates().length,2);assert.match(container.textContent,/aprendizaje quedó pendiente/);
await reset();await render();await act(async()=>exactButton("Revisar las 2 sugerencias").click());client.lostReply=true;await act(async()=>exactButton("Aplicar 2 categorías").click());await settle();assert.equal(updates().length,1);assert.equal(client.feedback.length,0);assert.match(container.textContent,/No se confirmó/);assert.match(container.textContent,/No se envió/);
await reset();await render();await act(async()=>exactButton("Revisar las 2 sugerencias").click());for(const row of client.movements)if(row.category_id==null)row.category_id=2;await act(async()=>exactButton("Aplicar 2 categorías").click());await settle();assert.equal(updates().length,0);assert.match(container.textContent,/cambió/);
await reset();await render();await act(async()=>exactButton("Revisar las 2 sugerencias").click());client.movements.find(row=>row.id===generated.suggestions[1].movementId).category_id=2;await act(async()=>exactButton("Aplicar 2 categorías").click());await settle();assert.equal(updates().length,1);assert.match(container.textContent,/Categoría aplicada/);assert.match(container.textContent,/cambió/);
for(const p of [{...props,ready:false},{...props,canEdit:false},{...props,snapshot:{...snapshot,workspace:{...snapshot.workspace,role:"viewer"}}}]) {await reset();await render(p);assert.ok(![...container.querySelectorAll('button')].some(node=>!node.disabled&&node.textContent.startsWith("Revisar")));assert.equal(updates().length,0);}
await reset();await render();await act(async()=>exactButton("Revisar las 2 sugerencias").click());await render({...props,ready:false});assert.equal(exactButton("Aplicar 2 categorías").disabled,true);
await reset();await render();await act(async()=>exactButton("Revisar las 2 sugerencias").click());client.gate=deferred();await act(async()=>exactButton("Aplicar 2 categorías").click());assert.equal(updates().length,1);await render({...props,userId:"other",canEdit:false});await act(async()=>client.gate.resolve());await settle();assert.equal(updates().length,1);assert.equal(client.feedback.length,0);assert.doesNotMatch(container.textContent,/Categoría aplicada/);assert.equal(container.querySelector('[role="dialog"]'),null);
await reset();await render();await act(async()=>exactButton("Revisar las 2 sugerencias").click());client.readGate=deferred();await act(async()=>exactButton("Aplicar 2 categorías").click());await render({...props,userId:"other",canEdit:false});await render(props);await act(async()=>client.readGate.resolve());await settle();assert.equal(updates().length,0);
await act(async()=>renderer.unmount());queryClient.clear();container.remove();dom.window.close();
console.log("Dashboard categories: original mobile candidates/feedback ranking, source priority, 90-day/status/FX/category guards, real scoped CAS-only updates and panel confirmations, conflicts, partial/lost replies, learning failure, duplicate and stale-context protection passed locally.");
