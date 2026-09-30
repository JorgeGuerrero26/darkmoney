import type {
  AccountSummary,
  CounterpartySummary,
  MovementRecord,
} from "../../../types/domain";
import type {
  CounterpartySuggestion,
  DescriptionSuggestion,
} from "../../../services/queries/movement-ai";
import { suggestCounterpartyLocally as suggestMobileCounterparty } from "./movement-counterparty-suggestions";
import { cleanupMovementDescriptionLocally, shouldShowDescriptionCleanup } from "./movement-description-cleanup";
export { suggestCategoryLocally } from "./local-category-suggestion";

export type AccountSuggestion = {
  accountId: number;
  accountName: string;
  confidence: number;
  reasons: string[];
};

export function suggestCounterpartyLocally(input: {
  description: string;
  counterparties: CounterpartySummary[];
  movements?: MovementRecord[];
  excludedMovementId?: number;
}): CounterpartySuggestion | null {
  const suggestion = suggestMobileCounterparty(input);
  if (!suggestion || suggestion.type === "none") return null;
  return {
    ...suggestion,
    type: suggestion.type,
    counterpartyName: suggestion.counterpartyName ?? suggestion.newCounterpartyName!,
  };
}

// Mobile loads the latest 300 posted movements before excluding the record being edited.
export function recentPatternMovements(movements: MovementRecord[], excludedMovementId?: number) {
  return movements
    .filter((movement) => movement.status === "posted")
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 300)
    .filter((movement) => movement.id !== excludedMovementId);
}

export function suggestAccountLocally(input: {
  accountId: number | null;
  accounts: AccountSummary[];
  actsAsIncome: boolean;
  movementType?: string;
  counterpartyId: number | null;
  movements: MovementRecord[];
  excludedMovementId?: number;
}): AccountSuggestion | null {
  if (input.movementType === "transfer" || input.counterpartyId === null) return null;
  const scores = new Map<number, number>();
  // Like mobile's pattern maps, account learning includes the edited record and all types.
  for (const movement of recentPatternMovements(input.movements)) {
    if (movement.counterpartyId !== input.counterpartyId) continue;
    const accountId = movement.movementType === "income"
      ? movement.destinationAccountId : movement.sourceAccountId;
    if (!accountId) continue;
    scores.set(accountId, (scores.get(accountId) ?? 0) + 1);
  }
  const best = [...scores.entries()].sort((left, right) => right[1] - left[1])
    .find(([, count]) => count >= 2);
  if (!best || best[0] === input.accountId) return null;
  const account = input.accounts.find((account) => account.id === best[0] && !account.isArchived);
  if (!account) return null;
  return {
    accountId: account.id,
    accountName: account.name,
    confidence: Math.min(0.94, 0.68 + best[1] * 0.06),
    reasons: [`la usaste ${best[1]} veces con esta contraparte`],
  };
}

export function suggestDescriptionCleanupLocally(description: string): DescriptionSuggestion | null {
  const suggestion = cleanupMovementDescriptionLocally({ rawDescription: description });
  return suggestion && shouldShowDescriptionCleanup(description, suggestion.cleanedDescription)
    ? suggestion : null;
}
