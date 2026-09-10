import type { CategoryKind, CounterpartyType } from "../../types/domain";
import { invokeAuthenticatedFunction } from "./workspace-data";

export type MovementSuggestionSource = "local" | "deepseek";

export type CategorySuggestion = {
  categoryId: number;
  categoryName: string;
  confidence: number;
  reasons: string[];
  source: MovementSuggestionSource;
};

export type CounterpartySuggestion = {
  counterpartyId: number;
  counterpartyName: string;
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

type CategoryAiResponse = {
  ok: boolean;
  recommendation: {
    type: "existing_category" | "new_category" | "none";
    categoryId: number | null;
    categoryName: string | null;
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
    recommendation.type !== "existing_category" ||
    recommendation.categoryId === null ||
    !recommendation.categoryName ||
    recommendation.confidence < 0.65
  ) {
    return null;
  }
  return {
    categoryId: recommendation.categoryId,
    categoryName: recommendation.categoryName,
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
            newCounterpartyName: null,
            confidence: input.localSuggestion.confidence,
            reasons: input.localSuggestion.reasons,
          }
        : null,
    },
  );
  const recommendation = response.ok ? response.recommendation : null;
  if (
    !recommendation ||
    recommendation.type !== "existing_counterparty" ||
    recommendation.counterpartyId === null ||
    !recommendation.counterpartyName ||
    recommendation.confidence < 0.65
  ) {
    return null;
  }
  return {
    counterpartyId: recommendation.counterpartyId,
    counterpartyName: recommendation.counterpartyName,
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
