import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import type { SubscriptionFormState } from "../../subscriptions/components/subscription-editor-dialog";
import type { RecurringIncomeFormState } from "../../recurring-income/components/recurring-income-editor-dialog";
import { validBudgetDay, budgetTodayLima } from "../../budgets/lib/budget-date";

export type AssistantRecurringDraft = {
  kind: "subscription" | "recurring_income"; name: string; amount: number; currency: string;
  frequency: "weekly" | "monthly" | "yearly"; dayOfMonth: number | null; nextDate: string;
  categoryName: string | null; accountName: string | null; description: string | null;
};
export type RecurringEditorDraft = { kind: "subscription"; value: SubscriptionFormState } | { kind: "recurring_income"; value: RecurringIncomeFormState };
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null;
export function parseRecurringProposal(value: unknown): AssistantRecurringDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const amount = typeof raw.amount === "number" || typeof raw.amount === "string" ? Number(raw.amount) : NaN;
  if (!["subscription", "recurring_income"].includes(String(raw.kind)) || !Number.isFinite(amount) || amount <= 0 ||
    typeof raw.currency !== "string" || !/^[A-Z]{3}$/.test(raw.currency) || !validBudgetDay(raw.nextDate) ||
    raw.frequency != null && !["weekly", "monthly", "yearly"].includes(String(raw.frequency))) return null;
  const day = typeof raw.dayOfMonth === "number" || typeof raw.dayOfMonth === "string" ? Number(raw.dayOfMonth) : NaN;
  return { kind: raw.kind as AssistantRecurringDraft["kind"], name: text(raw.name)?.slice(0, 120) ?? "Recurrente", amount, currency: raw.currency,
    frequency: raw.frequency === "weekly" || raw.frequency === "yearly" ? raw.frequency : "monthly",
    dayOfMonth: Number.isInteger(day) && day >= 1 && day <= 31 ? day : null, nextDate: raw.nextDate,
    categoryName: text(raw.categoryName), accountName: text(raw.accountName), description: text(raw.description) };
}
export function prepareRecurringProposal(draft: AssistantRecurringDraft, snapshot: WorkspaceSnapshot, today = budgetTodayLima()): RecurringEditorDraft {
  const fold = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
  const accounts = snapshot.accounts.filter(a => !a.isArchived && a.workspaceId === snapshot.workspace.id && a.currencyCode === draft.currency && draft.accountName && fold(a.name) === fold(draft.accountName));
  const kind = draft.kind === "subscription" ? "expense" : "income";
  const categories = snapshot.catalogs.categories.filter(c => c.isActive && (c.kind === kind || c.kind === "both") && draft.categoryName && fold(c.name) === fold(draft.categoryName));
  const base = { name: draft.name, amount: String(draft.amount), currencyCode: draft.currency,
    accountId: accounts.length === 1 ? String(accounts[0].id) : "", categoryId: categories.length === 1 ? String(categories[0].id) : "",
    frequency: draft.frequency, intervalCount: "1", dayOfMonth: draft.dayOfMonth ? String(draft.dayOfMonth) : "", dayOfWeek: "",
    startDate: today, endDate: "", status: "active" as const, remindDaysBefore: "1", description: draft.description ?? "", notes: "" };
  return draft.kind === "subscription" ? { kind: "subscription", value: { ...base, vendorPartyId: "", nextDueDate: draft.nextDate, autoCreateMovement: false } }
    : { kind: "recurring_income", value: { ...base, payerPartyId: "", nextExpectedDate: draft.nextDate, grossAmount: "", deductions: [] } };
}
