import { detectionPending, type DetectedMovement } from "./detected-movement.ts";

export type DetectionOmissionChange = { before: DetectedMovement; after: DetectedMovement };
export type DetectionOmissionInput =
  | { action: "omit"; suggestions: DetectedMovement[]; markNotificationsRead?: boolean }
  | { action: "restore"; changes: DetectionOmissionChange[] };
export type DetectionOmissionResult = {
  changes: DetectionOmissionChange[]; failed: number; skipped: number; readingUpdated: boolean;
};

/** Capture only the IDs confirmed by the user; never include a later inbox refresh. */
export function omissionTargets(userId: string, workspaceId: number, input: DetectionOmissionInput) {
  const candidates = input.action === "omit"
    ? input.suggestions.map((before) => ({ before, after: before })) : input.changes;
  return [...new Map(candidates.filter(({ before, after }) =>
    Number.isSafeInteger(before.id) && before.id > 0 && before.userId === userId &&
    before.workspaceId === workspaceId && detectionPending(before) && before.movementId == null &&
    (input.action === "omit" || (after.id === before.id && after.userId === userId &&
      after.workspaceId === workspaceId && after.status === "discarded" && after.movementId == null &&
      typeof after.updatedAt === "string" && Number.isFinite(Date.parse(after.updatedAt))))
  ).map((change) => [change.before.id, change])).values()];
}

export function omissionGroups(targets: DetectionOmissionChange[], action: DetectionOmissionInput["action"]) {
  const groups = new Map<string, DetectionOmissionChange[]>();
  for (const change of targets) {
    const key = JSON.stringify([change.before.status, action === "restore" ? change.after.updatedAt : null]);
    groups.set(key, [...(groups.get(key) ?? []), change]);
  }
  // Bound PATCH URLs and returned rows independently of the inbox's size.
  return [...groups.values()].flatMap((group) => {
    const chunks: DetectionOmissionChange[][] = [];
    for (let offset = 0; offset < group.length; offset += 250) chunks.push(group.slice(offset, offset + 250));
    return chunks;
  });
}
