import type {
  BudgetOverview,
  ExchangeRateSummary,
  MovementRecord,
} from "../../../types/domain";

/**
 * Gasto consumido de un presupuesto, calculado en cliente.
 *
 * La vista SQL `v_budget_progress` ya devuelve `spent_amount`, pero difiere de
 * la app movil en dos puntos que cambian el numero:
 *
 * 1. La vista solo mira `movement_type in (expense, subscription_payment,
 *    obligation_payment)`. La app decide por montos, asi que un `adjustment` o
 *    una apertura de obligacion que sacan dinero tambien consumen presupuesto.
 * 2. La vista convierte con tasa directa o inversa; si no hay, usa el monto sin
 *    convertir. La app ademas puentea por la moneda base del workspace.
 *
 * Este modulo espeja lib/budget-metrics.ts de la app para que ambos clientes
 * muestren lo mismo. Igual que alli, los valores de la vista se sobrescriben.
 */

export type BudgetContribution = {
  movementId: number;
  occurredAt: string;
  movementType: string;
  description: string;
  categoryName: string | null;
  accountName: string | null;
  nativeAmount: number;
  nativeCurrencyCode: string;
  amountInBudgetCurrency: number;
  shareOfBudget: number;
  shareOfSpent: number;
};

export type BudgetComputedMetrics = {
  spentAmount: number;
  remainingAmount: number;
  usedPercent: number;
  movementCount: number;
  contributions: BudgetContribution[];
  averageMovementAmount: number;
  maxMovementAmount: number;
};

export type BudgetMetricsContext = {
  workspaceBaseCurrencyCode: string;
  exchangeRates: ExchangeRateSummary[];
};

type ExpenseSide = {
  amount: number;
  currencyCode: string;
  accountId: number | null;
  accountName: string | null;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeCurrency(code: string | null | undefined, fallback: string) {
  const normalized = code?.trim().toUpperCase();

  return normalized && normalized.length > 0 ? normalized : fallback.trim().toUpperCase();
}

function buildRateMap(rates: ExchangeRateSummary[]) {
  const map = new Map<string, number>();

  for (const rate of rates) {
    const from = rate.fromCurrencyCode.trim().toUpperCase();
    const to = rate.toCurrencyCode.trim().toUpperCase();

    if (!from || !to || !Number.isFinite(rate.rate) || rate.rate <= 0) {
      continue;
    }

    const key = `${from}:${to}`;

    if (!map.has(key)) {
      map.set(key, rate.rate);
    }
  }

  return map;
}

/** Directa, inversa o puente por la moneda base del workspace. */
function resolveRate(
  rateMap: Map<string, number>,
  fromCurrencyCode: string,
  toCurrencyCode: string,
  workspaceBaseCurrencyCode: string,
): number | null {
  const from = fromCurrencyCode.trim().toUpperCase();
  const to = toCurrencyCode.trim().toUpperCase();
  const base = workspaceBaseCurrencyCode.trim().toUpperCase();

  if (!from || !to) {
    return null;
  }

  if (from === to) {
    return 1;
  }

  const direct = rateMap.get(`${from}:${to}`);

  if (direct) {
    return direct;
  }

  const inverse = rateMap.get(`${to}:${from}`);

  if (inverse) {
    return 1 / inverse;
  }

  if (from !== base && to !== base) {
    const toBase = resolveRate(rateMap, from, base, base);
    const baseToTarget = resolveRate(rateMap, base, to, base);

    if (toBase && baseToTarget) {
      return toBase * baseToTarget;
    }
  }

  return null;
}

function convertAmount(
  amount: number,
  fromCurrencyCode: string,
  toCurrencyCode: string,
  rateMap: Map<string, number>,
  workspaceBaseCurrencyCode: string,
) {
  const rate = resolveRate(rateMap, fromCurrencyCode, toCurrencyCode, workspaceBaseCurrencyCode);

  // Sin tasa se usa el monto crudo, igual que la vista SQL y que la app.
  return rate ? amount * rate : amount;
}

function movementIsTransfer(movement: MovementRecord) {
  return movement.movementType === "transfer";
}

/** Espeja movementActsAsIncome de la app: por tipo cuando es inequivoco, por montos si no. */
function movementActsAsIncome(movement: MovementRecord) {
  if (movement.movementType === "income" || movement.movementType === "refund") {
    return true;
  }

  if (
    movement.movementType === "expense" ||
    movement.movementType === "subscription_payment"
  ) {
    return false;
  }

  if (movementIsTransfer(movement)) {
    return false;
  }

  return (movement.destinationAmount ?? 0) > (movement.sourceAmount ?? 0);
}

function movementActsAsExpense(movement: MovementRecord) {
  return movementIsTransfer(movement) ? false : !movementActsAsIncome(movement);
}

function readExpenseSide(
  movement: MovementRecord,
  workspaceBaseCurrencyCode: string,
): ExpenseSide | null {
  if (!movementActsAsExpense(movement)) {
    return null;
  }

  const rawAmount = Math.abs(Number(movement.sourceAmount ?? movement.destinationAmount ?? 0));

  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return null;
  }

  return {
    amount: rawAmount,
    currencyCode: normalizeCurrency(
      movement.sourceCurrencyCode ?? movement.destinationCurrencyCode,
      workspaceBaseCurrencyCode,
    ),
    accountId: movement.sourceAccountId ?? movement.destinationAccountId ?? null,
    accountName: movement.sourceAccountName ?? movement.destinationAccountName ?? null,
  };
}

function movementMatchesBudget(
  budget: BudgetOverview,
  movement: MovementRecord,
  expenseSide: ExpenseSide,
) {
  const occurredOn = movement.occurredAt.slice(0, 10);

  if (occurredOn < budget.periodStart || occurredOn > budget.periodEnd) {
    return false;
  }

  if (budget.categoryId != null && movement.categoryId !== budget.categoryId) {
    return false;
  }

  if (budget.accountId != null && expenseSide.accountId !== budget.accountId) {
    return false;
  }

  return true;
}

export function buildBudgetComputedMetrics(
  budget: BudgetOverview,
  movements: MovementRecord[],
  context: BudgetMetricsContext,
): BudgetComputedMetrics {
  const rateMap = buildRateMap(context.exchangeRates);
  const budgetCurrencyCode = normalizeCurrency(
    budget.currencyCode,
    context.workspaceBaseCurrencyCode,
  );
  const rawContributions: BudgetContribution[] = [];

  for (const movement of movements) {
    if (movement.status !== "posted") {
      continue;
    }

    const expenseSide = readExpenseSide(movement, context.workspaceBaseCurrencyCode);

    if (!expenseSide || !movementMatchesBudget(budget, movement, expenseSide)) {
      continue;
    }

    const converted = convertAmount(
      expenseSide.amount,
      expenseSide.currencyCode,
      budgetCurrencyCode,
      rateMap,
      context.workspaceBaseCurrencyCode,
    );

    rawContributions.push({
      movementId: movement.id,
      occurredAt: movement.occurredAt,
      movementType: movement.movementType,
      description: movement.description?.trim() || "Sin descripcion",
      categoryName: movement.categoryId ? movement.category : null,
      accountName: expenseSide.accountName,
      nativeAmount: round2(expenseSide.amount),
      nativeCurrencyCode: expenseSide.currencyCode,
      amountInBudgetCurrency: round2(converted),
      shareOfBudget: 0,
      shareOfSpent: 0,
    });
  }

  rawContributions.sort(
    (left, right) =>
      right.occurredAt.localeCompare(left.occurredAt) ||
      right.amountInBudgetCurrency - left.amountInBudgetCurrency ||
      right.movementId - left.movementId,
  );

  const spentAmount = round2(
    rawContributions.reduce((sum, contribution) => sum + contribution.amountInBudgetCurrency, 0),
  );
  const remainingAmount = round2(budget.limitAmount - spentAmount);
  const usedPercent = budget.limitAmount > 0 ? round2((spentAmount / budget.limitAmount) * 100) : 0;
  const movementCount = rawContributions.length;
  const averageMovementAmount =
    movementCount > 0 ? round2(spentAmount / movementCount) : 0;
  const maxMovementAmount = round2(
    rawContributions.reduce(
      (max, contribution) => Math.max(max, contribution.amountInBudgetCurrency),
      0,
    ),
  );

  const contributions = rawContributions.map((contribution) => ({
    ...contribution,
    shareOfBudget:
      budget.limitAmount > 0
        ? round2((contribution.amountInBudgetCurrency / budget.limitAmount) * 100)
        : 0,
    shareOfSpent:
      spentAmount > 0 ? round2((contribution.amountInBudgetCurrency / spentAmount) * 100) : 0,
  }));

  return {
    spentAmount,
    remainingAmount,
    usedPercent,
    movementCount,
    contributions,
    averageMovementAmount,
    maxMovementAmount,
  };
}

export function applyBudgetComputedMetrics(
  budget: BudgetOverview,
  metrics: BudgetComputedMetrics,
): BudgetOverview {
  const isOverLimit = metrics.usedPercent >= 100;
  const isNearLimit =
    !isOverLimit && budget.alertPercent > 0 && metrics.usedPercent >= budget.alertPercent;

  return {
    ...budget,
    spentAmount: metrics.spentAmount,
    remainingAmount: metrics.remainingAmount,
    usedPercent: metrics.usedPercent,
    movementCount: metrics.movementCount,
    isNearLimit,
    isOverLimit,
  };
}

export function buildBudgetMetricsMap(
  budgets: BudgetOverview[],
  movements: MovementRecord[],
  context: BudgetMetricsContext,
) {
  const map = new Map<number, BudgetComputedMetrics>();

  for (const budget of budgets) {
    map.set(budget.id, buildBudgetComputedMetrics(budget, movements, context));
  }

  return map;
}
