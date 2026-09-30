import { normalizeAnalyticsText } from "@darkmoney/shared/movement-features";
import type { CategorySummary, MovementRecord, MovementType } from "../../../types/domain";
import type { CategorySuggestion } from "../../../services/queries/movement-ai";
import { buildCategorySuggestionCandidates } from "./category-suggestion-candidates";

export const LOCAL_CATEGORY_AI_CONFIDENCE_THRESHOLD = 0.6;

export type CategoryLearningFeedback = {
  feedbackKind: string;
  acceptedCategoryId: number | null;
  normalizedDescription: string | null;
  createdAt: string;
};

export function deriveLearnedCategoryMatch(description: string, feedback: CategoryLearningFeedback[], categories: CategorySummary[]): CategorySuggestion | null {
  const normalized = normalizeAnalyticsText(description);
  if (!normalized) return null;
  const words = (text: string) => new Set(normalizeAnalyticsText(text).split(" ").filter((token) => token.length >= 3));
  const currentWords = words(normalized);
  const best = feedback
    .filter((item) => item.acceptedCategoryId != null && ["accepted_category_suggestion", "manual_category_change"].includes(item.feedbackKind))
    .map((item) => {
      const learned = item.normalizedDescription ?? "";
      const learnedWords = words(learned);
      const union = new Set([...currentWords, ...learnedWords]);
      const overlap = [...union].filter((word) => currentWords.has(word) && learnedWords.has(word)).length;
      const similarity = learned === normalized ? 1 : union.size ? overlap / union.size : 0;
      return { item, learned, learnedWords, similarity };
    })
    .filter((item) => item.similarity >= 0.58)
    .sort((a, b) => b.similarity - a.similarity || new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime())[0];
  if (!best?.item.acceptedCategoryId) return null;
  const category = categories.find((item) => item.id === best.item.acceptedCategoryId);
  if (!category) return null;
  // Mobile counts repeated tokens for the exact-match confidence, rather than unique words.
  const tokenCount = normalizeAnalyticsText(description).split(" ").filter((word) => word.length >= 3).length;
  const learnedTokenCount = normalizeAnalyticsText(best.learned).split(" ").filter((word) => word.length >= 3).length;
  const exact = normalized === normalizeAnalyticsText(best.learned);
  const confidence = exact
    ? Math.min(0.9, tokenCount <= 1 ? 0.68 : 0.76 + Math.min(tokenCount, 4) * 0.03)
    : tokenCount <= 1 || learnedTokenCount <= 1
      ? Math.min(0.58, 0.42 + best.similarity * 0.18)
      : Math.min(0.86, 0.38 + best.similarity * 0.48);
  if (confidence < LOCAL_CATEGORY_AI_CONFIDENCE_THRESHOLD) return null;
  return { type: "existing_category", categoryId: category.id, categoryName: category.name, newCategoryName: null, confidence, reasons: ["porque corregiste esto antes"], source: "local" };
}

export function suggestCategoryLocally(input: {
  description: string;
  counterpartyId: number | null;
  movementType: MovementType;
  categories: CategorySummary[];
  movements: MovementRecord[];
  excludedMovementId?: number;
  amount: number | null;
  accountId: number | null;
  occurredAt: string;
  learningFeedback?: CategoryLearningFeedback[];
}): CategorySuggestion | null {
  if (input.movementType === "transfer" || !input.description.trim()) return null;
  const categories = input.categories.filter((category) => category.isActive && (category.kind === "both" || category.kind === (input.movementType === "income" ? "income" : "expense")));
  const learned = deriveLearnedCategoryMatch(input.description, input.learningFeedback ?? [], categories);
  if (learned) return learned;
  const actsAsIncome = (movement: { movementType: string }) => movement.movementType === "income" || movement.movementType === "refund";
  const amount = (movement: MovementRecord) => {
    const source = Math.abs(Number(movement.sourceAmount ?? 0));
    const destination = Math.abs(Number(movement.destinationAmount ?? 0));
    return actsAsIncome(movement) ? destination || source : source || destination;
  };
  // Mobile fetches the latest 300 posted records, then excludes the edited record.
  const history = input.movements.filter((movement) => movement.status === "posted")
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 300).filter((movement) => movement.id !== input.excludedMovementId && movement.categoryId != null)
    .map((movement) => ({ ...movement, categoryId: movement.categoryId ?? null, counterpartyId: movement.counterpartyId ?? null, amount: amount(movement) }));
  const target = {
    id: input.excludedMovementId ? -input.excludedMovementId : -1,
    movementType: input.movementType, status: "posted", occurredAt: input.occurredAt,
    sourceAccountId: input.movementType === "income" ? null : input.accountId,
    destinationAccountId: input.movementType === "income" ? input.accountId : null,
    categoryId: null, counterpartyId: input.counterpartyId,
    description: input.description.trim(), amount: input.amount ?? 0,
  };
  const [candidate] = buildCategorySuggestionCandidates({
    movements: [...history, target], categories,
    isCashflow: (movement) => ["income", "refund", "expense", "subscription_payment", "obligation_payment"].includes(movement.movementType),
    isIncomeLike: actsAsIncome, getAmount: (movement) => movement.amount,
    limit: 1, targetLimit: 1,
  });
  return candidate ? {
    type: "existing_category", categoryId: candidate.suggestedCategoryId,
    categoryName: candidate.suggestedCategoryName, newCategoryName: null,
    confidence: candidate.confidence, reasons: candidate.reasons, source: "local",
  } : null;
}
