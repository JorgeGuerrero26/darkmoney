import assert from "node:assert/strict";
import {React,act,dom,load,mock,createRoot,MemoryRouter,QueryClient,QueryClientProvider,change,button,settle} from "./lib/web-ui-harness.mjs";
globalThis.assistantUser="u";globalThis.assistantWorkspace=8;globalThis.assistantCalls=[];globalThis.assistantGate=null;
const notice={id:90,user_id:"u",kind:"assistant_insight",title:"Revisa tus gastos",body:"Hay una señal por revisar.",payload:{assistantPrompt:"¿Qué cambió en mis gastos?",url:"https://malicious.invalid"}};
const reads=[];
globalThis.assistantClient={from:table=>{
  assert.equal(table,"notifications");const filters=[];
  const query={select:()=>query,eq:(k,v)=>{filters.push([k,v]);return query;},maybeSingle:async()=>{
    reads.push(filters);return {data:filters.every(([k,v])=>notice[k]===v)?notice:null,error:null};
  }};return query;
}};
mock("src/services/supabase/client.ts","export const supabase=globalThis.assistantClient;");
mock("src/services/queries/workspace-data.ts","export const invokeAuthenticatedFunction=async(name,body,options)=>{globalThis.assistantCalls.push({name,body,options});return globalThis.assistantGate?await globalThis.assistantGate:{ok:true,reply:'Respuesta de consulta',evidence:[{label:'Datos revisados',movementIds:[21]}],draft:{operation:'expense',amount:20,currency:'PEN'},remainingToday:3};};");
mock("src/modules/auth/auth-context.tsx","export const useAuth=()=>({user:{id:globalThis.assistantUser}});");
mock("src/modules/workspaces/use-active-workspace.ts",`const workspaces=[{id:8,name:'Personal',isArchived:false},{id:9,name:'Compartido',isArchived:false}];export const useActiveWorkspace=()=>({workspaces,activeWorkspace:workspaces.find(row=>row.id===globalThis.assistantWorkspace),isFetching:false,isError:false,setActiveWorkspaceId:id=>{globalThis.assistantWorkspace=id}});`);
mock("src/modules/shared/use-pro-feature-access.ts","export const useProFeatureAccess=()=>({canAccessProFeatures:true,isLoadingEntitlement:false});");
// Conversation I/O is covered here; financial review has its own suite.
mock("src/modules/assistant/components/assistant-payment-review.tsx", "export const AssistantPaymentReview=()=>null;");
mock("src/modules/assistant/components/assistant-movement-review.tsx","export const AssistantMovementReview=()=>null;");
mock("src/modules/assistant/components/assistant-budget-review.tsx","export const AssistantBudgetReview=()=>null;");
mock("src/modules/assistant/components/assistant-recurring-review.tsx","export const AssistantRecurringReview=()=>null;");
mock("src/modules/assistant/components/assistant-obligation-review.tsx","export const AssistantObligationReview=()=>null;");
const contract=await import(load("src/modules/assistant/lib/assistant-contract.ts"));
const service=await import(load("src/services/queries/assistant.ts"));
const {AssistantPage}=await import(load("src/modules/assistant/pages/assistant-page.tsx"));
const {notificationHref,notificationDestinationHref}=await import(load("src/modules/notifications/lib/notification-navigation.ts"));
assert.equal(notificationHref({kind:"assistant_insight",payload:{url:"https://malicious.invalid"}}),"/app/assistant");
assert.equal(notificationDestinationHref("/app/assistant",90),"/app/assistant?noticeId=90");
await assert.rejects(service.readAssistantInsight(globalThis.assistantClient,"other",90),/usuario/);
assert.deepEqual(reads[0],[["user_id","other"],["id",90]]);
const history=Array.from({length:20},(_,i)=>({role:"user",content:String(i)+"x".repeat(5000)}));
const body=contract.assistantRequest(" Hola ",history,8);assert.equal(body.history.length,16);assert.equal(body.history[0].content.length,3000);assert.equal(body.message,"Hola");
assert.throws(()=>contract.assistantRequest("x",[],0));assert.throws(()=>contract.assistantRequest("x".repeat(4001),[],8));
assert.throws(()=>contract.parseAssistantReply({ok:false,error:"Sin acceso"}),/Sin acceso/);
assert.throws(()=>contract.parseAssistantReply({reply:{}}),/incompleta/);
const parsed=contract.parseAssistantReply({reply:"Bien",evidence:[{label:"x",movementIds:[true,0,-1,2,2]}],drafts:[{operation:"expense",amount:1,currency:"PEN",href:"https://evil.invalid"},{operation:"delete_all",amount:999,currency:"PEN"}]});
assert.deepEqual(parsed.evidence[0].movementIds,[2]);assert.equal(parsed.proposals.length,1);assert.equal(parsed.proposals[0].href,"/app/movements");
let renderer,container,client;
async function render(){
  if(!renderer){container=document.createElement("div");document.body.append(container);renderer=createRoot(container);client=new QueryClient({defaultOptions:{queries:{retry:false,retryDelay:0,gcTime:0}}});}
  await act(async()=>renderer.render(React.createElement(QueryClientProvider,{client},React.createElement(MemoryRouter,{initialEntries:["/app/assistant?noticeId=90&ask=NO_AUTO_SEND"]},React.createElement(AssistantPage)))));await settle();
}
async function close(){await act(async()=>renderer.unmount());client.clear();container.remove();renderer=null;}
await render();assert.equal(globalThis.assistantCalls.length,0);
assert.equal(container.querySelector("textarea").value,notice.payload.assistantPrompt);assert.equal(button(container,"Enviar pregunta").disabled,true);
await change(container.querySelector("select"),"8");
await act(async()=>button(container,"Enviar pregunta").click());await settle();
assert.equal(globalThis.assistantCalls.length,1);assert.equal(globalThis.assistantCalls[0].name,"assistant-chat");assert.equal(globalThis.assistantCalls[0].body.workspaceId,8);
assert.equal(globalThis.assistantCalls[0].body.message,notice.payload.assistantPrompt);assert.match(container.textContent,/Respuesta de consulta/);assert.match(container.textContent,/sin registrar/);
assert.ok([...container.querySelectorAll("a")].every(a=>!a.href.includes("evil.invalid")));await close();
// A double submit is locked. A changed space aborts and a late response cannot populate it.
globalThis.assistantCalls=[];globalThis.assistantWorkspace=8;let finish;
globalThis.assistantGate=new Promise(resolve=>{finish=resolve;});await render();await change(container.querySelector("select"),"8");
await act(async()=>{const form=container.querySelector("form");form.dispatchEvent(new dom.window.Event("submit",{bubbles:true,cancelable:true}));form.dispatchEvent(new dom.window.Event("submit",{bubbles:true,cancelable:true}));});
assert.equal(globalThis.assistantCalls.length,1);globalThis.assistantWorkspace=9;await render();
assert.equal(globalThis.assistantCalls[0].options.signal.aborted,true);
await act(async()=>finish({reply:"OLD_SPACE_RESPONSE"}));await settle();assert.doesNotMatch(container.textContent,/OLD_SPACE_RESPONSE/);await close();
globalThis.assistantGate=null;globalThis.assistantUser="other";await render();
for(let i=0;i<20&&container.textContent.includes("Consultando el aviso");i++)await settle();
assert.match(container.textContent,/no está disponible/);assert.equal(container.querySelector("textarea"),null);await close();
dom.window.close();console.log("web-assistant: OK (canonical scoped notice, real page/service, no automatic prompt, explicit space/send, bounded history, evidence/proposals not commands, double submit and stale response guards; no live AI)");
