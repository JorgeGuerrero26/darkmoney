import type { MovementRecord } from "../../../types/domain";

function words(value: string) {
  return value.toLowerCase().split(/\s+/)
    .map((word) => word.replace(/[^a-záéíóúüñ0-9]/gi, ""))
    .filter((word) => word.length > 2);
}

function bestFromCounts(counts: Map<number, number>, minimum: number) {
  return [...counts.entries()].sort((left, right) => right[1] - left[1])
    .find(([, count]) => count >= minimum)?.[0] ?? null;
}

/** Mirrors the local learning used by the mobile subscription form. */
export function suggestSubscriptionFields(name: string, vendorPartyId: number | null, movements: MovementRecord[]) {
  const posted = movements.filter((movement) => movement.status === "posted").slice(0, 300);
  const wordScores = new Map<number, number>();
  const matchedWords = new Map<number, Set<string>>();
  const vendorCategoryCounts = new Map<number, number>();
  const vendorAccountCounts = new Map<number, number>();
  const queryWords = new Set(words(name));

  for (const movement of posted) {
    const categoryId = movement.categoryId;
    if (categoryId && queryWords.size) {
      for (const word of words(movement.description)) {
        if (!queryWords.has(word)) continue;
        wordScores.set(categoryId, (wordScores.get(categoryId) ?? 0) + 1);
        if (!matchedWords.has(categoryId)) matchedWords.set(categoryId, new Set());
        matchedWords.get(categoryId)!.add(word);
      }
    }
    if (vendorPartyId !== null && movement.counterpartyId === vendorPartyId) {
      if (categoryId) vendorCategoryCounts.set(categoryId, (vendorCategoryCounts.get(categoryId) ?? 0) + 1);
      const accountId = movement.movementType === "income" ? movement.destinationAccountId : movement.sourceAccountId;
      if (accountId) vendorAccountCounts.set(accountId, (vendorAccountCounts.get(accountId) ?? 0) + 1);
    }
  }

  let nameCategoryId: number | null = null;
  const ranked = [...wordScores.entries()].sort((left, right) => right[1] - left[1]);
  if (ranked.length && ranked[0][1] >= 2) {
    const [candidate, score] = ranked[0];
    const secondScore = ranked[1]?.[1] ?? 0;
    const gap = Math.max(0, score - secondScore);
    const matchedCount = matchedWords.get(candidate)?.size ?? 0;
    let confidence = 0.36 + Math.min(score, 10) * 0.025 + Math.min(matchedCount, 3) * 0.065 + Math.min(gap / 8, 0.12);
    if (secondScore > 0 && gap < 2) confidence = Math.min(confidence, 0.56);
    if (queryWords.size <= 1) confidence = Math.min(confidence, score >= 4 && secondScore === 0 ? 0.62 : 0.58);
    if (confidence >= 0.6) nameCategoryId = candidate;
  }

  return {
    categoryId: nameCategoryId ?? bestFromCounts(vendorCategoryCounts, 2),
    accountId: bestFromCounts(vendorAccountCounts, 2),
  };
}
