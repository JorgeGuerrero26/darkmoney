import type { MovementSplitSubmission } from "../../movements/lib/split-movement";
import { detectionObject } from "./detected-movement.ts";
import { validateDetectedSplit, type DetectedSplitInput } from "./detection-split.ts";

export type DetectionSplitSubmission = MovementSplitSubmission;

/** Capture the unsuffixed total once; server owns keys, provenance and per-part descriptions. */
export function detectionSplitRequest(value: DetectionSplitSubmission, suggestionId: number, expectedUpdatedAt: string, currencyCode: string): DetectedSplitInput {
  const input = value.input;
  if (input.status !== "posted" || !["expense", "income"].includes(input.movementType) || input.obligationId != null ||
      input.fxRate != null || (input.movementType === "expense" ? input.destinationAccountId != null || input.destinationAmount != null : input.sourceAccountId != null || input.sourceAmount != null)) {
    throw new Error("Solo se pueden dividir ingresos o gastos aplicados, sin conversión ni obligación.");
  }
  const metadata = detectionObject(input.metadata);
  const request: DetectedSplitInput = {
    workspaceId: input.workspaceId, suggestionId, expectedUpdatedAt,
    header: { movementType: input.movementType as "expense" | "income", currencyCode,
      accountId: (input.movementType === "income" ? input.destinationAccountId : input.sourceAccountId)!,
      amount: (input.movementType === "income" ? input.destinationAmount : input.sourceAmount)!,
      description: input.description, occurredAt: input.occurredAt, notes: input.notes ?? null,
      counterpartyId: input.counterpartyId ?? null, subscriptionId: input.subscriptionId ?? null,
      recurringIncomeId: metadata.recurring_income_id == null ? null : metadata.recurring_income_id as number,
      metadata: metadata as DetectedSplitInput["header"]["metadata"] },
    parts: value.parts,
  };
  validateDetectedSplit(request);
  return JSON.parse(JSON.stringify(request)) as DetectedSplitInput;
}
