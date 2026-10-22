import assert from "node:assert/strict";
import { React, act, dom, load, mock, h, createRoot, MemoryRouter, QueryClient, QueryClientProvider, change, button, settle } from "./lib/web-ui-harness.mjs";
mock("src/modules/assistant/components/assistant-movement-change-review.tsx","export const AssistantMovementChangeReview=()=>null;");

const { parseAssistantReply } = await import(load("src/modules/assistant/lib/assistant-contract.ts"));
const { paymentTargets, resolvePaymentTarget, resolvePaymentAccount, validateObligationPayment } = await import(load("src/modules/assistant/lib/payment-proposal.ts"));
const { validateSubscriptionPayment } = await import(load("src/modules/subscriptions/lib/subscription-payment-input.ts"));
const accounts = [{ id: 1, workspaceId: 8, name: "Principal", currencyCode: "PEN", currentBalance: 5000, isArchived: false }, { id: 2, workspaceId: 8, name: "USD", currencyCode: "USD", isArchived: false }, { id: 3, workspaceId: 9, name: "Ajena", currencyCode: "PEN", isArchived: false }];
const sub = { id: 10, workspaceId: 8, name: "Internet", vendor: "Empresa", status: "active", amount: 80, currencyCode: "PEN", frequency: "monthly", intervalCount: 1, nextDueDate: "2026-10-15", startDate: "2026-01-01", accountId: 1 };
const obligation = { id: 20, workspaceId: 8, title: "Préstamo", counterparty: "Lucía", status: "active", direction: "payable", currencyCode: "PEN", principalAmount: 500, pendingAmount: 400, startDate: "2026-01-01", events: [], paymentPlan: { mode: "equal", count: 5 } };
const snapshot = { workspace: { id: 8, baseCurrencyCode: "PEN" }, accounts, subscriptions: [sub], obligations: [obligation], movements: [], catalogs: { categories: [], counterparties: [] } };
const raw = { operation: "pay_subscription", amount: 80, currency: "PEN", subscriptionId: 10, subscriptionName: "internet", accountName: "principal", occurredAt: "2026-10-15" };
const draft = parseAssistantReply({ reply: "Revisa", draft: raw }).proposals[0].movementDraft;
assert.equal(resolvePaymentTarget(draft, snapshot), 10); assert.equal(resolvePaymentAccount(draft, snapshot), 1);
for (const patch of [{ subscriptionId: 99 }, { subscriptionName: "Otro" }, { currency: "USD" }, { subscriptionId: null, subscriptionName: null }]) assert.equal(resolvePaymentTarget({ ...draft, ...patch }, snapshot), null);
assert.equal(resolvePaymentTarget({ ...draft, subscriptionId: null }, { ...snapshot, subscriptions: [sub, { ...sub, id: 11 }] }), null);
for (const accounts of [[], [{ ...snapshot.accounts[0], isArchived: true }], [{ ...snapshot.accounts[0], workspaceId: 9 }], [snapshot.accounts[0], { ...snapshot.accounts[0], id: 4 }]]) assert.equal(resolvePaymentAccount(draft, { ...snapshot, accounts }), null);
for (const patch of [{ amount: 0 }, { amount: Infinity }, { amount: 0.001 }, { accountId: 2 }, { accountId: 3 }, { paidDate: "2026-02-30" }]) assert.throws(() => validateSubscriptionPayment(sub, accounts, { amount: 80, accountId: 1, paidDate: "2026-10-15", ...patch }));
const debtForm = { amount: "80", eventDate: "2026-10-15", installmentNo: "", description: "", notes: "", accountId: "1", registerAccountMovement: true };
assert.equal(validateObligationPayment(debtForm, snapshot, 20).nextStatus, "active");
assert.equal(validateObligationPayment({ ...debtForm, amount: "400" }, snapshot, 20).nextStatus, "paid");
assert.equal(validateObligationPayment({ ...debtForm, registerAccountMovement: false, accountId: "999" }, snapshot, 20).accountId, null);
for (const patch of [{ amount: "Infinity" }, { amount: "0.001" }, { eventDate: "2026-02-30" }, { eventDate: "2025-12-31" }, { installmentNo: "1.5" }, { accountId: "3" }]) assert.throws(() => validateObligationPayment({ ...debtForm, ...patch }, snapshot, 20));
assert.equal(paymentTargets(draft, { ...snapshot, subscriptions: [{ ...sub, status: "paused" }, { ...sub, workspaceId: 9 }] }).length, 0);

globalThis.payScope = { userId: "u", workspaceId: 8, pro: true };
globalThis.payQuery = { data: snapshot, isFetching: false, isError: false, isPlaceholderData: false, refetch: async () => {} };
globalThis.payWrites = []; globalThis.payWrite = async () => ({ eventId: 41, movementId: 42 }); globalThis.subPay = async () => "2026-11-15";
globalThis.payCalls = []; globalThis.payReply = parseAssistantReply({ reply: "Propuesta", draft: raw }); globalThis.payAttachments = []; globalThis.payMirrors = [];
globalThis.payStorageFail = false;
mock("src/services/queries/workspace-data.ts", `export const useWorkspaceSnapshotQuery=()=>globalThis.payQuery;export const useRegisterObligationPaymentMutation=()=>({mutateAsync:async input=>{globalThis.payWrites.push({kind:'obligation',input});return globalThis.payWrite(input);}});export const getQueryErrorMessage=e=>e.message??'Fixture SQL error';export const useCreateAttachmentRecordMutation=()=>({mutateAsync:async input=>globalThis.payAttachments.push(input)});export const mirrorObligationEventAttachmentsToMovement=async input=>globalThis.payMirrors.push(input);`);
mock("src/modules/subscriptions/lib/subscription-actions.ts", `export const todayPeru=()=>"2026-10-15";export const markSubscriptionPaid=async(target,input)=>{globalThis.payWrites.push({kind:'subscription',target,input});return globalThis.subPay(input);};`);
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:{id:globalThis.payScope.userId}});");
mock("src/modules/workspaces/use-active-workspace.ts", "const workspaces=[{id:8,name:'Personal'},{id:9,name:'Otro'}];export const useActiveWorkspace=()=>({workspaces,activeWorkspace:workspaces.find(w=>w.id===globalThis.payScope.workspaceId),setActiveWorkspaceId:id=>{globalThis.payScope.workspaceId=id},isFetching:false,isError:false});");
mock("src/modules/shared/use-pro-feature-access.ts", "export const useProFeatureAccess=()=>({canAccessProFeatures:globalThis.payScope.pro});");
mock("src/modules/attachments/use-receipt-feature-access.ts", "export const useReceiptFeatureAccess=()=>({canUploadReceipts:globalThis.payScope.pro,accessMessage:'Pro'});");
mock("src/modules/attachments/receipt-utils.ts", "export const createReceiptSignedUrl=async()=>'',deleteStoredReceipt=async()=>{};export const prepareReceiptUpload=async input=>({bucketName:'receipts',filePath:'fixture.webp',fileName:'receipt.webp',mimeType:'image/webp',sizeBytes:8,width:2,height:2,...input});export const uploadPreparedReceipt=async()=>{if(globalThis.payStorageFail)throw Error('Fixture storage failure');};");
mock("src/services/queries/assistant.ts", "export const useAssistantInsight=()=>({data:null});export const askAssistant=async(message,history)=>{globalThis.payCalls.push({message,history});return globalThis.payReply;};");
for (const [file, name] of [["assistant-movement-review", "AssistantMovementReview"], ["assistant-budget-review", "AssistantBudgetReview"], ["assistant-recurring-review", "AssistantRecurringReview"], ["assistant-obligation-review", "AssistantObligationReview"]]) mock(`src/modules/assistant/components/${file}.tsx`, `export const ${name}=()=>null;`);
mock("src/components/ui/date-picker-field.tsx", `${h} export const DatePickerField=p=>h('input',{'aria-label':'Fecha',value:p.value,onChange:e=>p.onChange(e.target.value)});`);
mock("src/components/ui/searchable-picker.tsx", `${h} export const SearchablePicker=p=>h('select',{'aria-label':p.placeholderLabel,value:p.value,disabled:p.disabled,onChange:e=>p.onChange(e.target.value)},h('option',{value:''},'Sin asignar'),...p.options.filter(o=>o.value!=='').map(o=>h('option',{key:o.value,value:o.value},o.label)));`);
const { AssistantPage } = await import(load("src/modules/assistant/pages/assistant-page.tsx"));
const { AssistantPaymentReview } = await import(load("src/modules/assistant/components/assistant-payment-review.tsx"));
let renderer, container; const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
async function render(element = React.createElement(AssistantPage)) { if (!renderer) { container = document.createElement("div"); document.body.append(container); renderer = createRoot(container); } await act(async () => renderer.render(React.createElement(QueryClientProvider, { client }, React.createElement(MemoryRouter, null, element)))); await settle(); }
async function close() { await act(async () => renderer.unmount()); container.remove(); renderer = null; }
async function click(label) { await act(async () => button(container, label).click()); await settle(); }
async function ask(text) { await change(container.querySelector("textarea"), text); await click("Enviar pregunta"); }
async function submitDebt() { await act(async () => { const form = container.querySelector('form.resource-editor'); assert.ok(form); for (let i = 0; i < 2; i++) form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); }); await settle(); }
let finish;
// Actual page/row/review + native payment dialog. No write on opening, one on explicit double-click.
await render(); const first = globalThis.payWrites.length; await ask("Paga Internet"); assert.equal(globalThis.payWrites.length, first); await click("Revisar y registrar"); assert.equal(globalThis.payWrites.length, first);
assert.equal(container.querySelector('#subscription-paid-amount').value, "80"); await change(container.querySelector('#subscription-paid-amount'), "82.50");
globalThis.subPay = () => new Promise(resolve => { finish = resolve; });
await act(async () => { const buttonNode = button(container, "Confirmar pago"); buttonNode.click(); buttonNode.click(); }); await settle(); assert.equal(globalThis.payWrites.length, first + 1); assert.equal(globalThis.payWrites.at(-1).input.amount, 82.5);
await act(async () => finish("2026-11-15")); await settle(); assert.match(container.textContent, /Guardado/); assert.match(container.textContent, /82[.,]50/); assert.match(container.textContent, /2026-11-15/);
await ask("¿Pagaste?"); assert.match(globalThis.payCalls.at(-1).history.at(-1).content, /GUARDÓ/); assert.match(globalThis.payCalls.at(-1).history.at(-1).content, /82[.,]50/);
await close(); window.localStorage.clear();
const debtRaw = { operation: "pay_debt", amount: 80, currency: "PEN", obligationId: 20, obligationCounterparty: "lucia", accountName: "principal", occurredAt: "2026-10-15" };
for (const direction of ["payable", "receivable"]) {
  snapshot.obligations = [{ ...obligation, direction }]; globalThis.payReply = parseAssistantReply({ reply: "Abono", draft: debtRaw });
  await render(); await ask("Abona el préstamo"); await click("Revisar y registrar"); assert.equal(container.querySelector('#payment-amount').value, "80"); assert.match(container.textContent, /Cuota 1 de 5/); await change(container.querySelector('#payment-amount'), "100"); const before = globalThis.payWrites.length; await submitDebt(); assert.equal(globalThis.payWrites.length, before + 1); const saved = globalThis.payWrites.at(-1); assert.equal(saved.input.amount, 100); assert.equal(saved.input.obligationId, 20); assert.equal(saved.input.accountId, 1); assert.equal(saved.input.userId, "u"); assert.equal(saved.input.workspaceId, 8); assert.match(container.textContent, /Abono #41/); assert.match(container.textContent, /Movimiento #42/);
  await ask("Otro abono"); await click("Revisar y registrar"); globalThis.payWrite = async () => { throw { code: "23514", message: "Late phase failed" }; }; const uncertainCount = globalThis.payWrites.length; await submitDebt(); assert.equal(globalThis.payWrites.length, uncertainCount + 1); assert.match(container.textContent, /Resultado del pago incierto/); assert.equal([...container.querySelectorAll('a')].find(a => a.textContent === "Comprobar en el módulo")?.getAttribute('href'), "/app/obligations"); await ask("¿Y ahora?"); assert.match(globalThis.payCalls.at(-1).history.at(-1).content, /RESULTADO INCIERTO; no repetir/); await close(); window.localStorage.clear(); globalThis.payWrite = async () => ({ eventId: 41, movementId: 42 });
}
snapshot.obligations = [obligation]; globalThis.subPay = async () => "2026-11-15";
const debtDraft = parseAssistantReply({ reply: "Abono", draft: debtRaw }).proposals[0].movementDraft;
let saved = [], uncertain = []; const base = { draft: debtDraft, userId: "u", workspaceId: 8, session: {}, onClose: () => {}, onSaved: note => saved.push(note), onUnconfirmed: note => uncertain.push(note) };
for (const changeScope of [() => { globalThis.payQuery.isFetching = true; }, () => { globalThis.payQuery.isError = true; }, () => { globalThis.payScope.pro = false; }]) {
  await render(React.createElement(AssistantPaymentReview, { ...base, session: {} })); changeScope(); await render(React.createElement(AssistantPaymentReview, { ...base, session: {} })); const before = globalThis.payWrites.length; await submitDebt(); assert.equal(globalThis.payWrites.length, before); await close(); globalThis.payQuery.isFetching = false; globalThis.payQuery.isError = false; globalThis.payScope.pro = true;
}
// Unknown/ambiguous entity requires explicit choice; never pay an arbitrary subscription.
await render(React.createElement(AssistantPaymentReview, { ...base, draft: { ...draft, subscriptionId: 999 }, session: {} })); assert.match(container.textContent, /no identifica un único/); assert.equal(container.querySelector('#subscription-paid-amount'), null); const choice = [...container.querySelectorAll('button')].find(node => node.textContent.startsWith('Internet')); await act(async () => choice.click()); await settle(); assert.equal(container.querySelector('#subscription-paid-amount').value, "80"); await close();
// A partial subscription failure is not success/retry, regardless of the SQL code.
globalThis.subPay = async () => { throw { code: "23514", message: "Movement failed after date advanced" }; }; const subSession = {};
await render(React.createElement(AssistantPaymentReview, { ...base, draft, session: subSession })); const partial = globalThis.payWrites.length; await click("Confirmar pago"); assert.equal(uncertain.length, 1); assert.equal(button(container, "Comprueba el pago en el historial").disabled, true); await click("Comprueba el pago en el historial"); assert.equal(globalThis.payWrites.length, partial + 1); assert.equal(subSession.saver.uncertain(), true); await close(); globalThis.subPay = async () => "2026-11-15";
// Background date advance invalidates an already-open payment; no second due date is paid implicitly.
const dateSession = {}; await render(React.createElement(AssistantPaymentReview, { ...base, draft, session: dateSession })); const previousDate = sub.nextDueDate; sub.nextDueDate = "2026-11-15"; await render(React.createElement(AssistantPaymentReview, { ...base, draft, session: dateSession })); const beforeDate = globalThis.payWrites.length; await click("Confirmar pago"); assert.equal(globalThis.payWrites.length, beforeDate); assert.match(container.textContent, /próximo cobro cambió/); assert.equal(dateSession.saver.uncertain(), false); await close(); sub.nextDueDate = previousDate;
// Receipt failures cannot replay a confirmed financial payment; event metadata and mirror use native contracts.
globalThis.File = dom.window.File;
for (const failure of [false, true]) {
  globalThis.payStorageFail = failure; const currentSession = {}; await render(React.createElement(AssistantPaymentReview, { ...base, session: currentSession })); const details = [...container.querySelectorAll('button')].find(node => node.querySelector('span')?.textContent === 'Detalles'); await act(async () => details.click()); await settle();
  const input = container.querySelector('input[type="file"]'); Object.defineProperty(input, "files", { value: [new File(["fake"], "receipt.png", { type: "image/png" })] }); await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true }))); const before = globalThis.payWrites.length; await submitDebt(); await submitDebt(); assert.equal(globalThis.payWrites.length, before + 1); assert.match(saved.at(-1), failure ? /Comprobante pendiente/ : /Movimiento #42/); await close();
}
assert.equal(globalThis.payAttachments.at(-1).entityType, "obligation-event"); assert.equal(globalThis.payAttachments.at(-1).entityId, 41); assert.equal(globalThis.payMirrors.at(-1).userId, "u");
// Late response cannot announce a payment in a different authenticated context.
const lateSession = {}; globalThis.payWrite = () => new Promise(resolve => { finish = resolve; }); await render(React.createElement(AssistantPaymentReview, { ...base, session: lateSession })); await submitDebt(); const count = saved.length; globalThis.payScope.userId = "other"; await render(React.createElement(AssistantPaymentReview, { ...base, session: lateSession })); await act(async () => finish({ eventId: 41, movementId: 42 })); await settle(); assert.equal(saved.length, count); await close(); globalThis.payScope.userId = "u";
assert.equal(lateSession.saver.confirmed().value.amount, 80);
console.log("Assistant payments: shared native forms, explicit target/account, amounts, dates, plans, outcomes, partial failures, receipts and scope guards passed locally.");
dom.window.close(); client.clear();
