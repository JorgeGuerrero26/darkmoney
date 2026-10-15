import { isCategorizedCashflow } from "@darkmoney/shared/aggregations";
import { convertParityAmount } from "@darkmoney/shared/currency";
import { movementActsAsIncome, movementDisplayAccountId, movementDisplayAmount } from "@darkmoney/shared/movement-amounts";
import { normalizeAnalyticsText } from "@darkmoney/shared/movement-features";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import type { CategoryLearningFeedback } from "../../movements/lib/local-category-suggestion";
import { buildCategorySuggestionCandidates, type CategorySuggestionCandidate } from "../../movements/lib/category-suggestion-candidates";
import { isHistoryBalanceCorrection } from "./dashboard-health";

export type CategorySignal = {
  movementId: number;
  suggestedCategoryId: number | null;
  confidence: number | null;
  reasons: string[];
};
export type DashboardCategoryEvidence = { feedback: CategoryLearningFeedback[]; signals: CategorySignal[]; unavailable: string[] };

/** Mobile dashboard feedback ranking (different confidence contract from the movement editor). */
export function dashboardLearnedCategorySuggestions(
  movements: WorkspaceSnapshot["movements"], feedback: CategoryLearningFeedback[],
  categoryNames: Map<number, string>, amountOf: (movement: WorkspaceSnapshot["movements"][number]) => number,
): CategorySuggestionCandidate[] {
  const accepted = feedback.filter(row => row.acceptedCategoryId != null && ["accepted_category_suggestion", "manual_category_change"].includes(row.feedbackKind));
  const tokens = (value: string) => new Set(normalizeAnalyticsText(value).split(" ").filter(word => word.length >= 3));
  return movements.filter(row => isCategorizedCashflow({ ...row, categoryId: row.categoryId ?? null, counterpartyId: row.counterpartyId ?? null }) && row.categoryId == null).flatMap(row => {
    const normalized = normalizeAnalyticsText(row.description);
    if (!normalized) return [];
    const current = tokens(normalized);
    const matches = accepted.map(item => {
      const learned = item.normalizedDescription ?? "", previous = tokens(learned), union = new Set([...current, ...previous]);
      const similarity = learned === normalized ? 1 : union.size ? [...union].filter(word => current.has(word) && previous.has(word)).length / union.size : 0;
      return { item, similarity };
    }).filter(item => item.similarity >= 0.58).sort((a, b) => b.similarity - a.similarity || new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime());
    const best = matches[0];
    if (!best?.item.acceptedCategoryId) return [];
    return [{ movementId: row.id, description: row.description.trim() || "Movimiento sin descripción", occurredAt: row.occurredAt,
      amount: amountOf(row), suggestedCategoryId: best.item.acceptedCategoryId, suggestedCategoryName: categoryNames.get(best.item.acceptedCategoryId) ?? "Categoría sugerida",
      confidence: Math.max(0.62, Math.min(0.98, 0.56 + best.similarity * 0.26 + Math.min(matches.length, 4) * 0.035)), matchedSamples: matches.length,
      reasons: ["aprendido de una corrección tuya", best.similarity >= 0.92 ? "texto casi igual" : "texto parecido", `${matches.length} respuesta${matches.length === 1 ? "" : "s"} usada${matches.length === 1 ? "" : "s"}`] }];
  }).sort((a, b) => b.confidence - a.confidence || new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 4);
}

export function buildDashboardCategorySuggestions(snapshot: WorkspaceSnapshot, ctx: ParityConversionCtx, evidence: DashboardCategoryEvidence, now = new Date()) {
  const categories = snapshot.catalogs.categories.filter(row => row.isActive);
  const rows = snapshot.movements.map(row => ({ ...row, categoryId: row.categoryId ?? null, counterpartyId: row.counterpartyId ?? null })).filter(row => row.workspaceId === snapshot.workspace.id && isCategorizedCashflow(row) && !isHistoryBalanceCorrection(row)
    && new Date(row.occurredAt) <= now && new Date(row.occurredAt).getTime() >= now.getTime() - 90 * 86400000);
  const amounts = new Map<number, number>(); let unconvertedCount = 0;
  for (const row of rows) {
    const amount = convertParityAmount({ amount: movementDisplayAmount(row), currencyCode: ctx.accountCurrencyMap.get(movementDisplayAccountId(row) ?? 0), baseCurrencyCode: ctx.baseCurrency, targetCurrencyCode: ctx.displayCurrency, exchangeRateMap: ctx.exchangeRateMap });
    if (amount === null || !Number.isFinite(amount)) unconvertedCount++; else amounts.set(row.id, amount);
  }
  if (unconvertedCount) return { suggestions: [] as CategorySuggestionCandidate[], unconvertedCount };
  const amountOf = (row: WorkspaceSnapshot["movements"][number]) => amounts.get(row.id) ?? 0;
  const categoryNames = new Map(categories.map(row => [row.id, row.name]));
  const compatible = (row: typeof rows[number], categoryId: number) => categories.some(category => category.id === categoryId && (category.kind === "both" || category.kind === (movementActsAsIncome(row) ? "income" : "expense")));
  const learned = dashboardLearnedCategorySuggestions(rows, evidence.feedback, categoryNames, amountOf);
  const persisted = evidence.signals.flatMap(signal => {
    const row = rows.find(item => item.id === signal.movementId);
    if (!row || row.categoryId != null || !signal.suggestedCategoryId || !Number.isFinite(signal.confidence) || signal.confidence! < 0.6 || signal.confidence! > 1) return [];
    return [{ movementId: row.id, description: row.description.trim() || "Movimiento sin descripción", occurredAt: row.occurredAt, amount: amountOf(row),
      suggestedCategoryId: signal.suggestedCategoryId, suggestedCategoryName: categoryNames.get(signal.suggestedCategoryId) ?? "Categoría sugerida", confidence: signal.confidence!, matchedSamples: 0,
      reasons: signal.reasons.length ? signal.reasons : ["señal analítica persistida"] }];
  }).sort((a, b) => b.confidence - a.confidence || new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 4);
  const generated = buildCategorySuggestionCandidates({ movements: rows.map(row => ({ ...row, categoryId: row.categoryId ?? null, counterpartyId: row.counterpartyId ?? null })), categories,
    isCashflow: isCategorizedCashflow, isIncomeLike: movementActsAsIncome, getAmount: amountOf, limit: 4, targetLimit: 10 });
  const seen = new Set<number>();
  const suggestions = [...learned, ...persisted, ...generated].filter(item => {
    const row = rows.find(row => row.id === item.movementId);
    if (!row || row.categoryId != null || !compatible(row, item.suggestedCategoryId) || seen.has(row.id)) return false;
    seen.add(row.id); return true;
  }).sort((a, b) => b.amount - a.amount || b.confidence - a.confidence).slice(0, 4);
  return { suggestions, unconvertedCount };
}
