import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, dom, root, load, mock, h, createRoot, MemoryRouter, change, button, settle } from "./lib/web-ui-harness.mjs";
mock("src/modules/assistant/components/assistant-movement-change-review.tsx","export const AssistantMovementChangeReview=()=>null;");

const { parseBudgetProposal, prepareBudgetProposal } = await import(load("src/modules/assistant/lib/budget-proposal.ts"));
const { buildBudgetEditorInput } = await import(load("src/modules/budgets/lib/budget-editor-input.ts"));
const { createAssistantResourceSaver } = await import(load("src/modules/assistant/lib/resource-proposal-save.ts"));
const { parseAssistantReply, assistantRequest } = await import(load("src/modules/assistant/lib/assistant-contract.ts"));
const { assistantHistoryTurn } = await import(load("src/modules/assistant/lib/proposal-memory.ts"));
const raw = { name: "Comida de octubre", limitAmount: 400, currency: "PEN", categoryName: "alimentacion", periodStart: "2026-10-01", periodEnd: "2026-10-31", alertPercent: 80 };
const snapshot = { workspace: { id: 8, baseCurrencyCode: "PEN" }, catalogs: { categories: [{ id: 10, name: "Alimentación", isActive: true, kind: "expense" }], counterparties: [] },
  accounts: [{ id: 1, name: "Principal", workspaceId: 8, currencyCode: "PEN", isArchived: false }], budgets: [], movements: [], subscriptions: [], recurringIncome: [], exchangeRates: [] };
// Execute the actual mobile parser in isolation, not a hand-copied expectation.
const phoneSource = readFileSync(resolve(root, "../DarkMoneyApp/services/queries/assistant.ts"), "utf8");
const ast = ts.createSourceFile("assistant.ts", phoneSource, ts.ScriptTarget.Latest, true);
const phoneFn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "parseBudgetDraft"); assert.ok(phoneFn);
const phoneParser = new Function(ts.transpileModule(phoneFn.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + "; return parseBudgetDraft;")();
for (const value of [raw, { ...raw, limitAmount: "399.5" }, { ...raw, name: "", alertPercent: 999 }, { ...raw, alertPercent: null }]) assert.deepEqual(parseBudgetProposal(value), phoneParser(value));
for (const patch of [{ limitAmount: true }, { limitAmount: 0 }, { limitAmount: Infinity }, { periodStart: "2026-02-30" }, { periodStart: "2026-11-01" }, { currency: "pen" }]) assert.equal(parseBudgetProposal({ ...raw, ...patch }), null);
const draft = parseBudgetProposal(raw), value = prepareBudgetProposal(draft, snapshot);
assert.equal(value.categoryId, 10); assert.equal(value.scopeChosen, true); assert.equal(value.recurrence, "none");
const payload = buildBudgetEditorInput(value, snapshot, [], "2026-10-15", true);
assert.equal(payload.periodStart, raw.periodStart); assert.equal(payload.periodEnd, raw.periodEnd); assert.equal(payload.limitAmount, 400); assert.equal(payload.categoryId, 10);
assert.equal(buildBudgetEditorInput({ ...value, recurrence: "monthly" }, snapshot, [], "2026-10-15", true).periodStart, "2026-10-15");
assert.equal(buildBudgetEditorInput({ ...value, recurrence: "monthly" }, snapshot, [], "2026-10-15", false).periodStart, "2026-10-01");
for (const categories of [[], [...snapshot.catalogs.categories, { id: 11, name: "ALIMENTACION", isActive: true, kind: "both" }], [{ id: 10, name: "Alimentación", isActive: false, kind: "expense" }], [{ id: 10, name: "Alimentación", isActive: true, kind: "income" }]]) {
  const prepared = prepareBudgetProposal(draft, { ...snapshot, catalogs: { ...snapshot.catalogs, categories } });
  assert.equal(prepared.categoryId, null); assert.equal(prepared.scopeChosen, false); assert.throws(() => buildBudgetEditorInput(prepared, snapshot, [], "2026-10-15", true), /Elige qué gasto/);
}
for (const patch of [{ limitAmount: "0" }, { periodEnd: "2026-09-30" }, { periodStart: "2026-02-30" }, { categoryId: 99 }, { accountId: 99 }, { spendTypeId: 99 }, { currencyCode: "XYZ" }, { alertPercent: 0 }, { recurrence: "invalid" }]) assert.throws(() => buildBudgetEditorInput({ ...value, ...patch }, snapshot, [], "2026-10-15", true));
const reply = parseAssistantReply({ reply: "Propongo un límite", budgetDraft: { ...raw, href: "https://evil.invalid", status: "saved" } });
assert.deepEqual(reply.proposals[0].budgetDraft, draft); assert.equal(reply.proposals[0].status, undefined); assert.equal(reply.proposals[0].href, "/app/budgets");
{
  let calls = 0, finish; const save = createAssistantResourceSaver({ isCurrent: () => true, insert: async () => { calls++; await new Promise(r => { finish = r; }); } });
  const a = save.save(payload), b = save.save(payload); await Promise.resolve(); assert.equal(calls, 1); finish(); await Promise.all([a, b]); await save.save(payload); assert.equal(calls, 1); assert.equal(save.confirmed(), payload);
}
for (const code of [undefined, 20, "NETWORK_ERROR", "PGRST000"]) {
  let calls = 0; const save = createAssistantResourceSaver({ isCurrent: () => true, insert: async () => { calls++; throw { code }; } });
  await assert.rejects(save.save(payload)); assert.equal(save.uncertain(), true); await assert.rejects(save.save(payload), /Comprueba el módulo/); assert.equal(calls, 1);
}
{
  let fail = true, calls = 0; const save = createAssistantResourceSaver({ isCurrent: () => true, insert: async () => { calls++; if (fail) throw { code: "23514" }; } });
  await assert.rejects(save.save(payload)); assert.equal(save.uncertain(), false); fail = false; await save.save(payload); assert.equal(calls, 2);
}
{
  let current = true, calls = 0; const save = createAssistantResourceSaver({ isCurrent: () => current, insert: async () => { calls++; } });
  const flight = save.save(payload); current = false; await assert.rejects(flight, /contexto cambió/); assert.equal(calls, 0); assert.equal(save.uncertain(), false);
}
const annotated = assistantHistoryTurn({ role: "assistant", content: "x".repeat(5000), response: { proposals: Array.from({ length: 23 }, () => ({ ...reply.proposals[0], status: "unconfirmed", statusNote: "x".repeat(500) })) } });
assert.ok(annotated.content.length <= 3000); assert.match(assistantRequest("otra", [annotated], 8).history[0].content, /#23: RESULTADO INCIERTO; no repetir/);

// Real page, proposal row, budget review and shared editor. Only I/O and calendar control are substituted.
globalThis.budgetScope = { userId: "u", workspaceId: 8, pro: true, role: "owner", archived: false };
globalThis.budgetQuery = { data: snapshot, isSuccess: true, isFetching: false, isError: false, isPlaceholderData: false, refetch: async () => {} };
globalThis.budgetSpend = { data: [], isSuccess: true, isFetching: false, isError: false };
globalThis.budgetWrites = []; globalThis.budgetWrite = async () => {}; globalThis.budgetCalls = []; globalThis.budgetReply = reply;
mock("src/services/queries/workspace-data.ts", `export const useWorkspaceSnapshotQuery=()=>globalThis.budgetQuery,useBudgetSpendTypesQuery=()=>globalThis.budgetSpend;
export const useCreateBudgetMutation=()=>({mutateAsync:async input=>{globalThis.budgetWrites.push(input);await globalThis.budgetWrite(input);return globalThis.budgetResult??{id:77,workspaceId:input.workspaceId};}});export const getQueryErrorMessage=e=>e.message??'SQL rejected';`);
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:{id:globalThis.budgetScope.userId}});");
mock("src/modules/workspaces/use-active-workspace.ts", "const workspaces=[{id:8,name:'Personal'},{id:9,name:'Otro'}];export const useActiveWorkspace=()=>({workspaces,activeWorkspace:{...workspaces.find(w=>w.id===globalThis.budgetScope.workspaceId),role:globalThis.budgetScope.role,isArchived:globalThis.budgetScope.archived},setActiveWorkspaceId:id=>{globalThis.budgetScope.workspaceId=id},isFetching:false,isError:false});");
mock("src/modules/shared/use-pro-feature-access.ts", "export const useProFeatureAccess=()=>({canAccessProFeatures:globalThis.budgetScope.pro});");
mock("src/services/queries/assistant.ts", "export const useAssistantInsight=()=>({data:null});export const askAssistant=async(message,history)=>{globalThis.budgetCalls.push({message,history});return globalThis.budgetReply;};");
mock("src/modules/assistant/components/assistant-payment-review.tsx", "export const AssistantPaymentReview=()=>null;");
mock("src/modules/assistant/components/assistant-movement-review.tsx", "export const AssistantMovementReview=()=>null;");
mock("src/modules/assistant/components/assistant-recurring-review.tsx", "export const AssistantRecurringReview=()=>null;");
mock("src/modules/assistant/components/assistant-obligation-review.tsx", "export const AssistantObligationReview=()=>null;");
mock("src/components/ui/date-picker-field.tsx", `${h} export const DatePickerField=p=>h('input',{value:p.value,onChange:e=>p.onChange(e.target.value)});`);
const { AssistantPage } = await import(load("src/modules/assistant/pages/assistant-page.tsx"));
const { AssistantBudgetReview } = await import(load("src/modules/assistant/components/assistant-budget-review.tsx"));
let renderer, container;
async function render(element = React.createElement(AssistantPage)) { if (!renderer) { container = document.createElement("div"); document.body.append(container); renderer = createRoot(container); } await act(async () => renderer.render(React.createElement(MemoryRouter, null, element))); await settle(); }
async function close() { await act(async () => renderer.unmount()); container.remove(); renderer = null; }
async function click(label) { await act(async () => button(container, label).click()); await settle(); }
async function ask(text) { await change(container.querySelector("textarea"), text); await click("Enviar pregunta"); }
async function submit() { await act(async () => { const form = container.querySelector('[role="dialog"] form'); assert.ok(form); for (let i = 0; i < 2; i++) form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); }); await settle(); }
const amount = () => container.querySelector('input[inputmode="decimal"]');
await render(); await ask("Limita mi gasto"); assert.equal(globalThis.budgetWrites.length, 0); await click("Revisar y registrar"); assert.equal(globalThis.budgetWrites.length, 0); assert.match(container.textContent, /Nuevo presupuesto/); assert.equal(amount().value, "400");
await change(amount(), "450"); globalThis.budgetQuery.isFetching = true; await render(); assert.equal(amount().value, "450"); await submit(); assert.equal(globalThis.budgetWrites.length, 0); assert.match(container.textContent, /Espera la lectura/);
globalThis.budgetQuery.isFetching = false; await render(); let finish; globalThis.budgetWrite = () => new Promise(r => { finish = r; }); await submit(); assert.equal(globalThis.budgetWrites.length, 1); assert.equal(button(container, "Guardando...").disabled, true);
assert.equal(globalThis.budgetWrites[0].limitAmount, 450); assert.equal(globalThis.budgetWrites[0].periodStart, "2026-10-01"); assert.equal(globalThis.budgetWrites[0].recurrence, "none");
await act(async () => finish()); await settle(); assert.equal(container.querySelector('[role="dialog"]'), null); assert.match(container.textContent, /Guardado/);
await ask("¿Quedó registrado?"); assert.match(globalThis.budgetCalls.at(-1).history.at(-1).content, /GUARDÓ/); assert.match(globalThis.budgetCalls.at(-1).history.at(-1).content, /450[.,]00/);
await click("Revisar y registrar"); globalThis.budgetWrite = async () => { throw Error("Network response lost"); }; await submit();
assert.equal(container.querySelector('[role="dialog"]'), null); assert.match(container.textContent, /podría haberse creado/);
const checkLink = [...container.querySelectorAll("a")].find(a => a.textContent === "Comprobar en el módulo"); assert.equal(checkLink?.getAttribute("href"), "/app/budgets");
assert.equal([...container.querySelectorAll("button")].filter(b => b.textContent === "Revisar y registrar").length, 0); assert.equal([...container.querySelectorAll("button")].filter(b => b.textContent === "Descartar").length, 0);
assert.equal(globalThis.budgetWrites.length, 2); await ask("¿Se creó el segundo?"); assert.match(globalThis.budgetCalls.at(-1).history.at(-1).content, /RESULTADO INCIERTO; no repetir/); await close();

let outcomes = [], uncertain = [], closes = 0;
const props = { draft, workspaceId: 8, userId: "u", session: {}, onClose: () => { closes++; }, onSaved: note => outcomes.push(note), onUnconfirmed: note => uncertain.push(note) };
// A definite SQL rejection keeps fields editable and permits a deliberate corrected retry.
let fail = true; globalThis.budgetWrite = async () => { if (fail) throw { code: "23514", message: "Fixture SQL rejection" }; };
await render(React.createElement(AssistantBudgetReview, props)); await submit(); assert.match(container.textContent, /Fixture SQL rejection/); assert.equal(uncertain.length, 0);
await change(amount(), "480"); fail = false; await submit(); assert.match(outcomes.at(-1), /480[.,]00/); await close();
// A missing or ambiguous category must be explicitly changed/confirmed, not silently expanded to all spending.
globalThis.budgetWrite = async () => {}; const ambiguous = { ...draft, categoryName: "No existe" };
await render(React.createElement(AssistantBudgetReview, { ...props, draft: ambiguous, session: {} })); const beforeScope = globalThis.budgetWrites.length; await submit(); assert.equal(globalThis.budgetWrites.length, beforeScope); assert.match(container.textContent, /Elige qué gasto/);
const scopeButton = [...container.querySelectorAll("button")].find(b => b.querySelector("span")?.textContent === "Qué limitas"); assert.ok(scopeButton); await act(async () => scopeButton.click()); await click("Usar este alcance"); await submit(); assert.equal(globalThis.budgetWrites.at(-1).categoryId, null); await close();
// Scope, entitlement and in-progress/failed reads are rechecked when saving.
for (const setBoundary of [() => { globalThis.budgetScope.pro = false; }, () => { globalThis.budgetQuery.isFetching = true; }, () => { globalThis.budgetQuery.isError = true; }, () => { globalThis.budgetSpend.isError = true; }, () => { globalThis.budgetScope.role = "viewer"; }, () => { globalThis.budgetScope.archived = true; }, () => { globalThis.budgetSpend.isPlaceholderData = true; }, () => { globalThis.budgetQuery.isSuccess = false; }]) {
  setBoundary(); await render(React.createElement(AssistantBudgetReview, { ...props, session: {} })); const before = globalThis.budgetWrites.length; if (container.querySelector('form')) await submit(); assert.equal(globalThis.budgetWrites.length, before); await close();
  globalThis.budgetScope.pro = true; globalThis.budgetScope.role = "owner"; globalThis.budgetScope.archived = false; globalThis.budgetQuery.isFetching = false; globalThis.budgetQuery.isError = false; globalThis.budgetQuery.isSuccess = true; globalThis.budgetSpend.isError = false; globalThis.budgetSpend.isPlaceholderData = false;
}
for (const setBoundary of [() => { globalThis.budgetScope.workspaceId = 9; }, () => { globalThis.budgetScope.userId = "other"; }, () => { globalThis.budgetQuery.isPlaceholderData = true; }]) {
  setBoundary(); await render(React.createElement(AssistantBudgetReview, { ...props, session: {} })); assert.equal(container.querySelector('[role="dialog"]'), null); await close();
  globalThis.budgetScope.workspaceId = 8; globalThis.budgetScope.userId = "u"; globalThis.budgetQuery.isPlaceholderData = false;
}
// Late completion must not announce a save to a different user or space.
for (const field of ["userId", "workspaceId"]) {
  const session = {}; globalThis.budgetWrite = () => new Promise(r => { finish = r; }); const before = outcomes.length;
  await render(React.createElement(AssistantBudgetReview, { ...props, session })); await submit(); globalThis.budgetScope[field] = field === "userId" ? "other" : 9;
  await render(React.createElement(AssistantBudgetReview, { ...props, session })); await act(async () => finish()); await settle(); assert.equal(outcomes.length, before); await close(); globalThis.budgetScope[field] = field === "userId" ? "u" : 8;
}
// Explicitly discarding unsaved edits restores the initial proposal when reopened.
const session = {}; await render(React.createElement(AssistantBudgetReview, { ...props, session })); await change(amount(), "600");
await act(async () => container.querySelector('button[aria-label="Cerrar formulario"]').click()); assert.match(container.textContent, /Salir sin guardar/); await click("Sí, descartar"); assert.equal(session.value, undefined); await close();
await render(React.createElement(AssistantBudgetReview, { ...props, session })); assert.equal(amount().value, "400"); await close();
// A transport resolving without a confirmed row is not a saved proposal.
globalThis.budgetWrite = async () => {};
for (const result of [{}, { id: 77, workspaceId: 99 }, { id: "77", workspaceId: 8 }]) {
  globalThis.budgetResult = result; const before = outcomes.length, beforeUncertain = uncertain.length, beforeWrites = globalThis.budgetWrites.length;
  const session = {}; await render(React.createElement(AssistantBudgetReview, { ...props, session })); await submit();
  assert.equal(outcomes.length, before); assert.equal(uncertain.length, beforeUncertain + 1); assert.equal(session.saver.uncertain(), true);
  await submit(); assert.equal(globalThis.budgetWrites.length, beforeWrites + 1); await close();
}
globalThis.budgetResult = undefined;
// Restored permission does not revive the original pending callback (ABA).
{
  const session = {}, before = outcomes.length; globalThis.budgetWrite = () => new Promise(resolve => { finish = resolve; });
  await render(React.createElement(AssistantBudgetReview, { ...props, session })); await submit();
  globalThis.budgetScope.role = "viewer"; await render(React.createElement(AssistantBudgetReview, { ...props, session }));
  globalThis.budgetScope.role = "owner"; await render(React.createElement(AssistantBudgetReview, { ...props, session }));
  await act(async () => finish()); await settle(); assert.equal(outcomes.length, before); assert.equal(session.saver.uncertain(), true);
  assert.match(container.textContent, /Resultado por comprobar/); assert.equal(button(container, "Crear presupuesto").disabled, true); await close();
}
dom.window.close(); console.log("assistant-budget-drafts: OK (actual mobile parser, strict dates/scoped category, shared payload/editor, explicit creation and outcome history, double submit, definitive SQL retry, uncertain result without replay, read/Pro/user/workspace boundaries, discard; fixture I/O only)");
