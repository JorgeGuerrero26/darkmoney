import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, dom, root, load, createRoot, settle } from "./lib/web-ui-harness.mjs";
const { useFinancialWriteGuard } = await import(load("src/modules/shared/use-financial-write-guard.ts"));
const { buildObligationEditorInput } = await import(load("src/modules/obligations/lib/obligation-editor-input.ts"));
const { prepareObligationProposal } = await import(load("src/modules/assistant/lib/obligation-proposal.ts"));
const model = await import(load("src/modules/obligations/lib/obligation-editor-model.ts"));
const plan = await import(load("src/modules/obligations/lib/payment-plan.ts"));
const path = resolve(root, "src/modules/obligations/pages/obligations-page.tsx");
const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
const names = ["handleSubmitObligation", "handleSubmitPayment"], functions = [];
function visit(node) { if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) functions.push(node.getText(source)); ts.forEachChild(node, visit); }
visit(source); assert.equal(functions.length, 2);
const code = ts.transpileModule(functions.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const createHandlers = new Function("env", `with(env){${code};return {${names.join(",")}};}`);
const account = { id: 1, workspaceId: 8, name: "Principal", currencyCode: "PEN", isArchived: false };
const target = { id: 20, workspaceId: 8, title: "Préstamo", direction: "payable", status: "active", currencyCode: "PEN", principalAmount: 500, pendingAmount: 400, startDate: "2026-01-01", events: [{ id: 33, amount: 50, movementId: 44 }] };
const snapshot = { workspace: { id: 8, baseCurrencyCode: "PEN" }, accounts: [account], obligations: [target], catalogs: { categories: [], counterparties: [{ id: 10, name: "Lucía", isArchived: false }] } };
function environment() {
  const state = { calls: [], feedback: [], receipt: [], invites: [], close: [], fail: false, gate: null };
  const mutation = kind => ({ mutateAsync: async input => { state.calls.push({ kind, input }); if (state.gate) await state.gate; if (state.fail) throw { code: "23514", message: "Late compound phase failed" }; return kind === "create" ? 401 : { eventId: 41, movementId: 42 }; } });
  const env = { activeWorkspace: { id: 8 }, user: { id: "u" }, snapshot, snapshotQuery: { isFetching: false, isPlaceholderData: false, isError: false }, accounts: [account], baseCurrencyCode: "PEN",
    formState: prepareObligationProposal({ direction: "payable", title: "Préstamo", principalAmount: 500, currency: "PEN", counterpartyName: "Lucía", startDate: "2026-01-01", dueDate: null, description: null, paymentPlan: null }, snapshot),
    paymentTarget: target, paymentFormState: { amount: "80", eventDate: "2026-10-15", installmentNo: "", description: "", notes: "", accountId: "1", registerAccountMovement: true }, paymentEditEventId: null,
    pendingReceiptFile: null, pendingPaymentReceiptFile: null, canUploadReceipts: true, editorMode: "create", selectedObligation: null, shareByObligationId: new Map(), createShareFormState: { invitedEmail: "", message: "" },
    shouldResendShareInvite: () => false, buildObligationEditorInput, ...model, ...plan, parseOptionalInteger: value => value ? Number(value) : null, parseOptionalNumber: value => value ? Number(value.replace(",", ".")) : null,
    getQueryErrorMessage: error => error.message, describeShareInviteOutcome: () => "Compartido", createDefaultShareInviteFormState: () => ({ invitedEmail: "", message: "" }),
    createMutation: mutation("create"), updateMutation: mutation("update"), paymentMutation: mutation("payment"), eventUpdateMutation: mutation("event-update"),
    uploadReceiptForObligation: async (...input) => state.receipt.push(input), uploadReceiptForEvent: async (...input) => state.receipt.push(input), sendShareInvite: async (...input) => { state.invites.push(input); return {}; },
    setEditorFeedback: value => state.feedback.push(value), setPaymentFeedback: value => state.feedback.push(value), setPageFeedback: value => state.feedback.push(value), setInvalidFields: () => {},
    setPendingReceiptFile: () => {}, setCreateShareFormState: () => {}, setIsEditorOpen: value => state.close.push(value), setSelectedObligationId: () => {}, setPaymentTargetId: value => state.close.push(value), setPaymentEditEventId: () => {}, setPendingPaymentReceiptFile: () => {},
  }; return { state, env };
}
let renderer, container, handlers, editorGuard, paymentGuard;
function Host({ env, identity }) { editorGuard = useFinancialWriteGuard(identity + ":editor"); paymentGuard = useFinancialWriteGuard(identity + ":payment"); handlers = createHandlers({ ...env, editorWrite: editorGuard, paymentWrite: paymentGuard }); return React.createElement('div', null, editorGuard.status, paymentGuard.status); }
async function render(env, identity) { if (!renderer) { container = document.createElement('div'); document.body.append(container); renderer = createRoot(container); } await act(async () => renderer.render(React.createElement(Host, { env, identity }))); await settle(); }
const event = { preventDefault() {} }; let index = 0;
for (const name of names) {
  const { env, state } = environment(); let finish; state.gate = new Promise(resolve => { finish = resolve; }); await render(env, "scope" + index++); const callback = handlers[name]; let a, b;
  await act(async () => { a = callback(event); b = callback(event); }); await settle(); assert.equal(state.calls.length, 1, name + " double submit");
  await act(async () => { finish(); await Promise.all([a, b]); }); await settle(); assert.ok(state.feedback.some(value => value?.tone === "success")); assert.equal(state.calls.length, 1); await act(async () => callback(event)); assert.equal(state.calls.length, 1);
}
for (const name of names) {
  const { env, state } = environment(); state.fail = true; await render(env, "scope" + index++); await act(async () => handlers[name](event)); assert.match(state.feedback.at(-1).description, /No repitas el envío/); const before = state.calls.length; await act(async () => handlers[name](event)); assert.equal(state.calls.length, before); assert.match(container.textContent, /uncertain/);
}
// Late writes cannot start receipt uploads/invitations or close a new user's editor.
for (const name of names) {
  const { env, state } = environment(); env.pendingReceiptFile = {}; env.pendingPaymentReceiptFile = {}; env.createShareFormState.invitedEmail = "guest@example.test"; let finish; state.gate = new Promise(resolve => { finish = resolve; }); const id = "scope" + index++; await render(env, id); let saving;
  await act(async () => { saving = handlers[name](event); }); await render(environment().env, id + ":other-user"); await act(async () => { finish(); await saving; }); assert.equal(state.receipt.length, 0); assert.equal(state.invites.length, 0); assert.equal(state.close.length, 0);
}
// A -> B -> A still invalidates the old attempt, even if no write began in B.
{ const { env, state } = environment(); let finish; state.gate = new Promise(resolve => { finish = resolve; }); await render(env, "A"); let saving; await act(async () => { saving = handlers.handleSubmitPayment(event); }); await render(env, "B"); await render(env, "A"); await act(async () => { finish(); await saving; }); assert.equal(state.close.length, 0); }
for (const patch of [{ amount: "Infinity" }, { amount: "1.001" }, { installmentNo: "1.5" }, { eventDate: "2026-02-30" }, { eventDate: "2025-12-31" }, { accountId: "99" }]) {
  const { env, state } = environment(); Object.assign(env.paymentFormState, patch); await render(env, "scope" + index++); await act(async () => handlers.handleSubmitPayment(event)); assert.equal(state.calls.length, 0); assert.match(container.textContent, /idle/);
}
{ const { env, state } = environment(); env.accounts = []; await render(env, "scope" + index++); await act(async () => handlers.handleSubmitPayment(event)); assert.equal(state.calls.length, 0); env.paymentFormState.registerAccountMovement = false; await render(env, "scope" + index++); await act(async () => handlers.handleSubmitPayment(event)); assert.equal(state.calls.length, 1); assert.equal(state.calls[0].input.registerAccountMovement, false); }
{ const { env, state } = environment(); env.paymentEditEventId = 999; await render(env, "scope" + index++); await act(async () => handlers.handleSubmitPayment(event)); assert.equal(state.calls.length, 0); assert.match(state.feedback.at(-1).description, /No se creará otro abono/); }
{ const { env, state } = environment(); env.paymentEditEventId = 33; await render(env, "scope" + index++); await act(async () => handlers.handleSubmitPayment(event)); assert.equal(state.calls[0].kind, "event-update"); assert.equal(state.calls[0].input.eventId, 33); }
for (const name of names) for (const field of ["isFetching", "isError", "isPlaceholderData"]) { const { env, state } = environment(); env.snapshotQuery[field] = true; await render(env, "scope" + index++); await act(async () => handlers[name](event)); assert.equal(state.calls.length, 0); }
await act(async () => renderer.unmount()); container.remove(); dom.window.close();
console.log("Native obligation write guards: actual handlers + hook, duplicate submits, uncertain multi-write failures, stale/ABA scope, receipts/invites, exact money/date/account checks and missing edit event passed locally; not server atomicity.");
