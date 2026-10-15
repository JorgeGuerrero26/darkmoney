import type { AccountSummary, SubscriptionSummary } from "../../../types/domain";

export type SubscriptionPaymentInput = { paidDate: string; amount: number; accountId: number };
export function validateSubscriptionPayment(subscription: SubscriptionSummary, accounts: AccountSummary[], input: SubscriptionPaymentInput): SubscriptionPaymentInput {
  const date = new Date(`${input.paidDate}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.paidDate ||
    !Number.isFinite(input.amount) || input.amount <= 0 || !Number.isSafeInteger(Math.round(input.amount * 100)) || Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 1e-6) throw new Error("Revisa la fecha y el monto del pago.");
  if (subscription.status !== "active") throw new Error("La suscripción debe estar activa para registrar el pago.");
  if (!Number.isSafeInteger(input.accountId) || !accounts.some(account => account.id === input.accountId && account.workspaceId === subscription.workspaceId && !account.isArchived && account.currencyCode === subscription.currencyCode)) throw new Error(`Elige una cuenta activa del espacio en ${subscription.currencyCode}.`);
  return input;
}
