import { useMemo } from "react";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import { useDashboardAiSummary } from "../hooks/use-dashboard-ai-summary";
import { buildDashboardPatterns } from "../lib/dashboard-patterns";
import { buildDashboardAiPatternsPayload } from "../lib/build-ai-patterns-payload";
import { DashboardAiSummaryPanel } from "./dashboard-ai-summary-panel";
import { DashboardPatternsPanel } from "./dashboard-patterns-panel";

export function DashboardPatternsSection({ snapshot, ctx, now, userId, isAdmin, ready, enabled }: {
  snapshot: WorkspaceSnapshot; ctx: ParityConversionCtx; now: Date; userId?: string; isAdmin: boolean; ready: boolean; enabled: boolean;
}) {
  const model = useMemo(() => buildDashboardPatterns(snapshot, ctx, now), [snapshot, ctx, now]);
  const payload = useMemo(() => buildDashboardAiPatternsPayload(model, ctx.displayCurrency, snapshot.workspace.name), [model, ctx.displayCurrency, snapshot.workspace.name]);
  const ai = useDashboardAiSummary({ userId, workspaceId: snapshot.workspace.id, currencyCode: ctx.displayCurrency, isAdmin,
    section: "patterns", contextKey: JSON.stringify(payload), enabled: enabled && ready && payload !== null });
  return <div className="space-y-6">
    <DashboardPatternsPanel model={model} currency={ctx.displayCurrency} ready={ready} />
    {enabled ? <details className="border-t border-white/[0.07] pt-5">
      <summary className="cursor-pointer text-sm font-medium text-ink">Explicar mis patrones con IA</summary>
      <div className="mt-4"><DashboardAiSummaryPanel title="Tus patrones explicados"
        description="Interpreta hábitos, subidas y gastos fuera de costumbre de esta pestaña. Solo se consulta al pulsar Generar; no aplica cambios."
        contextLabel={`${model.from} a ${model.to} · Lima · Una generación diaria por sección. Cambiar moneda o tono no renueva el límite.`}
        tone={ai.tone} onToneChange={ai.setTone} isPending={ai.isPending} limitReached={ai.limitReached}
        response={ai.currentResponse} errorMessage={ai.error instanceof Error ? ai.error.message : null}
        unavailableReason={!ready ? "Espera a que se comprueben los movimientos del espacio." : !payload ? "Revisa las conversiones e importes: no enviamos un historial monetario parcial a la IA." : null}
        onGenerate={() => { if (enabled && ready && payload) void ai.requestSummary(snapshot.workspace.id, payload).catch(() => {}); }} />
      </div>
    </details> : null}
  </div>;
}
