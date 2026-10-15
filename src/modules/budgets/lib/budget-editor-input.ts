import type { BudgetFormInput, WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import type { BudgetEditorValue } from "../components/budget-editor-dialog";
import { validBudgetDay } from "./budget-date";
import { firstBudgetPeriod, recurrenceOptions } from "./budget-periods";

export function budgetEditorCurrencies(snapshot: WorkspaceSnapshot) {
  return [...new Set([snapshot.workspace.baseCurrencyCode, "PEN", "USD", "EUR", ...snapshot.accounts.map(a => a.currencyCode)])];
}

/** One payload contract for the normal editor and assistant review. */
export function buildBudgetEditorInput(value: BudgetEditorValue, snapshot: WorkspaceSnapshot,
  spendTypes: Array<{ id: number; name: string }>, today: string, isCreate: boolean): BudgetFormInput {
  if (!value.scopeChosen) throw new Error("Elige qué gasto limita este presupuesto. También puedes elegir todo el gasto.");
  const limitAmount = Number(value.limitAmount);
  if (!Number.isFinite(limitAmount) || limitAmount <= 0) throw new Error("Ingresa un límite mayor a cero.");
  if (!validBudgetDay(value.periodStart) || !validBudgetDay(value.periodEnd) || value.periodEnd < value.periodStart) throw new Error("Revisa las fechas del período: el final no puede ser anterior al inicio.");
  if (!recurrenceOptions.some(r => r.value === value.recurrence)) throw new Error("Revisa la renovación del presupuesto.");
  if (!Number.isFinite(value.alertPercent) || value.alertPercent < 1 || value.alertPercent > 100) throw new Error("El aviso debe estar entre 1% y 100%.");
  if (!budgetEditorCurrencies(snapshot).includes(value.currencyCode)) throw new Error("Selecciona una moneda disponible en Opcionales.");
  const category = snapshot.catalogs.categories.find(c => c.id === value.categoryId && c.isActive && (c.kind === "expense" || c.kind === "both"));
  const account = snapshot.accounts.find(a => a.id === value.accountId && !a.isArchived && a.workspaceId === snapshot.workspace.id);
  const spendType = spendTypes.find(s => s.id === value.spendTypeId);
  if (value.categoryId != null && !category) throw new Error("La categoría ya no está disponible para gasto.");
  if (value.accountId != null && !account) throw new Error("La cuenta ya no está disponible en este espacio.");
  if (value.spendTypeId != null && !spendType) throw new Error("El tipo de gasto ya no está disponible.");
  const period = isCreate && value.recurrence !== "none" ? firstBudgetPeriod(today, value.recurrence) : { periodStart: value.periodStart, periodEnd: value.periodEnd };
  const cadence = { none: "entre fechas", monthly: "mensual", weekly: "semanal", biweekly: "quincenal", quarterly: "trimestral", yearly: "anual" }[value.recurrence];
  return { name: value.name.trim() || `${category?.name ?? spendType?.name ?? "Presupuesto"} · ${cadence}`, ...period,
    currencyCode: value.currencyCode, categoryId: value.categoryId, accountId: value.accountId, spendTypeId: value.spendTypeId,
    recurrence: value.recurrence, limitAmount, alertPercent: value.alertPercent, rolloverEnabled: value.rolloverEnabled,
    notes: value.notes.trim() || null, isActive: value.isActive };
}
