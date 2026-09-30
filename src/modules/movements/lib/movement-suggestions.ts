import type {
  AccountSummary,
  CounterpartySummary,
  MovementRecord,
} from "../../../types/domain";
import type {
  CounterpartySuggestion,
  DescriptionSuggestion,
} from "../../../services/queries/movement-ai";
import { movementActsAsIncome } from "./movement-form";
export { suggestCategoryLocally } from "./local-category-suggestion";

export type AccountSuggestion = {
  accountId: number;
  accountName: string;
  confidence: number;
  reasons: string[];
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
      type: "existing_counterparty",
      counterpartyId: exactName.id,
      counterpartyName: exactName.name,
      newCounterpartyName: null,
      counterpartyType: exactName.type,
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
    type: "existing_counterparty",
    counterpartyId: counterparty.id,
    counterpartyName: counterparty.name,
    newCounterpartyName: null,
    counterpartyType: counterparty.type,
    confidence: 0.88,
    reasons: ["la usaste antes con esta descripción"],
    source: "local",
  };
}

export function suggestAccountLocally(input: {
  accountId: number | null;
  accounts: AccountSummary[];
  actsAsIncome: boolean;
  counterpartyId: number | null;
  movements: MovementRecord[];
  excludedMovementId?: number;
}): AccountSuggestion | null {
  if (input.accountId !== null || input.counterpartyId === null) return null;
  const availableAccounts = new Map(
    input.accounts.filter((account) => !account.isArchived).map((account) => [account.id, account]),
  );
  const scores = new Map<number, number>();
  input.movements.forEach((movement) => {
    if (
      movement.id === input.excludedMovementId ||
      movement.status === "voided" ||
      movement.movementType === "transfer" ||
      movement.counterpartyId !== input.counterpartyId ||
      movementActsAsIncome(movement) !== input.actsAsIncome
    ) {
      return;
    }
    const accountId = input.actsAsIncome ? movement.destinationAccountId : movement.sourceAccountId;
    if (accountId == null || !availableAccounts.has(accountId)) return;
    scores.set(accountId, (scores.get(accountId) ?? 0) + 1);
  });
  const best = [...scores.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!best) return null;
  const account = availableAccounts.get(best[0]);
  if (!account) return null;
  return {
    accountId: account.id,
    accountName: account.name,
    confidence: Math.min(0.94, 0.68 + best[1] * 0.06),
    reasons: [best[1] === 1 ? "la usaste antes con esta contraparte" : `la usaste ${best[1]} veces con esta contraparte`],
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
