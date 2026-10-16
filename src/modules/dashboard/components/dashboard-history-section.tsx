import { useMemo, type ComponentProps } from "react";
import { useDashboardAiSummary } from "../hooks/use-dashboard-ai-summary";
import { buildDashboardAiHistoryPayload } from "../lib/build-ai-history-payload";
import type { buildDashboardHistory } from "../lib/dashboard-history";
import { DashboardAiSummaryPanel } from "./dashboard-ai-summary-panel";
import { DashboardHistoryPanel } from "./dashboard-history-panel";

type Props = Omit<ComponentProps<typeof DashboardHistoryPanel>, "renderExplanation"> & { userId?: string; isAdmin: boolean; enabled: boolean };

function DashboardHistoryExplanation({ snapshot, ctx, now, ready, userId, isAdmin, enabled, model }: Props & { model: ReturnType<typeof buildDashboardHistory> }) {
  const payload = useMemo(() => ready ? buildDashboardAiHistoryPayload(snapshot, model, ctx.displayCurrency, now) : null, [ready, snapshot, model, ctx.displayCurrency, now]);
  const ai = useDashboardAiSummary({ userId, workspaceId: snapshot.workspace.id, currencyCode: ctx.displayCurrency, isAdmin, section: "history",
    contextKey: JSON.stringify(payload), enabled: enabled && ready && payload !== null });
  if (!enabled) return null;
  return <details className="mt-6 border-t border-white/[0.07] pt-5">
    <summary className="cursor-pointer text-sm font-medium text-ink">Explicar mi historial con IA</summary>
    <div className="mt-4"><DashboardAiSummaryPanel title={`Tu ${model.year}, explicado`}
      description="Interpreta el año seleccionado, sus cambios y los meses parecidos. Solo se consulta al pulsar Generar; no modifica registros."
      contextLabel={`${model.year} · ${payload ? `${payload.period.from} a ${payload.period.to} · ${payload.observedMonths} meses con actividad · ` : ""}Lima · Una generación diaria por sección; cambiar año, moneda o tono no renueva el límite.`}
      tone={ai.tone} onToneChange={ai.setTone} isPending={ai.isPending} limitReached={ai.limitReached} response={ai.currentResponse}
      errorMessage={ai.error instanceof Error ? ai.error.message : null}
      unavailableReason={!userId ? "Inicia sesión para solicitar una explicación." : !ready ? "Espera a que se compruebe el historial completo del espacio." : !model.complete ? "Revisa las conversiones e importes: no enviamos un año monetario parcial a la IA." : !payload ? "No hay ingresos o gastos aplicados válidos de este año para interpretar." : null}
      onGenerate={() => { if (enabled && ready && payload) void ai.requestSummary(snapshot.workspace.id, payload).catch(() => {}); }} />
    </div>
  </details>;
}

export function DashboardHistorySection(props: Props) {
  return <DashboardHistoryPanel {...props} renderExplanation={model => <DashboardHistoryExplanation {...props} model={model} />} />;
}
