import { resolveCommonCurrencyCode } from "../../../lib/formatting/money";
import type { MovementRecord } from "../../../types/domain";
import type { AggregateAmountDisplayItem, PeriodTotals } from "./dashboard-types";

export function resolveAggregateAmountDisplay(
  items: AggregateAmountDisplayItem[],
  baseCurrencyCode: string,
) {
  const normalizedBaseCurrency = baseCurrencyCode.trim().toUpperCase();
  const currencyCode = resolveCommonCurrencyCode(
    items.map((item) => item.currencyCode),
    normalizedBaseCurrency,
  );

  const amount = items.reduce((total, item) => {
    const normalizedItemCurrency = item.currencyCode.trim().toUpperCase();

    if (currencyCode === normalizedBaseCurrency && normalizedItemCurrency !== normalizedBaseCurrency) {
      return total + (item.amountInBaseCurrency ?? item.amount);
    }

    return total + item.amount;
  }, 0);

  return {
    amount,
    currencyCode,
  };
}

export function getIncomeAmount(movement: MovementRecord) {
  return Math.max(
    0,
    movement.destinationAmountInBaseCurrency ??
      movement.destinationAmount ??
      movement.sourceAmountInBaseCurrency ??
      movement.sourceAmount ??
      0,
  );
}

export function getExpenseAmount(movement: MovementRecord) {
  return Math.max(
    0,
    movement.sourceAmountInBaseCurrency ??
      movement.sourceAmount ??
      movement.destinationAmountInBaseCurrency ??
      movement.destinationAmount ??
      0,
  );
}

export function getTransferLineAmount(movement: MovementRecord) {
  return Math.max(
    0,
    movement.sourceAmountInBaseCurrency ??
      movement.sourceAmount ??
      movement.destinationAmountInBaseCurrency ??
      movement.destinationAmount ??
      0,
  );
}

export function classifyMovement(
  movement: MovementRecord,
): { kind: "income" | "expense"; amount: number } | null {
  if (movement.status !== "posted") {
    return null;
  }

  if (movement.movementType === "income" || movement.movementType === "refund") {
    return { kind: "income", amount: getIncomeAmount(movement) };
  }

  if (
    movement.movementType === "expense" ||
    movement.movementType === "subscription_payment" ||
    movement.movementType === "obligation_payment"
  ) {
    return { kind: "expense", amount: getExpenseAmount(movement) };
  }

  if (movement.movementType === "adjustment") {
    const incoming = getIncomeAmount(movement);
    const outgoing = getExpenseAmount(movement);

    if (incoming === outgoing) {
      return null;
    }

    return incoming > outgoing
      ? { kind: "income", amount: incoming }
      : { kind: "expense", amount: outgoing };
  }

  return null;
}

export function pickExpenseDailyAmount(movement: MovementRecord): number | null {
  const classified = classifyMovement(movement);

  return classified?.kind === "expense" ? classified.amount : null;
}

export function pickIncomeDailyAmount(movement: MovementRecord): number | null {
  const classified = classifyMovement(movement);

  return classified?.kind === "income" ? classified.amount : null;
}

export function pickTransferDailyAmount(movement: MovementRecord): number | null {
  if (movement.status !== "posted" || movement.movementType !== "transfer") {
    return null;
  }

  const amount = getTransferLineAmount(movement);

  return amount > 0 ? amount : null;
}

export function classifyScheduledMovement(
  movement: MovementRecord,
): { kind: "income" | "expense"; amount: number } | null {
  if (movement.status === "voided" || movement.status === "posted") {
    return null;
  }

  if (movement.movementType === "income" || movement.movementType === "refund") {
    return { kind: "income", amount: getIncomeAmount(movement) };
  }

  if (
    movement.movementType === "expense" ||
    movement.movementType === "subscription_payment" ||
    movement.movementType === "obligation_payment"
  ) {
    return { kind: "expense", amount: getExpenseAmount(movement) };
  }

  if (movement.movementType === "adjustment") {
    const incoming = getIncomeAmount(movement);
    const outgoing = getExpenseAmount(movement);

    if (incoming === outgoing) {
      return null;
    }

    return incoming > outgoing
      ? { kind: "income", amount: incoming }
      : { kind: "expense", amount: outgoing };
  }

  return null;
}

export function buildPeriodTotals(movements: MovementRecord[]) {
  return movements.reduce<PeriodTotals>(
    (totals, movement) => {
      const classified = classifyMovement(movement);

      if (!classified) {
        return totals;
      }

      totals.movementCount += 1;

      if (classified.kind === "income") {
        totals.income += classified.amount;
      } else {
        totals.expense += classified.amount;
      }

      totals.net = totals.income - totals.expense;
      return totals;
    },
    { income: 0, expense: 0, net: 0, movementCount: 0 },
  );
}
