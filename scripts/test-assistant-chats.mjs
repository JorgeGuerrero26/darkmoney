import assert from "node:assert/strict";
import { React, act, dom, load, mock, createRoot, MemoryRouter, change, button, settle } from "./lib/web-ui-harness.mjs";

const web = await import(load("src/modules/assistant/lib/chat-store.ts"));
const phone = await import(load("../DarkMoneyApp/features/assistant/lib/chat-store.ts"));
const { useAssistantChats, assistantChatsKey } = await import(load("src/modules/assistant/hooks/use-assistant-chats.ts"));
const { AssistantChatsPanel } = await import(load("src/modules/assistant/components/assistant-chats-panel.tsx"));
const items = [{ id:"a",role:"user",content:"Pago a Lucía" },{ id:"b",role:"assistant",content:"Puedes revisar la cuenta" }];
for (const data of [null,"broken",JSON.stringify({activeId:"c",chats:[{id:"c",updatedAt:9,items,unexpected:"ignored"}]}),JSON.stringify({chats:Array.from({length:25},(_,i)=>({id:String(i),items,updatedAt:i}))})]) assert.deepEqual(web.parseChatStore(data),phone.parseChatStore(data));
const initial = [{ id:"c",title:"Pago a Lucía",updatedAt:9,items }];
for (const title of ["  Renta   familiar  ","", "x".repeat(100)]) assert.deepEqual(web.renameChat(initial,"c",title),phone.renameChat(initial,"c",title));
for (const query of ["lucia","PAGO","cuenta","no existe",""]) assert.deepEqual(web.searchChats(initial,query),phone.searchChats(initial,query));
assert.deepEqual(web.upsertChat(initial,"c",items,100),phone.upsertChat(initial,"c",items,100));
assert.equal(web.upsertChat(initial,"c",items,100)[0].updatedAt,9);
assert.equal(web.upsertChat(initial,"d",Array.from({length:50},(_,i)=>({...items[0],id:String(i)})),100)[0].items.length,40);
assert.equal(web.upsertChat(Array.from({length:20},(_,i)=>({...initial[0],id:String(i)})),"new",items,100).length,20);

let renderer,container,hook;
const response = { reply:"Respuesta",evidence:[{label:"Dato",movementIds:[21]}],proposals:[{label:"Gasto",amount:20,currency:"PEN",href:"/app/movements"}],remainingToday:3 };
function Host({userId="alice",workspaceId=8,fresh=false}) {
  hook=useAssistantChats(userId,workspaceId,fresh);
  return React.createElement("div",null,React.createElement(AssistantChatsPanel,{chats:hook.chats,activeId:hook.activeId,busy:false,onSelect:hook.select,onRename:hook.rename,onRemove:hook.remove}),React.createElement("output",null,hook.turns.map(m=>m.content).join("|")),React.createElement("span",{role:"status"},hook.error));
}
async function render(props={}) {
  if(!renderer){container=document.createElement("div");document.body.append(container);renderer=createRoot(container);}
  await act(async()=>renderer.render(React.createElement(Host,props)));await settle();
}
async function close(){await act(async()=>renderer.unmount());container.remove();renderer=null;}
await render();assert.equal(hook.chats.length,0);
await act(async()=>hook.append([{role:"user",content:"Pago a Lucía"},{role:"assistant",content:"Respuesta",response}]));
const first=hook.activeId,key=assistantChatsKey("alice",8),saved=JSON.parse(window.localStorage.getItem(key));
assert.equal(saved.chats.length,1);assert.equal(saved.chats[0].items[1].response,undefined);assert.ok(hook.turns[1].response);
await act(async()=>hook.rename(first,"Renta"));assert.equal(hook.chats[0].title,"Renta");
await act(async()=>hook.startNew());assert.equal(hook.turns.length,0);assert.equal(hook.chats.length,1);
await act(async()=>hook.append([{role:"user",content:"Otro chat"},{role:"assistant",content:"Otra respuesta",response}]));
const second=hook.activeId;assert.notEqual(first,second);assert.equal(hook.chats.length,2);
await act(async()=>hook.select(first));assert.equal(hook.turns[1].response,undefined);assert.equal(hook.turns[0].content,"Pago a Lucía");
const staleAppend=hook.append;
await act(async()=>hook.startNew());await act(async()=>staleAppend([{role:"assistant",content:"STALE_CHAT"}]));assert.equal(hook.turns.length,0);
await act(async()=>hook.select(first));await close();await render();assert.equal(hook.activeId,first);assert.equal(hook.turns[1].response,undefined);
await render({workspaceId:9});assert.equal(hook.chats.length,0);assert.equal(hook.turns.length,0);
await render({userId:"bob",workspaceId:8});assert.equal(hook.chats.length,0);assert.equal(JSON.parse(window.localStorage.getItem(key)).chats.length,2);
await render();await act(async()=>hook.remove(second));assert.equal(hook.chats.length,1);assert.equal(hook.activeId,first);
const originalSet=dom.window.Storage.prototype.setItem,previousRaw=window.localStorage.getItem(key);
dom.window.Storage.prototype.setItem=function(){throw new Error("quota");};
try {await act(async()=>hook.rename(first,"En memoria"));assert.match(hook.error,/No pudimos guardar/);assert.equal(window.localStorage.getItem(key),previousRaw);}
finally {dom.window.Storage.prototype.setItem=originalSet;}
await act(async()=>hook.rename(first,"Persistido"));assert.equal(hook.error,"");
const brokenKey=assistantChatsKey("broken",8);window.localStorage.setItem(brokenKey,"broken");await render({userId:"broken"});assert.match(hook.error,/No pudimos leer/);assert.equal(window.localStorage.getItem(brokenKey),"broken");
await close();

// Real page and persistence together, with only auth/workspaces and transport substituted.
globalThis.chatUser="page-user";globalThis.chatWorkspace=8;globalThis.chatCalls=[];globalThis.chatGate=null;
mock("src/modules/auth/auth-context.tsx","export const useAuth=()=>({user:{id:globalThis.chatUser}});");
mock("src/modules/shared/use-pro-feature-access.ts","export const useProFeatureAccess=()=>({canAccessProFeatures:true,isLoadingEntitlement:false});");
mock("src/modules/assistant/components/assistant-movement-review.tsx","export const AssistantMovementReview=()=>null;");
mock("src/modules/assistant/components/assistant-budget-review.tsx","export const AssistantBudgetReview=()=>null;");
mock("src/modules/assistant/components/assistant-recurring-review.tsx","export const AssistantRecurringReview=()=>null;");
mock("src/modules/workspaces/use-active-workspace.ts","const workspaces=[{id:8,name:'Personal'},{id:9,name:'Compartido'}];export const useActiveWorkspace=()=>({workspaces,activeWorkspace:workspaces.find(w=>w.id===globalThis.chatWorkspace),setActiveWorkspaceId:id=>{globalThis.chatWorkspace=id},isFetching:false,isError:false});");
mock("src/services/queries/assistant.ts","export const useAssistantInsight=()=>({data:null,isPending:false,isError:false});export async function askAssistant(message,history,workspaceId,signal){globalThis.chatCalls.push({message,history,workspaceId,signal});return globalThis.chatGate?await globalThis.chatGate:{reply:'Respuesta a '+message,evidence:[],proposals:[{label:'Gasto',href:'/app/movements',amount:20,currency:'PEN'}],remainingToday:3};}");
const { AssistantPage }=await import(load("src/modules/assistant/pages/assistant-page.tsx"));
async function page(){if(!renderer){container=document.createElement("div");document.body.append(container);renderer=createRoot(container);}await act(async()=>renderer.render(React.createElement(MemoryRouter,null,React.createElement(AssistantPage))));await settle();}
async function ask(text){await change(container.querySelector("textarea"),text);await act(async()=>button(container,"Enviar pregunta").click());await settle();}
await page();assert.equal(globalThis.chatCalls.length,0);
await ask("Pregunta uno");assert.match(container.textContent,/Respuesta a Pregunta uno/);assert.match(container.textContent,/sin registrar/);
await act(async()=>button(container,"Nueva conversación").click());await ask("Pregunta dos");assert.equal(globalThis.chatCalls[1].history.length,0);
const firstButton=[...container.querySelectorAll("details ul li button")].find(b=>b.textContent==="Pregunta uno");assert.ok(firstButton);await act(async()=>firstButton.click());assert.match(container.textContent,/Respuesta a Pregunta uno/);assert.doesNotMatch(container.textContent,/sin registrar/);
await close();await page();assert.match(container.textContent,/Respuesta a Pregunta uno/);assert.doesNotMatch(container.textContent,/sin registrar/);assert.equal(globalThis.chatCalls.length,2);
await act(async()=>container.querySelector('button[aria-label="Renombrar Pregunta uno"]').click());await change(container.querySelector('input[aria-label="Nombre de conversación"]'),"Familia");await act(async()=>button(container,"Guardar nombre").click());
await change(container.querySelector('input[aria-label="Buscar conversación"]'),"familia");assert.equal(container.querySelectorAll("details ul li").length,1);
await act(async()=>container.querySelector('button[aria-label="Eliminar Familia"]').click());assert.match(container.textContent,/No se borran movimientos/);await act(async()=>button(container,"Eliminar conversación").click());assert.doesNotMatch(container.querySelector("[aria-live]").textContent,/Respuesta a Pregunta uno/);
await change(container.querySelector("select"),"9");assert.equal(container.querySelector("[aria-live]").textContent,"");
let finishOld;globalThis.chatGate=new Promise(r=>{finishOld=r;});await change(container.querySelector("textarea"),"Consulta lenta");await act(async()=>button(container,"Enviar pregunta").click());
await act(async()=>button(container,"Cancelar consulta").click());assert.equal(globalThis.chatCalls.at(-1).signal.aborted,true);
globalThis.chatGate=null;await ask("Consulta nueva");await act(async()=>finishOld({reply:"STALE_CANCELLED",evidence:[],proposals:[],remainingToday:3}));await settle();assert.doesNotMatch(container.textContent,/STALE_CANCELLED/);assert.match(container.textContent,/Respuesta a Consulta nueva/);
globalThis.chatUser="another-user";await page();assert.equal(container.querySelector("[aria-live]").textContent,"");assert.equal(globalThis.chatCalls.length,4);
await close();dom.window.close();console.log("assistant-chats: OK (real mobile store comparison, scoped browser persistence, caps/search/rename/confirmed deletion, blocked/corrupt storage preservation, text-only restore, real page and cancellation; no remote calls)");
