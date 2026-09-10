import type {
  BudgetOverview,
  ExchangeRateSummary,
  MovementRecord,
  MovementType,
  RecurringIncomeSummary,
  SubscriptionSummary,
} from "../../../types/domain";
import type { BudgetInsight, RecurringInsight, RiskInsight } from "../../../services/queries/movement-ai";
import { movementActsAsIncome } from "./movement-form";

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

export function normalizeInsightText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textSimilarity(left: string, right: string) {
  const leftTokens = new Set(normalizeInsightText(left).split(" ").filter((token) => token.length >= 3));
  const rightTokens = new Set(normalizeInsightText(right).split(" ").filter((token) => token.length >= 3));
  const union = new Set([...leftTokens, ...rightTokens]);
  if (union.size === 0) return 0;
  let overlap = 0;
  union.forEach((token) => {
    if (leftTokens.has(token) && rightTokens.has(token)) overlap += 1;
  });
  return overlap / union.size;
}

function amountSimilarity(left: number, right: number) {
  if (left <= 0 || right <= 0) return 0;
  const ratio = Math.abs(left - right) / Math.max(left, right);
  if (ratio <= 0.01) return 1;
  if (ratio <= 0.05) return 0.88;
  if (ratio <= 0.1) return 0.7;
  return 0;
}

function daysBetween(left: string, right: string) {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return Number.POSITIVE_INFINITY;
  return Math.abs(leftDate.getTime() - rightDate.getTime()) / 86_400_000;
}

function frequencyFromDays(days: number): RecurringInsight["frequency"] | null {
  if (days >= 6 && days <= 8) return "weekly";
  if (days >= 13 && days <= 16) return "biweekly";
  if (days >= 27 && days <= 33) return "monthly";
  if (days >= 84 && days <= 96) return "quarterly";
  if (days >= 350 && days <= 380) return "yearly";
  return null;
}

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
  if (current.amount <= 0 || current.movementType === "transfer" || !current.description.trim()) return null;
  const isIncome = current.actsAsIncome;
  const existing = (isIncome ? input.recurringIncome : input.subscriptions).some((item) => {
    const partyId = isIncome
      ? (item as RecurringIncomeSummary).payerPartyId
      : (item as SubscriptionSummary).vendorPartyId;
    return (
      item.status === "active" &&
      item.currencyCode === current.currencyCode &&
      amountSimilarity(item.amount, current.amount) >= 0.88 &&
      ((current.counterpartyId != null && partyId === current.counterpartyId) ||
        textSimilarity(item.name, current.description) >= 0.7)
    );
  });
  if (existing) return null;

  const candidates = input.history
    .filter((item) => item.id !== current.id && item.actsAsIncome === isIncome)
    .filter((item) => {
      const sameParty = current.counterpartyId != null && item.counterpartyId === current.counterpartyId;
      const sameCategory = current.categoryId != null && item.categoryId === current.categoryId;
      return amountSimilarity(current.amount, item.amount) >= 0.7 &&
        (sameParty || sameCategory || textSimilarity(current.description, item.description) >= 0.55);
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const frequency = candidates[0]
    ? frequencyFromDays(daysBetween(current.occurredAt, candidates[0].occurredAt))
    : null;
  const normalized = normalizeInsightText(current.description);
  const words = isIncome
    ? ["sueldo", "salario", "nomina", "planilla", "honorarios", "alquiler", "renta"]
    : ["suscripcion", "mensualidad", "membresia", "netflix", "spotify", "disney", "prime", "hosting", "software", "plan"];
  const lexicalHit = words.some((word) => normalized.includes(word));
  if (!frequency && !lexicalHit) return null;
  const resolvedFrequency = frequency ?? "monthly";
  const confidence = Math.min(0.88, 0.42 + (frequency ? 0.22 : 0) + (candidates.length >= 2 ? 0.14 : 0) + (lexicalHit ? 0.1 : 0));
  return {
    type: isIncome ? "recurring_income" : "subscription",
    name: current.counterpartyName || current.description.slice(0, 48),
    frequency: resolvedFrequency,
    confidence,
    reasons: [
      frequency ? `se repite de forma ${recurringFrequencyLabel(resolvedFrequency)}` : null,
      candidates.length >= 2 ? "ya hubo movimientos parecidos" : null,
      lexicalHit ? (isIncome ? "parece un ingreso fijo" : "parece un cargo fijo") : null,
    ].filter((reason): reason is string => Boolean(reason)),
    source: "local",
  };
}

export function analyzeRiskLocally(current: InsightMovement, history: InsightMovement[]): RiskInsight | null {
  if (current.amount <= 0 || current.movementType === "transfer") return null;
  const candidates = history
    .filter((item) => item.id !== current.id && item.movementType === current.movementType)
    .map((item) => {
      const days = daysBetween(current.occurredAt, item.occurredAt);
      const amountScore = amountSimilarity(current.amount, item.amount);
      if (days > 2 || amountScore < 0.7) return null;
      const textScore = textSimilarity(current.description, item.description);
      const sameParty = current.counterpartyId != null && item.counterpartyId === current.counterpartyId;
      const sameAccount = current.accountId != null && item.accountId === current.accountId;
      const sameCategory = current.categoryId != null && item.categoryId === current.categoryId;
      let score = amountScore * 0.42 + Math.max(textScore, sameParty ? 0.75 : 0) * 0.34;
      if (days < 0.75) score += 0.1;
      if (sameAccount) score += 0.06;
      if (sameCategory) score += 0.04;
      if (sameParty) score += 0.08;
      const reasons = [
        days < 0.75 ? "mismo día" : "fecha cercana",
        amountScore >= 0.88 ? "monto casi igual" : null,
        textScore >= 0.55 ? "texto parecido" : null,
        sameAccount ? "misma cuenta" : null,
      ].filter((reason): reason is string => Boolean(reason));
      return { item, score: Math.min(1, score), reasons };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => right.score - left.score);
  const duplicate = candidates[0];
  if (duplicate?.score >= 0.68) {
    return {
      kind: "duplicate",
      severity: duplicate.score >= 0.82 ? "high" : "medium",
      confidence: duplicate.score,
      title: "Podría estar repetido",
      explanation: `Se parece a otro movimiento por ${duplicate.reasons.slice(0, 3).join(", ")}.`,
      reasons: duplicate.reasons,
      relatedMovementIds: candidates.slice(0, 3).map((item) => item.item.id),
      source: "local",
    };
  }

  const comparable = history.filter(
    (item) =>
      item.id !== current.id &&
      item.movementType === current.movementType &&
      ((current.categoryId != null && item.categoryId === current.categoryId) ||
        (current.counterpartyId != null && item.counterpartyId === current.counterpartyId)),
  );
  if (comparable.length < 5) return null;
  const amounts = comparable.map((item) => item.amount).filter((amount) => amount > 0).sort((a, b) => a - b);
  const middle = Math.floor(amounts.length / 2);
  const median = amounts.length % 2 ? amounts[middle] : (amounts[middle - 1] + amounts[middle]) / 2;
  if (!median || current.amount < median * 2.5 || current.amount - median < 10) return null;
  const confidence = Math.min(0.86, 0.56 + Math.min(0.3, (current.amount / median - 2.5) * 0.08));
  return {
    kind: "amount_anomaly",
    severity: confidence >= 0.78 ? "high" : "medium",
    confidence,
    title: "Monto inusual",
    explanation: `Es bastante mayor que tu valor habitual cercano a ${median.toFixed(2)}.`,
    reasons: ["monto fuera de tu patrón"],
    relatedMovementIds: comparable.slice(0, 3).map((item) => item.id),
    source: "local",
  };
}

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
  return {
    id: movement.id,
    movementType: movement.movementType,
    actsAsIncome: isIncome,
    occurredAt: movement.occurredAt,
    description: movement.description,
    amount: isIncome ? movement.destinationAmount ?? 0 : movement.sourceAmount ?? 0,
    currencyCode: isIncome
      ? movement.destinationCurrencyCode ?? fallbackCurrency
      : movement.sourceCurrencyCode ?? fallbackCurrency,
    categoryId: movement.categoryId ?? null,
    categoryName: movement.category || null,
    counterpartyId: movement.counterpartyId ?? null,
    counterpartyName: movement.counterparty || null,
    accountId: isIncome ? movement.destinationAccountId : movement.sourceAccountId,
    accountName: isIncome ? movement.destinationAccountName : movement.sourceAccountName,
  };
}
