import assert from "node:assert/strict";
import { React, act, dom, load, mock, h, createRoot, MemoryRouter, change, button, settle } from "./lib/web-ui-harness.mjs";

// Real parsers, resolver and save controller. All financial writes below are in-memory fixtures.
const { parseAssistantReply, assistantRequest } = await import(load("src/modules/assistant/lib/assistant-contract.ts"));
const { parseMovementProposal, prepareMovementProposal, validateAssistantMovement } = await import(load("src/modules/assistant/lib/movement-proposal.ts"));
const { createAssistantMovementSaver } = await import(load("src/modules/assistant/lib/proposal-save.ts"));
const { assistantHistoryTurn } = await import(load("src/modules/assistant/lib/proposal-memory.ts"));
const account = (id, name, currencyCode = "PEN", patch = {}) => ({ id, workspaceId: 8, name, currencyCode, currentBalance: 100, isArchived: false, ...patch });
const snapshot = { workspace: { id: 8, baseCurrencyCode: "PEN" }, accounts: [account(1, "Principal"), account(2, "Ahorros"), account(3, "Dólares", "USD")],
  catalogs: { categories: [{ id: 10, name: "Comida", kind: "expense", isActive: true }], counterparties: [{ id: 20, name: "Lucía", isArchived: false }] },
  movements: [], budgets: [], subscriptions: [], recurringIncome: [], exchangeRates: [] };
const raw = { operation: "expense", amount: 20, currency: "PEN", accountName: "principal", categoryName: "Comida", counterpartyName: "Lucia", occurredAt: "2026-10-12", description: "Compra" };
const draft = parseMovementProposal(raw); assert.ok(draft);
for (const patch of [{ amount: true }, { amount: -1 }, { amount: Infinity }, { amount: 0.001 }, { currency: "pen" }, { occurredAt: "2026-02-30" }, { operation: "delete_all" }]) assert.equal(parseMovementProposal({ ...raw, ...patch }), null);
assert.equal(parseMovementProposal({ ...raw, subscriptionId: true }).subscriptionId, null);
assert.equal(parseAssistantReply({ reply: "Revisa", draft: { ...raw, status: "saved", href: "https://evil.invalid" } }).proposals[0].status, undefined);
assert.equal(parseAssistantReply({ reply: "Revisa", draft: raw }).proposals[0].href, "/app/movements");
const prepared = prepareMovementProposal(draft, snapshot, new Date("2026-10-13T04:30:00Z"));
assert.equal(prepared.initialDraft.accountId, "1"); assert.equal(prepared.initialDraft.counterpartyId, "20"); assert.equal(prepared.initialDraft.categoryId, "10"); assert.equal(prepared.initialDraft.status, "posted");
assert.equal(prepareMovementProposal({ ...draft, occurredAt: "2026-10-13" }, snapshot, new Date("2026-10-13T04:30:00Z")).initialDraft.status, "planned", "calendar day is Lima, not UTC");
assert.equal(new Date(prepared.initialDraft.occurredAt).toISOString(), "2026-10-12T17:00:00.000Z");
for (const accounts of [[...snapshot.accounts, account(4, "PRINCIPAL")], [account(1, "Principal", "USD")], [account(1, "Principal", "PEN", { isArchived: true })], [account(1, "Principal", "PEN", { workspaceId: 9 })]]) {
  const value = prepareMovementProposal(draft, { ...snapshot, accounts }); assert.equal(value.initialDraft.accountId, ""); assert.ok(value.unresolved.includes("cuenta"));
}
const transfer = prepareMovementProposal({ ...draft, operation: "transfer", destinationAccountName: "Dolares" }, snapshot);
assert.equal(transfer.initialDraft.sourceAccountId, "1"); assert.equal(transfer.initialDraft.destinationAccountId, "3"); assert.equal(transfer.initialDraft.destinationAmount, ""); assert.equal(transfer.initialDraft.categoryId, "");
assert.equal(prepareMovementProposal({ ...draft, operation: "transfer", destinationAccountName: "Ahorros" }, snapshot).initialDraft.destinationAmount, "20");
assert.throws(() => prepareMovementProposal({ ...draft, operation: "pay_debt" }, snapshot), /específico/);

const input = { userId: "u", workspaceId: 8, movementType: "expense", status: "posted", description: "Compra", occurredAt: "2026-10-12T17:00:00Z", sourceAccountId: 1, sourceAmount: 20, destinationAccountId: null, destinationAmount: null, categoryId: 10, counterpartyId: 20, subscriptionId: null, obligationId: null };
for (const patch of [{ userId: "other" }, { workspaceId: 9 }, { status: "voided" }, { movementType: "refund" }, { sourceAccountId: 3 }, { sourceAmount: NaN }, { destinationAccountId: 2 }, { categoryId: 99 }, { counterpartyId: 99 }, { subscriptionId: 99 }, { obligationId: 99 }]) assert.throws(() => validateAssistantMovement({ ...input, ...patch }, snapshot, "u", "PEN"));
const tInput = { ...input, movementType: "transfer", categoryId: null, destinationAccountId: 2, destinationAmount: 20 };
validateAssistantMovement(tInput, snapshot, "u", "PEN");
assert.throws(() => validateAssistantMovement({ ...tInput, destinationAmount: 19 }, snapshot, "u", "PEN"), /conservar/);
assert.throws(() => validateAssistantMovement({ ...tInput, destinationAccountId: 1 }, snapshot, "u", "PEN"));
function saver(insert, extra = {}) { return createAssistantMovementSaver({ userId: "u", workspaceId: 8, currency: "PEN", intentKey: "assistant:turn:one", isCurrent: () => true, snapshot: () => snapshot, insert, ...extra }); }
{
  let finish, calls = []; const pending = new Promise(r => { finish = r; }); const save = saver(value => { calls.push(value); return pending; });
  const a = save.save(input), b = save.save(input); await Promise.resolve(); assert.equal(calls.length, 1); finish(21);
  assert.equal(await a, 21); assert.equal(await b, 21); assert.equal(await save.save(input), 21); assert.equal(calls.length, 1);
  assert.equal(calls[0].dedupeKey, "assistant:turn:one"); assert.equal(calls[0].metadata.source, "assistant_chat");
  await assert.rejects(save.save({ ...input, sourceAmount: 25 }), /intento previo/);
}
{
  let fail = true, keys = []; const save = saver(async value => { keys.push(value.dedupeKey); if (fail) throw Error("Network response lost"); return 22; });
  await assert.rejects(save.save(input), /Network/); assert.equal(save.attempted().sourceAmount, 20);
  await assert.rejects(save.save({ ...input, sourceAmount: 25 }), /intento previo/); assert.equal(keys.length, 1);
  fail = false; assert.equal(await save.save(input), 22); assert.deepEqual(keys, ["assistant:turn:one", "assistant:turn:one"]);
}
{
  let fail = true; const save = saver(async () => { if (fail) throw { code: "23514" }; return 23; });
  await assert.rejects(save.save(input)); assert.equal(save.attempted(), null); fail = false; assert.equal(await save.save({ ...input, sourceAmount: 25 }), 23);
}
{
  let current = true, calls = 0; const save = saver(async () => { calls++; return 24; }, { isCurrent: () => current });
  const pending = save.save(input); current = false; await assert.rejects(pending, /contexto cambió/); assert.equal(calls, 0); current = true; assert.equal(await save.save({ ...input, sourceAmount: 25 }), 24);
}
for (const extra of [{ isCurrent: () => false }, { snapshot: () => ({ ...snapshot, workspace: { id: 9 } }) }]) {
  let calls = 0; await assert.rejects(saver(async () => { calls++; return 1; }, extra).save(input)); assert.equal(calls, 0);
}
for (const code of [20, "NETWORK_ERROR", "23505", "PGRST000"]) {
  let calls = 0; const save = saver(async () => { calls++; throw { code }; }); await assert.rejects(save.save(input));
  await assert.rejects(save.save({ ...input, sourceAmount: 25 }), /intento previo/); assert.equal(calls, 1);
}
const proposals = Array.from({ length: 24 }, (_, i) => ({ label: "Gasto", amount: i + 1, currency: "PEN", href: "/app/movements", status: i === 23 ? "saved" : i === 22 ? "discarded" : "pending" }));
const annotation = assistantHistoryTurn({ role: "assistant", content: "x".repeat(5000), response: { proposals } });
assert.ok(annotation.content.length <= 3000); assert.match(assistantRequest("otra", [annotation], 8).history[0].content, /#24: el usuario lo GUARDÓ/); assert.match(annotation.content, /#23: el usuario lo DESCARTÓ/);

// Real page -> proposal row -> review -> actual shared QuickMovementDialog, only I/O and peripheral controls substituted.
globalThis.draftScope = { userId: "u", workspaceId: 8, pro: true };
globalThis.draftQuery = { data: snapshot, isFetching: false, isError: false, isPlaceholderData: false, refetch: async () => {} };
globalThis.draftWrites = []; globalThis.draftWrite = async () => 101; globalThis.draftCalls = [];
globalThis.draftReply = parseAssistantReply({ reply: "Te propongo un movimiento", draft: raw });
mock("src/services/queries/workspace-data.ts", `const unexpected=()=>({isPending:false,mutateAsync:async()=>{throw Error('Unexpected auxiliary write')}});
export const useWorkspaceSnapshotQuery=()=>globalThis.draftQuery;
export const useCreateMovementMutation=()=>({isPending:false,mutateAsync:async input=>{globalThis.draftWrites.push(input);return globalThis.draftWrite(input);}});
export const useCreateAttachmentRecordMutation=unexpected,useCreateCategoryMutation=unexpected,useCreateCounterpartyMutation=unexpected,useCreateRecurringIncomeMutation=unexpected,useCreateSubscriptionMutation=unexpected;
export const useBudgetSpendTypesQuery=()=>({data:[]}),usePersistLearningFeedbackMutation=()=>({mutateAsync:async()=>{}}),getQueryErrorMessage=e=>e.message;`);
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:{id:globalThis.draftScope.userId}});");
mock("src/modules/workspaces/use-active-workspace.ts", "const workspaces=[{id:8,name:'Personal'},{id:9,name:'Otro'}];export const useActiveWorkspace=()=>({workspaces,activeWorkspace:workspaces.find(w=>w.id===globalThis.draftScope.workspaceId),setActiveWorkspaceId:id=>{globalThis.draftScope.workspaceId=id},isError:false,isFetching:false});");
mock("src/modules/shared/use-pro-feature-access.ts", "export const useProFeatureAccess=()=>({canAccessProFeatures:globalThis.draftScope.pro});");
mock("src/services/queries/assistant.ts", "export const useAssistantInsight=()=>({data:null});export const askAssistant=async(message,history)=>{globalThis.draftCalls.push({message,history});return globalThis.draftReply;};");
mock("src/modules/attachments/use-receipt-feature-access.ts", "export const useReceiptFeatureAccess=()=>({canUploadReceipts:true});");
mock("src/modules/attachments/receipt-utils.ts", "export const deleteStoredReceipt=()=>{},createReceiptSignedUrl=async()=>'',prepareReceiptUpload=()=>{throw Error('Fixture receipt upload failure')},uploadPreparedReceipt=()=>{};");
mock("src/modules/movements/hooks/use-movement-suggestions.ts", "export const useMovementSuggestions=()=>({});");
mock("src/modules/movements/hooks/use-movement-insights.ts", "export const useMovementInsights=()=>({});");
mock("src/modules/assistant/components/assistant-budget-review.tsx", "export const AssistantBudgetReview=()=>null;");
mock("src/modules/assistant/components/assistant-recurring-review.tsx", "export const AssistantRecurringReview=()=>null;");
mock("src/modules/assistant/components/assistant-obligation-review.tsx", "export const AssistantObligationReview=()=>null;");
mock("src/modules/contacts/components/contact-quick-create-dialog.tsx", "export const ContactQuickCreateDialog=()=>null;");
mock("src/components/ui/date-picker-field.tsx", `${h} export const DatePickerField=p=>h('input',{value:p.value,onChange:e=>p.onChange(e.target.value)});`);
mock("src/components/ui/searchable-picker.tsx", `${h} export const SearchablePicker=p=>h('select',{'aria-label':p.placeholderLabel,value:p.value,onChange:e=>p.onChange(e.target.value)},h('option',{value:''},'Sin asignar'),...p.options.map(o=>h('option',{key:o.value,value:o.value},o.label)));`);
const { AssistantPage } = await import(load("src/modules/assistant/pages/assistant-page.tsx"));
const { AssistantMovementReview } = await import(load("src/modules/assistant/components/assistant-movement-review.tsx"));
let renderer, container;
async function render(element = React.createElement(AssistantPage)) {
  if (!renderer) { container = document.createElement("div"); document.body.append(container); renderer = createRoot(container); }
  await act(async () => renderer.render(React.createElement(MemoryRouter, null, element))); await settle();
}
async function close() { await act(async () => renderer.unmount()); container.remove(); renderer = null; }
async function click(label) { await act(async () => button(container, label).click()); await settle(); }
async function ask(text) { await change(container.querySelector("textarea"), text); await click("Enviar pregunta"); }
async function submitTwice() { await act(async () => { const form = container.querySelector('[role="dialog"] form'); assert.ok(form); for (let i = 0; i < 2; i++) form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); }); await settle(); }
await render(); await ask("Registra la compra"); assert.equal(globalThis.draftWrites.length, 0);
await click("Revisar y registrar"); assert.equal(globalThis.draftWrites.length, 0); assert.ok(container.querySelector('[role="dialog"]')); assert.match(container.textContent, /Revisar movimiento sugerido/);
const amount = () => container.querySelector('input[inputmode="decimal"]'); assert.equal(amount().value, "20"); await change(amount(), "25");
globalThis.draftQuery = { ...globalThis.draftQuery, isFetching: true }; await render(); assert.equal(amount().value, "25", "refresh preserves edited fields");
await submitTwice(); assert.equal(globalThis.draftWrites.length, 0); assert.match(container.textContent, /Espera la lectura/);
globalThis.draftQuery = { ...globalThis.draftQuery, isFetching: false }; await render();
let finish; globalThis.draftWrite = () => new Promise(r => { finish = r; }); await submitTwice(); assert.equal(globalThis.draftWrites.length, 1);
assert.equal(globalThis.draftWrites[0].sourceAmount, 25); assert.match(globalThis.draftWrites[0].dedupeKey, /^assistant:u:8:/);
await act(async () => finish(101)); await settle(); assert.match(container.textContent, /Guardado/); assert.match(container.textContent, /Movimiento #101/); assert.equal(container.querySelector('[role="dialog"]'), null);
await ask("¿Se guardó?"); assert.match(globalThis.draftCalls.at(-1).history.at(-1).content, /GUARDÓ/); assert.match(globalThis.draftCalls.at(-1).history.at(-1).content, /25[.,]00/);
// Same content in another fresh reply is a different intent; discard never writes.
await click("Descartar"); assert.equal(globalThis.draftWrites.length, 1); await ask("¿Lo descarté?"); assert.match(globalThis.draftCalls.at(-1).history.at(-1).content, /DESCARTÓ/); await close();

// Direct real review lifecycle: stale scope, failed attempt, remount and same-key retry.
const session = {}; const outcomes = []; const props = { draft, intentKey: "assistant:reopen", userId: "u", workspaceId: 8, session, onClose: () => {}, onSaved: note => outcomes.push(note) };
for (const [operation, sourceAccountId, sourceAmount, destinationAccountId, destinationAmount] of [["income", null, null, 1, 20], ["transfer", 1, 20, 2, 20]]) {
  const value = { ...draft, operation, destinationAccountName: "Ahorros" }; globalThis.draftWrite = async () => 110;
  await render(React.createElement(AssistantMovementReview, { ...props, draft: value, intentKey: `assistant:${operation}`, session: {} })); await submitTwice();
  const saved = globalThis.draftWrites.at(-1); assert.equal(saved.movementType, operation); assert.equal(saved.sourceAccountId, sourceAccountId); assert.equal(saved.sourceAmount, sourceAmount); assert.equal(saved.destinationAccountId, destinationAccountId); assert.equal(saved.destinationAmount, destinationAmount); await close();
}
outcomes.length = 0;
{
  globalThis.File = dom.window.File; globalThis.draftWrite = async () => 111;
  await render(React.createElement(AssistantMovementReview, { ...props, intentKey: "assistant:receipt", session: {} }));
  const details = [...container.querySelectorAll("button")].find(b => b.querySelector("span")?.textContent === "Detalles"); assert.ok(details); await act(async () => details.click());
  assert.doesNotMatch(container.textContent, /Dividir en categorías/);
  const file = container.querySelector('input[type="file"]'); assert.ok(file);
  Object.defineProperty(file, "files", { value: [new File(["fixture"], "recibo.png", { type: "image/png" })], configurable: true });
  await act(async () => file.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
  const before = globalThis.draftWrites.length; await submitTwice(); assert.equal(globalThis.draftWrites.length, before + 1); assert.match(outcomes.at(-1), /comprobante quedo pendiente/); await close();
}
outcomes.length = 0;
globalThis.draftWrite = async () => { throw Error("Network response lost"); }; await render(React.createElement(AssistantMovementReview, props)); await change(amount(), "26"); await submitTwice(); assert.match(container.textContent, /Network response lost/); const uncertainKey = globalThis.draftWrites.at(-1).dedupeKey; await close();
await render(React.createElement(AssistantMovementReview, props)); assert.equal(amount().value, "26"); await change(amount(), "27"); const before = globalThis.draftWrites.length; await submitTwice(); assert.equal(globalThis.draftWrites.length, before); assert.match(container.textContent, /intento previo/);
await change(amount(), "26"); globalThis.draftWrite = async () => 102; await submitTwice(); assert.equal(globalThis.draftWrites.at(-1).dedupeKey, uncertainKey); assert.equal(outcomes.length, 1); await close();
globalThis.draftScope.workspaceId = 9; await render(React.createElement(AssistantMovementReview, { ...props, session: {} })); assert.equal(container.querySelector('[role="dialog"]'), null); await close();
globalThis.draftScope.workspaceId = 8; globalThis.draftScope.pro = false;
await render(React.createElement(AssistantMovementReview, { ...props, session: {} })); const noPro = globalThis.draftWrites.length; await submitTwice(); assert.equal(globalThis.draftWrites.length, noPro); await close(); globalThis.draftScope.pro = true;
// A missing/stale read cannot prepare a form, and an outstanding write cannot mark another user.
globalThis.draftQuery = { ...globalThis.draftQuery, isPlaceholderData: true }; await render(React.createElement(AssistantMovementReview, { ...props, session: {} })); assert.equal(container.querySelector('[role="dialog"]'), null); await close(); globalThis.draftQuery.isPlaceholderData = false;
globalThis.draftWrite = () => new Promise(r => { finish = r; }); const beforeOutcome = outcomes.length; await render(React.createElement(AssistantMovementReview, { ...props, session: {} })); await submitTwice(); globalThis.draftScope.userId = "other"; await render(React.createElement(AssistantMovementReview, { ...props, session: {} })); await act(async () => finish(103)); await settle(); assert.equal(outcomes.length, beforeOutcome); await close();
dom.window.close(); console.log("assistant-movement-drafts: OK (validated proposals, exact scoped resolution, Lima dates, real page/review/shared form, explicit save/discard and outcome memory, duplicate/unknown retry guards, refresh/Pro/user/workspace boundaries; fixture I/O only)");
