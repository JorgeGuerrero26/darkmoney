import type { AccountSummary, CategorySummary } from "../../../types/domain";
import { detectedMovementDraft, validateDetectedMovement, type DetectedMovement, type DetectionMovementInput, type DetectionSetting } from "./detected-movement";

/** A direct save is available only when the user can see every field that will be stored. */
export function prepareDetectionQuickSave(suggestion: DetectedMovement, accounts: AccountSummary[], categories: CategorySummary[], settings: DetectionSetting[], userId: string, workspaceId: number): DetectionMovementInput | null {
  if (suggestion.userId !== userId || suggestion.workspaceId !== workspaceId || suggestion.status !== "pending" || !suggestion.updatedAt ||
      (suggestion.movementType !== "income" && suggestion.movementType !== "expense") || !suggestion.description.trim() || !Number.isFinite(Date.parse(suggestion.occurredAt)) ||
      !Number.isFinite(suggestion.amount) || suggestion.amount <= 0) return null;
  const draft = detectedMovementDraft(suggestion, accounts, categories, settings);
  const accountId = Number(draft.form.accountId), categoryId = Number(draft.form.categoryId);
  if (!Number.isSafeInteger(accountId) || accountId <= 0 || !Number.isSafeInteger(categoryId) || categoryId <= 0) return null;
  const income = suggestion.movementType === "income";
  const input: DetectionMovementInput = {
    userId, workspaceId, movementType: suggestion.movementType, status: "posted", description: suggestion.description,
    occurredAt: suggestion.occurredAt, categoryId, sourceAccountId: income ? null : accountId, sourceAmount: income ? null : suggestion.amount,
    destinationAccountId: income ? accountId : null, destinationAmount: income ? suggestion.amount : null,
    metadata: { channel: "dashboard-detection" },
  };
  try { validateDetectedMovement(suggestion, input, accounts, categories); return input; } catch { return null; }
}

/** Reuse the review transaction and its duplicate check, never silently bypass a match. */
export async function savePreparedDetection(suggestion: DetectedMovement, input: DetectionMovementInput, accounts: AccountSummary[], categories: CategorySummary[], settings: DetectionSetting[], dependencies: {
  store: ReturnType<typeof import("../../../services/queries/detected-movement-store").createDetectedMovementStore>;
  checker: ReturnType<typeof import("../../../services/queries/detection-duplicates").createDetectedDuplicateChecker>;
  create: (input: DetectionMovementInput) => Promise<number>; signal: AbortSignal; proAccessEnabled: boolean;
}) {
  const active = () => { if (dependencies.signal.aborted) throw new Error("La revisión se canceló; vuelve a intentarlo."); };
  active();
  return dependencies.store.register(suggestion.id, input, accounts, async value => {
    active();
    return dependencies.create(value);
  }, async (fresh, candidate) => {
    active();
    const freshInput = prepareDetectionQuickSave(fresh, accounts, categories, settings, input.userId, input.workspaceId);
    if (fresh.updatedAt !== suggestion.updatedAt || !freshInput || JSON.stringify(freshInput) !== JSON.stringify(input))
      throw new Error("La detección cambió. Revisa sus datos antes de guardar.");
    const decision = await dependencies.checker.check(fresh, input, accounts, candidate, dependencies.proAccessEnabled, null, dependencies.signal);
    active();
    if (!decision.allowed) throw new Error("Hay una posible coincidencia. Abre la revisión para decidir.");
  }, categories);
}
