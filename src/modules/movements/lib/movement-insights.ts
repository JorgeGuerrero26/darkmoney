import type {
  BudgetOverview,
  ExchangeRateSummary,
  MovementRecord,
  MovementType,
  RecurringIncomeSummary,
  SubscriptionSummary,
} from "../../../types/domain";
import type { BudgetInsight, RecurringInsight } from "../../../services/queries/movement-ai";
import { movementActsAsIncome } from "./movement-form";
import { suggestRecurringLocally as suggestMobileRecurring } from "./movement-recurring-suggestions";
import { analyzeMovementRiskLocally } from "./movement-risk-analysis";

export type InsightMovement = {
  id: number;
  movementType: MovementType;
  actsAsIncome: boolean;
  occurredAt: string;
  description: string;
  amount: number;
  currencyCode: string;
  categoryId: number | null;
  categoryName: string | null;
  counterpartyId: number | null;
  counterpartyName: string | null;
  accountId: number | null;
  accountName: string | null;
};

export function recurringFrequencyLabel(frequency: RecurringInsight["frequency"]) {
  return {
    weekly: "semanal",
    biweekly: "quincenal",
    monthly: "mensual",
    quarterly: "trimestral",
    yearly: "anual",
  }[frequency];
}

export function recurringFrequencyFields(frequency: RecurringInsight["frequency"]) {
  if (frequency === "biweekly") return { frequency: "weekly" as const, intervalCount: 2 };
  return { frequency, intervalCount: 1 };
}

export function suggestRecurringLocally(input: {
  current: InsightMovement;
  history: InsightMovement[];
  subscriptions: SubscriptionSummary[];
  recurringIncome: RecurringIncomeSummary[];
}): RecurringInsight | null {
  const current = input.current;
  if (current.movementType !== "expense" && current.movementType !== "income") return null;
  const suggestion = suggestMobileRecurring({
    movementType: current.movementType,
    description: current.description,
    amount: current.amount,
    currencyCode: current.currencyCode,
    occurredAt: current.occurredAt,
    category: current.categoryId == null ? null : { id: current.categoryId, name: current.categoryName ?? "" },
    counterparty: current.counterpartyId == null ? null : { id: current.counterpartyId, name: current.counterpartyName ?? "" },
    recentMovements: input.history.filter((item) => item.id !== current.id),
    subscriptions: input.subscriptions,
    recurringIncome: input.recurringIncome,
  });
  if (!suggestion || suggestion.type === "none" || !suggestion.name || !suggestion.frequency) return null;
  return { ...suggestion, type: suggestion.type, name: suggestion.name, frequency: suggestion.frequency };
}

export const analyzeRiskLocally = analyzeMovementRiskLocally;

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function convertedAmount(
  amount: number,
  from: string,
  to: string,
  rates: ExchangeRateSummary[],
  baseCurrencyCode: string,
) {
  const rateMap = new Map<string, number>();
  rates.forEach((rate) => {
    if (rate.rate > 0) rateMap.set(`${rate.fromCurrencyCode}:${rate.toCurrencyCode}`, rate.rate);
  });
  const resolveRate = (source: string, target: string): number | null => {
    if (source === target) return 1;
    const direct = rateMap.get(`${source}:${target}`);
    if (direct) return direct;
    const inverse = rateMap.get(`${target}:${source}`);
    if (inverse) return 1 / inverse;
    if (source !== baseCurrencyCode && target !== baseCurrencyCode) {
      const toBase = resolveRate(source, baseCurrencyCode);
      const baseToTarget = resolveRate(baseCurrencyCode, target);
      if (toBase && baseToTarget) return toBase * baseToTarget;
    }
    return null;
  };
  return round2(amount * (resolveRate(from, to) ?? 1));
}

export function analyzeBudgetLocally(input: {
  current: InsightMovement;
  budgets: BudgetOverview[];
  exchangeRates: ExchangeRateSummary[];
  workspaceBaseCurrencyCode: string;
}): BudgetInsight | null {
  const current = input.current;
  if (current.movementType !== "expense" || current.amount <= 0) return null;
  const date = current.occurredAt.slice(0, 10);
  return input.budgets
    .filter(
      (budget) =>
        budget.isActive &&
        date >= budget.periodStart &&
        date <= budget.periodEnd &&
        (budget.categoryId == null || budget.categoryId === current.categoryId) &&
        (budget.accountId == null || budget.accountId === current.accountId),
    )
    .map((budget) => {
      const impactAmount = convertedAmount(
        current.amount,
        current.currencyCode,
        budget.currencyCode,
        input.exchangeRates,
        input.workspaceBaseCurrencyCode,
      );
      const projectedSpentAmount = round2(budget.spentAmount + impactAmount);
      const projectedUsedPercent = budget.limitAmount > 0 ? (projectedSpentAmount / budget.limitAmount) * 100 : 0;
      const severity: BudgetInsight["severity"] = projectedUsedPercent >= 100 || projectedUsedPercent >= Math.max(90, budget.alertPercent || 90)
        ? "high"
        : projectedUsedPercent >= Math.max(80, budget.alertPercent || 80) ||
            (budget.usedPercent < (budget.alertPercent || 80) && projectedUsedPercent >= (budget.alertPercent || 80))
          ? "medium"
          : "low";
      const overAmount = Math.max(0, projectedSpentAmount - budget.limitAmount);
      return {
        budgetId: budget.id,
        budgetName: budget.name,
        currencyCode: budget.currencyCode,
        impactAmount,
        previousSpentAmount: budget.spentAmount,
        projectedSpentAmount,
        limitAmount: budget.limitAmount,
        previousUsedPercent: budget.usedPercent,
        projectedUsedPercent,
        overAmount,
        severity,
        confidence: severity === "high" ? 0.88 : 0.74,
        title: projectedUsedPercent >= 100
          ? "Presupuesto superado"
          : severity === "high"
            ? "Presupuesto al límite"
            : "Presupuesto sensible",
        recommendation: overAmount > 0
          ? `Superaría “${budget.name}” por ${budget.currencyCode} ${overAmount.toFixed(2)}.`
          : `Dejaría “${budget.name}” al ${Math.round(projectedUsedPercent)}%.`,
        reasons: [budget.categoryName ? `categoría ${budget.categoryName}` : "impacta un presupuesto activo"],
        source: "local" as const,
      };
    })
    .filter((impact) => impact.severity !== "low")
    .sort((left, right) => right.projectedUsedPercent - left.projectedUsedPercent)[0] ?? null;
}

export function movementRecordToInsight(movement: MovementRecord, fallbackCurrency: string): InsightMovement {
  const isIncome = movementActsAsIncome(movement);
  const source = Math.abs(Number(movement.sourceAmount ?? 0));
  const destination = Math.abs(Number(movement.destinationAmount ?? 0));
  const destinationFirst = movement.movementType === "income" || movement.movementType === "refund";
  return {
    id: movement.id,
    movementType: movement.movementType,
    actsAsIncome: isIncome,
    occurredAt: movement.occurredAt,
    description: movement.description,
    amount: destinationFirst ? destination || source : source || destination,
    currencyCode: destinationFirst
      ? movement.destinationCurrencyCode ?? movement.sourceCurrencyCode ?? fallbackCurrency
      : movement.sourceCurrencyCode ?? movement.destinationCurrencyCode ?? fallbackCurrency,
    categoryId: movement.categoryId ?? null,
    categoryName: movement.category || null,
    counterpartyId: movement.counterpartyId ?? null,
    counterpartyName: movement.counterparty || null,
    accountId: movement.destinationAccountId ?? movement.sourceAccountId,
    accountName: movement.destinationAccountName ?? movement.sourceAccountName,
  };
}
