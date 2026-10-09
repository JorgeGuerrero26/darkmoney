import type { MovementRecord } from "../../../types/domain";
import { movementDateInPeru } from "../../movements/lib/movement-date-range.ts";

export function selectNotificationDayMovements(items: MovementRecord[], day: string) {
  return items.filter((item) => item.status === "posted" && movementDateInPeru(item.occurredAt) === day)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
