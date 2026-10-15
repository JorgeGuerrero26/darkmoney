import type { SupabaseClient } from "@supabase/supabase-js";
import { isCategorizedCashflow } from "@darkmoney/shared/aggregations";
import { movementActsAsIncome } from "@darkmoney/shared/movement-amounts";
import { normalizeAnalyticsText } from "@darkmoney/shared/movement-features";
import type { CategorySummary, MovementRecord } from "../../types/domain";
import type { DashboardCategoryEvidence } from "../../modules/dashboard/lib/dashboard-category-suggestions";
import { isHistoryBalanceCorrection } from "../../modules/dashboard/lib/dashboard-health";

export async function readDashboardCategoryEvidence(client: SupabaseClient, workspaceId: number): Promise<DashboardCategoryEvidence> {
  const [signals, feedback] = await Promise.all([
    client.from("movement_analytics_signals").select("movement_id, suggested_category_id, suggested_category_confidence, signal_reasons").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(300),
    client.from("movement_learning_feedback").select("feedback_kind, accepted_category_id, normalized_description, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(300),
  ]);
  const unavailable: string[] = [];
  for (const [name, result] of [["movement_analytics_signals", signals], ["movement_learning_feedback", feedback]] as const) {
    if (!result.error) continue;
    if (["42P01", "PGRST205"].includes(result.error.code) && result.error.message.includes(name)) unavailable.push(name);
    else throw result.error;
  }
  return { unavailable, signals: signals.error ? [] : (signals.data ?? []).map(row => ({ movementId: Number(row.movement_id), suggestedCategoryId: row.suggested_category_id == null ? null : Number(row.suggested_category_id), confidence: row.suggested_category_confidence == null ? null : Number(row.suggested_category_confidence), reasons: Array.isArray(row.signal_reasons) ? row.signal_reasons.map(String) : [] })),
    feedback: feedback.error ? [] : (feedback.data ?? []).map(row => ({ feedbackKind: row.feedback_kind, acceptedCategoryId: row.accepted_category_id == null ? null : Number(row.accepted_category_id), normalizedDescription: row.normalized_description, createdAt: row.created_at })) };
}

export class CategoryApplyError extends Error {
  constructor(message: string, public readonly uncertain = false) { super(message); }
}

/** Category-only compare-and-set: never resaves money or synchronizes obligation events. RLS remains authoritative. */
export async function applyDashboardCategory(client: SupabaseClient, input: {
  workspaceId: number; userId: string; movement: MovementRecord; category: CategorySummary;
  confidence: number; canContinue: () => boolean;
}) {
  const { workspaceId, userId, movement, category, canContinue } = input;
  const checkScope = () => { if (!canContinue()) throw new CategoryApplyError("Cambió el contexto. Vuelve a revisar la sugerencia."); };
  checkScope();
  if (!Number.isSafeInteger(workspaceId) || workspaceId <= 0 || !userId || movement.workspaceId !== workspaceId || !Number.isSafeInteger(movement.id) || movement.id <= 0 || !Number.isSafeInteger(category.id) || category.id <= 0
    || movement.categoryId != null || !isCategorizedCashflow({ ...movement, categoryId: movement.categoryId ?? null, counterpartyId: movement.counterpartyId ?? null }) || isHistoryBalanceCorrection(movement) || !category.isActive) throw new CategoryApplyError("La sugerencia ya no es válida.");
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== userId) throw new CategoryApplyError("Comprueba la sesión antes de aplicar la categoría.");
  checkScope();
  const [membership, workspace, categoryResult, movementResult] = await Promise.all([
    client.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle(),
    client.from("workspaces").select("is_archived").eq("id", workspaceId).maybeSingle(),
    client.from("categories").select("id, name, kind, is_active").eq("workspace_id", workspaceId).eq("id", category.id).maybeSingle(),
    client.from("movements").select("id, movement_type, status, description, occurred_at, source_account_id, source_amount, destination_account_id, destination_amount, counterparty_id, category_id, updated_at").eq("workspace_id", workspaceId).eq("id", movement.id).maybeSingle(),
  ]);
  checkScope();
  if ([membership, workspace, categoryResult, movementResult].some(result => result.error)) throw new CategoryApplyError("No se pudo comprobar el movimiento y sus permisos. Actualiza antes de continuar.");
  if (!membership.data || !["owner", "admin", "member"].includes(membership.data.role) || !workspace.data || workspace.data.is_archived) throw new CategoryApplyError("No tienes permiso para modificar este espacio.");
  const remoteCategory = categoryResult.data, row = movementResult.data;
  const kind = movementActsAsIncome(movement) ? "income" : "expense";
  if (!remoteCategory?.is_active || remoteCategory.name !== category.name || !["both", kind].includes(remoteCategory.kind)) throw new CategoryApplyError("La categoría cambió o ya no es compatible. Actualiza y revisa otra vez.");
  const sameNumber = (a: unknown, b: number | null | undefined) => a == null ? b == null : b != null && Number(a) === b;
  if (!row || row.category_id != null || !row.updated_at || row.movement_type !== movement.movementType || row.status !== "posted" || row.description !== movement.description
    || new Date(row.occurred_at).getTime() !== new Date(movement.occurredAt).getTime() || !sameNumber(row.source_account_id, movement.sourceAccountId)
    || !sameNumber(row.destination_account_id, movement.destinationAccountId) || !sameNumber(row.source_amount, movement.sourceAmount)
    || !sameNumber(row.destination_amount, movement.destinationAmount) || !sameNumber(row.counterparty_id, movement.counterpartyId)) throw new CategoryApplyError("El movimiento cambió desde la revisión. Actualiza antes de aplicar.");
  checkScope();
  let result;
  try {
    result = await client.from("movements").update({ category_id: category.id, updated_by_user_id: userId })
      .eq("workspace_id", workspaceId).eq("id", movement.id).is("category_id", null).eq("updated_at", row.updated_at).select("id, category_id").maybeSingle();
  } catch { throw new CategoryApplyError("No se confirmó la categoría. Comprueba el movimiento antes de repetir.", true); }
  if (result.error) throw new CategoryApplyError("No se confirmó la categoría. Comprueba el movimiento antes de repetir.", true);
  if (!result.data) throw new CategoryApplyError("Otra edición cambió el movimiento. Actualiza y revisa su categoría.");
  if (Number(result.data.id) !== movement.id || Number(result.data.category_id) !== category.id) throw new CategoryApplyError("No se confirmó la categoría. Comprueba el movimiento antes de repetir.", true);
  let learningSaved = false;
  if (canContinue()) {
    try {
      const feedback = await client.from("movement_learning_feedback").insert({ workspace_id: workspaceId, user_id: userId, movement_id: movement.id,
        feedback_kind: "accepted_category_suggestion", normalized_description: normalizeAnalyticsText(movement.description) || null,
        previous_category_id: null, accepted_category_id: category.id, confidence: input.confidence, source: "dashboard-salud",
        metadata: { categoryName: category.name, description: movement.description } });
      learningSaved = !feedback.error;
    } catch { /* The category is already confirmed; learning must never cause a money/category retry. */ }
  }
  return { movementId: movement.id, categoryId: category.id, learningSaved };
}
