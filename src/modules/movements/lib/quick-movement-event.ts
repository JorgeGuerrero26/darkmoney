import type { QuickMovementKind } from "../components/quick-movement-dialog";

export const QUICK_MOVEMENT_EVENT = "darkmoney:open-quick-movement";

export type QuickMovementEventDetail = {
  accountId?: number | null;
  kind: QuickMovementKind;
};

export function requestQuickMovement(detail: QuickMovementEventDetail) {
  window.dispatchEvent(new CustomEvent<QuickMovementEventDetail>(QUICK_MOVEMENT_EVENT, { detail }));
}
