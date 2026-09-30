import { useEffect, useMemo, useState } from "react";

import type {
  AccountSummary,
  CategorySummary,
  CounterpartySummary,
  MovementRecord,
  MovementType,
} from "../../../types/domain";
import {
  requestCategorySuggestion,
  requestCounterpartySuggestion,
  requestDescriptionSuggestion,
  type CategorySuggestion,
  type CounterpartySuggestion,
  type DescriptionSuggestion,
} from "../../../services/queries/movement-ai";
import {
  suggestAccountLocally,
  suggestCategoryLocally,
  suggestCounterpartyLocally,
  suggestDescriptionCleanupLocally,
} from "../lib/movement-suggestions";
import type { AccountSuggestion } from "../lib/movement-suggestions";
import { LOCAL_CATEGORY_AI_CONFIDENCE_THRESHOLD } from "../lib/local-category-suggestion";
import { useMovementLearningQuery } from "../../../services/queries/movement-learning";

type MovementSuggestions = {
  account: AccountSuggestion | null;
  aiUnavailable: boolean;
  learningUnavailable: boolean;
  category: CategorySuggestion | null;
  counterparty: CounterpartySuggestion | null;
  description: DescriptionSuggestion | null;
  isLoading: boolean;
};

type RemoteMovementSuggestions = Pick<MovementSuggestions, "category" | "counterparty" | "description">;

const categoryCache = new Map<string, CategorySuggestion | null>();
const counterpartyCache = new Map<string, CounterpartySuggestion | null>();
const descriptionCache = new Map<string, DescriptionSuggestion | null>();

export function useMovementSuggestions(input: {
  enabled: boolean;
  workspaceId: number;
  proAccessEnabled?: boolean;
  movementType: MovementType;
  accountId: number | null;
  accounts: AccountSummary[];
  actsAsIncome: boolean;
  amount: number | null;
  currencyCode: string;
  description: string;
  occurredAt: string;
  categoryId: number | null;
  counterpartyId: number | null;
  categories: CategorySummary[];
  counterparties: CounterpartySummary[];
  movements: MovementRecord[];
  editingMovementId?: number;
}): MovementSuggestions {
  const learningQuery = useMovementLearningQuery(input.workspaceId, input.enabled);
  const localAccount = useMemo(
    () =>
      suggestAccountLocally({
        accountId: input.accountId,
        accounts: input.accounts,
        actsAsIncome: input.actsAsIncome,
        counterpartyId: input.counterpartyId,
        movements: input.movements,
        excludedMovementId: input.editingMovementId,
      }),
    [
      input.accountId,
      input.accounts,
      input.actsAsIncome,
      input.counterpartyId,
      input.editingMovementId,
      input.movements,
    ],
  );
  const localCategory = useMemo(
    () =>
      input.categoryId === null
        ? suggestCategoryLocally({
            description: input.description,
            counterpartyId: input.counterpartyId,
            movementType: input.movementType,
            categories: input.categories,
            movements: input.movements,
            excludedMovementId: input.editingMovementId,
            accountId: input.accountId,
            amount: input.amount,
            occurredAt: input.occurredAt,
            learningFeedback: learningQuery.data,
          })
        : null,
    [
      input.categories,
      input.accountId,
      input.amount,
      input.occurredAt,
      learningQuery.data,
      input.categoryId,
      input.counterpartyId,
      input.description,
      input.editingMovementId,
      input.movementType,
      input.movements,
    ],
  );
  const localCounterparty = useMemo(
    () =>
      input.counterpartyId === null
        ? suggestCounterpartyLocally({
            description: input.description,
            counterparties: input.counterparties,
            movements: input.movements,
            excludedMovementId: input.editingMovementId,
          })
        : null,
    [input.counterparties, input.counterpartyId, input.description, input.editingMovementId, input.movements],
  );
  const localDescription = useMemo(
    () => suggestDescriptionCleanupLocally(input.description),
    [input.description],
  );
  const [remote, setRemote] = useState<RemoteMovementSuggestions>({
    category: null,
    counterparty: null,
    description: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const requestKey = useMemo(
    () =>
      JSON.stringify({
        workspaceId: input.workspaceId,
        type: input.movementType,
        amount: input.amount,
        currency: input.currencyCode,
        description: input.description.trim().toLocaleLowerCase("es-PE"),
        categoryId: input.categoryId,
        counterpartyId: input.counterpartyId,
      }),
    [
      input.amount,
      input.categoryId,
      input.counterpartyId,
      input.currencyCode,
      input.description,
      input.movementType,
      input.workspaceId,
    ],
  );
  const categoryRequestKey = JSON.stringify({
    requestKey, accountId: input.accountId, occurredOn: input.occurredAt.slice(0, 10),
    categories: input.categories.map(({ id, name, kind, isActive }) => ({ id, name, kind, isActive })),
    localCategory,
  });
  const [resolvedCategoryKey, setResolvedCategoryKey] = useState("");

  useEffect(() => {
    const description = input.description.trim();
    if (!input.enabled || description.length < 3 || input.movementType === "transfer") {
      setRemote({ category: null, counterparty: null, description: null });
      setIsLoading(false);
      setAiUnavailable(false);
      return;
    }

    if (!input.proAccessEnabled) {
      setRemote({ category: null, counterparty: null, description: null });
      setIsLoading(false);
      setAiUnavailable(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      const categoryKey = `category:${categoryRequestKey}`;
      const counterpartyKey = `counterparty:${requestKey}`;
      const descriptionKey = `description:${requestKey}`;
      const categoryPromise =
        input.categoryId === null && (!localCategory || localCategory.confidence < LOCAL_CATEGORY_AI_CONFIDENCE_THRESHOLD)
          ? categoryCache.has(categoryKey)
            ? Promise.resolve(categoryCache.get(categoryKey) ?? null)
            : requestCategorySuggestion({
                workspaceId: input.workspaceId,
                movementType: input.movementType === "income" ? "income" : "expense",
                amount: input.amount,
                currencyCode: input.currencyCode,
                description,
                occurredAt: input.occurredAt,
                categories: input.categories
                  .filter((category) => category.isActive)
                  .map(({ id, name, kind }) => ({ id, name, kind })),
                localSuggestion: localCategory,
              }).then((result) => {
                categoryCache.set(categoryKey, result);
                return result;
              })
          : Promise.resolve(null);
      const counterpartyPromise =
        input.counterpartyId === null && (!localCounterparty || localCounterparty.confidence < 0.7)
          ? counterpartyCache.has(counterpartyKey)
            ? Promise.resolve(counterpartyCache.get(counterpartyKey) ?? null)
            : requestCounterpartySuggestion({
                workspaceId: input.workspaceId,
                movementType: input.movementType === "income" ? "income" : "expense",
                amount: input.amount,
                currencyCode: input.currencyCode,
                description,
                counterparties: input.counterparties
                  .filter((counterparty) => !counterparty.isArchived)
                  .map(({ id, name, type }) => ({ id, name, type })),
                localSuggestion: localCounterparty,
              }).then((result) => {
                counterpartyCache.set(counterpartyKey, result);
                return result;
              })
          : Promise.resolve(null);
      const descriptionPromise =
        !localDescription || localDescription.confidence < 0.7
          ? descriptionCache.has(descriptionKey)
            ? Promise.resolve(descriptionCache.get(descriptionKey) ?? null)
            : requestDescriptionSuggestion({
                workspaceId: input.workspaceId,
                rawDescription: description,
                amount: input.amount,
                currencyCode: input.currencyCode,
                localSuggestion: localDescription,
              }).then((result) => {
                descriptionCache.set(descriptionKey, result);
                return result;
              })
          : Promise.resolve(null);

      setIsLoading(true);
      setAiUnavailable(false);
      void Promise.allSettled([categoryPromise, counterpartyPromise, descriptionPromise]).then((results) => {
        if (cancelled) return;
        setResolvedCategoryKey(categoryRequestKey);
        setRemote({
          category: results[0].status === "fulfilled" ? results[0].value : null,
          counterparty: results[1].status === "fulfilled" ? results[1].value : null,
          description: results[2].status === "fulfilled" ? results[2].value : null,
        });
        setAiUnavailable(results.some((result) => result.status === "rejected"));
        setIsLoading(false);
      });
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    input.amount,
    input.categories,
    input.categoryId,
    input.counterparties,
    input.counterpartyId,
    input.currencyCode,
    input.description,
    input.enabled,
    input.movementType,
    input.occurredAt,
    input.proAccessEnabled,
    input.workspaceId,
    localCategory,
    localCounterparty,
    localDescription,
    requestKey,
    categoryRequestKey,
  ]);

  return {
    account: localAccount,
    aiUnavailable,
    learningUnavailable: learningQuery.isError,
    category: input.categoryId === null
      ? localCategory && localCategory.confidence >= LOCAL_CATEGORY_AI_CONFIDENCE_THRESHOLD
        ? localCategory
        : resolvedCategoryKey === categoryRequestKey ? remote.category ?? localCategory : localCategory
      : null,
    counterparty: input.counterpartyId === null ? remote.counterparty ?? localCounterparty : null,
    description: remote.description ?? localDescription,
    isLoading,
  };
}
