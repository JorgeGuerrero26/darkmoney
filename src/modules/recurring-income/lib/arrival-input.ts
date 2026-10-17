import type { AccountSummary, RecurringIncomeSummary } from "../../../types/domain";
import type { ConfirmArrivalInput } from "../../../services/queries/workspace-data";
import { advanceNextExpectedDate } from "./recurring-income-parity";

export type ArrivalInput = Omit<ConfirmArrivalInput, "workspaceId" | "userId">;
const validMoney = (amount: number) => Number.isFinite(amount) && amount > 0 && Number.isSafeInteger(Math.round(amount * 100)) && Math.abs(amount * 100 - Math.round(amount * 100)) <= 1e-6;
function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

/** Rechecked by the page against current data, not just the dialog's original props. */
export function validateArrivalInput(income: RecurringIncomeSummary, accounts: AccountSummary[], input: ArrivalInput) {
  if (income.status !== "active" || input.recurringIncomeId !== income.id || input.expectedDate !== income.nextExpectedDate ||
    input.currencyCode !== income.currencyCode || input.currentBaseAmount !== income.amount || input.currentAccountId !== (income.accountId ?? null) ||
    input.categoryId !== (income.categoryId ?? null) || input.payerPartyId !== (income.payerPartyId ?? null) ||
    input.recurringIncomeName !== income.name || input.description !== (income.description ?? null) || input.nextExpectedDate !== advanceNextExpectedDate(income)) {
    throw new Error("El ingreso o la próxima llegada cambiaron. Cierra y revisa antes de confirmar.");
  }
  if (!validDay(input.actualDate) || !validDay(input.expectedDate) || !validDay(input.nextExpectedDate) || !validMoney(input.amount) || !validMoney(input.currentBaseAmount) ||
    (input.newBaseAmount !== null && (!validMoney(input.newBaseAmount) || input.newBaseAmount !== input.amount))) {
    throw new Error("Revisa la fecha real y el monto recibido (máximo dos decimales).");
  }
  if (!Number.isSafeInteger(input.accountId) || input.accountId <= 0 || !accounts.some(account => account.id === input.accountId && account.workspaceId === income.workspaceId && !account.isArchived && account.currencyCode === income.currencyCode)) {
    throw new Error(`Elige una cuenta activa de este espacio en ${income.currencyCode}.`);
  }
  return input;
}
