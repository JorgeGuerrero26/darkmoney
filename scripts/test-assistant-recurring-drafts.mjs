import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, dom, root, load, mock, h, createRoot, MemoryRouter, change, button, settle } from "./lib/web-ui-harness.mjs";

const { parseRecurringProposal, prepareRecurringProposal } = await import(load("src/modules/assistant/lib/recurring-proposal.ts"));
const { buildSubscriptionEditorInput, buildRecurringIncomeEditorInput } = await import(load("src/modules/shared/recurring-editor-input.ts"));
const { parseAssistantReply } = await import(load("src/modules/assistant/lib/assistant-contract.ts"));
const source = readFileSync(resolve(root, "../DarkMoneyApp/services/queries/assistant.ts"), "utf8");
const ast = ts.createSourceFile("assistant.ts", source, ts.ScriptTarget.Latest, true);
const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "parseRecurringDraft"); assert.ok(node);
const mobileParser = new Function(ts.transpileModule(node.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ";return parseRecurringDraft;")();
const snapshot = { workspace: { id: 8, baseCurrencyCode: "PEN" }, accounts: [
  { id: 1, name: "Principal", workspaceId: 8, currencyCode: "PEN", isArchived: false },
  { id: 2, name: "Reserva", workspaceId: 8, currencyCode: "PEN", isArchived: false },
  { id: 3, name: "Dólares", workspaceId: 8, currencyCode: "USD", isArchived: false }],
  catalogs: { categories: [{ id: 10, name: "Servicios", kind: "expense", isActive: true }, { id: 20, name: "Sueldo", kind: "income", isActive: true }], counterparties: [{ id: 30, name: "Empresa", isArchived: false }] },
  movements: [], budgets: [], subscriptions: [], recurringIncome: [], exchangeRates: [] };
const raw = { kind: "subscription", name: "Internet", amount: 80, currency: "PEN", frequency: "monthly", dayOfMonth: 22, nextDate: "2099-10-22", categoryName: "Servicios", accountName: "principal", description: "Plan familiar" };
for (const kind of ["subscription", "recurring_income"]) for (const frequency of ["weekly", "monthly", "yearly", undefined]) {
  const value = { ...raw, kind, frequency }; assert.deepEqual(parseRecurringProposal(value), mobileParser(value));
}
for (const patch of [{ amount: true }, { amount: Infinity }, { amount: -1 }, { currency: "pen" }, { nextDate: "2026-02-30" }, { kind: "delete_all" }, { frequency: "daily" }]) assert.equal(parseRecurringProposal({ ...raw, ...patch }), null);
assert.equal(parseRecurringProposal({ ...raw, dayOfMonth: true }).dayOfMonth, null);
assert.equal(parseRecurringProposal({ ...raw, dayOfMonth: 1.5 }).dayOfMonth, null);
const draft = parseRecurringProposal(raw), subscription = prepareRecurringProposal(draft, snapshot, "2026-10-15");
assert.equal(subscription.value.accountId, "1"); assert.equal(subscription.value.categoryId, "10"); assert.equal(subscription.value.startDate, "2026-10-15"); assert.equal(subscription.value.remindDaysBefore, "1"); assert.equal(subscription.value.autoCreateMovement, false);
const subInput = buildSubscriptionEditorInput(subscription.value, snapshot);
assert.equal(subInput.amount, 80); assert.equal(subInput.nextDueDate, raw.nextDate); assert.equal(subInput.intervalCount, 1); assert.equal(subInput.autoCreateMovement, false);
const incomeDraft = parseRecurringProposal({ ...raw, kind: "recurring_income", name: "Sueldo", categoryName: "sueldo" });
const income = prepareRecurringProposal(incomeDraft, snapshot, "2026-10-15"), incomeInput = buildRecurringIncomeEditorInput(income.value, snapshot);
assert.equal(incomeInput.accountId, 1); assert.equal(incomeInput.categoryId, 20); assert.equal(incomeInput.nextExpectedDate, raw.nextDate); assert.equal(incomeInput.grossAmount, null); assert.deepEqual(incomeInput.deductions, []);
for (const accounts of [[], [...snapshot.accounts, { ...snapshot.accounts[0], id: 4 }], [{ ...snapshot.accounts[0], isArchived: true }], [{ ...snapshot.accounts[0], workspaceId: 9 }], [{ ...snapshot.accounts[0], currencyCode: "USD" }]]) {
  const prepared = prepareRecurringProposal(incomeDraft, { ...snapshot, accounts }, "2026-10-15"); assert.equal(prepared.value.accountId, "");
  assert.throws(() => buildRecurringIncomeEditorInput(prepared.value, snapshot), /cuenta/);
}
assert.equal(prepareRecurringProposal({ ...draft, categoryName: "sueldo" }, snapshot).value.categoryId, "");
const paid = { ...subscription.value, autoCreateMovement: true };
assert.throws(() => buildSubscriptionEditorInput({ ...paid, accountId: "" }, snapshot), /misma moneda/);
assert.throws(() => buildSubscriptionEditorInput({ ...paid, accountId: "3" }, snapshot), /misma moneda/);
assert.equal(buildSubscriptionEditorInput(paid, snapshot).autoCreateMovement, true, "only a deliberate editor change enables automatic recording");
for (const patch of [{ amount: "Infinity" }, { intervalCount: "0" }, { dayOfMonth: "32" }, { dayOfWeek: "7" }, { startDate: "2100-01-01" }, { nextDueDate: "2026-02-30" }, { currencyCode: "XYZ" }, { status: "deleted" }, { vendorPartyId: "99" }, { categoryId: "20" }, { remindDaysBefore: "-1" }, { accountId: "99" }]) assert.throws(() => buildSubscriptionEditorInput({ ...subscription.value, ...patch }, snapshot));
for (const patch of [{ accountId: "" }, { grossAmount: "Infinity" }, { deductions: [{ name: "AFP", amount: "Infinity" }] }, { categoryId: "10" }]) assert.throws(() => buildRecurringIncomeEditorInput({ ...income.value, ...patch }, snapshot));
const gross = buildRecurringIncomeEditorInput({ ...income.value, grossAmount: "100,50", deductions: [{ name: " AFP ", amount: "10,5" }, { name: "", amount: "5" }, { name: "Cero", amount: "0" }] }, snapshot);
assert.equal(gross.grossAmount, 100.5); assert.deepEqual(gross.deductions, [{ name: "AFP", amount: 10.5 }]);
const archived = { ...snapshot, accounts: snapshot.accounts.map(a => ({ ...a, isArchived: true })) };
assert.throws(() => buildSubscriptionEditorInput(subscription.value, archived), /cuenta/); assert.equal(buildSubscriptionEditorInput(subscription.value, archived, false).accountId, 1, "editing preserves legacy archived associations");
assert.equal(buildSubscriptionEditorInput({ ...subscription.value, dayOfMonth: "", frequency: "monthly" }, snapshot).dayOfMonth, 22);
assert.equal(buildSubscriptionEditorInput({ ...subscription.value, frequency: "weekly", dayOfWeek: "4" }, snapshot).dayOfWeek, 4);
const parsed = parseAssistantReply({ reply: "Revisa", recurringDraft: { ...raw, href: "https://evil.invalid", status: "saved" } });
assert.equal(parsed.proposals[0].href, "/app/subscriptions"); assert.equal(parsed.proposals[0].status, undefined); assert.deepEqual(parsed.proposals[0].recurringDraft, draft);

// Real page/row/review/shared editors. I/O is simulated; no payment or arrival mutation is provided.
globalThis.recScope = { userId: "u", workspaceId: 8, pro: true };
globalThis.recQuery = { data: snapshot, isFetching: false, isError: false, isPlaceholderData: false, refetch: async () => {} };
globalThis.recWrites = []; globalThis.recWrite = async () => ({ id: 301 }); globalThis.recReply = parsed; globalThis.recCalls = [];
mock("src/services/queries/workspace-data.ts", `export const useWorkspaceSnapshotQuery=()=>globalThis.recQuery;const mutation=kind=>({mutateAsync:async input=>{globalThis.recWrites.push({kind,input});return globalThis.recWrite(kind,input);}});export const useCreateSubscriptionMutation=()=>mutation('subscription'),useCreateRecurringIncomeMutation=()=>mutation('recurring_income');export const getQueryErrorMessage=e=>e.message??'Fixture SQL rejection';`);
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:{id:globalThis.recScope.userId}});");
mock("src/modules/workspaces/use-active-workspace.ts", "const workspaces=[{id:8,name:'Personal'},{id:9,name:'Otro'}];export const useActiveWorkspace=()=>({workspaces,activeWorkspace:workspaces.find(w=>w.id===globalThis.recScope.workspaceId),setActiveWorkspaceId:id=>{globalThis.recScope.workspaceId=id},isFetching:false,isError:false});");
mock("src/modules/shared/use-pro-feature-access.ts", "export const useProFeatureAccess=()=>({canAccessProFeatures:globalThis.recScope.pro});");
mock("src/services/queries/assistant.ts", "export const useAssistantInsight=()=>({data:null});export const askAssistant=async(message,history)=>{globalThis.recCalls.push({message,history});return globalThis.recReply;};");
mock("src/modules/assistant/components/assistant-movement-review.tsx", "export const AssistantMovementReview=()=>null;");
mock("src/modules/assistant/components/assistant-budget-review.tsx", "export const AssistantBudgetReview=()=>null;");
mock("src/components/ui/date-picker-field.tsx", `${h} export const DatePickerField=p=>h('input',{value:p.value,onChange:e=>p.onChange(e.target.value)});`);
mock("src/components/ui/searchable-picker.tsx", `${h} export const SearchablePicker=p=>h('select',{'aria-label':p.placeholderLabel,value:p.value,onChange:e=>p.onChange(e.target.value)},h('option',{value:''},'Sin asignar'),...p.options.filter(o=>o.value!=='').map(o=>h('option',{key:o.value,value:o.value},o.label)));`);
const { AssistantPage } = await import(load("src/modules/assistant/pages/assistant-page.tsx"));
const { AssistantRecurringReview } = await import(load("src/modules/assistant/components/assistant-recurring-review.tsx"));
let renderer, container;
async function render(element = React.createElement(AssistantPage)) { if (!renderer) { container = document.createElement("div"); document.body.append(container); renderer = createRoot(container); } await act(async () => renderer.render(React.createElement(MemoryRouter, null, element))); await settle(); }
async function close() { await act(async () => renderer.unmount()); container.remove(); renderer = null; }
async function click(label) { await act(async () => button(container, label).click()); await settle(); }
async function ask(text) { await change(container.querySelector("textarea"), text); await click("Enviar pregunta"); }
async function submit() { await act(async () => { const form = container.querySelector('[role="dialog"] form'); assert.ok(form); for (let i = 0; i < 2; i++) form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); }); await settle(); }
const amount = () => container.querySelector('input[inputmode="decimal"]');
let finish;
for (const proposal of [draft, incomeDraft]) {
  globalThis.recReply = parseAssistantReply({ reply: "Propuesta recurrente", recurringDraft: proposal }); globalThis.recWrite = () => new Promise(r => { finish = r; });
  const before = globalThis.recWrites.length; await render(); await ask("Crea " + proposal.kind); assert.equal(globalThis.recWrites.length, before); await click("Revisar y registrar"); assert.match(container.textContent, proposal.kind === "subscription" ? /Nueva suscripción/ : /Nuevo ingreso fijo/); assert.equal(amount().value, "80");
  await change(amount(), "90"); globalThis.recQuery.isFetching = true; await render(); assert.equal(amount().value, "90"); await submit(); assert.equal(globalThis.recWrites.length, before); assert.match(container.textContent, /Espera la lectura/);
  globalThis.recQuery.isFetching = false; await render(); await submit(); assert.equal(globalThis.recWrites.length, before + 1); assert.equal(globalThis.recWrites.at(-1).input.amount, 90); assert.equal(globalThis.recWrites.at(-1).input.accountId, 1); assert.equal(button(container, "Guardando...").disabled, true);
  if (proposal.kind === "subscription") assert.equal(globalThis.recWrites.at(-1).input.autoCreateMovement, false);
  globalThis.recQuery.isFetching = true; await render(); await act(async () => finish({ id: 301 })); await settle(); assert.equal(container.querySelector('[role="dialog"]'), null); assert.match(container.textContent, /#301/); assert.match(container.textContent, /Guardado/); globalThis.recQuery.isFetching = false; await render();
  await ask("¿Se creó?"); assert.match(globalThis.recCalls.at(-1).history.at(-1).content, /GUARDÓ/); assert.match(globalThis.recCalls.at(-1).history.at(-1).content, /90[.,]00/);
  await click("Revisar y registrar"); globalThis.recWrite = async () => { throw Error("Network response lost"); }; await submit(); assert.equal(container.querySelector('[role="dialog"]'), null); assert.match(container.textContent, /podría haberse creado/);
  const link = [...container.querySelectorAll("a")].find(a => a.textContent === "Comprobar en el módulo"); assert.equal(link?.getAttribute("href"), proposal.kind === "subscription" ? "/app/subscriptions" : "/app/recurring-income");
  await ask("¿Qué pasó?"); assert.match(globalThis.recCalls.at(-1).history.at(-1).content, /RESULTADO INCIERTO; no repetir/); await close(); window.localStorage.clear();
}
let outcomes = [], unconfirmed = [];
const props = { draft, userId: "u", workspaceId: 8, session: {}, onClose: () => {}, onSaved: note => outcomes.push(note), onUnconfirmed: note => unconfirmed.push(note) };
let fail = true; globalThis.recWrite = async () => { if (fail) throw { code: "23514", message: "Fixture SQL rejection" }; return { id: 302 }; };
await render(React.createElement(AssistantRecurringReview, props)); await submit(); assert.match(container.textContent, /Fixture SQL rejection/); assert.equal(unconfirmed.length, 0); await change(amount(), "95"); fail = false; await submit(); assert.match(outcomes.at(-1), /95[.,]00/); await close();
// An ambiguous income account is mandatory, so saving waits for an explicit choice.
const ambiguous = { ...incomeDraft, accountName: "No existe" }; globalThis.recWrite = async () => ({ id: 303 });
await render(React.createElement(AssistantRecurringReview, { ...props, draft: ambiguous, session: {} })); const beforeAccount = globalThis.recWrites.length; await submit(); assert.equal(globalThis.recWrites.length, beforeAccount); assert.match(container.textContent, /cuenta/);
await change(container.querySelector('select[aria-label="Elige una cuenta"]'), "2"); await submit(); assert.equal(globalThis.recWrites.at(-1).input.accountId, 2); await close();
// Invalid dates remain errors inside the shared editor, never normalised into another calendar day.
await render(React.createElement(AssistantRecurringReview, { ...props, session: {} })); const dates = [...container.querySelectorAll("label")].find(l => l.textContent.startsWith("Próximo cobro"))?.querySelector("input"); await change(dates, "2026-02-30"); const beforeDate = globalThis.recWrites.length; await submit(); assert.equal(globalThis.recWrites.length, beforeDate); assert.match(container.textContent, /fecha debe ser válida/); await close();
for (const boundary of [() => { globalThis.recScope.pro = false; }, () => { globalThis.recQuery.isError = true; }]) {
  boundary(); await render(React.createElement(AssistantRecurringReview, { ...props, session: {} })); const before = globalThis.recWrites.length; await submit(); assert.equal(globalThis.recWrites.length, before); await close(); globalThis.recScope.pro = true; globalThis.recQuery.isError = false;
}
for (const boundary of [() => { globalThis.recScope.userId = "other"; }, () => { globalThis.recScope.workspaceId = 9; }, () => { globalThis.recQuery.isPlaceholderData = true; }]) {
  boundary(); await render(React.createElement(AssistantRecurringReview, { ...props, session: {} })); assert.equal(container.querySelector('[role="dialog"]'), null); await close(); globalThis.recScope.userId = "u"; globalThis.recScope.workspaceId = 8; globalThis.recQuery.isPlaceholderData = false;
}
// A late response cannot report a result to a different user/space, even if the wrapper stays mounted.
for (const field of ["userId", "workspaceId"]) {
  const session = {}, before = outcomes.length; globalThis.recWrite = () => new Promise(r => { finish = r; });
  await render(React.createElement(AssistantRecurringReview, { ...props, session })); await submit(); globalThis.recScope[field] = field === "userId" ? "other" : 9; await render(React.createElement(AssistantRecurringReview, { ...props, session })); await act(async () => finish({ id: 304 })); await settle(); assert.equal(outcomes.length, before); await close(); globalThis.recScope[field] = field === "userId" ? "u" : 8;
}
// No positive server ID means no invented success.
globalThis.recWrite = async () => ({}); const beforeUnconfirmed = unconfirmed.length; await render(React.createElement(AssistantRecurringReview, { ...props, session: {} })); await submit(); assert.equal(unconfirmed.length, beforeUnconfirmed + 1); await close();
const session = {}; await render(React.createElement(AssistantRecurringReview, { ...props, session })); await change(amount(), "100"); await act(async () => container.querySelector('button[aria-label="Cerrar formulario"]').click()); assert.match(container.textContent, /Salir sin guardar/); await click("Sí, descartar"); assert.equal(session.value, undefined); await close();
dom.window.close(); console.log("assistant-recurring-drafts: OK (actual mobile parser, scoped prefill and shared input builders/editors, explicit schedule creation without payment/arrival, exact IDs/edited amounts/outcomes, double submit, SQL/uncertain errors, fresh-read/Pro/user/workspace guards and discard; fixture I/O only)");
