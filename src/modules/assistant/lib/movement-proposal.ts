import { isoToDateStr } from "@darkmoney/shared/dates";
import type { WorkspaceSnapshot, MovementFormInput } from "../../../services/queries/workspace-data";
import type { QuickMovementFormState, QuickMovementKind } from "../../movements/components/quick-movement-dialog";

export type AssistantMovementDraft = {
  operation: "expense" | "income" | "transfer" | "pay_subscription" | "pay_debt";
  amount: number; currency: string; accountName: string | null; destinationAccountName: string | null;
  categoryName: string | null; counterpartyName: string | null; subscriptionId: number | null;
  subscriptionName: string | null; obligationId: number | null; obligationCounterparty: string | null;
  occurredAt: string | null; description: string | null; missing: string[];
};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null;
const positiveId = (value: unknown) => (typeof value === "number" || typeof value === "string") && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
export function validAssistantDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function parseMovementProposal(value: unknown): AssistantMovementDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!["expense", "income", "transfer", "pay_subscription", "pay_debt"].includes(String(raw.operation))) return null;
  const amount = typeof raw.amount === "number" || typeof raw.amount === "string" ? Number(raw.amount) : NaN;
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6 ||
    typeof raw.currency !== "string" || !/^[A-Z]{3}$/.test(raw.currency)) return null;
  const occurredAt = text(raw.occurredAt);
  if (occurredAt && !validAssistantDay(occurredAt)) return null;
  return {
    operation: raw.operation as AssistantMovementDraft["operation"], amount, currency: raw.currency,
    accountName: text(raw.accountName), destinationAccountName: text(raw.destinationAccountName),
    categoryName: text(raw.categoryName), counterpartyName: text(raw.counterpartyName),
    subscriptionId: positiveId(raw.subscriptionId), subscriptionName: text(raw.subscriptionName),
    obligationId: positiveId(raw.obligationId), obligationCounterparty: text(raw.obligationCounterparty),
    occurredAt, description: text(raw.description), missing: Array.isArray(raw.missing) ? raw.missing.filter((v): v is string => typeof v === "string").slice(0, 20).map(v => v.slice(0, 100)) : [],
  };
}
const fold = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
function unique<T extends { id: number; name: string }>(rows: T[], name: string | null): T | null {
  if (!name) return null;
  const matches = rows.filter(row => fold(row.name) === fold(name));
  return matches.length === 1 ? matches[0] : null;
}
const idText = (row: { id: number } | null) => row ? String(row.id) : "";
function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function prepareMovementProposal(draft: AssistantMovementDraft, snapshot: WorkspaceSnapshot, now = new Date()): {
  kind: QuickMovementKind; initialDraft: Partial<QuickMovementFormState>; unresolved: string[];
} {
  if (!["expense", "income", "transfer"].includes(draft.operation)) throw new Error("Este borrador usa el formulario específico de pago.");
  const kind = draft.operation as QuickMovementKind;
  const accounts = snapshot.accounts.filter(a => !a.isArchived && a.workspaceId === snapshot.workspace.id);
  const account = unique(accounts.filter(a => a.currencyCode === draft.currency), draft.accountName);
  const destination = kind === "transfer" ? unique(accounts.filter(a => a.id !== account?.id), draft.destinationAccountName) : null;
  const category = kind === "transfer" ? null : unique(snapshot.catalogs.categories.filter(c => c.isActive && (c.kind === kind || c.kind === "both")), draft.categoryName);
  const counterparty = unique(snapshot.catalogs.counterparties.filter(c => !c.isArchived), draft.counterpartyName);
  const unresolved = [!account ? "cuenta" : null, kind === "transfer" && !destination ? "cuenta de destino" : null,
    draft.categoryName && !category && kind !== "transfer" ? "categoría" : null, draft.counterpartyName && !counterparty ? "contraparte" : null].filter((v): v is string => v !== null);
  return { kind, unresolved, initialDraft: {
    amount: String(draft.amount), accountId: kind === "transfer" ? "" : idText(account), sourceAccountId: kind === "transfer" ? idText(account) : "",
    destinationAccountId: idText(destination), destinationAmount: destination?.currencyCode === draft.currency ? String(draft.amount) : "",
    categoryId: idText(category), counterpartyId: idText(counterparty), description: draft.description ?? "",
    occurredAt: localInput(draft.occurredAt ? new Date(`${draft.occurredAt}T12:00:00-05:00`) : now),
    status: draft.occurredAt && draft.occurredAt > isoToDateStr(now.toISOString()) ? "planned" : "posted",
  } };
}

export function validateAssistantMovement(input: MovementFormInput & { userId: string; workspaceId: number },
  snapshot: WorkspaceSnapshot, userId: string, currency: string) {
  if (snapshot.workspace.id !== input.workspaceId || input.userId !== userId) throw new Error("El usuario o espacio del borrador cambiaron.");
  if (!["expense", "income", "transfer"].includes(input.movementType) || !["planned", "pending", "posted"].includes(input.status) || Number.isNaN(new Date(input.occurredAt).getTime())) throw new Error("Revisa tipo, estado y fecha antes de guardar.");
  const source = snapshot.accounts.find(a => a.id === input.sourceAccountId && !a.isArchived && a.workspaceId === input.workspaceId);
  const destination = snapshot.accounts.find(a => a.id === input.destinationAccountId && !a.isArchived && a.workspaceId === input.workspaceId);
  const primary = input.movementType === "income" ? destination : source;
  if (!primary || primary.currencyCode !== currency) throw new Error("Elige una cuenta activa del espacio en la moneda del borrador.");
  const amount = input.movementType === "income" ? input.destinationAmount : input.sourceAmount;
  if (amount === null || !Number.isFinite(amount) || amount <= 0) throw new Error("El monto debe ser mayor que cero.");
  if (input.movementType === "income" && (input.sourceAccountId !== null || input.sourceAmount !== null) || input.movementType === "expense" && (input.destinationAccountId !== null || input.destinationAmount !== null)) throw new Error("Un ingreso o gasto debe afectar solo su cuenta correspondiente.");
  if (input.movementType === "transfer" && (!destination || destination.id === source?.id || !Number.isFinite(input.destinationAmount) || !input.destinationAmount || input.destinationAmount <= 0 || input.categoryId != null)) throw new Error("Revisa la cuenta y el monto de destino.");
  if (input.movementType === "transfer" && source?.currencyCode === destination?.currencyCode && input.sourceAmount !== input.destinationAmount) throw new Error("El traspaso en una misma moneda debe conservar el monto.");
  if (input.fxRate != null && (!Number.isFinite(input.fxRate) || input.fxRate <= 0)) throw new Error("El tipo de cambio no es válido.");
  if (input.categoryId != null && !snapshot.catalogs.categories.some(c => c.id === input.categoryId && c.isActive && (c.kind === input.movementType || c.kind === "both"))) throw new Error("La categoría ya no está disponible para este tipo.");
  if (input.counterpartyId != null && !snapshot.catalogs.counterparties.some(c => c.id === input.counterpartyId && !c.isArchived)) throw new Error("La contraparte ya no está disponible.");
  if (input.obligationId != null) throw new Error("Los abonos usan el formulario específico de créditos y deudas.");
  if (input.subscriptionId != null && !snapshot.subscriptions.some(s => s.id === input.subscriptionId && s.workspaceId === input.workspaceId && s.status === "active" && s.currencyCode === currency)) throw new Error("La suscripción vinculada no está disponible en este espacio y moneda.");
}
