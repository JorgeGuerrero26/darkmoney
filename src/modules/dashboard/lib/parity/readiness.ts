/**
 * PARITY PORT de DarkMoneyApp/features/dashboard/components/advanced/AdvancedDashboard.tsx
 * (learning / readinessScore). Los movimientos deben venir ordenados reciente
 * primero (igual que la query del dashboard) para que `oldest` sea el último.
 */

import { isCategorizedCashflow } from "./aggregations";
import { differenceInDays } from "./date-utils";
import type { ParityMovement } from "./types";

export type ParityReadiness = {
  readinessScore: number;
  historyDays: number;
  usefulCount: number;
  categorizedRate: number;
};

export function buildReadiness(
  movements: ParityMovement[],
  now: Date = new Date(),
): ParityReadiness {
  const posted = movements.filter((movement) => movement.status === "posted");
  const useful = posted.filter((movement) => movement.movementType !== "obligation_opening");
  const categorizedBase = useful.filter(isCategorizedCashflow);
  const categorizedCount = categorizedBase.filter((movement) => movement.categoryId != null).length;
  const categorizedRate = categorizedBase.length > 0 ? categorizedCount / categorizedBase.length : 0;
  const oldest = useful[useful.length - 1];
  const historyDays = oldest
    ? Math.max(1, differenceInDays(now, new Date(oldest.occurredAt)))
    : 0;
  const readinessScore = Math.round(
    Math.min(1, useful.length / 120) * 40 +
      Math.min(1, historyDays / 120) * 25 +
      categorizedRate * 35,
  );
  return { categorizedRate, historyDays, readinessScore, usefulCount: useful.length };
}
