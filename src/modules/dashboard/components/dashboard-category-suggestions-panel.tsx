import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { formatCurrency } from "../../../lib/formatting/money";
import { supabase } from "../../../services/supabase/client";
import { applyDashboardCategory, CategoryApplyError, readDashboardCategoryEvidence } from "../../../services/queries/dashboard-categories";
import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import type { CategorySuggestionCandidate } from "../../movements/lib/category-suggestion-candidates";
import { buildDashboardCategorySuggestions, type DashboardCategoryEvidence } from "../lib/dashboard-category-suggestions";

type Result = { movementId: number; message: string };
type ReviewItem = { suggestion: CategorySuggestionCandidate; movement: WorkspaceSnapshot["movements"][number]; category: WorkspaceSnapshot["catalogs"]["categories"][number] };
export type DashboardCategoryReading = { suggestions: CategorySuggestionCandidate[]; evidence: DashboardCategoryEvidence | null; ready: boolean; failed: boolean; unconvertedCount: number; applying: boolean };
type Props = { snapshot: WorkspaceSnapshot; ctx: ParityConversionCtx; userId?: string; ready: boolean; canEdit: boolean; now: Date; renderExplanation?: (reading: DashboardCategoryReading) => ReactNode };
const emptyEvidence = { feedback: [], signals: [], unavailable: [] };

export function DashboardCategorySuggestionsPanel({ snapshot, ctx, userId, ready, canEdit, now, renderExplanation }: Props) {
  const queryClient = useQueryClient();
  const scopeKey = `${userId}:${snapshot.workspace.id}:${ctx.displayCurrency}`;
  const scope = useRef({ key: scopeKey });
  if (scope.current.key !== scopeKey) scope.current = { key: scopeKey };
  const alive = useRef(true), attempt = useRef<object | null>(null);
  const current = useRef({ ready, canEdit, userId });
  const [review, setReview] = useState<ReviewItem[] | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [accepted, setAccepted] = useState<Set<number>>(() => new Set());
  const [pending, setPending] = useState(false), [finished, setFinished] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { attempt.current = null; setReview(null); setResults([]); setAccepted(new Set()); setPending(false); setFinished(false); }, [scopeKey]);
  const evidence = useQuery({ queryKey: ["dashboard-category-evidence", userId, snapshot.workspace.id], enabled: Boolean(userId && supabase), staleTime: 30_000,
    queryFn: () => readDashboardCategoryEvidence(supabase!, snapshot.workspace.id) });
  const model = buildDashboardCategorySuggestions(snapshot, ctx, evidence.isError ? emptyEvidence : evidence.data ?? emptyEvidence, now);
  const suggestions = model.suggestions.filter(row => !accepted.has(row.movementId));
  const reading = !ready || evidence.isFetching || evidence.isPending;
  const writable = Boolean(canEdit && userId && supabase && !snapshot.workspace.isArchived && snapshot.workspace.role !== "viewer" && !reading);
  current.current = { ready: ready && !reading, canEdit: writable, userId };

  function openReview(items: CategorySuggestionCandidate[]) {
    if (!writable || attempt.current) return;
    const selected = items.flatMap(suggestion => {
      const movement = snapshot.movements.find(row => row.id === suggestion.movementId && row.categoryId == null);
      const category = snapshot.catalogs.categories.find(row => row.id === suggestion.suggestedCategoryId && row.isActive);
      return movement && category ? [{ suggestion, movement, category }] : [];
    });
    if (!selected.length) return;
    setReview(selected); setResults([]); setFinished(false);
  }
  function closeReview() { if (!attempt.current) setReview(null); }

  async function applyReviewed() {
    if (!review?.length || !writable || finished || attempt.current || !supabase || !userId) return;
    const token = {}, startedScope = scope.current, workspaceId = snapshot.workspace.id;
    attempt.current = token; setPending(true);
    const isCurrent = () => alive.current && scope.current === startedScope && attempt.current === token;
    const canContinue = () => isCurrent() && current.current.ready && current.current.canEdit && current.current.userId === userId;
    const output: Result[] = [];
    try {
      for (const item of review) {
        if (!canContinue()) break;
        try {
          const saved = await applyDashboardCategory(supabase, { workspaceId, userId, movement: item.movement, category: item.category,
            confidence: item.suggestion.confidence, canContinue });
          if (!isCurrent()) break;
          setAccepted(ids => new Set([...ids, saved.movementId]));
          output.push({ movementId: saved.movementId, message: saved.learningSaved ? "Categoría aplicada." : "Categoría aplicada. El aprendizaje quedó pendiente; no vuelvas a aplicar por ese motivo." });
        } catch (error) {
          if (!isCurrent()) break;
          output.push({ movementId: item.movement.id, message: error instanceof CategoryApplyError ? error.message : "No se confirmó el resultado. Comprueba el movimiento antes de repetir." });
          // Stop the batch on the first conflict/uncertain response; never silently retry a reviewed item.
          break;
        }
      }
    } finally {
      if (isCurrent()) {
        const attempted = new Set(output.map(row => row.movementId));
        setResults([...output, ...review.filter(row => !attempted.has(row.movement.id)).map(row => ({ movementId: row.movement.id, message: "No se envió. Actualiza los datos antes de iniciar otra revisión." }))]);
        setFinished(true); setPending(false); attempt.current = null;
      }
      // Invalidate only the initiating identity, even if the user has since left the panel.
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["workspace-snapshot", workspaceId, userId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-category-evidence", userId, workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["movement-learning-feedback", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["categories-overview", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["detection-learning", userId, workspaceId] }),
      ]);
    }
  }

  return <section aria-label="Sugerencias de categorías" className="mt-6 border-t border-white/[0.07] pt-6">
    <h2 className="text-base font-semibold text-ink">Categorías por completar</h2>
    <p className="mt-2 text-xs leading-5 text-storm">Sugerencias de los últimos 90 días. Revisas antes de aplicar; no cambian importes, cuentas ni pagos vinculados.</p>
    {reading ? <p className="mt-4 text-sm text-storm" role="status">Comprobando las sugerencias del espacio…</p>
      : model.unconvertedCount ? <p className="mt-4 text-sm text-storm" role="status">{model.unconvertedCount} movimientos sin conversión. Las sugerencias monetarias esperan una referencia completa.</p>
      : <>
        {evidence.isError || evidence.data?.unavailable.length ? <p className="mt-3 text-xs leading-5 text-storm" role="status">No está disponible todo el aprendizaje guardado. Se muestran solo las fuentes que pudieron comprobarse.</p> : null}
        <div className="mt-4 divide-y divide-white/[0.07]">{suggestions.map(row => <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3" key={row.movementId}>
          <div className="min-w-0"><p className="text-sm font-medium text-ink">{row.description}</p><p className="mt-1 text-xs text-storm">{formatCurrency(row.amount, ctx.displayCurrency)} · {row.suggestedCategoryName}</p></div>
          <Button disabled={!writable || pending} onClick={() => openReview([row])} variant="ghost">Revisar categoría</Button>
        </div>)}</div>
        {!suggestions.length ? <p className="mt-3 text-sm text-storm">No hay sugerencias claras para estos movimientos.</p> : null}
        {suggestions.length > 1 ? <Button className="mt-3" disabled={!writable || pending} onClick={() => openReview(suggestions)} variant="secondary">Revisar las {suggestions.length} sugerencias</Button> : null}
        {!canEdit || snapshot.workspace.role === "viewer" ? <p className="mt-3 text-xs text-storm">Tu acceso permite consultar, pero no aplicar categorías.</p> : null}
      </>}
    {renderExplanation?.({ suggestions, evidence: evidence.isError ? null : evidence.data ?? null, ready: !reading, failed: evidence.isError, unconvertedCount: model.unconvertedCount, applying: pending })}
    {review ? <Modal className={resourceEditorSurfaceClassName} labelledBy="category-review-title" onClose={closeReview} disableOutsideClose={pending}>
      <ResourceEditorHeader disabled={pending} onClose={closeReview} title="Revisar categorías" titleId="category-review-title" />
      <ModalBody><p className="mb-3 text-sm leading-6 text-storm">Solo se guardará la categoría de cada movimiento. La coincidencia orienta; no garantiza que la categoría sea correcta.</p>
        <div className="divide-y divide-white/10">{review.map(({ suggestion: row }) => <div className="py-4" key={row.movementId}>
          <Link className="text-sm font-medium text-ink underline underline-offset-4" to={`/app/movements?period=all&movement=${row.movementId}`}>{row.description}</Link>
          <p className="mt-2 text-sm text-ink">Sin categoría → {row.suggestedCategoryName} · {formatCurrency(row.amount, ctx.displayCurrency)}</p>
          <p className="mt-2 text-xs leading-5 text-storm">Coincidencia {Math.round(row.confidence * 100)}% · {row.reasons.join(" · ")}</p>
          {results.find(result => result.movementId === row.movementId) ? <p className="mt-2 text-sm leading-5 text-ink" role="status">{results.find(result => result.movementId === row.movementId)!.message}</p> : null}
        </div>)}</div>
      </ModalBody>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-4 sm:px-6">
        <Button disabled={pending} onClick={closeReview} variant="ghost">{finished ? "Cerrar" : "Cancelar"}</Button>
        {!finished ? <Button disabled={!writable || pending} onClick={() => void applyReviewed()}>{pending ? "Aplicando…" : review.length === 1 ? "Aplicar categoría" : `Aplicar ${review.length} categorías`}</Button> : null}
      </footer>
    </Modal> : null}
  </section>;
}
