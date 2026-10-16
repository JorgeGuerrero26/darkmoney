import { useMemo } from "react";
import type { ComponentProps } from "react";
import { useDashboardAiSummary } from "../hooks/use-dashboard-ai-summary";
import { buildDashboardAiFlowPayload } from "../lib/build-ai-flow-payload";
import { buildDashboardFlowDetails } from "../lib/projection/dashboard-flow-details";
import type { buildDashboardHealth } from "../lib/dashboard-health";
import { DashboardAiSummaryPanel } from "./dashboard-ai-summary-panel";
import { ProjectionHorizonPanel } from "./projection-horizon-panel";

type Props = Omit<ComponentProps<typeof ProjectionHorizonPanel>, "renderExplanation"> & {
  userId?: string; isAdmin: boolean; enabled: boolean; health: ReturnType<typeof buildDashboardHealth>;
};
type ExplanationProps = Props & {
  cashflow: Parameters<NonNullable<ComponentProps<typeof ProjectionHorizonPanel>["renderExplanation"]>>[0];
  scenarios: Parameters<NonNullable<ComponentProps<typeof ProjectionHorizonPanel>["renderExplanation"]>>[1];
  horizon: number;
};

function DashboardFlowExplanation({ snapshot, shared, supplement, ctx, now, ready, userId, isAdmin, enabled, health, cashflow, scenarios, horizon }: ExplanationProps) {
  const payload = useMemo(() => ready && cashflow && scenarios && supplement ? buildDashboardAiFlowPayload({ snapshot, shared, supplement, cashflow, scenarios,
    details: buildDashboardFlowDetails(snapshot, shared, cashflow, ctx, now), health, currency: ctx.displayCurrency, horizon }) : null,
  [ready, cashflow, scenarios, supplement, snapshot, shared, ctx, now, health, horizon]);
  const ai = useDashboardAiSummary({ userId, workspaceId: snapshot.workspace.id, currencyCode: ctx.displayCurrency, isAdmin, section: "flow",
    contextKey: JSON.stringify(payload), enabled: enabled && ready && payload !== null });
  if (!enabled) return null;
  return <details className="mt-6 border-t border-white/[0.07] pt-5">
    <summary className="cursor-pointer text-sm font-medium text-ink">Explicar mi flujo con IA</summary>
    <div className="mt-4"><DashboardAiSummaryPanel title="Tu flujo explicado"
      description="Interpreta la caja y los compromisos del horizonte seleccionado. Solo se consulta al pulsar Generar; no cobra, paga ni cambia fechas."
      contextLabel={`${horizon} meses · Escenarios solo de ${scenarios?.monthKey ?? "este mes"} · Lima · Una generación diaria por sección, sin renovarla al cambiar horizonte, moneda o tono.`}
      tone={ai.tone} onToneChange={ai.setTone} isPending={ai.isPending} limitReached={ai.limitReached} response={ai.currentResponse}
      errorMessage={ai.error instanceof Error ? ai.error.message : null}
      unavailableReason={!userId ? "Inicia sesión para solicitar una explicación." : !ready || !cashflow || !supplement ? "Espera a que se compruebe el calendario completo del espacio." : !payload ? "Revisa las conversiones, fechas e importes del calendario y los escenarios. No enviamos una proyección parcial a la IA." : null}
      onGenerate={() => { if (enabled && ready && payload) void ai.requestSummary(snapshot.workspace.id, payload).catch(() => {}); }} />
    </div>
  </details>;
}

export function DashboardFlowSection(props: Props) {
  return <ProjectionHorizonPanel {...props} renderExplanation={(cashflow, scenarios, horizon) => <DashboardFlowExplanation {...props} cashflow={cashflow} scenarios={scenarios} horizon={horizon} />} />;
}
