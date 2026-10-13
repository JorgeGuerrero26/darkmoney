import type { AccountSummary, CategorySummary, JsonValue, MovementRecord } from "../../../types/domain";
import type { MovementFormInput } from "../../../services/queries/workspace-data";
import { movementDateInPeru } from "../../movements/lib/movement-date-range.ts";

export type DetectionStatus = "pending" | "needs_review" | "registered" | "discarded" | "duplicate";
export type DetectedMovement = {
  id: number; userId: string; workspaceId: number; financialAppKey: string;
  packageName: string; appLabel: string; movementType: "expense" | "income" | "transfer" | "unknown";
  amount: number; currencyCode: string; description: string; occurredAt: string;
  confidence: string; status: DetectionStatus; movementId: number | null; metadata: JsonValue | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};
export type DetectionSetting = { financialAppKey: string; enabled: boolean; defaultAccountId: number | null };
export type DetectionMovementInput = MovementFormInput & { userId: string; workspaceId: number };

export function detectionObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function positiveId(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null; }
export function detectionPending(suggestion: Pick<DetectedMovement, "status">) { return suggestion.status === "pending" || suggestion.status === "needs_review"; }

/** Keep the list that opened the review; never accept an arbitrary return URL. */
export function detectedReviewParams(current: URLSearchParams, id: number) {
  const next = new URLSearchParams(current);
  if (current.get("detected") === "pending") next.set("detectedOrigin", "pending");
  else next.delete("detectedOrigin");
  next.set("detected", String(id));
  return next;
}

export function closeDetectedReviewParams(current: URLSearchParams) {
  const next = new URLSearchParams(current);
  if (current.get("detectedOrigin") === "pending") next.set("detected", "pending");
  else next.delete("detected");
  next.delete("detectedOrigin");
  return next;
}

/** Use receipt/account settings, never choose an arbitrary second account. */
export function detectedMovementDraft(suggestion: DetectedMovement, accounts: AccountSummary[], categories: CategorySummary[], settings: DetectionSetting[]) {
  const meta = detectionObject(suggestion.metadata);
  const kind = suggestion.movementType === "unknown" ? "expense" : suggestion.movementType;
  const eligible = accounts.filter((row) => !row.isArchived && row.currencyCode === suggestion.currencyCode);
  const configured = settings.find((row) => row.enabled && row.financialAppKey === suggestion.financialAppKey)?.defaultAccountId;
  const accountId = positiveId(meta.accountId) ?? positiveId(kind === "income" ? meta.destinationAccountId : meta.sourceAccountId) ?? configured;
  const account = eligible.find((row) => row.id === accountId) ?? (eligible.length === 1 ? eligible[0] : null);
  const destination = kind === "transfer" ? accounts.find((row) => !row.isArchived && row.id === positiveId(meta.destinationAccountId) && row.id !== account?.id) : null;
  const categoryId = positiveId(meta.categoryId) ?? positiveId(detectionObject(meta.aiCategoryRecommendation).categoryId);
  const category = categories.find((row) => row.id === categoryId && row.isActive && (row.kind === kind || row.kind === "both"));
  const occurred = new Date(suggestion.occurredAt);
  const localDateTime = Number.isFinite(occurred.getTime()) ? new Date(occurred.getTime() - occurred.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";
  return { kind, form: {
    amount: suggestion.amount.toFixed(2), description: suggestion.description, occurredAt: localDateTime,
    accountId: kind === "transfer" ? "" : String(account?.id ?? ""),
    sourceAccountId: kind === "transfer" ? String(account?.id ?? "") : "",
    destinationAccountId: String(destination?.id ?? ""),
    destinationAmount: destination && destination.currencyCode === account?.currencyCode ? suggestion.amount.toFixed(2) : "",
    categoryId: kind === "transfer" ? "" : String(category?.id ?? ""), status: "posted" as const,
  } };
}

export function validateDetectedMovement(suggestion: DetectedMovement, input: DetectionMovementInput, accounts: AccountSummary[], categories?: CategorySummary[]) {
  if (input.workspaceId !== suggestion.workspaceId || input.userId !== suggestion.userId) throw new Error("La detección pertenece a otro espacio o usuario.");
  if (!["expense", "income", "transfer"].includes(input.movementType) || input.status !== "posted") throw new Error("Confirma un ingreso, gasto o transferencia aplicado.");
  if (!input.description.trim() || !Number.isFinite(Date.parse(input.occurredAt))) throw new Error("Revisa la descripción y fecha de la detección.");
  const primaryId = input.movementType === "income" ? input.destinationAccountId : input.sourceAccountId;
  const primary = accounts.find((row) => row.id === primaryId && row.workspaceId === input.workspaceId && !row.isArchived);
  const amount = input.movementType === "income" ? input.destinationAmount : input.sourceAmount;
  if (!primary || primary.currencyCode !== suggestion.currencyCode) throw new Error(`Elige una cuenta activa en ${suggestion.currencyCode}; no se convierte el importe detectado automáticamente.`);
  if (amount == null || !Number.isFinite(amount) || amount <= 0) throw new Error("Revisa el importe detectado.");
  if (categories && input.categoryId != null && input.movementType !== "transfer" && !categories.some((row) => row.id === input.categoryId && row.isActive && (row.kind === input.movementType || row.kind === "both"))) throw new Error("Elige una categoría activa que corresponda al tipo de movimiento.");
  if (input.movementType === "transfer") {
    const destination = accounts.find((row) => row.id === input.destinationAccountId && row.workspaceId === input.workspaceId && !row.isArchived);
    if (!destination || destination.id === primary.id) throw new Error("Elige un destino activo distinto del origen.");
    if (input.destinationAmount == null || !Number.isFinite(input.destinationAmount) || input.destinationAmount <= 0) throw new Error("Indica cuánto llega al destino.");
    if (destination.currencyCode !== primary.currencyCode && (input.fxRate == null || !Number.isFinite(input.fxRate) || input.fxRate <= 0)) throw new Error("Revisa el tipo de cambio de la transferencia.");
  }
  if ("split_group" in detectionObject(input.metadata)) throw new Error("La revisión detectada simple no admite división todavía.");
}

export function detectedInputSignature(input: DetectionMovementInput) {
  return JSON.stringify([input.workspaceId, input.userId, input.movementType, input.status, input.description,
    input.occurredAt, input.sourceAccountId, input.sourceAmount, input.destinationAccountId, input.destinationAmount, input.fxRate]);
}
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim(); }

/** A possible match needs user confirmation; amount alone never resolves a detection. */
export function possibleDetectedDuplicate(input: DetectionMovementInput, accounts: AccountSummary[], movements: MovementRecord[]) {
  return movements.find((row) => {
    if (row.workspaceId !== input.workspaceId || row.status !== "posted" || row.movementType !== input.movementType) return false;
    if (movementDateInPeru(row.occurredAt) !== movementDateInPeru(input.occurredAt) || normalize(row.description) !== normalize(input.description)) return false;
    const income = input.movementType === "income";
    const accountId = income ? input.destinationAccountId : input.sourceAccountId;
    const amount = income ? input.destinationAmount : input.sourceAmount;
    const currency = accounts.find((account) => account.id === accountId)?.currencyCode;
    if (!currency || (income ? row.destinationAccountId : row.sourceAccountId) !== accountId || (income ? row.destinationAmount : row.sourceAmount) !== amount) return false;
    return input.movementType !== "transfer" || (row.destinationAccountId === input.destinationAccountId && row.destinationAmount === input.destinationAmount);
  }) ?? null;
}

export function reconciliationCandidateForDetectedInput(suggestion: DetectedMovement, input: DetectionMovementInput, accounts: AccountSummary[], candidate: MovementRecord | null) {
  if (!candidate || candidate.workspaceId !== suggestion.workspaceId || candidate.status !== "posted") return null;
  const kind = suggestion.movementType === "unknown" ? "expense" : suggestion.movementType;
  if (input.movementType !== kind || input.description !== suggestion.description ||
      input.occurredAt.slice(0, 16) !== suggestion.occurredAt.slice(0, 16) ||
      (kind === "income" ? input.destinationAmount : input.sourceAmount) !== suggestion.amount) return null;
  const primaryId = kind === "income" ? candidate.destinationAccountId : candidate.sourceAccountId;
  if ((kind === "income" ? input.destinationAccountId : input.sourceAccountId) !== primaryId ||
      accounts.find((row) => row.id === primaryId)?.currencyCode !== suggestion.currencyCode) return null;
  if (kind === "transfer" && input.destinationAccountId !== candidate.destinationAccountId) return null;
  return candidate;
}

export function detectedWriteInput(suggestion: DetectedMovement, input: DetectionMovementInput): DetectionMovementInput {
  return { ...input, dedupeKey: `suggestion:${suggestion.id}`, metadata: {
    ...detectionObject(input.metadata) as Record<string, JsonValue>, source: "notification_detection",
    suggestionId: suggestion.id, financialAppKey: suggestion.financialAppKey, confidence: suggestion.confidence,
  } };
}
