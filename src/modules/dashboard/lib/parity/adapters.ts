/**
 * Adaptadores que transforman el WorkspaceSnapshot de la web a las entradas
 * crudas que consume la capa de paridad (espejo del contrato del móvil).
 *
 * Clave: usa `snapshot.movements` CRUDOS (no pre-convertidos) filtrados a los
 * últimos 90 días en cliente — el mismo universo que la query del móvil — para
 * que readiness/historyDays/duplicados coincidan exactamente.
 */

import type {
  AccountSummary,
  ExchangeRateSummary,
  MovementRecord,
  ObligationSummary,
  RecurringIncomeSummary,
  SubscriptionSummary,
} from "../../../../types/domain";
import { subDays } from "./date-utils";
import type {
  ParityConversionCtx,
  ParityMovement,
  ParityObligation,
  ParityRecurringIncome,
  ParitySubscription,
} from "./types";

/** Mapa "FROM:TO" → rate. Conserva la PRIMERA tasa por par (como el móvil). */
export function buildParityExchangeRateMap(rates: ExchangeRateSummary[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const rate of rates) {
    const key = `${rate.fromCurrencyCode.toUpperCase()}:${rate.toCurrencyCode.toUpperCase()}`;
    if (!map.has(key) && rate.rate > 0) map.set(key, rate.rate);
  }
  return map;
}

export function buildAccountCurrencyMap(accounts: AccountSummary[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const account of accounts) map.set(account.id, account.currencyCode);
  return map;
}

function toParityMovement(movement: MovementRecord): ParityMovement {
  return {
    id: movement.id,
    movementType: movement.movementType,
    status: movement.status,
    occurredAt: movement.occurredAt,
    sourceAmount: movement.sourceAmount,
    destinationAmount: movement.destinationAmount,
    sourceAccountId: movement.sourceAccountId,
    destinationAccountId: movement.destinationAccountId,
    categoryId: movement.categoryId ?? null,
    counterpartyId: movement.counterpartyId ?? null,
    description: movement.description,
  };
}

function toParityObligation(obligation: ObligationSummary): ParityObligation {
  return {
    direction: obligation.direction,
    pendingAmount: obligation.pendingAmount,
    installmentAmount: obligation.installmentAmount ?? null,
    installmentCount: obligation.installmentCount ?? null,
    currencyCode: obligation.currencyCode,
    dueDate: obligation.dueDate,
    lastPaymentDate: obligation.lastPaymentDate ?? null,
    startDate: obligation.startDate,
    status: obligation.status,
  };
}

function toParitySubscription(subscription: SubscriptionSummary): ParitySubscription {
  return {
    amount: subscription.amount,
    currencyCode: subscription.currencyCode,
    nextDueDate: subscription.nextDueDate,
    status: subscription.status,
    accountId: subscription.accountId ?? null,
  };
}

function toParityRecurringIncome(income: RecurringIncomeSummary): ParityRecurringIncome {
  return {
    amount: income.amount,
    currencyCode: income.currencyCode,
    nextExpectedDate: income.nextExpectedDate,
    status: income.status,
  };
}

export type ParityInputs = {
  movements: ParityMovement[];
  obligations: ParityObligation[];
  subscriptions: ParitySubscription[];
  recurringIncome: ParityRecurringIncome[];
};

type ParitySnapshotLike = {
  movements: MovementRecord[];
  obligations: ObligationSummary[];
  subscriptions: SubscriptionSummary[];
  recurringIncome: RecurringIncomeSummary[];
};

/**
 * Construye las entradas de paridad. Los movimientos se acotan a los últimos
 * 90 días (mismo universo que el móvil); las entidades (obligaciones,
 * suscripciones, ingresos fijos) se pasan completas, igual que el móvil.
 */
export function buildParityInputs(snapshot: ParitySnapshotLike, now: Date = new Date()): ParityInputs {
  const since = subDays(now, 90);

  const movements = snapshot.movements
    .filter((movement) => new Date(movement.occurredAt) >= since)
    .map(toParityMovement)
    // Reciente primero (la query del móvil ordena así; readiness depende de ello).
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime() || b.id - a.id,
    );

  return {
    movements,
    obligations: snapshot.obligations.map(toParityObligation),
    subscriptions: snapshot.subscriptions.map(toParitySubscription),
    recurringIncome: snapshot.recurringIncome.map(toParityRecurringIncome),
  };
}

export function buildParityConversionCtx(input: {
  accounts: AccountSummary[];
  exchangeRates: ExchangeRateSummary[];
  displayCurrency: string;
  baseCurrency: string;
}): ParityConversionCtx {
  return {
    accountCurrencyMap: buildAccountCurrencyMap(input.accounts),
    exchangeRateMap: buildParityExchangeRateMap(input.exchangeRates),
    displayCurrency: input.displayCurrency,
    baseCurrency: input.baseCurrency,
  };
}
