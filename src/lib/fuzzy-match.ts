/**
 * Fuzzy match por subsecuencia con scoring simple, sin dependencias.
 * Normaliza acentos para que "categoria" encuentre "Categorías".
 */
export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function fuzzyScore(query: string, target: string): number | null {
  const normalizedQuery = normalizeSearchText(query.trim());
  const normalizedTarget = normalizeSearchText(target);

  if (!normalizedQuery) {
    return 0;
  }

  let score = 0;
  let targetIndex = 0;
  let previousMatchIndex = -2;

  for (const char of normalizedQuery) {
    if (char === " ") {
      continue;
    }

    const foundIndex = normalizedTarget.indexOf(char, targetIndex);

    if (foundIndex === -1) {
      return null;
    }

    score += 1;

    if (foundIndex === previousMatchIndex + 1) {
      score += 2;
    }

    if (foundIndex === 0 || normalizedTarget[foundIndex - 1] === " ") {
      score += 3;
    }

    previousMatchIndex = foundIndex;
    targetIndex = foundIndex + 1;
  }

  return score;
}
