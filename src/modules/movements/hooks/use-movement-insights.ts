import { useEffect, useMemo, useState } from "react";
import { recentPatternMovements } from "../lib/movement-suggestions";

import {
  requestBudgetInsight,
  requestRecurringInsight,
  requestRiskInsight,
  type BudgetInsight,
  type RecurringInsight,
  type RiskInsight,
} from "../../../services/queries/movement-ai";
import type {
  BudgetOverview,
  ExchangeRateSummary,
  MovementRecord,
  MovementType,
  RecurringIncomeSummary,
  SubscriptionSummary,
} from "../../../types/domain";
import {
  analyzeBudgetLocally,
  analyzeRiskLocally,
  movementRecordToInsight,
  suggestRecurringLocally,
  type InsightMovement,
} from "../lib/movement-insights";

type NamedEntity = { id: number; name: string } | null;

type MovementInsights = {
  aiUnavailable: boolean;
  budget: BudgetInsight | null;
  isLoading: boolean;
  recurring: RecurringInsight | null;
  risk: RiskInsight | null;
};

const recurringCache = new Map<string, RecurringInsight | null>();
const riskCache = new Map<string, RiskInsight | null>();
const budgetCache = new Map<string, BudgetInsight | null>();

function movementPayload(movement: InsightMovement) {
  return {
    id: movement.id,
    movementType: movement.movementType,
    occurredAt: movement.occurredAt,
    description: movement.description,
    amount: movement.amount,
    currencyCode: movement.currencyCode,
    categoryId: movement.categoryId,
    categoryName: movement.categoryName,
    counterpartyId: movement.counterpartyId,
    counterpartyName: movement.counterpartyName,
    accountId: movement.accountId,
    accountName: movement.accountName,
  };
}

export function useMovementInsights(input: {
  account: NamedEntity;
  actsAsIncome: boolean;
  amount: number;
  baseCurrencyCode: string;
  budgets: BudgetOverview[];
  category: NamedEntity;
  counterparty: NamedEntity;
  currencyCode: string;
  description: string;
  cleanedDescription?: string;
  editingMovementId?: number;
  enabled: boolean;
  exchangeRates: ExchangeRateSummary[];
  movementType: MovementType;
  movements: MovementRecord[];
  occurredAt: string;
  proAccessEnabled?: boolean;
  recurringIncome: RecurringIncomeSummary[];
  subscriptions: SubscriptionSummary[];
  workspaceId: number;
}): MovementInsights {
  const history = useMemo(
    () => recentPatternMovements(input.movements, input.editingMovementId)
      .map((movement) => movementRecordToInsight(movement, input.currencyCode)),
    [input.currencyCode, input.movements, input.editingMovementId],
  );
  const current = useMemo<InsightMovement>(
    () => ({
      id: input.editingMovementId ?? -1,
      movementType: input.movementType,
      actsAsIncome: input.actsAsIncome,
      occurredAt: input.occurredAt,
      description: input.description.trim(),
      amount: Number.isFinite(input.amount) ? Math.abs(input.amount) : 0,
      currencyCode: input.currencyCode,
      categoryId: input.category?.id ?? null,
      categoryName: input.category?.name ?? null,
      counterpartyId: input.counterparty?.id ?? null,
      counterpartyName: input.counterparty?.name ?? null,
      accountId: input.account?.id ?? null,
      accountName: input.account?.name ?? null,
    }),
    [
      input.account,
      input.actsAsIncome,
      input.amount,
      input.category,
      input.counterparty,
      input.currencyCode,
      input.description,
      input.editingMovementId,
      input.movementType,
      input.occurredAt,
    ],
  );
  const localRecurring = useMemo(
    () =>
      input.editingMovementId === undefined ? suggestRecurringLocally({
        current: { ...current, description: input.cleanedDescription ?? current.description },
        history,
        subscriptions: input.subscriptions,
        recurringIncome: input.recurringIncome,
      }) : null,
    [current, history, input.cleanedDescription, input.editingMovementId, input.recurringIncome, input.subscriptions],
  );
  const localRisk = useMemo(() => analyzeRiskLocally(current, history), [current, history]);
  const localBudget = useMemo(
    () => analyzeBudgetLocally({
      current,
      budgets: input.budgets,
      exchangeRates: input.exchangeRates,
      workspaceBaseCurrencyCode: input.baseCurrencyCode,
    }),
    [current, input.baseCurrencyCode, input.budgets, input.exchangeRates],
  );
  const [remote, setRemote] = useState<Omit<MovementInsights, "isLoading" | "aiUnavailable">>({
    budget: null,
    recurring: null,
    risk: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [resolvedRequestKey, setResolvedRequestKey] = useState("");
  const requestKey = useMemo(
    () =>
      JSON.stringify({
        workspaceId: input.workspaceId,
        movement: movementPayload(current),
        cleanedDescription: input.cleanedDescription,
        localRecurring,
        localRisk,
        localBudget,
      }),
    [current, input.cleanedDescription, input.workspaceId, localBudget, localRecurring, localRisk],
  );

  useEffect(() => {
    if (
      !input.enabled ||
      !input.proAccessEnabled ||
      current.movementType === "transfer"
    ) {
      setRemote({ budget: null, recurring: null, risk: null });
      setIsLoading(false);
      setAiUnavailable(false);
      return;
    }

    let cancelled = false;
    setRemote({ budget: null, recurring: null, risk: null });
    setIsLoading(false);
    setAiUnavailable(false);
    const timer = window.setTimeout(() => {
      const recentMovements = history
        .filter((movement) => movement.id !== current.id)
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .slice(0, 30);
      const recurringKey = `recurring:${requestKey}`;
      const riskKey = `risk:${requestKey}`;
      const budgetKey = `budget:${requestKey}`;
      const recurringPromise = input.editingMovementId === undefined &&
        (current.movementType === "expense" || current.movementType === "income") &&
        Boolean((input.cleanedDescription ?? current.description).trim()) &&
        (!localRecurring || localRecurring.confidence < 0.7)
        ? recurringCache.has(recurringKey)
          ? Promise.resolve(recurringCache.get(recurringKey) ?? null)
          : requestRecurringInsight({
              workspaceId: input.workspaceId,
              movementType: current.actsAsIncome ? "income" : "expense",
              description: input.cleanedDescription ?? current.description,
              amount: current.amount,
              currencyCode: current.currencyCode,
              occurredAt: current.occurredAt,
              category: input.category,
              counterparty: input.counterparty,
              recentMovements: recentMovements.map(movementPayload),
              subscriptions: input.subscriptions
                .filter((item) => item.status === "active")
                .slice(0, 40)
                .map(({ id, name, amount, currencyCode, frequency, intervalCount, vendorPartyId, categoryId }) => ({
                  id, name, amount, currencyCode, frequency, intervalCount, vendorPartyId, categoryId,
                })),
              recurringIncome: input.recurringIncome
                .filter((item) => item.status === "active")
                .slice(0, 40)
                .map(({ id, name, amount, currencyCode, frequency, intervalCount, payerPartyId, categoryId }) => ({
                  id, name, amount, currencyCode, frequency, intervalCount, payerPartyId, categoryId,
                })),
              localSuggestion: localRecurring,
            }).then((result) => {
              recurringCache.set(recurringKey, result);
              return result;
            })
        : Promise.resolve(null);
      const relatedMovements = localRisk
        ? history.filter((movement) => localRisk.relatedMovementIds.includes(movement.id)).slice(0, 5)
        : [];
      const riskPromise = localRisk && relatedMovements.length > 0
        ? riskCache.has(riskKey)
          ? Promise.resolve(riskCache.get(riskKey) ?? null)
          : requestRiskInsight({
              workspaceId: input.workspaceId,
              currentMovement: movementPayload(current),
              relatedMovements: relatedMovements.map(movementPayload),
              localRisk: {
                kind: localRisk.kind,
                severity: localRisk.severity,
                confidence: localRisk.confidence,
                title: localRisk.title,
                explanation: localRisk.explanation,
                reasons: localRisk.reasons,
                relatedMovementIds: localRisk.relatedMovementIds,
              },
            }).then((result) => {
              riskCache.set(riskKey, result);
              return result;
            })
        : Promise.resolve(null);
      const budgetPromise = localBudget?.severity === "high"
        ? budgetCache.has(budgetKey)
          ? Promise.resolve(budgetCache.get(budgetKey) ?? null)
          : requestBudgetInsight(
              {
                workspaceId: input.workspaceId,
                movement: movementPayload(current),
                budgetImpact: {
                  budgetId: localBudget.budgetId,
                  budgetName: localBudget.budgetName,
                  currencyCode: localBudget.currencyCode,
                  impactAmount: localBudget.impactAmount,
                  previousSpentAmount: localBudget.previousSpentAmount,
                  projectedSpentAmount: localBudget.projectedSpentAmount,
                  limitAmount: localBudget.limitAmount,
                  previousUsedPercent: localBudget.previousUsedPercent,
                  projectedUsedPercent: localBudget.projectedUsedPercent,
                  overAmount: localBudget.overAmount,
                  severity: localBudget.severity,
                  confidence: localBudget.confidence,
                  reasons: localBudget.reasons,
                },
              },
              localBudget,
            ).then((result) => {
              budgetCache.set(budgetKey, result);
              return result;
            })
        : Promise.resolve(null);

      setIsLoading(true);
      void Promise.allSettled([recurringPromise, riskPromise, budgetPromise]).then((results) => {
        if (cancelled) return;
        setResolvedRequestKey(requestKey);
        setRemote({
          recurring: results[0].status === "fulfilled" ? results[0].value : null,
          risk: results[1].status === "fulfilled" ? results[1].value : null,
          budget: results[2].status === "fulfilled" ? results[2].value : null,
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
    current,
    history,
    input.category,
    input.cleanedDescription,
    input.editingMovementId,
    input.counterparty,
    input.enabled,
    input.proAccessEnabled,
    input.recurringIncome,
    input.subscriptions,
    input.workspaceId,
    localBudget,
    localRecurring,
    localRisk,
    requestKey,
  ]);

  return {
    recurring: input.enabled && input.proAccessEnabled && resolvedRequestKey === requestKey ? remote.recurring ?? localRecurring : localRecurring,
    aiUnavailable,
    risk: input.enabled && input.proAccessEnabled && resolvedRequestKey === requestKey ? remote.risk ?? localRisk : localRisk,
    budget: input.enabled && input.proAccessEnabled && resolvedRequestKey === requestKey ? remote.budget ?? localBudget : localBudget,
    isLoading,
  };
}
