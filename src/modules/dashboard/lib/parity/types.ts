/**
 * PARITY PORT de DarkMoneyApp/features/dashboard/lib/types.ts y dashboard-row.ts.
 * Contrato compartido de cálculo del dashboard — mantener en sincronía.
 */

export type Period = "today" | "week" | "month" | "last_30";

export type ParityConversionCtx = {
  accountCurrencyMap: Map<number, string>;
  exchangeRateMap: Map<string, number>;
  displayCurrency: string;
  baseCurrency: string;
};

/** Espejo de DashboardMovementRow del móvil (campos crudos, sin pre-conversión). */
export type ParityMovement = {
  id: number;
  movementType: string;
  status: string;
  occurredAt: string;
  sourceAmount: number | null;
  destinationAmount: number | null;
  sourceAccountId: number | null;
  destinationAccountId: number | null;
  categoryId: number | null;
  counterpartyId: number | null;
  description: string;
};

export type ParityObligation = {
  direction: string;
  pendingAmount: number;
  installmentAmount?: number | null;
  installmentCount?: number | null;
  currencyCode: string;
  dueDate: string | null;
  lastPaymentDate?: string | null;
  startDate?: string | null;
  status: string;
};

export type ParitySubscription = {
  amount: number;
  currencyCode: string;
  nextDueDate: string;
  status: string;
  accountId?: number | null;
};

export type ParityRecurringIncome = {
  amount: number;
  currencyCode: string;
  nextExpectedDate: string;
  status: string;
};
