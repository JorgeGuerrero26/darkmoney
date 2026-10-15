import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import type { BudgetEditorValue } from "../../budgets/components/budget-editor-dialog";
import { validBudgetDay } from "../../budgets/lib/budget-date";

export type AssistantBudgetDraft = {
  name: string; limitAmount: number; currency: string; categoryName: string | null;
  periodStart: string; periodEnd: string; alertPercent: number;
};
export function parseBudgetProposal(value: unknown): AssistantBudgetDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const amount = typeof raw.limitAmount === "number" || typeof raw.limitAmount === "string" ? Number(raw.limitAmount) : NaN;
  if (!Number.isFinite(amount) || amount <= 0 || typeof raw.currency !== "string" || !/^[A-Z]{3}$/.test(raw.currency) ||
    !validBudgetDay(raw.periodStart) || !validBudgetDay(raw.periodEnd) || raw.periodEnd < raw.periodStart) return null;
  const alert = typeof raw.alertPercent === "number" || typeof raw.alertPercent === "string" ? Number(raw.alertPercent) : NaN;
  return { name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 120) : "Presupuesto", limitAmount: amount, currency: raw.currency,
    categoryName: typeof raw.categoryName === "string" && raw.categoryName.trim() ? raw.categoryName.trim().slice(0, 500) : null,
    periodStart: raw.periodStart, periodEnd: raw.periodEnd, alertPercent: Number.isFinite(alert) && alert >= 1 && alert <= 100 ? alert : 80 };
}
export function prepareBudgetProposal(draft: AssistantBudgetDraft, snapshot: WorkspaceSnapshot): BudgetEditorValue {
  const fold = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
  const matches = snapshot.catalogs.categories.filter(c => c.isActive && (c.kind === "expense" || c.kind === "both") && draft.categoryName && fold(c.name) === fold(draft.categoryName));
  return { name: draft.name, scopeChosen: matches.length === 1, categoryId: matches.length === 1 ? matches[0].id : null,
    accountId: null, spendTypeId: null, limitAmount: String(draft.limitAmount), recurrence: "none",
    periodStart: draft.periodStart, periodEnd: draft.periodEnd, alertPercent: draft.alertPercent, currencyCode: draft.currency,
    rolloverEnabled: false, isActive: true, notes: "" };
}
