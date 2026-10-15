import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import type { ObligationFormState } from "../../obligations/lib/obligation-editor-model";
import { validateObligationPlan } from "../../obligations/lib/obligation-editor-input";
import type { PaymentPlan } from "../../obligations/lib/payment-plan";
import { validBudgetDay } from "../../budgets/lib/budget-date";

export type AssistantObligationDraft = {
  direction: "receivable" | "payable"; title: string; counterpartyName: string | null; principalAmount: number;
  currency: string; startDate: string; dueDate: string | null; description: string | null; paymentPlan: PaymentPlan | null; planSummary: string | null;
};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null;
export function parseObligationProposal(value: unknown): AssistantObligationDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const amount = typeof raw.principalAmount === "number" || typeof raw.principalAmount === "string" ? Number(raw.principalAmount) : NaN;
  if (!["receivable", "payable"].includes(String(raw.direction)) || !Number.isFinite(amount) || amount <= 0 ||
    !Number.isSafeInteger(Math.round(amount * 100)) || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6 ||
    typeof raw.currency !== "string" || !/^[A-Z]{3}$/.test(raw.currency) || !validBudgetDay(raw.startDate)) return null;
  const dueDate = raw.dueDate == null || raw.dueDate === "" ? null : raw.dueDate;
  if (dueDate !== null && (!validBudgetDay(dueDate) || dueDate < raw.startDate)) return null;
  try {
    const { plan } = validateObligationPlan(raw.paymentPlan, amount, raw.startDate);
    return { direction: raw.direction as AssistantObligationDraft["direction"], title: text(raw.title)?.slice(0, 120) ?? (raw.direction === "receivable" ? "Crédito a favor" : "Deuda"),
      counterpartyName: text(raw.counterpartyName), principalAmount: amount, currency: raw.currency, startDate: raw.startDate,
      dueDate, description: text(raw.description), paymentPlan: plan, planSummary: text(raw.planSummary) };
  } catch { return null; }
}
export function prepareObligationProposal(draft: AssistantObligationDraft, snapshot: WorkspaceSnapshot): ObligationFormState {
  const fold = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
  const counterparties = snapshot.catalogs.counterparties.filter(p => !p.isArchived && draft.counterpartyName && fold(p.name) === fold(draft.counterpartyName));
  const { rows } = validateObligationPlan(draft.paymentPlan, draft.principalAmount, draft.startDate);
  return { direction: draft.direction, originType: "manual", manualOpeningImpact: "none", status: "active", title: draft.title,
    counterpartyId: counterparties.length === 1 ? String(counterparties[0].id) : "", openingAccountId: "", settlementAccountId: "",
    currencyCode: draft.currency, principalAmount: String(draft.principalAmount), startDate: draft.startDate, dueDate: draft.dueDate ?? "",
    installmentAmount: rows.length ? String(rows[0].amount) : "", installmentCount: rows.length ? String(rows.length) : "",
    paymentPlan: draft.paymentPlan, interestRate: "", description: draft.description ?? "", notes: "" };
}
