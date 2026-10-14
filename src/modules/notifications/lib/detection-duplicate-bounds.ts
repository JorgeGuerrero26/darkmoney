import { movementDateInPeru } from "../../movements/lib/movement-date-range";

export function detectionDuplicateBounds(occurredAt: string) {
  const day = movementDateInPeru(occurredAt);
  if (!day || !Number.isFinite(Date.parse(occurredAt))) throw new Error("Revisa la fecha para comprobar coincidencias.");
  const from = new Date(`${day}T00:00:00-05:00`);
  return { from: from.toISOString(), to: new Date(from.getTime() + 86400000).toISOString() };
}
