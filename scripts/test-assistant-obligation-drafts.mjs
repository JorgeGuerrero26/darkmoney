import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, dom, root, load, mock, h, createRoot, MemoryRouter, change, button, settle } from "./lib/web-ui-harness.mjs";
mock("src/modules/assistant/components/assistant-movement-change-review.tsx","export const AssistantMovementChangeReview=()=>null;");

const { parseObligationProposal, prepareObligationProposal } = await import(load("src/modules/assistant/lib/obligation-proposal.ts"));
const { buildObligationEditorInput, validateObligationPlan } = await import(load("src/modules/obligations/lib/obligation-editor-input.ts"));
const { expandPaymentPlan } = await import(load("src/modules/obligations/lib/payment-plan.ts"));
const mobilePlan = await import(load("../DarkMoneyApp/features/obligations/lib/payment-plan.ts"));
const { parseAssistantReply } = await import(load("src/modules/assistant/lib/assistant-contract.ts"));
const source = readFileSync(resolve(root, "../DarkMoneyApp/services/queries/assistant.ts"), "utf8");
const ast = ts.createSourceFile("assistant.ts", source, ts.ScriptTarget.Latest, true);
const functions = ["parseObligationDraft", "parseObligationPlan"].map(name => { const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name); assert.ok(fn); return fn.getText(ast); });
const mobileParser = new Function(ts.transpileModule(functions.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ";return parseObligationDraft;")();
const equal = { mode: "equal", count: 3, firstDueDate: "2026-10-31" };
const custom = { mode: "custom", agreed: [{ amount: 150, dueDate: "2026-10-31" }, { amount: 250, dueDate: "2026-10-31" }], tail: 200, firstDueDate: "2026-10-31" };
const raw = { direction: "receivable", title: "Préstamo familiar", counterpartyName: "lucia", principalAmount: 1200, currency: "PEN", startDate: "2026-10-01", dueDate: "2026-12-31", description: "Acuerdo familiar", paymentPlan: equal, planSummary: "3 cuotas" };
const snapshot = { workspace: { id: 8, baseCurrencyCode: "PEN" }, accounts: [{ id: 1, workspaceId: 8, name: "Principal", currencyCode: "PEN", type: "bank", isArchived: false }, { id: 2, workspaceId: 8, name: "USD", currencyCode: "USD", type: "bank", isArchived: false }],
  catalogs: { counterparties: [{ id: 30, name: "Lucía", type: "person", isArchived: false }], categories: [] }, movements: [], budgets: [], subscriptions: [], recurringIncome: [], exchangeRates: [] };
for (const direction of ["receivable", "payable"]) for (const paymentPlan of [null, equal, custom]) {
  const value = { ...raw, direction, paymentPlan }; assert.deepEqual(parseObligationProposal(value), mobileParser(value));
  if (paymentPlan) { const validated = validateObligationPlan(paymentPlan, 1200, raw.startDate); assert.deepEqual(validated.rows, mobilePlan.expandPaymentPlan({ plan: paymentPlan, principal: 1200, startDate: raw.startDate })); }
}
for (const patch of [{ principalAmount: true }, { principalAmount: Infinity }, { principalAmount: 0.001 }, { currency: "pen" }, { startDate: "2026-02-30" }, { dueDate: "2026-09-30" }, { direction: "delete" }, { paymentPlan: { ...equal, count: true } }, { paymentPlan: { ...equal, count: 601 } }, { paymentPlan: { ...equal, firstDueDate: "2026-02-30" } }, { paymentPlan: { mode: "custom", agreed: [{ amount: 10 }], tail: null } }, { paymentPlan: { mode: "custom", agreed: [{ amount: true }], tail: 100 } }]) assert.equal(parseObligationProposal({ ...raw, ...patch }), null);
assert.throws(() => validateObligationPlan({ mode: "equal", count: 2 }, 0.01, raw.startDate), /cuotas positivas/);
const draft = parseObligationProposal(raw), form = prepareObligationProposal(draft, snapshot), payload = buildObligationEditorInput(form, snapshot);
assert.equal(form.counterpartyId, "30"); assert.equal(form.originType, "manual"); assert.equal(form.manualOpeningImpact, "none"); assert.equal(form.openingAccountId, ""); assert.equal(payload.openingImpact, "none"); assert.equal(payload.openingAccountId, null); assert.equal(payload.installmentCount, 3); assert.equal(payload.installmentAmount, 400);
assert.deepEqual(payload.paymentPlan, equal);
for (const counterparties of [[], [...snapshot.catalogs.counterparties, { ...snapshot.catalogs.counterparties[0], id: 31 }], [{ ...snapshot.catalogs.counterparties[0], isArchived: true }]]) {
  const prepared = prepareObligationProposal(draft, { ...snapshot, catalogs: { ...snapshot.catalogs, counterparties } }); assert.equal(prepared.counterpartyId, ""); assert.throws(() => buildObligationEditorInput(prepared, snapshot), /contraparte/);
}
for (const patch of [{ counterpartyId: "99" }, { principalAmount: "0" }, { principalAmount: "1.001" }, { dueDate: "2026-09-30" }, { currencyCode: "XYZ" }, { settlementAccountId: "99" }, { returnTotal: "400" }, { originType: "" }, { paymentPlan: { mode: "equal", count: 2.5 } }, { originType: "cash_loan", openingAccountId: "2" }]) assert.throws(() => buildObligationEditorInput({ ...form, ...patch }, snapshot));
// Al crear la tasa no se escribe: sale del total a devolver (móvil). Al editar, una tasa inválida sigue rechazándose.
assert.equal(buildObligationEditorInput({ ...form, interestRate: "Infinity" }, snapshot).interestRate, null);
assert.throws(() => buildObligationEditorInput({ ...form, interestRate: "Infinity" }, snapshot, false));
{ const withInterest = buildObligationEditorInput({ ...form, returnTotal: String(Number(form.principalAmount) + 50) }, snapshot); assert.equal(withInterest.principalAmount, Number(form.principalAmount)); assert.ok(withInterest.interestRate > 0); }
assert.equal(buildObligationEditorInput({ ...form, originType: "cash_loan", openingAccountId: "1" }, snapshot).openingImpact, "outflow");
assert.equal(buildObligationEditorInput({ ...form, direction: "payable", originType: "cash_loan", openingAccountId: "1" }, snapshot).openingImpact, "inflow");
const parsed = parseAssistantReply({ reply: "Revisa este crédito", obligationDraft: { ...raw, href: "https://evil.invalid", status: "paid", openingImpact: "outflow", openingAccountId: 1 } });
assert.equal(parsed.proposals[0].href, "/app/obligations"); assert.equal(parsed.proposals[0].status, undefined); assert.deepEqual(parsed.proposals[0].obligationDraft, draft);

// Actual page, review, shared editor, plan editor and compact receipt control. All I/O is local.
globalThis.obScope = { userId: "u", workspaceId: 8, pro: true };
globalThis.obQuery = { data: snapshot, isFetching: false, isError: false, isPlaceholderData: false, refetch: async () => {} };
globalThis.obWrites = []; globalThis.obWrite = async () => 401; globalThis.obReply = parsed; globalThis.obCalls = []; globalThis.obUploads = []; globalThis.obAttachments = []; globalThis.obUploadFail = false;
mock("src/services/queries/workspace-data.ts", `export const useWorkspaceSnapshotQuery=()=>globalThis.obQuery;export const useCreateObligationMutation=()=>({mutateAsync:async input=>{globalThis.obWrites.push(input);return globalThis.obWrite(input);}});export const useCreateAttachmentRecordMutation=()=>({mutateAsync:async input=>{globalThis.obAttachments.push(input);}});export const getQueryErrorMessage=e=>e.message??'Fixture SQL rejection';`);
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:{id:globalThis.obScope.userId}});");
mock("src/modules/workspaces/use-active-workspace.ts", "const workspaces=[{id:8,name:'Personal'},{id:9,name:'Otro'}];export const useActiveWorkspace=()=>({workspaces,activeWorkspace:workspaces.find(w=>w.id===globalThis.obScope.workspaceId),setActiveWorkspaceId:id=>{globalThis.obScope.workspaceId=id},isFetching:false,isError:false});");
mock("src/modules/shared/use-pro-feature-access.ts", "export const useProFeatureAccess=()=>({canAccessProFeatures:globalThis.obScope.pro});");
mock("src/modules/attachments/use-receipt-feature-access.ts", "export const useReceiptFeatureAccess=()=>({canUploadReceipts:globalThis.obScope.pro,accessMessage:'Pro'});");
mock("src/modules/attachments/receipt-utils.ts", "export const createReceiptSignedUrl=async()=>'',deleteStoredReceipt=async()=>{};export const prepareReceiptUpload=async input=>({bucketName:'receipts',filePath:'fixture.webp',fileName:'receipt.webp',mimeType:'image/webp',sizeBytes:8,width:2,height:2,...input});export const uploadPreparedReceipt=async input=>{globalThis.obUploads.push(input);if(globalThis.obUploadFail)throw Error('Fixture storage failure');};");
mock("src/services/queries/assistant.ts", "export const useAssistantInsight=()=>({data:null});export const askAssistant=async(message,history)=>{globalThis.obCalls.push({message,history});return globalThis.obReply;};");
mock("src/modules/assistant/components/assistant-payment-review.tsx", "export const AssistantPaymentReview=()=>null;");
for (const [file, name] of [["assistant-movement-review", "AssistantMovementReview"], ["assistant-budget-review", "AssistantBudgetReview"], ["assistant-recurring-review", "AssistantRecurringReview"]]) mock(`src/modules/assistant/components/${file}.tsx`, `export const ${name}=()=>null;`);
mock("src/components/ui/date-picker-field.tsx", `${h} export const DatePickerField=p=>h('input',{value:p.value,onChange:e=>p.onChange(e.target.value)});`);
mock("src/components/ui/searchable-picker.tsx", `${h} export const SearchablePicker=p=>h('select',{'aria-label':p.placeholderLabel,value:p.value,disabled:p.disabled,onChange:e=>p.onChange(e.target.value)},h('option',{value:''},'Sin asignar'),...p.options.filter(o=>o.value!=='').map(o=>h('option',{key:o.value,value:o.value},o.label)));`);
const { AssistantPage } = await import(load("src/modules/assistant/pages/assistant-page.tsx"));
const { AssistantObligationReview } = await import(load("src/modules/assistant/components/assistant-obligation-review.tsx"));
let renderer, container;
async function render(element = React.createElement(AssistantPage)) { if (!renderer) { container = document.createElement("div"); document.body.append(container); renderer = createRoot(container); } await act(async () => renderer.render(React.createElement(MemoryRouter, null, element))); await settle(); }
async function close() { await act(async () => renderer.unmount()); container.remove(); renderer = null; }
async function click(label) { await act(async () => button(container, label).click()); await settle(); }
async function destination(label) { const found = [...container.querySelectorAll("button")].find(b => b.querySelector("span")?.textContent === label); assert.ok(found, label); await act(async () => found.click()); await settle(); }
async function ask(text) { await change(container.querySelector("textarea"), text); await click("Enviar pregunta"); }
async function submit() { await act(async () => { const form = container.querySelector('[role="dialog"] form'); assert.ok(form); for (let i = 0; i < 2; i++) form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); }); await settle(); }
const amount = () => container.querySelector('#obligation-principal');
let finish;
for (const direction of ["receivable", "payable"]) {
  globalThis.obReply = parseAssistantReply({ reply: "Propuesta", obligationDraft: { ...raw, direction } }); globalThis.obWrite = () => new Promise(r => { finish = r; });
  const before = globalThis.obWrites.length; await render(); await ask("Registra " + direction); assert.equal(globalThis.obWrites.length, before); await click("Revisar y registrar"); assert.equal(amount().value, "1200"); assert.match(container.textContent, /sin mover dinero/);
  await destination("Detalles"); await destination("Plan de pagos"); assert.equal(container.querySelector('input[aria-label="Número de cuotas"]').value, "3"); await submit(); assert.equal(globalThis.obWrites.length, before, "plan panel cannot submit the obligation");
  await click("Guardar plan"); assert.equal(globalThis.obWrites.length, before); await act(async () => container.querySelector('button[aria-label="Volver"]').click());
  await change(amount(), "1500"); globalThis.obQuery.isFetching = true; await render(); assert.equal(amount().value, "1500"); await submit(); assert.equal(globalThis.obWrites.length, before); assert.match(container.textContent, /Espera la lectura/); globalThis.obQuery.isFetching = false; await render();
  await submit(); assert.equal(globalThis.obWrites.length, before + 1); const saved = globalThis.obWrites.at(-1); assert.equal(saved.direction, direction); assert.equal(saved.principalAmount, 1500); assert.equal(saved.installmentAmount, 500); assert.equal(saved.openingImpact, "none"); assert.equal(saved.openingAccountId, null); assert.equal(button(container, "Guardando...").disabled, true);
  await act(async () => finish(401)); await settle(); assert.equal(container.querySelector('[role="dialog"]'), null); assert.match(container.textContent, /#401/); assert.match(container.textContent, /Guardado/);
  await ask("¿Se guardó?"); assert.match(globalThis.obCalls.at(-1).history.at(-1).content, /GUARDÓ/); assert.match(globalThis.obCalls.at(-1).history.at(-1).content, /1,500[.,]00/);
  await click("Revisar y registrar"); globalThis.obWrite = async () => { throw { code: "23514", message: "Later opening-event phase failed" }; }; await submit(); assert.equal(container.querySelector('[role="dialog"]'), null); assert.match(container.textContent, /alguna fase podría haberse guardado/); const check = [...container.querySelectorAll("a")].find(a => a.textContent === "Comprobar en el módulo"); assert.equal(check?.getAttribute("href"), "/app/obligations");
  await ask("¿Qué pasó?"); assert.match(globalThis.obCalls.at(-1).history.at(-1).content, /RESULTADO INCIERTO; no repetir/); await close(); window.localStorage.clear();
}
let outcomes = [], unconfirmed = [];
const props = { draft, userId: "u", workspaceId: 8, session: {}, onClose: () => {}, onSaved: note => outcomes.push(note), onUnconfirmed: note => unconfirmed.push(note) };
globalThis.obWrite = async () => 402;
// A missing/ambiguous counterparty is not guessed; an explicit selection can correct it.
await render(React.createElement(AssistantObligationReview, { ...props, draft: { ...draft, counterpartyName: "No existe" }, session: {} })); const beforeParty = globalThis.obWrites.length; await submit(); assert.equal(globalThis.obWrites.length, beforeParty); assert.match(container.textContent, /Elige una contraparte/);
await change(container.querySelector('select[aria-label="Selecciona una contraparte"]'), "30"); await submit(); assert.equal(globalThis.obWrites.length, beforeParty + 1); await close();
// Opening cash impact only follows an explicit change and a valid same-currency account.
await render(React.createElement(AssistantObligationReview, { ...props, session: {} })); await change(container.querySelector('select[aria-label="Elegir cómo nació"]'), "cash_loan"); await destination("Detalles"); assert.match(container.textContent, /Elegiste una apertura con salida/); const beforeOpening = globalThis.obWrites.length; await submit(); assert.equal(globalThis.obWrites.length, beforeOpening); await change(container.querySelector('select[aria-label="Selecciona una cuenta"]'), "1"); await submit(); assert.equal(globalThis.obWrites.at(-1).openingImpact, "outflow"); assert.equal(globalThis.obWrites.at(-1).openingAccountId, 1); await close();
// A plan that would contain a zero-valued installment cannot be saved in the actual plan editor.
await render(React.createElement(AssistantObligationReview, { ...props, session: {} })); await change(amount(), "0.01"); await destination("Detalles"); await destination("Plan de pagos"); await change(container.querySelector('input[aria-label="Número de cuotas"]'), "2"); assert.equal(button(container, "Guardar plan").disabled, true); assert.match(container.textContent, /cuotas positivas/); await close();
// Original custom schedule keeps mobile month ordering, and the shared plan editor declares shifted dates.
const customDraft = parseObligationProposal({ ...raw, paymentPlan: custom }); await render(React.createElement(AssistantObligationReview, { ...props, draft: customDraft, session: {} })); assert.match(container.textContent, /Hay fechas que se cruzan/); await destination("Detalles"); await destination("Plan de pagos"); assert.match(container.textContent, /El calendario que se usará/); await click("Guardar plan"); await submit(); assert.deepEqual(globalThis.obWrites.at(-1).paymentPlan, custom); assert.equal(globalThis.obWrites.at(-1).installmentCount, expandPaymentPlan(custom, 1200, raw.startDate).length); await close();
// A receipt failure follows a confirmed creation; never replay the financial write to retry the image.
globalThis.File = dom.window.File; globalThis.obUploadFail = true;
await render(React.createElement(AssistantObligationReview, { ...props, session: {} })); await destination("Detalles"); const file = container.querySelector('input[type="file"]'); assert.ok(file); Object.defineProperty(file, "files", { value: [new File(["fixture"], "receipt.png", { type: "image/png" })], configurable: true }); await act(async () => file.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
const beforeReceipt = globalThis.obWrites.length; await submit(); assert.equal(globalThis.obWrites.length, beforeReceipt + 1); assert.match(outcomes.at(-1), /comprobante quedó pendiente/); assert.equal(unconfirmed.length, 0); await close(); globalThis.obUploadFail = false;
// Successful image attachment retains the original record/user/workspace, not a new obligation.
await render(React.createElement(AssistantObligationReview, { ...props, session: {} })); await destination("Detalles"); const receiptInput = container.querySelector('input[type="file"]'); Object.defineProperty(receiptInput, "files", { value: [new File(["fixture"], "receipt.png", { type: "image/png" })], configurable: true }); await act(async () => receiptInput.dispatchEvent(new dom.window.Event("change", { bubbles: true }))); await submit(); assert.equal(globalThis.obAttachments.at(-1).entityId, 402); assert.equal(globalThis.obAttachments.at(-1).workspaceId, 8); assert.equal(globalThis.obAttachments.at(-1).uploadedByUserId, "u"); await close();
for (const boundary of [() => { globalThis.obScope.pro = false; }, () => { globalThis.obQuery.isError = true; }]) {
  boundary(); await render(React.createElement(AssistantObligationReview, { ...props, session: {} })); const before = globalThis.obWrites.length; await submit(); assert.equal(globalThis.obWrites.length, before); await close(); globalThis.obScope.pro = true; globalThis.obQuery.isError = false;
}
for (const boundary of [() => { globalThis.obScope.userId = "other"; }, () => { globalThis.obScope.workspaceId = 9; }, () => { globalThis.obQuery.isPlaceholderData = true; }]) {
  boundary(); await render(React.createElement(AssistantObligationReview, { ...props, session: {} })); assert.equal(container.querySelector('[role="dialog"]'), null); await close(); globalThis.obScope.userId = "u"; globalThis.obScope.workspaceId = 8; globalThis.obQuery.isPlaceholderData = false;
}
for (const field of ["userId", "workspaceId"]) {
  const session = {}, before = outcomes.length; globalThis.obWrite = () => new Promise(r => { finish = r; }); await render(React.createElement(AssistantObligationReview, { ...props, session })); await submit(); globalThis.obScope[field] = field === "userId" ? "other" : 9; await render(React.createElement(AssistantObligationReview, { ...props, session })); await act(async () => finish(403)); await settle(); assert.equal(outcomes.length, before); await close(); globalThis.obScope[field] = field === "userId" ? "u" : 8;
}
globalThis.obWrite = async () => null; const beforeUnconfirmed = unconfirmed.length; await render(React.createElement(AssistantObligationReview, { ...props, session: {} })); await submit(); assert.equal(unconfirmed.length, beforeUnconfirmed + 1); await close();
const session = {}; await render(React.createElement(AssistantObligationReview, { ...props, session })); await change(amount(), "1600"); await act(async () => container.querySelector('button[aria-label="Cerrar formulario"]').click()); assert.match(container.textContent, /Salir sin guardar/); await click("Sí, descartar"); assert.equal(session.value, undefined); await close();
dom.window.close(); console.log("assistant-obligation-drafts: OK (actual mobile parsers/schedules, shared editor/plan/receipt, scoped prefill, no auto opening, exact coverage, explicit creation/outcome, double submit and plan-only save, compound SQL uncertainty without replay, receipt success/failure, context guards; local fixture I/O only)");
