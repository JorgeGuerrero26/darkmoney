import type { WorkspaceSnapshot, SubscriptionFormInput, RecurringIncomeFormInput } from "../../services/queries/workspace-data";
import type { SubscriptionFormState } from "../subscriptions/components/subscription-editor-dialog";
import type { RecurringIncomeFormState } from "../recurring-income/components/recurring-income-editor-dialog";
import { collectIncomeScheduledChanges } from "../recurring-income/lib/scheduled-changes";

const optionalNumber = (value: string) => value.trim() ? Number(value.replace(",", ".")) : null;
function integer(value: string, label: string, min: number, max = Number.MAX_SAFE_INTEGER, optional = false) {
  const n = optionalNumber(value);
  if (n === null && optional) return null;
  if (n === null || !Number.isSafeInteger(n) || n < min || n > max) throw new Error(`Revisa ${label}.`);
  return n;
}
function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
type Common = Pick<SubscriptionFormState, "name" | "accountId" | "categoryId" | "currencyCode" | "amount" | "frequency" | "intervalCount" | "dayOfMonth" | "dayOfWeek" | "startDate" | "endDate" | "status" | "remindDaysBefore" | "description" | "notes">;
function common(value: Common, nextDate: string, snapshot: WorkspaceSnapshot, kind: "income" | "expense", isCreate: boolean, party: string) {
  const name = value.name.trim(), amount = optionalNumber(value.amount);
  if (!name || name.length > 120) throw new Error("Indica un nombre de hasta 120 caracteres.");
  if (amount === null || !Number.isFinite(amount) || amount <= 0) throw new Error("El monto debe ser mayor que cero.");
  const currencyCode = value.currencyCode.trim().toUpperCase() || snapshot.workspace.baseCurrencyCode;
  const currencies = new Set([snapshot.workspace.baseCurrencyCode, "PEN", "USD", "EUR", "BRL", "MXN", "CLP", ...snapshot.accounts.map(a => a.currencyCode)]);
  if (!/^[A-Z]{3}$/.test(currencyCode) || !currencies.has(currencyCode)) throw new Error("Revisa la moneda del recurrente.");
  if (!["daily", "weekly", "monthly", "quarterly", "yearly", "custom"].includes(value.frequency)) throw new Error("Revisa la frecuencia.");
  if (!["active", "paused", "cancelled"].includes(value.status)) throw new Error("Revisa el estado.");
  const startDate = kind === "income" ? value.startDate || nextDate : value.startDate;
  if (!validDay(startDate) || !validDay(nextDate) || nextDate < startDate) throw new Error("La próxima fecha debe ser válida y no ser anterior al inicio.");
  if (value.endDate && (!validDay(value.endDate) || value.endDate < startDate)) throw new Error("Revisa la fecha final: no puede ser anterior al inicio.");
  const accountId = integer(value.accountId, "la cuenta", 1, undefined, kind === "expense");
  const account = snapshot.accounts.find(a => a.id === accountId && a.workspaceId === snapshot.workspace.id && (!isCreate || !a.isArchived));
  if (accountId !== null && !account) throw new Error("La cuenta ya no está disponible en este espacio.");
  const categoryId = integer(value.categoryId, "la categoría", 1, undefined, true);
  if (categoryId !== null && !snapshot.catalogs.categories.some(c => c.id === categoryId && (!isCreate || c.isActive) && (c.kind === kind || c.kind === "both"))) throw new Error("La categoría ya no está disponible para este tipo de recurrente.");
  const partyId = integer(party, "la contraparte", 1, undefined, true);
  if (partyId !== null && !snapshot.catalogs.counterparties.some(p => p.id === partyId && (!isCreate || !p.isArchived))) throw new Error("La contraparte ya no está disponible.");
  return { name, amount, currencyCode, frequency: value.frequency, intervalCount: integer(value.intervalCount, "el intervalo", 1)!,
    dayOfMonth: integer(value.dayOfMonth, "el día del mes (1–31)", 1, 31, true), dayOfWeek: integer(value.dayOfWeek, "el día de la semana (0–6)", 0, 6, true),
    startDate, endDate: value.endDate || null, status: value.status, remindDaysBefore: integer(value.remindDaysBefore, "el aviso en días", 0)!,
    accountId, categoryId, description: value.description, notes: value.notes, partyId, account };
}

/** Used by both the module editor and the assistant. Creating a schedule is not confirming a payment/arrival. */
export function buildSubscriptionEditorInput(value: SubscriptionFormState, snapshot: WorkspaceSnapshot, isCreate = true): SubscriptionFormInput {
  const { partyId, account, ...base } = common(value, value.nextDueDate, snapshot, "expense", isCreate, value.vendorPartyId);
  if (value.autoCreateMovement && (!account || account.currencyCode !== base.currencyCode)) throw new Error("El registro automático requiere una cuenta en la misma moneda del cobro.");
  return { ...base, vendorPartyId: partyId, dayOfMonth: ["monthly", "quarterly", "yearly"].includes(value.frequency) ? base.dayOfMonth ?? Number(value.nextDueDate.slice(8, 10)) : null,
    dayOfWeek: value.frequency === "weekly" ? base.dayOfWeek : null, nextDueDate: value.nextDueDate, autoCreateMovement: value.autoCreateMovement };
}
export function buildRecurringIncomeEditorInput(value: RecurringIncomeFormState, snapshot: WorkspaceSnapshot, isCreate = true): RecurringIncomeFormInput {
  const { partyId, account: _account, ...base } = common(value, value.nextExpectedDate, snapshot, "income", isCreate, value.payerPartyId);
  const grossAmount = optionalNumber(value.grossAmount);
  if (grossAmount !== null && (!Number.isFinite(grossAmount) || grossAmount <= 0)) throw new Error("El bruto debe ser mayor que cero, o puedes dejarlo vacío.");
  const deductions = value.deductions.flatMap(row => {
    const amount = optionalNumber(row.amount);
    if (!row.name.trim() || amount === null || amount <= 0) return [];
    if (!Number.isFinite(amount)) throw new Error("Revisa el monto de los descuentos.");
    return [{ name: row.name.trim().slice(0, 60), amount: Number(amount.toFixed(2)) }];
  });
  return { ...base, payerPartyId: partyId, grossAmount, deductions, scheduledChanges: collectIncomeScheduledChanges(value.scheduledChanges), nextExpectedDate: value.nextExpectedDate };
}
