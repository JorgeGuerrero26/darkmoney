import type { WorkspaceSnapshot, ObligationPaymentFormInput } from "../../../services/queries/workspace-data";
import type { PaymentFormState } from "../../obligations/components/obligation-payment-dialog";
import type { AssistantMovementDraft } from "./movement-proposal";
import { validAssistantDay } from "./movement-proposal";

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
export function paymentTargets(draft: AssistantMovementDraft, snapshot: WorkspaceSnapshot) {
  return draft.operation === "pay_subscription"
    ? snapshot.subscriptions.filter(row => row.workspaceId === snapshot.workspace.id && row.currencyCode === draft.currency && row.status === "active").map(row => ({ id: row.id, name: row.name, party: row.vendor }))
    : snapshot.obligations.filter(row => row.workspaceId === snapshot.workspace.id && row.currencyCode === draft.currency && !["cancelled", "archived", "paid"].includes(row.status) && row.pendingAmount > 0).map(row => ({ id: row.id, name: row.title, party: row.counterparty }));
}
export function resolvePaymentTarget(draft: AssistantMovementDraft, snapshot: WorkspaceSnapshot) {
  const rows = paymentTargets(draft, snapshot);
  const id = draft.operation === "pay_subscription" ? draft.subscriptionId : draft.obligationId;
  const name = draft.operation === "pay_subscription" ? draft.subscriptionName : draft.obligationCounterparty;
  const matches = rows.filter(row => (id == null || row.id === id) && (name == null || fold(draft.operation === "pay_subscription" ? row.name : row.party) === fold(name)));
  return id == null && name == null || matches.length !== 1 ? null : matches[0].id;
}
export function resolvePaymentAccount(draft: AssistantMovementDraft, snapshot: WorkspaceSnapshot) {
  const matches = snapshot.accounts.filter(row => row.workspaceId === snapshot.workspace.id && !row.isArchived && row.currencyCode === draft.currency && draft.accountName && fold(row.name) === fold(draft.accountName));
  return matches.length === 1 ? matches[0].id : null;
}
export function validateObligationPayment(value: PaymentFormState, snapshot: WorkspaceSnapshot, obligationId: number): ObligationPaymentFormInput {
  const target = snapshot.obligations.find(row => row.workspaceId === snapshot.workspace.id && row.id === obligationId);
  if (!target || ["archived", "cancelled", "paid"].includes(target.status) || target.pendingAmount <= 0) throw new Error("El crédito o deuda ya no está disponible para este abono.");
  const amount = Number(value.amount.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100)) || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) throw new Error("Ingresa un monto positivo con hasta dos decimales.");
  if (!validAssistantDay(value.eventDate) || value.eventDate < target.startDate) throw new Error("Revisa la fecha del abono y el inicio del crédito o deuda.");
  const accountId = value.registerAccountMovement ? Number(value.accountId) : null;
  if (value.registerAccountMovement && !snapshot.accounts.some(row => row.id === accountId && row.workspaceId === snapshot.workspace.id && !row.isArchived && row.currencyCode === target.currencyCode)) throw new Error(`Elige una cuenta activa en ${target.currencyCode} o desactiva explícitamente el movimiento en cuenta.`);
  const installmentNo = value.installmentNo ? Number(value.installmentNo) : null;
  if (installmentNo != null && (!Number.isSafeInteger(installmentNo) || installmentNo <= 0)) throw new Error("Revisa el número de cuota.");
  return { obligationId, amount, eventDate: value.eventDate, accountId, registerAccountMovement: value.registerAccountMovement, installmentNo,
    description: value.description, notes: value.notes, nextStatus: amount >= target.pendingAmount ? "paid" : target.status === "draft" ? "active" : target.status };
}
