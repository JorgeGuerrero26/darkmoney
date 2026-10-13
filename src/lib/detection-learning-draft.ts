import { learningObject, receiptAccountHints, type LearningMovement, type PersonalProposal } from "./detection-personal-learning";

export type LearningFields = "account" | "destination" | "category";
export type LearningSelection = { accountId: number | null; destinationAccountId: number | null; categoryId: number | null };
export type DetectionLearningContext = {
  history: readonly LearningMovement[];
  baseline: LearningSelection;
  baselines?: Partial<Record<"expense" | "income" | "transfer", LearningSelection>>;
  originalDescription: string;
  movementType: string;
  financialAppKey: string;
  currencyCode: string;
  metadata: unknown;
};
const positiveId = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;

/** Same precedence/retraction as mobile, independent of the form's string representation. */
export function applyPersonalSelection(current: LearningSelection, kind: "expense" | "income" | "transfer", manual: ReadonlySet<LearningFields>, baseline: LearningSelection,
  proposal: PersonalProposal, previous: LearningSelection, metadata: unknown) {
  const meta = learningObject(metadata), hints = receiptAccountHints(meta.accountHints);
  const draft = { ...current }, applied = { ...previous };
  if (!manual.has("account")) {
    const explicit = positiveId(meta.accountId) ?? positiveId(kind === "income" ? meta.destinationAccountId : meta.sourceAccountId);
    const proposed = proposal.accountEvidence === "receipt" || !explicit ? proposal.accountId : null;
    const hasReference = kind === "income" ? hints.destination : hints.source;
    draft.accountId = proposed ?? (hasReference && !explicit ? null : baseline.accountId);
    applied.accountId = proposed;
  }
  if (!manual.has("category") && kind !== "transfer") {
    if (proposal.categoryId != null || previous.categoryId != null) draft.categoryId = proposal.categoryId ?? baseline.categoryId;
    applied.categoryId = proposal.categoryId;
  }
  if (kind === "transfer" && !manual.has("destination")) {
    const proposed = proposal.destinationEvidence === "receipt" || !positiveId(meta.destinationAccountId) ? proposal.destinationAccountId : null;
    draft.destinationAccountId = proposed ?? (previous.destinationAccountId != null ? baseline.destinationAccountId : current.destinationAccountId);
    if (draft.destinationAccountId === draft.accountId) draft.destinationAccountId = null;
    applied.destinationAccountId = proposed;
  }
  return { draft, applied };
}

export function detectionLearningDecision(context: DetectionLearningContext, manual: ReadonlySet<LearningFields>) {
  const hints = receiptAccountHints(learningObject(context.metadata).accountHints);
  return { originalDescription: context.originalDescription, movementType: context.movementType,
    financialAppKey: context.financialAppKey, accountHints: { source: hints.source ?? null, destination: hints.destination ?? null },
    manualChoices: { account: manual.has("account"), destination: manual.has("destination"), category: manual.has("category") } };
}
