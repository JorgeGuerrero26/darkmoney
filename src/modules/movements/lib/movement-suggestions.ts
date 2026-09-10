import type {
  CategorySummary,
  CounterpartySummary,
  MovementRecord,
  MovementType,
} from "../../../types/domain";
import type {
  CategorySuggestion,
  CounterpartySuggestion,
  DescriptionSuggestion,
} from "../../../services/queries/movement-ai";
import { movementActsAsIncome } from "./movement-form";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length >= 3));
}

function similarity(left: string, right: string) {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  const union = new Set([...leftTokens, ...rightTokens]);
  if (union.size === 0) return 0;
  let matches = 0;
  union.forEach((token) => {
    if (leftTokens.has(token) && rightTokens.has(token)) matches += 1;
  });
  return matches / union.size;
}

function isCompatibleCategory(category: CategorySummary, movementType: MovementType) {
  if (category.kind === "both") return true;
  if (movementType === "income") return category.kind === "income";
  return category.kind === "expense";
}

export function suggestCategoryLocally(input: {
  description: string;
  counterpartyId: number | null;
  movementType: MovementType;
  categories: CategorySummary[];
  movements: MovementRecord[];
  excludedMovementId?: number;
}): CategorySuggestion | null {
  const normalizedDescription = normalizeText(input.description);
  if (normalizedDescription.length < 3 || input.movementType === "transfer") return null;

  const categories = new Map(
    input.categories
      .filter((category) => category.isActive && isCompatibleCategory(category, input.movementType))
      .map((category) => [category.id, category]),
  );
  const scores = new Map<number, { score: number; exact: boolean; sameCounterparty: boolean }>();

  input.movements.forEach((movement) => {
    if (
      movement.id === input.excludedMovementId ||
      movement.categoryId == null ||
      !categories.has(movement.categoryId) ||
      movement.movementType === "transfer" ||
      movement.status === "voided" ||
      movementActsAsIncome(movement) !== (input.movementType === "income")
    ) {
      return;
    }
    const exact = normalizeText(movement.description) === normalizedDescription;
    const sameCounterparty =
      input.counterpartyId !== null && movement.counterpartyId === input.counterpartyId;
    const textScore = similarity(input.description, movement.description);
    const score = exact ? 0.95 : sameCounterparty ? 0.78 : textScore >= 0.5 ? 0.58 + textScore * 0.28 : 0;
    if (!score) return;
    const previous = scores.get(movement.categoryId);
    if (!previous || score > previous.score) {
      scores.set(movement.categoryId, { score, exact, sameCounterparty });
    }
  });

  const best = [...scores.entries()].sort((left, right) => right[1].score - left[1].score)[0];
  if (!best) return null;
  const category = categories.get(best[0]);
  if (!category) return null;
  return {
    categoryId: category.id,
    categoryName: category.name,
    confidence: best[1].score,
    reasons: [
      best[1].exact
        ? "la usaste antes con esta descripción"
        : best[1].sameCounterparty
          ? "la usaste antes con esta contraparte"
          : "coincide con movimientos anteriores",
    ],
    source: "local",
  };
}

export function suggestCounterpartyLocally(input: {
  description: string;
  counterparties: CounterpartySummary[];
  movements: MovementRecord[];
  excludedMovementId?: number;
}): CounterpartySuggestion | null {
  const normalizedDescription = normalizeText(input.description);
  if (normalizedDescription.length < 3) return null;

  const exactName = input.counterparties.find((counterparty) => {
    const name = normalizeText(counterparty.name);
    return !counterparty.isArchived && name.length >= 3 && normalizedDescription.includes(name);
  });
  if (exactName) {
    return {
      counterpartyId: exactName.id,
      counterpartyName: exactName.name,
      confidence: 0.9,
      reasons: ["el nombre aparece en la descripción"],
      source: "local",
    };
  }

  const matchingMovement = input.movements
    .filter(
      (movement) =>
        movement.id !== input.excludedMovementId &&
        movement.counterpartyId != null &&
        movement.status !== "voided" &&
        normalizeText(movement.description) === normalizedDescription,
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  if (!matchingMovement?.counterpartyId) return null;
  const counterparty = input.counterparties.find(
    (item) => item.id === matchingMovement.counterpartyId && !item.isArchived,
  );
  if (!counterparty) return null;
  return {
    counterpartyId: counterparty.id,
    counterpartyName: counterparty.name,
    confidence: 0.88,
    reasons: ["la usaste antes con esta descripción"],
    source: "local",
  };
}

const CLEANUP_PATTERNS: Array<{ pattern: RegExp; value: string; reason: string }> = [
  { pattern: /\b(taxi|uber|cabify|didi|indriver)\b/i, value: "Pago de movilidad", reason: "detectamos un servicio de movilidad" },
  { pattern: /\b(rappi|pedidosya|uber\s*eats|glovo)\b/i, value: "Pedido por delivery", reason: "detectamos una app de delivery" },
  { pattern: /\b(netflix|spotify|disney\+?|hbo|amazon\s*prime|youtube\s*premium)\b/i, value: "Suscripción de entretenimiento", reason: "detectamos un servicio de entretenimiento" },
  { pattern: /\b(openai|chatgpt|claude|google\s*one|dropbox|adobe)\b/i, value: "Suscripción de software", reason: "detectamos un servicio de software" },
  { pattern: /\b(botica|farmacia|inkafarma|mifarma)\b/i, value: "Compra en botica", reason: "detectamos una farmacia" },
  { pattern: /\b(grifo|primax|repsol|pecsa|combustible|gasolina)\b/i, value: "Compra de combustible", reason: "detectamos una compra de combustible" },
];

export function suggestDescriptionCleanupLocally(description: string): DescriptionSuggestion | null {
  const raw = description.trim().replace(/\s+/g, " ");
  if (raw.length < 4) return null;
  const match = CLEANUP_PATTERNS.find((item) => item.pattern.test(raw));
  if (!match || normalizeText(match.value) === normalizeText(raw)) return null;
  return {
    cleanedDescription: match.value,
    confidence: 0.78,
    reasons: [match.reason],
    source: "local",
  };
}
