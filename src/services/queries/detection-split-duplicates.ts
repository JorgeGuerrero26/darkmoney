import type { SupabaseClient } from "@supabase/supabase-js";
import { detectionObject, type DetectedMovement } from "../../modules/notifications/lib/detected-movement";
import type { DetectionSplitSubmission } from "../../modules/notifications/lib/detection-split-submission";
import type { DetectionDuplicateDecision, DuplicatePermission } from "./detection-duplicates";
import { detectionDuplicateBounds } from "../../modules/notifications/lib/detection-duplicate-bounds";
import { mapDetectedCandidate } from "./detected-movement-store";

const key = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, "").trim();
const positiveId = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
function cents(value: unknown) {
  if ((typeof value !== "number" && typeof value !== "string") || !/^[0-9]+(\.[0-9]{1,2})?$/.test(String(value))) return null;
  const n = Math.round(Number(value) * 100);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
function index(value: unknown) {
  const n = Number(value);
  return /^[1-9][0-9]{0,2}$/.test(String(value)) && n <= 100 ? n : null;
}
function instant(value: unknown) {
  const s = String(value), fraction = /\.(\d{1,6})(?:Z|[+-]\d{2}:\d{2})$/.exec(s)?.[1] ?? "";
  return `${Date.parse(s)}:${fraction.padEnd(6, "0").slice(3)}`;
}
function active(signal?: AbortSignal) {
  if (signal?.aborted) throw Object.assign(new Error("La comprobación se canceló. Revisa antes de guardar."), { name: "AbortError" });
}
type Page = { data: unknown[] | null; error: unknown; count: number | null };
async function pages(build: (offset: number) => PromiseLike<Page>, signal?: AbortSignal) {
  const rows: Record<string, unknown>[] = [], ids = new Set<number>();
  let expected: number | null = null;
  for (let offset = 0; ; offset += 500) {
    active(signal); const result = await build(offset); active(signal);
    if (result.error || !Number.isSafeInteger(result.count) || result.count! < 0 || (expected !== null && expected !== result.count))
      throw new Error("No se pudo comprobar el historial completo. Actualiza antes de guardar.");
    expected = result.count;
    for (const value of result.data ?? []) {
      const row = detectionObject(value), id = Number(row.id);
      if (!positiveId(row.id) || ids.has(id)) throw new Error("El historial cambió durante la consulta. Actualiza antes de guardar.");
      ids.add(id); rows.push(row);
    }
    if (!result.data || result.data.length < 500) {
      if (rows.length !== expected) throw new Error("El historial quedó incompleto. Actualiza antes de guardar.");
      return rows;
    }
  }
}

/** Compare complete native receipts, not an amount-filtered subset of split parts. Manual confirmation:
 * the existing AI endpoint counts ledger rows, so its evidence is not safe for virtual group totals. */
export async function checkDetectedSplitDuplicates(client: SupabaseClient, scope: { userId: string; workspaceId: number },
  suggestion: DetectedMovement, value: DetectionSplitSubmission, permission: DuplicatePermission | null, signal?: AbortSignal): Promise<DetectionDuplicateDecision> {
  const { input, parts } = value;
  if (input.userId !== scope.userId || input.workspaceId !== scope.workspaceId || suggestion.userId !== scope.userId || suggestion.workspaceId !== scope.workspaceId)
    throw new Error("La comprobación no pertenece a este usuario y espacio.");
  const income = input.movementType === "income", side = income ? "destination" : "source";
  const account = income ? input.destinationAccountId : input.sourceAccountId, amount = cents(income ? input.destinationAmount : input.sourceAmount);
  if (!positiveId(account) || amount === null) throw new Error("Revisa cuenta e importe antes de comprobar coincidencias.");
  const { from, to } = detectionDuplicateBounds(input.occurredAt);
  const day = await pages(offset => {
    let query = client.from("movements").select("*", { count: "exact" }).eq("workspace_id", scope.workspaceId)
      .eq("movement_type", input.movementType).eq(`${side}_account_id`, account!).gte("occurred_at", from).lt("occurred_at", to)
      .order("id").range(offset, offset + 499);
    if (signal) query = query.abortSignal(signal);
    return query;
  }, signal);
  const groups = [...new Set(day.map(row => detectionObject(row.metadata).split_group).filter((g): g is string => typeof g === "string" && Boolean(g.trim())))];
  const allParts: Record<string, unknown>[] = [];
  for (let start = 0; start < groups.length; start += 40) {
    const batch = groups.slice(start, start + 40);
    const rows = await pages(offset => {
      let query = client.from("movements").select("*", { count: "exact" }).eq("workspace_id", scope.workspaceId)
        .in("metadata->>split_group", batch).order("id").range(offset, offset + 499);
      if (signal) query = query.abortSignal(signal);
      return query;
    }, signal);
    if (rows.some(row => Number(row.workspace_id) !== scope.workspaceId || !batch.includes(String(detectionObject(row.metadata).split_group))))
      throw new Error("El recibo pertenece a otro espacio o grupo.");
    allParts.push(...rows);
  }
  const receipts: Array<{ row: Record<string, unknown>; fingerprint: string }> = [];
  for (const group of groups) {
    const items = allParts.filter(row => detectionObject(row.metadata).split_group === group);
    // No stale reuse if the second query lost a row or the first read changed.
    for (const row of day.filter(row => detectionObject(row.metadata).split_group === group)) {
      if (!items.some(part => Number(part.id) === Number(row.id) && JSON.stringify(part) === JSON.stringify(row)))
        throw new Error("La división cambió durante la comprobación. Actualiza antes de guardar.");
    }
    if (items.length && items.every(row => row.status !== "posted")) continue;
    const heads = items.filter(row => index(detectionObject(row.metadata).split_index) === 1), head = heads.length === 1 ? heads[0] : null;
    const n = index(detectionObject(head?.metadata).split_total), indices = new Set<number>();
    let total = 0, valid = Boolean(head && n && n >= 2 && items.length === n && typeof head.created_by_user_id === "string" && head.created_by_user_id && Number.isFinite(Date.parse(String(head.occurred_at))));
    for (const row of items) {
      const meta = detectionObject(row.metadata), i = index(meta.split_index), partAmount = cents(row[`${side}_amount`]);
      if (!head || i === null || !n || i > n || indices.has(i) || index(meta.split_total) !== n || row.status !== "posted" ||
          row.movement_type !== input.movementType || Number(row.workspace_id) !== scope.workspaceId || Number(row[`${side}_account_id`]) !== account ||
          row[income ? "source_account_id" : "destination_account_id"] != null || row[income ? "source_amount" : "destination_amount"] != null ||
          row.created_by_user_id !== head.created_by_user_id || instant(row.occurred_at) !== instant(head.occurred_at) || partAmount === null ||
          (row.subscription_id != null && row.subscription_id !== head.subscription_id)) valid = false;
      if (i !== null) indices.add(i);
      if (partAmount !== null) total += partAmount;
    }
    if (!valid || !head || !Number.isSafeInteger(total)) throw new Error("Hay una división incompleta o incompatible. Revísala antes de registrar otra.");
    const suffix = ` (1/${n})`, description = String(head.description ?? "");
    receipts.push({ row: { ...head, description: description.endsWith(suffix) ? description.slice(0, -suffix.length) : description, [`${side}_amount`]: total / 100 },
      fingerprint: JSON.stringify(items.sort((a, b) => Number(a.id) - Number(b.id))) });
  }
  for (const row of day) {
    const meta = detectionObject(row.metadata);
    if (typeof meta.split_group === "string" && meta.split_group.trim()) continue;
    if ("split_group" in meta || "split_index" in meta || "split_total" in meta) throw new Error("Hay una división inválida. Revísala antes de guardar.");
    if (Number(row.workspace_id) !== scope.workspaceId) throw new Error("El historial pertenece a otro espacio.");
    if (row.status === "posted") receipts.push({ row, fingerprint: JSON.stringify(row) });
  }
  const matched = receipts.find(({ row }) => cents(row[`${side}_amount`]) === amount && key(String(row.description ?? "")) === key(input.description));
  if (!matched) return { candidate: null, allowed: true, permission: null, ai: null };
  const candidate = mapDetectedCandidate(matched.row), currentPermission = {
    signature: JSON.stringify([input, parts, suggestion.updatedAt]),
    candidateKey: matched.fingerprint,
  };
  return { candidate, allowed: permission?.signature === currentPermission.signature && permission.candidateKey === currentPermission.candidateKey,
    permission: currentPermission, ai: { verdict: "skipped", reason: "Revisa el recibo completo: la coincidencia se compara por su total, no por una parte." } };
}
