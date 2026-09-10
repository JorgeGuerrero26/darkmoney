import { useEffect, useMemo, useState } from "react";

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
    movementType: movement.actsAsIncome ? "income" : "expense",
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
    () => input.movements.map((movement) => movementRecordToInsight(movement, input.currencyCode)),
    [input.currencyCode, input.movements],
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
      suggestRecurringLocally({
        current,
        history,
        subscriptions: input.subscriptions,
        recurringIncome: input.recurringIncome,
      }),
    [current, history, input.recurringIncome, input.subscriptions],
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
  const [remote, setRemote] = useState<Omit<MovementInsights, "isLoading">>({
    budget: null,
    recurring: null,
    risk: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const requestKey = useMemo(
    () =>
      JSON.stringify({
        workspaceId: input.workspaceId,
        movement: movementPayload(current),
        localRecurring,
        localRisk,
        localBudget,
      }),
    [current, input.workspaceId, localBudget, localRecurring, localRisk],
  );

  useEffect(() => {
    if (
      !input.enabled ||
      !input.proAccessEnabled ||
      current.amount <= 0 ||
      current.description.length < 3 ||
      current.movementType === "transfer"
    ) {
      setRemote({ budget: null, recurring: null, risk: null });
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setRemote({ budget: null, recurring: null, risk: null });
    setIsLoading(false);
    const timer = window.setTimeout(() => {
      const recentMovements = history
        .filter((movement) => movement.id !== current.id)
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .slice(0, 30);
      const recurringKey = `recurring:${requestKey}`;
      const riskKey = `risk:${requestKey}`;
      const budgetKey = `budget:${requestKey}`;
      const recurringPromise = !localRecurring || localRecurring.confidence < 0.7
        ? recurringCache.has(recurringKey)
          ? Promise.resolve(recurringCache.get(recurringKey) ?? null)
          : requestRecurringInsight({
              workspaceId: input.workspaceId,
              movementType: current.actsAsIncome ? "income" : "expense",
              description: current.description,
              amount: current.amount,
              currencyCode: current.currencyCode,
              occurredAt: current.occurredAt,
              category: input.category,
              counterparty: input.counterparty,
              recentMovements: recentMovements.map(movementPayload),
              subscriptions: input.subscriptions
                .filter((item) => item.status === "active")
                .map(({ id, name, amount, currencyCode, frequency, intervalCount, vendorPartyId, categoryId }) => ({
                  id, name, amount, currencyCode, frequency, intervalCount, vendorPartyId, categoryId,
                })),
              recurringIncome: input.recurringIncome
                .filter((item) => item.status === "active")
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
        ? recentMovements.filter((movement) => localRisk.relatedMovementIds.includes(movement.id))
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
        setRemote({
          recurring: results[0].status === "fulfilled" ? results[0].value : null,
          risk: results[1].status === "fulfilled" ? results[1].value : null,
          budget: results[2].status === "fulfilled" ? results[2].value : null,
        });
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
    recurring: remote.recurring ?? localRecurring,
    risk: remote.risk ?? localRisk,
    budget: remote.budget ?? localBudget,
    isLoading,
  };
}
