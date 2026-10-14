import type { JsonValue } from "../../../types/domain";
import type { MovementFormInput } from "../../../services/queries/workspace-data";

export type MovementSplitSubmission = {
  input: MovementFormInput & { userId: string; workspaceId: number };
  parts: Array<{ amount: number; categoryId: number; spendTypeId?: number | null }>;
};

export type MovementSplitLine = {
  id: string;
  amount: string;
  categoryId: string;
  spendTypeId?: string;
};

/** Same edit restrictions as mobile: a split part or an obligation event stays a single movement. */
export function canSplitMovement(movementType: string, metadata?: unknown): boolean {
  if (movementType !== "expense" && movementType !== "income") return false;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return true;
  const values = metadata as Record<string, unknown>;
  const eventId = Number(values.obligation_event_id ?? 0);
  return !values.split_group && !(Number.isFinite(eventId) && eventId > 0);
}

export function createMovementSplitLines(initialCategoryId = ""): MovementSplitLine[] {
  return [createMovementSplitLine(initialCategoryId), createMovementSplitLine()];
}

export function createMovementSplitLine(categoryId = ""): MovementSplitLine {
  return {
    id: crypto.randomUUID(),
    amount: "",
    categoryId,
  };
}

export function getMovementSplitTotal(lines: MovementSplitLine[]) {
  return lines.reduce((total, line) => total + (Number(line.amount) || 0), 0);
}

export function validateMovementSplit(lines: MovementSplitLine[], totalAmount: number): string | null {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return "Ingresa primero el monto total del movimiento.";
  }
  if (lines.length < 2) return "Agrega al menos dos partes.";
  if (lines.length > 100) return "La división admite hasta 100 partes.";
  if (lines.some((line) => !line.categoryId || !Number.isSafeInteger(Number(line.categoryId)) || Number(line.categoryId) <= 0)) return "Elige una categoría para cada parte.";
  if (lines.some((line) => !Number.isFinite(Number(line.amount)) || Number(line.amount) <= 0)) {
    return "Cada parte debe tener un monto mayor a cero.";
  }
  if (new Set(lines.map((line) => Number(line.categoryId))).size !== lines.length) {
    return "No repitas una categoría dentro de la división.";
  }
  if (![totalAmount, ...lines.map(line => Number(line.amount))].every(value => /^[0-9]+(\.[0-9]{1,2})?$/.test(String(value)) && Number.isSafeInteger(Math.round(value * 100)))) {
    return "Usa importes con un máximo de dos decimales.";
  }
  if (lines.reduce((total, line) => total + Math.round(Number(line.amount) * 100), 0) !== Math.round(totalAmount * 100)) {
    return "La suma de las partes debe coincidir con el monto del movimiento.";
  }
  return null;
}

export function buildSplitDescription(description: string, index: number, total: number) {
  return `${description} (${index + 1}/${total})`;
}

export function buildSplitMetadata(
  metadata: JsonValue | null | undefined,
  groupId: string,
  index: number,
  total: number,
) {
  const metadataObject = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata
    : {};
  return {
    ...metadataObject,
    split_group: groupId,
    split_index: index + 1,
    split_total: total,
  };
}
