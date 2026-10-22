import assert from "node:assert/strict";
import { React, act, dom, load, mock, createRoot, MemoryRouter, change, button, settle } from "./lib/web-ui-harness.mjs";
mock("src/modules/assistant/components/assistant-movement-change-review.tsx","export const AssistantMovementChangeReview=()=>null;");

const recognitions = [], spoken = []; let cancelled = 0;
class Recognition {
  constructor() { recognitions.push(this); }
  start() { this.started = true; }
  stop() { this.onend?.(); }
  abort() { this.aborted = true; }
  result(text, final = true) { this.onresult?.({ results: [{ 0: { transcript: text }, isFinal: final }] }); }
}
window.SpeechRecognition = Recognition;
window.speechSynthesis = { speak: utterance => spoken.push(utterance), cancel: () => { cancelled++; } };
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
const { useAssistantVoice, cleanSpokenReply } = await import(load("src/modules/assistant/hooks/use-assistant-voice.ts"));
assert.equal(cleanSpokenReply("**Hola**  😊 S/ 20"), "Hola S/ 20");
let renderer, container, hook; const texts = [], submissions = [];
function Host({ scopeKey = "alice:8:chat", enabled = true }) { hook = useAssistantVoice({ scopeKey, enabled, onText: text => texts.push(text), onSubmit: text => submissions.push(text) }); return React.createElement('div', null, hook.error); }
async function render(element = React.createElement(Host)) { if (!renderer) { container = document.createElement('div'); document.body.append(container); renderer = createRoot(container); } await act(async () => renderer.render(element)); await settle(); }
async function close() { await act(async () => renderer.unmount()); container.remove(); renderer = null; }
await render(); assert.equal(recognitions.length, 0); assert.equal(spoken.length, 0);
await act(async () => hook.start()); const first = recognitions.at(-1); assert.equal(first.lang, "es-PE"); assert.equal(first.interimResults, true); await act(async () => first.result("¿Cuánto gasté?", false)); assert.equal(texts.at(-1), "¿Cuánto gasté?"); await act(async () => first.result("¿Cuánto gasté?")); await act(async () => first.onend()); assert.equal(submissions.length, 0);
await act(async () => hook.toggleMode()); await act(async () => hook.start()); const handsFree = recognitions.at(-1); await act(async () => handsFree.result("Compara mis gastos")); const end = handsFree.onend; await act(async () => { end(); end(); }); assert.deepEqual(submissions, ["Compara mis gastos"]);
const speakAfterToggle = hook.speakReply; await act(async () => hook.toggleMode()); await act(async () => speakAfterToggle("No debe leer")); assert.equal(spoken.length, 0);
await act(async () => hook.speak("**Hola** 😊")); assert.equal(spoken.at(-1).text, "Hola"); assert.equal(spoken.at(-1).lang, "es-PE"); assert.equal(hook.speaking, true); await act(async () => hook.stopSpeaking()); assert.equal(hook.speaking, false);
await act(async () => hook.start()); const old = recognitions.at(-1), late = old.onresult, lateEnd = old.onend; const beforeText = texts.length; await render(React.createElement(Host, { scopeKey: "bob:9:new" })); assert.equal(old.aborted, true); await act(async () => { late({ results: [{ 0: { transcript: "Secreto de alice" }, isFinal: true }] }); lateEnd(); }); assert.equal(texts.length, beforeText); assert.equal(submissions.length, 1); assert.equal(hook.mode, false);
await act(async () => hook.start()); const denied = recognitions.at(-1); await act(async () => denied.onerror({ error: "not-allowed" })); assert.match(container.textContent, /Sin permiso/); assert.equal(hook.listening, false); assert.equal(denied.onend, null);
await act(async () => hook.start()); const disabled = recognitions.at(-1); await render(React.createElement(Host, { scopeKey: "bob:9:new", enabled: false })); assert.equal(disabled.aborted, true); assert.equal(hook.listening, false); const noStart = recognitions.length; await act(async () => hook.start()); assert.equal(recognitions.length, noStart); await close();
const supported = window.SpeechRecognition; delete window.SpeechRecognition; await render(); assert.equal(hook.canDictate, false); await act(async () => hook.start()); assert.equal(recognitions.length, noStart); await close(); window.SpeechRecognition = supported;

// The actual page: dictation edits the question, hands-free sends only the question,
// replies speak, and financial suggestions remain explicitly unconfirmed.
globalThis.voiceScope = { user: "alice", workspace: 8 }; globalThis.voiceCalls = []; globalThis.voiceAsk = async () => ({ reply: "**Revisa** tus datos 😊", evidence: [], proposals: [{ label: "Gasto", amount: 20, currency: "PEN", href: "/app/movements" }], remainingToday: 4 });
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:{id:globalThis.voiceScope.user}});");
mock("src/modules/workspaces/use-active-workspace.ts", "const workspaces=[{id:8,name:'Personal'},{id:9,name:'Otro'}];export const useActiveWorkspace=()=>({workspaces,activeWorkspace:workspaces.find(w=>w.id===globalThis.voiceScope.workspace),setActiveWorkspaceId:id=>globalThis.voiceScope.workspace=id,isFetching:false,isError:false});");
mock("src/modules/shared/use-pro-feature-access.ts", "export const useProFeatureAccess=()=>({canAccessProFeatures:true});");
mock("src/components/ui/searchable-picker.tsx", `import { createElement as h } from "${new URL("../node_modules/react/index.js", import.meta.url).href}"; export const SearchablePicker=p=>h("select",{"aria-label":p.placeholderLabel,value:p.value,disabled:p.disabled,onChange:e=>p.onChange(e.target.value)},h("option",{value:""},p.placeholderLabel),...p.options.map(o=>h("option",{key:o.value,value:o.value},o.label)));`);
mock("src/services/queries/assistant.ts", "export const useAssistantInsight=()=>({data:null});export const askAssistant=async(message,history)=>{globalThis.voiceCalls.push({message,history});return globalThis.voiceAsk();};");
for (const [file, name] of [["assistant-movement-review", "AssistantMovementReview"], ["assistant-budget-review", "AssistantBudgetReview"], ["assistant-recurring-review", "AssistantRecurringReview"], ["assistant-obligation-review", "AssistantObligationReview"], ["assistant-payment-review", "AssistantPaymentReview"]]) mock(`src/modules/assistant/components/${file}.tsx`, `export const ${name}=()=>{throw Error('Financial review must not open automatically');};`);
const { AssistantPage } = await import(load("src/modules/assistant/pages/assistant-page.tsx"));
const page = React.createElement(MemoryRouter, null, React.createElement(AssistantPage));
async function click(label) { await act(async () => button(container, label).click()); await settle(); }
await render(page); assert.match(container.textContent, /servicio del navegador/); await click("Dictar pregunta"); const manual = recognitions.at(-1); await act(async () => manual.result("¿Cuánto salió?")); await act(async () => manual.onend()); assert.equal(globalThis.voiceCalls.length, 0); assert.equal(container.querySelector('textarea').value, "¿Cuánto salió?");
const beforeSpeech = spoken.length; await click("Enviar pregunta"); assert.equal(globalThis.voiceCalls.length, 1); assert.equal(spoken.length, beforeSpeech); assert.match(container.textContent, /sin registrar automáticamente/); await click("Leer respuesta"); assert.equal(spoken.at(-1).text, "Revisa tus datos"); await click("Detener lectura");
await click("Activar modo hablante"); await click("Dictar pregunta"); const active = recognitions.at(-1); await act(async () => active.result("Registra un gasto")); await click("Terminar dictado"); assert.equal(globalThis.voiceCalls.length, 2); assert.equal(globalThis.voiceCalls.at(-1).message, "Registra un gasto"); assert.equal(spoken.at(-1).text, "Revisa tus datos"); assert.equal(container.querySelector('[role="dialog"]'), null);
let finish; globalThis.voiceAsk = () => new Promise(resolve => { finish = resolve; }); await change(container.querySelector('textarea'), "Consulta lenta"); await click("Enviar pregunta"); await click("Desactivar modo hablante"); const beforeDisabledSpeech = spoken.length; await act(async () => finish({ reply: "No leer después de apagar", evidence: [], proposals: [] })); await settle(); assert.equal(spoken.length, beforeDisabledSpeech);
await click("Dictar pregunta"); const typed = recognitions.at(-1), delayed = typed.onresult; await change(container.querySelector('textarea'), "Texto escrito"); assert.equal(typed.aborted, true); await act(async () => delayed({ results: [{ 0: { transcript: "No reemplazar" }, isFinal: true }] })); assert.equal(container.querySelector('textarea').value, "Texto escrito");
await click("Activar modo hablante"); await click("Dictar pregunta"); const switched = recognitions.at(-1); await change(container.querySelector('select[aria-label="Elige un espacio"]'), "9"); assert.equal(switched.aborted, true); assert.ok(button(container, "Activar modo hablante")); assert.ok(cancelled > 0); await close();
console.log("Assistant voice: opt-in es-PE dictation/readback, mobile spoken-text rules, hands-free questions only, unsupported/denied fallback, late result and scope guards passed with simulated browser APIs; no audio/network.");
dom.window.close();
