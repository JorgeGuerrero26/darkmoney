import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountSummary, MovementRecord } from "../../types/domain";
import { movementDateInPeru } from "../../modules/movements/lib/movement-date-range";
import { detectedInputSignature, reconciliationCandidateForDetectedInput, type DetectedMovement, type DetectionMovementInput } from "../../modules/notifications/lib/detected-movement";
import { parseDuplicateVerdict, type DuplicateAiResult } from "../../modules/notifications/lib/duplicate-verdict";
import { mapDetectedCandidate } from "./detected-movement-store";

export type DuplicatePermission = { signature: string; candidateKey: string };
export type DetectionDuplicateDecision = {
  candidate: MovementRecord | null; allowed: boolean; permission: DuplicatePermission | null; ai: DuplicateAiResult | null;
};
export type DuplicateCheckBody = {
  workspaceId: number;
  suggestion: { description: string; amountLabel: string; occurredAt: string; sourceApp: string; rawText: string | null };
  candidateMovement: { id: number; description: string | null; occurredAt: string; amount: number };
  counts: { sameDaySuggestions: number; sameDayRegisteredFromSuggestions: number; sameDayMatchingMovements: number };
};
const unknown = (): DuplicateAiResult => ({ verdict: "unknown", reason: null });
function active(signal?: AbortSignal) {
  if (signal?.aborted) throw Object.assign(new Error("La comprobación se canceló. Revisa el formulario antes de volver a guardar."), { name: "AbortError" });
}
export function detectionDuplicateBounds(occurredAt: string) {
  const day = movementDateInPeru(occurredAt);
  if (!day || !Number.isFinite(Date.parse(occurredAt))) throw new Error("Revisa la fecha para comprobar coincidencias.");
  const from = new Date(`${day}T00:00:00-05:00`);
  return { from: from.toISOString(), to: new Date(from.getTime() + 86400000).toISOString() };
}
export function duplicateCandidateKey(candidate: MovementRecord) {
  return JSON.stringify([candidate.id, candidate.workspaceId, candidate.movementType, candidate.status, candidate.description,
    candidate.occurredAt, candidate.sourceAccountId, candidate.sourceAmount, candidate.destinationAccountId, candidate.destinationAmount]);
}
// Identical normalization to the mobile lookup, including punctuation and whitespace order.
function descriptionKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\s+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}
function compatible(input: DetectionMovementInput, row: MovementRecord) {
  const income = input.movementType === "income";
  return Number.isSafeInteger(row.id) && row.id > 0 && row.workspaceId === input.workspaceId && row.status === "posted" && row.movementType === input.movementType &&
    movementDateInPeru(row.occurredAt) === movementDateInPeru(input.occurredAt) &&
    (income ? row.destinationAccountId === input.destinationAccountId && row.destinationAmount === input.destinationAmount : row.sourceAccountId === input.sourceAccountId && row.sourceAmount === input.sourceAmount) &&
    (input.movementType !== "transfer" || (row.destinationAccountId === input.destinationAccountId && row.destinationAmount === input.destinationAmount));
}

/** Bounded wait, cancellable on navigation/draft edits. Late replies have no side effects. */
export async function confirmDuplicateWithAi(client: SupabaseClient, body: DuplicateCheckBody, signal?: AbortSignal, timeoutMs = 8000): Promise<DuplicateAiResult> {
  if (signal?.aborted) return unknown();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const stopped = new Promise<DuplicateAiResult>((resolve) => {
      const stop = () => { controller.abort(); resolve(unknown()); };
      onAbort = stop; signal?.addEventListener("abort", stop, { once: true });
      timer = setTimeout(stop, timeoutMs);
    });
    const request = client.functions.invoke("movement-duplicate-ai-check", { body, signal: controller.signal })
      .then(({ data, error }) => error ? unknown() : parseDuplicateVerdict(data), () => unknown());
    return await Promise.race([request, stopped]);
  } catch { return unknown(); }
  finally { clearTimeout(timer); if (onAbort) signal?.removeEventListener("abort", onAbort); }
}

export function createDetectedDuplicateChecker(client: SupabaseClient, scope: { userId: string; workspaceId: number }) {
  async function candidate(input: DetectionMovementInput, signal?: AbortSignal) {
    active(signal);
    const { from, to } = detectionDuplicateBounds(input.occurredAt);
    const income = input.movementType === "income", account = income ? input.destinationAccountId : input.sourceAccountId;
    const amount = income ? input.destinationAmount : input.sourceAmount;
    if (!account || amount == null || amount <= 0 || !Number.isFinite(amount)) throw new Error("Revisa cuenta e importe antes de comprobar coincidencias.");
    for (let offset = 0; ; offset += 500) {
      let query = client.from("movements").select("id,workspace_id,movement_type,status,occurred_at,description,source_account_id,source_amount,destination_account_id,destination_amount,metadata")
        .eq("workspace_id", scope.workspaceId).eq("movement_type", input.movementType).eq("status", "posted")
        .eq(income ? "destination_account_id" : "source_account_id", account).eq(income ? "destination_amount" : "source_amount", amount)
        .gte("occurred_at", from).lt("occurred_at", to).order("occurred_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 499);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query; active(signal);
      if (error) throw new Error("No se pudieron consultar las coincidencias. Reintenta antes de guardar.");
      const matched = (data ?? []).map(mapDetectedCandidate).find((row) => compatible(input, row) && descriptionKey(row.description) === descriptionKey(input.description));
      if (matched) return matched;
      if (!data || data.length < 500) return null;
    }
  }
  async function counts(input: DetectionMovementInput, currencyCode: string, signal?: AbortSignal) {
    const { from, to } = detectionDuplicateBounds(input.occurredAt), income = input.movementType === "income";
    const suggestionQuery = () => client.from("notification_detected_movement_suggestions").select("id", { head: true, count: "exact" })
      .eq("workspace_id", scope.workspaceId).eq("user_id", scope.userId).eq("amount", income ? input.destinationAmount! : input.sourceAmount!)
      .eq("currency_code", currencyCode).eq("movement_type", input.movementType).in("status", ["pending", "needs_review", "registered"])
      .gte("occurred_at", from).lt("occurred_at", to);
    const queries = [suggestionQuery(), suggestionQuery().eq("status", "registered"), client.from("movements").select("id", { head: true, count: "exact" })
      .eq("workspace_id", scope.workspaceId).eq("movement_type", input.movementType).eq("status", "posted")
      .eq(income ? "destination_account_id" : "source_account_id", income ? input.destinationAccountId! : input.sourceAccountId!)
      .eq(income ? "destination_amount" : "source_amount", income ? input.destinationAmount! : input.sourceAmount!).gte("occurred_at", from).lt("occurred_at", to)];
    const results = await Promise.all(queries.map(query => signal ? query.abortSignal(signal) : query)); active(signal);
    if (results.some(result => result.error || !Number.isSafeInteger(result.count) || result.count! < 0)) throw new Error("No se pudo consultar la evidencia de coincidencias.");
    if (results[1].count! > results[0].count!) throw new Error("La evidencia cambió durante la consulta.");
    return { sameDaySuggestions: results[0].count!, sameDayRegisteredFromSuggestions: results[1].count!, sameDayMatchingMovements: results[2].count! };
  }
  async function check(suggestion: DetectedMovement, input: DetectionMovementInput, accounts: AccountSummary[], reconciled: MovementRecord | null,
    proAccessEnabled: boolean, permission: DuplicatePermission | null, signal?: AbortSignal): Promise<DetectionDuplicateDecision> {
    active(signal);
    if (input.userId !== scope.userId || input.workspaceId !== scope.workspaceId || suggestion.userId !== scope.userId || suggestion.workspaceId !== scope.workspaceId)
      throw new Error("La comprobación no pertenece a este usuario y espacio.");
    const canonical = reconciliationCandidateForDetectedInput(suggestion, input, accounts, reconciled);
    const matched = canonical && compatible(input, canonical) ? canonical : await candidate(input, signal);
    if (!matched) return { candidate: null, allowed: true, permission: null, ai: null };
    const currentPermission = { signature: detectedInputSignature(input), candidateKey: duplicateCandidateKey(matched) };
    if (permission?.signature === currentPermission.signature && permission.candidateKey === currentPermission.candidateKey)
      return { candidate: matched, allowed: true, permission: currentPermission, ai: null };
    let ai: DuplicateAiResult = { verdict: "skipped", reason: null };
    if (proAccessEnabled) {
      try {
        const evidence = await counts(input, suggestion.currencyCode, signal);
        if (evidence.sameDayMatchingMovements < 1) throw new Error("La coincidencia ya no está aplicada.");
        ai = await confirmDuplicateWithAi(client, { workspaceId: scope.workspaceId,
          suggestion: { description: input.description.trim() || suggestion.description, amountLabel: String(input.movementType === "income" ? input.destinationAmount : input.sourceAmount),
            occurredAt: input.occurredAt, sourceApp: suggestion.financialAppKey, rawText: suggestion.description || null },
          candidateMovement: { id: matched.id, description: matched.description || null, occurredAt: matched.occurredAt,
            amount: (input.movementType === "income" ? input.destinationAmount : input.sourceAmount)! }, counts: evidence }, signal);
      } catch { ai = unknown(); }
    }
    active(signal);
    if (ai.verdict === "distinct") {
      let query = client.from("movements").select("*").eq("workspace_id", scope.workspaceId).eq("id", matched.id).eq("status", "posted");
      if (signal) query = query.abortSignal(signal);
      const fresh = await query.maybeSingle(); active(signal);
      if (fresh.error || !fresh.data || duplicateCandidateKey(mapDetectedCandidate(fresh.data)) !== currentPermission.candidateKey)
        throw new Error("La coincidencia cambió durante la comprobación. Actualiza antes de guardar.");
    }
    return { candidate: matched, allowed: ai.verdict === "distinct", permission: currentPermission, ai };
  }
  return { check };
}
