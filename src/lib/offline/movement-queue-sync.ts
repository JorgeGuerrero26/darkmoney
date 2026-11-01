import { isAmbiguousWriteError } from "../idempotent-write";
import { acknowledgeQueuedMovement, listQueuedMovements, markQueuedMovementForReview, validateQueuedMovement, type QueuedMovement, type QueuedMovementInput } from "./movement-queue";

export type QueueScope = { userId: string; workspaceId: number };
type Dependencies = {
  list: (userId: string, workspaceId: number) => Promise<QueuedMovement[]>;
  acknowledge: (row: QueuedMovement) => Promise<boolean>;
  markReview: (row: QueuedMovement, message: string) => Promise<boolean>;
  send: (input: QueuedMovementInput) => Promise<number>;
  isActive: (scope: QueueScope) => boolean;
  isOnline: () => boolean;
};

/** Replay requires a cross-tab lock; never proceed without a stable user and workspace. */
export async function syncMovementQueue(scope: QueueScope, dependencies: Dependencies, withLock: (name: string, task: () => Promise<void>) => Promise<boolean>) {
  let sent = 0, needsReview = 0, interrupted = false;
  const locked = await withLock(`darkmoney-queue:${scope.userId}:${scope.workspaceId}`, async () => {
    if (!dependencies.isActive(scope) || !dependencies.isOnline()) { interrupted = true; return; }
    const rows = await dependencies.list(scope.userId, scope.workspaceId);
    for (const row of rows) {
      if (row.userId !== scope.userId || row.workspaceId !== scope.workspaceId || row.input.userId !== scope.userId || row.input.workspaceId !== scope.workspaceId || row.input.dedupeKey !== row.dedupeKey) { interrupted = true; break; }
      if (row.state !== "pending") continue;
      try { validateQueuedMovement(row.input); }
      catch {
        if (await dependencies.markReview(row, "Los datos pendientes necesitan revisión antes de enviarse.")) { needsReview++; continue; }
        interrupted = true; break;
      }
      if (!dependencies.isActive(scope) || !dependencies.isOnline()) { interrupted = true; break; }
      let id: number;
      try { id = await dependencies.send(row.input); }
      catch (error) {
        if (!dependencies.isActive(scope) || !dependencies.isOnline() || isAmbiguousWriteError(error)) { interrupted = true; break; }
        if (await dependencies.markReview(row, "No se pudo aplicar el cambio. Revisa sus datos y permisos antes de reintentar.")) { needsReview++; continue; }
        interrupted = true; break;
      }
      // Failure to acknowledge after a confirmed write is ambiguous locally. Keep the same key.
      if (!Number.isSafeInteger(id) || id <= 0) { interrupted = true; break; }
      try { if (await dependencies.acknowledge(row)) sent++; else { interrupted = true; break; } }
      catch { interrupted = true; break; }
    }
  });
  return { locked, sent, needsReview, interrupted };
}

export async function browserQueueLock(name: string, task: () => Promise<void>): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.locks) return false;
  return await navigator.locks.request(name, { ifAvailable: true }, async lock => { if (!lock) return false; await task(); return true; });
}
export function syncLocalMovementQueue(scope: QueueScope, send: Dependencies["send"], isActive: Dependencies["isActive"], isOnline: Dependencies["isOnline"]) {
  return syncMovementQueue(scope, { list: listQueuedMovements, acknowledge: acknowledgeQueuedMovement, markReview: markQueuedMovementForReview, send, isActive, isOnline }, browserQueueLock);
}
