import type { CategoryKind, CounterpartyType } from "../../types/domain";
import { invokeAuthenticatedFunction } from "./workspace-data";

export type MovementSuggestionSource = "local" | "deepseek";

export type CategorySuggestion = {
  type: "existing_category" | "new_category";
  categoryId: number | null;
  categoryName: string;
  newCategoryName: string | null;
  confidence: number;
  reasons: string[];
  source: MovementSuggestionSource;
};

export type CounterpartySuggestion = {
  type: "existing_counterparty" | "new_counterparty";
  counterpartyId: number | null;
  counterpartyName: string;
  newCounterpartyName: string | null;
  counterpartyType: CounterpartyType;
  confidence: number;
  reasons: string[];
  source: MovementSuggestionSource;
};

export type DescriptionSuggestion = {
  cleanedDescription: string;
  confidence: number;
  reasons: string[];
  source: MovementSuggestionSource;
};

export type RecurringInsight = {
  type: "subscription" | "recurring_income";
  name: string;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  confidence: number;
  reasons: string[];
  source: MovementSuggestionSource;
};

export type RiskInsight = {
  kind: "duplicate" | "amount_anomaly";
  severity: "low" | "medium" | "high";
  confidence: number;
  title: string;
  explanation: string;
  reasons: string[];
  relatedMovementIds: number[];
  source: MovementSuggestionSource;
};

export type BudgetInsight = {
  budgetId: number;
  budgetName: string;
  currencyCode: string;
  impactAmount: number;
  previousSpentAmount: number;
  projectedSpentAmount: number;
  limitAmount: number;
  previousUsedPercent: number;
  projectedUsedPercent: number;
  overAmount: number;
  severity: "low" | "medium" | "high";
  confidence: number;
  title: string;
  recommendation: string;
  reasons: string[];
  source: MovementSuggestionSource;
};

type CategoryAiResponse = {
  ok: boolean;
  recommendation: {
    type: "existing_category" | "new_category" | "none";
    categoryId: number | null;
    categoryName: string | null;
    newCategoryName: string | null;
    confidence: number;
    reasons: string[];
  } | null;
};

type CounterpartyAiResponse = {
  ok: boolean;
  recommendation: {
    type: "existing_counterparty" | "new_counterparty" | "none";
    counterpartyId: number | null;
    counterpartyName: string | null;
    newCounterpartyName: string | null;
    counterpartyType: CounterpartyType;
    confidence: number;
    reasons: string[];
  } | null;
};

type DescriptionAiResponse = {
  ok: boolean;
  cleanedDescription: string | null;
  confidence: number;
  reasons: string[];
};

export async function requestCategorySuggestion(input: {
  workspaceId: number;
  movementType: "expense" | "income";
  amount: number | null;
  currencyCode: string;
  description: string;
  occurredAt: string;
  categories: Array<{ id: number; name: string; kind: CategoryKind }>;
  localSuggestion: CategorySuggestion | null;
}) {
  const response = await invokeAuthenticatedFunction<CategoryAiResponse>(
    "movement-category-ai-suggestion",
    {
      ...input,
      surface: "movement_form",
      localSuggestion: input.localSuggestion
        ? {
            categoryId: input.localSuggestion.categoryId,
            categoryName: input.localSuggestion.categoryName,
            confidence: input.localSuggestion.confidence,
            reasons: input.localSuggestion.reasons,
          }
        : null,
    },
  );
  const recommendation = response.ok ? response.recommendation : null;
  if (
    !recommendation ||
    recommendation.type === "none" ||
    (recommendation.type === "existing_category" && recommendation.categoryId === null) ||
    !(recommendation.categoryName || recommendation.newCategoryName) ||
    recommendation.confidence < 0.65
  ) {
    return null;
  }
  return {
    type: recommendation.type,
    categoryId: recommendation.categoryId,
    categoryName: recommendation.categoryName ?? recommendation.newCategoryName!,
    newCategoryName: recommendation.newCategoryName,
    confidence: recommendation.confidence,
    reasons: recommendation.reasons,
    source: "deepseek" as const,
  } satisfies CategorySuggestion;
}

export async function requestCounterpartySuggestion(input: {
  workspaceId: number;
  movementType: "expense" | "income";
  amount: number | null;
  currencyCode: string;
  description: string;
  counterparties: Array<{ id: number; name: string; type: CounterpartyType }>;
  localSuggestion: CounterpartySuggestion | null;
}) {
  const response = await invokeAuthenticatedFunction<CounterpartyAiResponse>(
    "movement-counterparty-ai-suggestion",
    {
      ...input,
      surface: "movement_form",
      localSuggestion: input.localSuggestion
        ? {
            type: "existing_counterparty",
            counterpartyId: input.localSuggestion.counterpartyId,
            counterpartyName: input.localSuggestion.counterpartyName,
            newCounterpartyName: input.localSuggestion.newCounterpartyName,
            counterpartyType: input.localSuggestion.counterpartyType,
            confidence: input.localSuggestion.confidence,
            reasons: input.localSuggestion.reasons,
          }
        : null,
    },
  );
  const recommendation = response.ok ? response.recommendation : null;
  if (
    !recommendation ||
    recommendation.type === "none" ||
    (recommendation.type === "existing_counterparty" && recommendation.counterpartyId === null) ||
    !(recommendation.counterpartyName || recommendation.newCounterpartyName) ||
    recommendation.confidence < 0.65
  ) {
    return null;
  }
  return {
    type: recommendation.type,
    counterpartyId: recommendation.counterpartyId,
    counterpartyName: recommendation.counterpartyName ?? recommendation.newCounterpartyName!,
    newCounterpartyName: recommendation.newCounterpartyName,
    counterpartyType: recommendation.counterpartyType,
    confidence: recommendation.confidence,
    reasons: recommendation.reasons,
    source: "deepseek" as const,
  } satisfies CounterpartySuggestion;
}

export async function requestDescriptionSuggestion(input: {
  workspaceId: number;
  rawDescription: string;
  amount: number | null;
  currencyCode: string;
  localSuggestion: DescriptionSuggestion | null;
}) {
  const response = await invokeAuthenticatedFunction<DescriptionAiResponse>(
    "movement-description-ai-cleanup",
    {
      workspaceId: input.workspaceId,
      surface: "movement_form",
      rawDescription: input.rawDescription,
      amount: input.amount,
      currencyCode: input.currencyCode,
      localCleanup: input.localSuggestion
        ? {
            cleanedDescription: input.localSuggestion.cleanedDescription,
            confidence: input.localSuggestion.confidence,
            reasons: input.localSuggestion.reasons,
          }
        : null,
    },
  );
  if (
    !response.ok ||
    !response.cleanedDescription ||
    response.confidence < 0.65 ||
    response.cleanedDescription.trim().toLocaleLowerCase("es-PE") ===
      input.rawDescription.trim().toLocaleLowerCase("es-PE")
  ) {
    return null;
  }
  return {
    cleanedDescription: response.cleanedDescription,
    confidence: response.confidence,
    reasons: response.reasons,
    source: "deepseek" as const,
  } satisfies DescriptionSuggestion;
}

export async function requestRecurringInsight(input: Record<string, unknown>) {
  const response = await invokeAuthenticatedFunction<{
    ok: boolean;
    recommendation: {
      type: "subscription" | "recurring_income" | "none";
      name: string | null;
      frequency: RecurringInsight["frequency"] | null;
      confidence: number;
      reasons: string[];
    } | null;
  }>("movement-recurring-ai-suggestion", { ...input, surface: "movement_form" });
  const recommendation = response.ok ? response.recommendation : null;
  if (
    !recommendation ||
    recommendation.type === "none" ||
    !recommendation.name ||
    !recommendation.frequency ||
    recommendation.confidence < 0.65
  ) {
    return null;
  }
  return {
    type: recommendation.type,
    name: recommendation.name,
    frequency: recommendation.frequency,
    confidence: recommendation.confidence,
    reasons: recommendation.reasons,
    source: "deepseek" as const,
  } satisfies RecurringInsight;
}

export async function requestRiskInsight(input: Record<string, unknown>) {
  const response = await invokeAuthenticatedFunction<{
    ok: boolean;
    explanation: Omit<RiskInsight, "source"> | null;
  }>("movement-risk-ai-explanation", { ...input, surface: "movement_form" });
  if (!response.ok || !response.explanation || response.explanation.confidence < 0.65) return null;
  return { ...response.explanation, source: "deepseek" as const } satisfies RiskInsight;
}

export async function requestBudgetInsight(input: Record<string, unknown>, local: BudgetInsight) {
  const response = await invokeAuthenticatedFunction<{
    ok: boolean;
    recommendation: {
      budgetId: number;
      budgetName: string;
      severity: BudgetInsight["severity"];
      confidence: number;
      title: string;
      recommendation: string;
      reasons: string[];
    } | null;
  }>("movement-budget-ai-recommendation", { ...input, surface: "movement_form" });
  if (!response.ok || !response.recommendation || response.recommendation.confidence < 0.65) return null;
  return {
    ...local,
    ...response.recommendation,
    source: "deepseek" as const,
  } satisfies BudgetInsight;
}
