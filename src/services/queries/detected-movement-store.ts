import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountSummary, CategorySummary, JsonValue, MovementRecord } from "../../types/domain";
import { requestDetectedRegistrationUndo } from "../../modules/notifications/lib/detection-undo.ts";
import { requestDetectedSplit } from "../../modules/notifications/lib/detection-split.ts";
import { detectionSplitRequest, type DetectionSplitSubmission } from "../../modules/notifications/lib/detection-split-submission.ts";
import { omissionTargets, omissionGroups, type DetectionOmissionInput, type DetectionOmissionResult } from "../../modules/notifications/lib/detection-omissions.ts";
import { detectionObject, detectionPending, detectedWriteInput, validateDetectedMovement,
  type DetectedMovement, type DetectionMovementInput, type DetectionStatus } from "../../modules/notifications/lib/detected-movement.ts";

type Scope = { userId: string; workspaceId: number };
/** Usuarios con acceso PRO por correo confirmado en esta sesión (un "no" explícito lo retira). */
const confirmedEmailProAccess = new Set<string>();
const TABLE = "notification_detected_movement_suggestions";

export function mapDetectedMovement(value: unknown): DetectedMovement {
  const row = detectionObject(value);
  const id = Number(row.id), workspaceId = Number(row.workspace_id), amount = Number(row.amount);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(workspaceId) || workspaceId <= 0 ||
      typeof row.user_id !== "string" || !Number.isFinite(amount) || amount <= 0 ||
      !["expense", "income", "transfer", "unknown"].includes(String(row.movement_type)) ||
      !["pending", "needs_review", "registered", "discarded", "duplicate"].includes(String(row.status)) ||
      !["PEN", "USD"].includes(String(row.currency_code)) || !Number.isFinite(Date.parse(String(row.occurred_at)))) {
    throw new Error("La detección contiene datos inválidos. No se guardó ningún movimiento.");
  }
  return { id, workspaceId, userId: row.user_id, amount, currencyCode: String(row.currency_code),
    financialAppKey: String(row.financial_app_key ?? ""), packageName: String(row.package_name ?? ""),
    appLabel: String(row.app_label ?? "App financiera"), movementType: row.movement_type as DetectedMovement["movementType"],
    description: String(row.description ?? ""), occurredAt: String(row.occurred_at), confidence: String(row.confidence ?? "low"),
    status: row.status as DetectionStatus, movementId: row.movement_id == null ? null : Number(row.movement_id),
    metadata: (row.metadata ?? null) as JsonValue | null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null };
}

export function mapDetectedCandidate(value: unknown): MovementRecord {
  const row = detectionObject(value);
  const nullableNumber = (key: string) => row[key] == null ? null : Number(row[key]);
  return { id: Number(row.id), workspaceId: Number(row.workspace_id), movementType: row.movement_type as MovementRecord["movementType"],
    status: row.status as MovementRecord["status"], description: String(row.description ?? ""), occurredAt: String(row.occurred_at ?? ""),
    category: "", counterparty: "", sourceAccountId: nullableNumber("source_account_id"), sourceAccountName: null,
    sourceAmount: nullableNumber("source_amount"), destinationAccountId: nullableNumber("destination_account_id"),
    destinationAccountName: null, destinationAmount: nullableNumber("destination_amount"), metadata: (row.metadata ?? null) as JsonValue | null };
}

export function createDetectedMovementStore(client: SupabaseClient, scope: Scope) {
  const scoped = () => client.from(TABLE).select("*").eq("user_id", scope.userId).eq("workspace_id", scope.workspaceId);
  async function get(id: number) {
    const { data, error } = await scoped().eq("id", id).maybeSingle();
    if (error) throw new Error("No se pudo consultar el estado actual de la detección.");
    return data ? mapDetectedMovement(data) : null;
  }
  async function pro(suggestion: DetectedMovement) {
    if (suggestion.packageName !== "email:inbound") return;
    const { data, error } = await client.rpc("has_email_detection_pro_access");
    if (error) {
      // Como móvil: un fallo de red al volver a verificar no bloquea si el acceso ya se confirmó en esta
      // sesión; el servidor vuelve a exigir PRO al registrar. Sin confirmación previa, se pide reintentar.
      if (confirmedEmailProAccess.has(scope.userId)) return;
      throw new Error("No se pudo verificar el acceso PRO. Revisa tu conexión y reintenta.");
    }
    if (data !== true) {
      confirmedEmailProAccess.delete(scope.userId);
      throw new Error("La detección por correo requiere DarkMoney PRO activo.");
    }
    confirmedEmailProAccess.add(scope.userId);
  }
  async function reconcile(suggestionId?: number) {
    const { data, error } = await client.rpc("reconcile_detected_movements", {
      p_workspace_id: scope.workspaceId, p_suggestion_id: suggestionId ?? null,
    });
    if (error) throw new Error("No se pudieron conciliar las detecciones. Actualiza o reintenta; no se registrará sin esta comprobación.");
    const result = detectionObject(data);
    if (!Array.isArray(result.resolvedIds) || !Array.isArray(result.candidates)) throw new Error("La conciliación devolvió una respuesta inválida.");
    return { resolvedIds: result.resolvedIds.map(Number), candidates: new Map(result.candidates.map((value) => {
      const item = detectionObject(value);
      return [Number(item.suggestionId), mapDetectedCandidate(item.movement)] as const;
    })) };
  }
  async function review(id: number) {
    let suggestion = await get(id);
    if (!suggestion || !detectionPending(suggestion)) return { suggestion, candidate: null };
    await pro(suggestion);
    const result = await reconcile(id);
    if (result.resolvedIds.includes(id)) suggestion = await get(id);
    return { suggestion, candidate: result.candidates.get(id) ?? null };
  }
  async function pending() {
    await reconcile();
    const rows: DetectedMovement[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await scoped().in("status", ["pending", "needs_review"]).order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 499);
      if (error) throw new Error("No se pudieron cargar las detecciones pendientes.");
      rows.push(...(data ?? []).map(mapDetectedMovement));
      if (!data || data.length < 500) return rows;
    }
  }
  async function read(id: number) {
    try {
      const { error } = await client.from("notifications").update({ status: "read", read_at: new Date().toISOString() })
        .eq("user_id", scope.userId).eq("kind", "detected_movement_suggestion")
        .eq("related_entity_type", "detected_movement_suggestion").eq("related_entity_id", id).neq("status", "read");
      return !error;
    } catch { return false; }
  }
  async function assertPostedMovement(movementId: number | null) {
    if (movementId == null || !Number.isSafeInteger(movementId) || movementId <= 0) throw new Error("El movimiento asociado no está disponible en este espacio.");
    const { data, error } = await client.from("movements").select("id").eq("workspace_id", scope.workspaceId).eq("id", movementId).eq("status", "posted").maybeSingle();
    if (error || !data) throw new Error("El movimiento asociado no está disponible en este espacio.");
  }
  async function resolve(suggestion: DetectedMovement, status: "discarded" | "duplicate" | "registered", movementId: number | null = null) {
    if (suggestion.userId !== scope.userId || suggestion.workspaceId !== scope.workspaceId) throw new Error("La detección no pertenece a este espacio.");
    await pro(suggestion);
    if (!detectionPending(suggestion)) throw new Error("Esta detección ya fue resuelta. Actualiza la revisión.");
    if (status !== "discarded") {
      await assertPostedMovement(movementId);
    }
    const { data, error } = await client.from(TABLE).update({ status, movement_id: movementId, updated_at: new Date().toISOString() })
      .eq("user_id", scope.userId).eq("workspace_id", scope.workspaceId).eq("id", suggestion.id).eq("status", suggestion.status).select("*").maybeSingle();
    if (error || !data) throw new Error("La detección cambió en otro dispositivo. Actualiza antes de continuar.");
    return { suggestion: mapDetectedMovement(data), readingUpdated: await read(suggestion.id) };
  }
  async function restoreDiscarded(id: number) {
    const suggestion = await get(id);
    if (!suggestion || suggestion.status !== "discarded" || suggestion.movementId != null) throw new Error("La detección cambió y ya no puede deshacerse esta omisión.");
    await pro(suggestion);
    const { data, error } = await client.from(TABLE).update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("user_id", scope.userId).eq("workspace_id", scope.workspaceId).eq("id", id).eq("status", "discarded").is("movement_id", null).select("*").maybeSingle();
    if (error || !data) throw new Error("La detección cambió en otro dispositivo. Actualiza antes de deshacer.");
    return mapDetectedMovement(data);
  }
  async function register(id: number, input: DetectionMovementInput, accounts: AccountSummary[], create: (input: DetectionMovementInput) => Promise<number>, checkDuplicate?: (suggestion: DetectedMovement, candidate: MovementRecord | null) => Promise<void>, categories?: CategorySummary[]) {
    let suggestion = await get(id);
    if (!suggestion) throw new Error("La detección no está disponible en este espacio.");
    validateDetectedMovement(suggestion, input, accounts, categories);
    await pro(suggestion);
    if (suggestion.status === "registered" && suggestion.movementId) {
      await assertPostedMovement(suggestion.movementId);
      return { movementId: suggestion.movementId, readingUpdated: await read(id) };
    }
    if (!detectionPending(suggestion)) throw new Error("Esta detección ya fue resuelta. Actualiza la revisión.");
    const reconciliation = await reconcile(id);
    if (reconciliation.resolvedIds.includes(id)) throw new Error("Esta detección ya coincide con un movimiento. Actualiza para verlo.");
    await checkDuplicate?.(suggestion, reconciliation.candidates.get(id) ?? null);
    if (checkDuplicate) {
      // A delayed AI response must not authorize saving a detection resolved/edited meanwhile.
      const latest = await get(id);
      if (!latest || !detectionPending(latest) || JSON.stringify(latest) !== JSON.stringify(suggestion))
        throw new Error("La detección cambió durante la comprobación. Actualiza antes de guardar.");
    }
    const movementId = await create(detectedWriteInput(suggestion, input));
    // The mobile transaction trigger resolves simple registrations. Never demote a concurrent result.
    suggestion = await get(id);
    if (!suggestion) throw new Error("El movimiento se guardó, pero no se pudo confirmar la detección. Reintenta con la misma clave.");
    if (detectionPending(suggestion)) return { movementId, ...(await resolve(suggestion, "registered", movementId)) };
    if (suggestion.status !== "registered" || suggestion.movementId !== movementId) throw new Error("La detección cambió en otro dispositivo. Actualiza para comprobar el movimiento.");
    return { movementId, readingUpdated: await read(id) };
  }
  async function undoRegistration(suggestionId: number, movementId: number) {
    return requestDetectedRegistrationUndo(client, { workspaceId: scope.workspaceId, suggestionId, movementId });
  }
  async function registerSplit(id: number, expectedUpdatedAt: string, value: DetectionSplitSubmission, accounts: AccountSummary[], categories: CategorySummary[],
    checkDuplicate: (suggestion: DetectedMovement, value: DetectionSplitSubmission) => Promise<void>, assertActive: () => void) {
    // Snapshot before any I/O. Edits to the caller's parts cannot alter a pending save.
    const captured = JSON.parse(JSON.stringify(value)) as DetectionSplitSubmission;
    assertActive();
    const suggestion = await get(id); assertActive();
    if (!suggestion) throw new Error("La detección no está disponible en este espacio.");
    validateDetectedMovement(suggestion, captured.input, accounts, categories);
    const request = detectionSplitRequest(captured, id, expectedUpdatedAt, suggestion.currencyCode);
    if (captured.parts.some(part => !categories.some(category => category.id === part.categoryId && category.isActive &&
        (category.kind === captured.input.movementType || category.kind === "both")))) throw new Error("Revisa las categorías activas de cada parte.");
    await pro(suggestion); assertActive();
    if (suggestion.status !== "registered") {
      if (!detectionPending(suggestion) || suggestion.updatedAt !== expectedUpdatedAt) throw new Error("La detección cambió. Actualiza antes de guardar.");
      await checkDuplicate(suggestion, captured); assertActive();
      const latest = await get(id); assertActive();
      if (!latest || JSON.stringify(latest) !== JSON.stringify(suggestion)) throw new Error("La detección cambió durante la comprobación. Actualiza antes de guardar.");
    }
    // Exact registered retries are checked by the RPC, never accepted by ID alone.
    const result = await requestDetectedSplit(client, request);
    // A committed transaction is not cancelled retroactively; reading is separate.
    return { ...result, readingUpdated: await read(id) };
  }
  async function omissions(input: DetectionOmissionInput): Promise<DetectionOmissionResult> {
    const targets = omissionTargets(scope.userId, scope.workspaceId, input);
    const result: DetectionOmissionResult = { changes: [], failed: 0, skipped: 0, readingUpdated: true };
    let emailAllowed = true;
    const email = targets.find(({ before }) => before.packageName === "email:inbound");
    if (email) { try { await pro(email.before); } catch { emailAllowed = false; } }
    const eligible = targets.filter(({ before }) => emailAllowed || before.packageName !== "email:inbound");
    result.failed = targets.length - eligible.length;
    for (const group of omissionGroups(eligible, input.action)) {
      try {
        let update = client.from(TABLE).update({
          status: input.action === "omit" ? "discarded" : group[0].before.status,
          movement_id: null, updated_at: new Date().toISOString(),
        }).eq("user_id", scope.userId).eq("workspace_id", scope.workspaceId)
          .in("id", group.map(({ before }) => before.id)).is("movement_id", null);
        update = input.action === "omit" ? update.eq("status", group[0].before.status)
          : update.eq("status", "discarded").eq("updated_at", group[0].after.updatedAt!);
        const { data, error } = await update.select("*");
        if (error) throw error;
        const originals = new Map(group.map(({ before }) => [before.id, before]));
        const changes = (data ?? []).map((row) => {
          const after = mapDetectedMovement(row), before = originals.get(after.id);
          if (!before || after.userId !== scope.userId || after.workspaceId !== scope.workspaceId ||
            after.movementId != null || after.status !== (input.action === "omit" ? "discarded" : before.status)) {
            throw new Error("No se pudo confirmar el estado actualizado.");
          }
          return { before, after };
        });
        result.changes.push(...changes);
      } catch { result.failed += group.length; }
    }
    result.skipped = targets.length - result.failed - result.changes.length;
    if (input.action === "omit" && input.markNotificationsRead === true) {
      for (const { after } of result.changes) {
        if (!(await read(after.id))) result.readingUpdated = false;
      }
    }
    return result;
  }
  return { get, review, pending, resolve, register, registerSplit, restoreDiscarded, undoRegistration, omissions };
}
