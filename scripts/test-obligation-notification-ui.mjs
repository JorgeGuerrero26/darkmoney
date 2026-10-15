import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import {React,act,dom,load,mock,h,createRoot,change,button,settle,root} from "./lib/web-ui-harness.mjs";
import {resolve} from "node:path";
mock("src/components/ui/searchable-picker.tsx",`${h} export const SearchablePicker=p=>h('select',{'aria-label':p.placeholderLabel,value:p.value,onChange:e=>p.onChange(e.target.value)},h('option',{value:''},'Elige'),...p.options.map(o=>h('option',{key:o.value,value:o.value},o.label)));`);
const {useObligationNotificationOpening}=await import(load("src/modules/notifications/hooks/use-obligation-notification-opening.ts"));
const {PendingPaymentRequestsSection}=await import(load("src/modules/obligations/components/pending-payment-requests-section.tsx"));
const {PendingEventRequestsSection}=await import(load("src/modules/obligations/components/pending-event-requests-section.tsx"));
const obligation={id:11,workspaceId:8,title:"Crédito",currencyCode:"PEN",pendingAmount:100,status:"active",settlementAccountId:3,events:[{id:30,amount:25,movementId:100,accountId:3}]};
const payment={id:20,workspaceId:8,obligationId:11,status:"pending",amount:25,paymentDate:"2026-10-14",requestedByDisplayName:"Invitado"};
const edit={notificationId:40,payload:{obligationId:11,eventId:30,currentAmount:25,proposedAmount:35,requestedByDisplayName:"Invitado",obligationTitle:"Crédito",currencyCode:"PEN"}};
const deletion={notificationId:41,payload:{obligationId:11,eventId:30,amount:25,eventDate:"2026-10-14",obligationTitle:"Crédito",currencyCode:"PEN"}};
const accounts=[{id:3,workspaceId:8,name:"Principal",type:"bank",currencyCode:"PEN",isArchived:false}];
const pagePath=resolve(root,"src/modules/obligations/pages/obligations-page.tsx");
const pageSource=ts.createSourceFile(pagePath,readFileSync(pagePath,"utf8"),ts.ScriptTarget.Latest,true);
const names=["handleAcceptPaymentRequest","handleRejectPaymentRequest","handleAcceptEventEditRequest","handleRejectEventEditRequest","handleAcceptEventDeleteRequest","handleRejectEventDeleteRequest"];
const functions=[];function visit(node){if(ts.isFunctionDeclaration(node)&&names.includes(node.name?.text))functions.push(node.getText(pageSource));ts.forEachChild(node,visit);}visit(pageSource);assert.equal(functions.length,6);
const code=ts.transpileModule(functions.join("\n"),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function environment(){
  const state={calls:[],feedback:[],fail:false,gate:null};
  const mutation=name=>({mutateAsync:async input=>{state.calls.push({name,input});if(state.gate)await state.gate;if(state.fail)throw Error("Fixture server failed");}});
  const env={activeWorkspace:{id:8},user:{id:"u"},obligations:[obligation],setPageFeedback:value=>state.feedback.push(value),getQueryErrorMessage:e=>e.message,resolveEventAccountId:()=>3};
  for(const name of ["acceptPaymentRequestMutation","rejectPaymentRequestMutation","acceptEventEditRequestMutation","rejectEventEditRequestMutation","acceptEventDeleteRequestMutation","rejectEventDeleteRequestMutation"])env[name]=mutation(name);
  return {state,callbacks:new Function(...Object.keys(env),`${code};return {${names.join(",")}};`)(...Object.values(env))};
}
// Actual page callbacks propagate failure instead of resolving and falsely closing the form.
for(const name of names){
  const e=environment();e.state.fail=true;
  const args=name==="handleAcceptPaymentRequest"?[{request:payment,obligation,registerAccountMovement:true,accountId:3}]:name==="handleRejectPaymentRequest"?[{request:payment,obligation,rejectionReason:"No llegó"}]:name.includes("Delete")?[deletion,"No"]:[edit,"No"];
  await assert.rejects(e.callbacks[name](...args),/Fixture server failed/);assert.equal(e.state.calls.length,1);assert.equal(e.state.feedback[0].tone,"error");
}
let renderer,container,env,opening;
function Host({params,reads={shared:"ready",payments:"ready",events:"ready"},stale=false,workspaceId=8,snapshotWorkspaceId=8}){
  const [target,setTarget]=React.useState(null);const [error,setError]=React.useState("");
  useObligationNotificationOpening({params,workspaceId,snapshotWorkspaceId,stale,data:{owned:[obligation],shared:[],payments:[payment],deletes:[deletion],edits:[edit]},reads,
    onError:setError,onTarget:t=>{opening.push(t);setTarget(t);},onConsume:()=>{globalThis.consumed++;}});
  return React.createElement("div",null,error?React.createElement("p",{role:"alert"},error):null,target?.mode==="payment"?
    React.createElement(PendingPaymentRequestsSection,{focusRequestId:target.request,accounts,obligations:[obligation],requests:[payment],isResolving:false,onAccept:env.callbacks.handleAcceptPaymentRequest,onReject:env.callbacks.handleRejectPaymentRequest}):
    target?.mode==="edit"||target?.mode==="delete"?React.createElement(PendingEventRequestsSection,{focusRequest:{kind:target.mode,eventId:target.event},obligations:[obligation],deleteRequests:target.mode==="delete"?[deletion]:[],editRequests:target.mode==="edit"?[edit]:[],isResolving:false,
      onAcceptDelete:env.callbacks.handleAcceptEventDeleteRequest,onRejectDelete:env.callbacks.handleRejectEventDeleteRequest,onAcceptEdit:env.callbacks.handleAcceptEventEditRequest,onRejectEdit:env.callbacks.handleRejectEventEditRequest}):target?React.createElement("p",null,`Detalle ${target.id}`):null);
}
async function render(props){if(!renderer){env=environment();opening=[];globalThis.consumed=0;container=document.createElement("div");document.body.append(container);renderer=createRoot(container);}await act(async()=>renderer.render(React.createElement(Host,props)));await settle();}
async function close(){await act(async()=>renderer.unmount());container.remove();renderer=null;}
const params=new URLSearchParams("resource=11&paymentRequest=20&notificationKind=obligation_payment_request&noticeId=70");
await render({params,reads:{shared:"ready",payments:"loading",events:"ready"}});assert.equal(opening.length,0);assert.equal(globalThis.consumed,0);assert.equal(env.state.calls.length,0);
await render({params,reads:{shared:"ready",payments:"error",events:"ready"}});assert.match(container.textContent,/read/);assert.equal(globalThis.consumed,0);
await render({params});assert.equal(opening[0].mode,"payment");assert.equal(globalThis.consumed,1);assert.equal(env.state.calls.length,0);assert.ok(container.querySelector('select[aria-label="Selecciona una cuenta"]'));
env.state.fail=true;await act(async()=>button(container,"Confirmar abono").click());await settle();assert.match(container.textContent,/Fixture server failed/);assert.ok(container.querySelector("select"));assert.equal(env.state.calls.length,1);
env.state.fail=false;let finish;env.state.gate=new Promise(resolve=>{finish=resolve;});await act(async()=>{button(container,"Confirmar abono").click();button(container,"Confirmar abono").click();});assert.equal(env.state.calls.length,2);
await act(async()=>finish());await settle();assert.equal(env.state.calls[1].input.accountId,3);assert.equal(env.state.calls[1].input.registerAccountMovement,true);await close();
// An unresolved or foreign request opens only the owned detail, never another request.
await render({params:new URLSearchParams("resource=11&paymentRequest=999&notificationKind=obligation_payment_request")});assert.equal(opening[0].mode,"owned");assert.match(container.textContent,/Detalle 11/);assert.equal(env.state.calls.length,0);await close();
await render({params,stale:true});assert.equal(opening.length,0);await close();await render({params,workspaceId:9});assert.equal(opening.length,0);await close();
// No silent fallback to an account-less payment when the selected account is invalid.
accounts[0].isArchived=true;await render({params});
await act(async()=>button(container,"Confirmar abono").click());assert.equal(env.state.calls.length,0);assert.match(container.textContent,/cuenta activa/);
await act(async()=>container.querySelector('[aria-label="Registrar movimiento en cuenta"]').click());
await act(async()=>button(container,"Confirmar abono").click());await settle();assert.equal(env.state.calls.length,1);assert.equal(env.state.calls[0].input.registerAccountMovement,false);await close();accounts[0].isArchived=false;
// Same editor components are used for edit/delete destinations; no acceptance on mount/focus.
for(const kind of ["edit","delete"]){
  await render({params:new URLSearchParams(`resource=11&event=30&notificationKind=obligation_event_${kind}_request`)});
  assert.equal(opening[0].mode,kind);assert.equal(env.state.calls.length,0);assert.equal(document.activeElement.tagName,"LI");
  env.state.fail=true;await act(async()=>button(container,kind==="edit"?"Aplicar cambios":"Eliminar evento").click());await settle();assert.match(container.textContent,/Fixture server failed/);
  env.state.fail=false;await act(async()=>button(container,"Rechazar").click());await change(container.querySelector("input"),"No corresponde");
  await act(async()=>button(container,"Confirmar rechazo").click());await settle();assert.equal(env.state.calls.length,2);assert.equal(env.state.calls[1].input.rejectionReason,"No corresponde");await close();
}
dom.window.close();console.log("obligation-notification-ui: OK (actual opening hook, payment/edit/delete forms and page handlers, wait/error/stale scope, no auto-accept, one confirmation, failure preserves editor and rejection reason; local I/O only)");
