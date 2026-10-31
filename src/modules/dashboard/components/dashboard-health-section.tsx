import { useMemo, type ComponentProps } from "react";
import type { SharedObligationSummary } from "../../../types/domain";
import type { buildDashboardHealth } from "../lib/dashboard-health";
import type { buildDashboardCashflow } from "../lib/projection/build-dashboard-cashflow";
import { buildDashboardScenarios } from "../lib/projection/dashboard-scenarios";
import { buildDashboardHealthReview } from "../lib/dashboard-health-review";
import { buildDashboardAiHealthPayload, type HealthProjectionConfidence } from "../lib/build-ai-health-payload";
import { useDashboardAiSummary } from "../hooks/use-dashboard-ai-summary";
import { DashboardCategorySuggestionsPanel, type DashboardCategoryReading } from "./dashboard-category-suggestions-panel";
import { DashboardHealthPanel } from "./dashboard-health-panel";
import { DashboardAiSummaryPanel } from "./dashboard-ai-summary-panel";
import { limaCalendarDay } from "../lib/projection/lima-calendar";

type Props = Omit<ComponentProps<typeof DashboardCategorySuggestionsPanel>, "renderExplanation"> & {
  shared: SharedObligationSummary[]; health: ReturnType<typeof buildDashboardHealth>; enabled: boolean; isAdmin: boolean; healthReady: boolean;
  cashflow: ReturnType<typeof buildDashboardCashflow> | null;
};

function DashboardHealthExplanation({ snapshot, health, ctx, userId, enabled, isAdmin, ready, healthReady, reading, review, projectionConfidence }: Props & {
  reading: DashboardCategoryReading; review: ReturnType<typeof buildDashboardHealthReview>; projectionConfidence: HealthProjectionConfidence;
}) {
  const payload = useMemo(() => ready && healthReady ? buildDashboardAiHealthPayload({ snapshot, health, reading, review, projectionConfidence, currency: ctx.displayCurrency }) : null,
    [ready, healthReady, snapshot, health, reading, review, projectionConfidence, ctx.displayCurrency]);
  const ai = useDashboardAiSummary({ userId, workspaceId: snapshot.workspace.id, currencyCode: ctx.displayCurrency, isAdmin, section: "health",
    contextKey: JSON.stringify(payload), enabled: enabled && payload !== null });
  if (!enabled) return null;
  return <details className="mt-6 border-t border-white/[0.07] pt-5">
    <summary className="cursor-pointer text-sm font-medium text-ink">Explicar mi salud financiera con IA</summary>
    <div className="mt-4"><DashboardAiSummaryPanel title="Tu salud financiera, explicada"
      description="Interpreta los indicadores y las sugerencias visibles. Solo se consulta al pulsar Generar; no aplica categorías ni cambia registros."
      contextLabel={`${health.savings.months[0].monthKey} a ${health.savings.months[5].monthKey} · Revisión reciente: 90 días · Lima · Una generación diaria por sección, sin renovarla al cambiar moneda o tono.`}
      tone={ai.tone} onToneChange={ai.setTone} isPending={ai.isPending} limitReached={ai.limitReached} response={ai.currentResponse}
      errorMessage={ai.error instanceof Error ? ai.error.message : null}
      unavailableReason={!userId ? "Inicia sesión para solicitar una explicación." : !ready || !healthReady || !reading.ready || reading.applying ? "Espera a que se comprueben los datos y termine cualquier actualización de categorías." : !payload ? "Comprueba las fechas, conversiones y fuentes de aprendizaje. No enviamos fuentes sin verificar a la IA." : null}
      onGenerate={() => { if (enabled && ready && healthReady && payload) void ai.requestSummary(snapshot.workspace.id, payload).catch(() => {}); }} />
    </div>
  </details>;
}

export function DashboardHealthSection(props: Props) {
  const { snapshot, shared, ctx, now, health, ready, healthReady, cashflow } = props;
  const review = useMemo(() => buildDashboardHealthReview(snapshot, shared, now), [snapshot, shared, now]);
  const projectionConfidence = useMemo(() => {
    const validIncomes = snapshot.recurringIncome.filter(row => row.status === "active").every(row => limaCalendarDay(row.nextExpectedDate) && (!row.endDate || limaCalendarDay(row.endDate)) && Number.isFinite(row.amount) && row.amount >= 0
      && ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"].includes(row.frequency) && (row.intervalCount == null || Number.isSafeInteger(row.intervalCount) && row.intervalCount > 0));
    const result = ready && healthReady && cashflow && validIncomes ? buildDashboardScenarios(snapshot, shared, cashflow, ctx, now) : null;
    return result?.model ? { score: result.model.confidence, label: result.model.confidenceLabel } : null;
  }, [ready, healthReady, cashflow, snapshot, shared, ctx, now]);
  return <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-x-11">
    <div>{ready && healthReady ? <DashboardHealthPanel model={health} currency={ctx.displayCurrency} /> : <p role="status" className="text-sm text-storm">Comprobando la salud financiera del espacio…</p>}</div>
    <div>
    {ready && healthReady ? <>
      {review.invalidDates ? <p role="status" className="mt-4 text-sm text-storm">Hay fechas por comprobar. No cerramos el recuento de señales con calendarios inválidos.</p> : <details className="mt-5 border-t border-white/[0.07] pt-4"><summary className="cursor-pointer text-sm font-medium text-ink">Por revisar · {review.review.totalIssues} señales</summary>
        <p className="mt-2 text-xs leading-5 text-storm">Suma de siete comprobaciones, no de registros únicos. Un registro puede tener varias señales; no son errores confirmados.</p>
        <dl className="mt-3 divide-y divide-white/[0.07] text-sm">{[["Sin categoría", review.review.uncategorizedCount], ["Pendientes por aplicar", review.review.pendingMovementsCount], ["Grupos de posibles duplicados", review.review.duplicateExpenseGroups], ["Suscripciones por revisar", review.review.subscriptionsAttentionCount], ["Obligaciones sin plan o fecha", review.review.obligationsWithoutPlanCount], ["Obligaciones sin actividad reciente", review.review.staleObligationsCount], ["Obligaciones vencidas", review.review.overdueObligationsCount]].map(([label, value]) => <div className="flex min-h-11 items-center justify-between gap-4" key={label}><dt className="text-storm">{label}</dt><dd className="tabular-nums text-ink">{value}</dd></div>)}</dl>
      </details>}</> : null}
    <DashboardCategorySuggestionsPanel {...props} canEdit={props.canEdit && props.enabled}
      renderExplanation={reading => <DashboardHealthExplanation {...props} reading={reading} review={review} projectionConfidence={projectionConfidence} />} />
    </div>
  </div>;
}
