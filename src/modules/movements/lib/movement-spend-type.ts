import type { MovementType } from "../../../types/domain";

export type MovementSpendType = { id: number; name: string };

export function movementSpendTypeId(movementType: MovementType, explicitId?: number | null) {
  return movementType === "expense" ? explicitId ?? null : null;
}

export function movementSpendTypeLabel(
  types: MovementSpendType[],
  explicitId: number | null,
  categoryDefaultId?: number | null,
) {
  const effectiveId = explicitId ?? categoryDefaultId;
  if (effectiveId == null) return "Sin tipo";
  const name = types.find((type) => type.id === effectiveId)?.name ?? "Tipo no disponible";
  return explicitId == null ? `${name} · De categoría` : name;
}
