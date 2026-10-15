import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import type { SharedObligationSummary } from "../../../types/domain";
import { formatCurrency } from "../../../lib/formatting/money";
import type { buildDashboardCashflow } from "../lib/projection/build-dashboard-cashflow";
import { buildDashboardScenarios } from "../lib/projection/dashboard-scenarios";

export function DashboardScenariosPanel({ snapshot, shared, cashflow, ctx, now }: {
  snapshot: WorkspaceSnapshot; shared: SharedObligationSummary[]; cashflow: ReturnType<typeof buildDashboardCashflow>;
  ctx: ParityConversionCtx; now: Date;
}) {
  const result = useMemo(() => buildDashboardScenarios(snapshot, shared, cashflow, ctx, now), [snapshot, shared, cashflow, ctx, now]);
  const money = (value: number) => formatCurrency(value, ctx.displayCurrency);
  const model = result.model;
  const due = (days: number | null) => days === null ? "Sin fecha" : days < 0 ? `${-days} días vencido` : days === 0 ? "Vence hoy" : `En ${days} días`;
  return <section aria-label="Escenarios y prioridades" className="mt-6 border-t border-white/[0.07] pt-5">
    <h3 className="text-base font-semibold text-ink">Escenarios y prioridades</h3>
    <p className="mt-2 text-xs leading-5 text-storm">Solo el cierre de {result.monthKey}; no son escenarios para todo el horizonte seleccionado. Son estimaciones para revisar, no garantías ni órdenes de pago.</p>
    {!result.available || !model ? <p className="mt-3 text-sm leading-6 text-storm" role="status">{result.reasons.join(" ")}</p> : <>
      <details className="mt-4 border-t border-white/[0.07] pt-3">
        <summary className="cursor-pointer py-2 text-sm font-medium text-ink">Comparar escenarios de fin de mes</summary>
        <dl className="mt-3 divide-y divide-white/[0.07] text-sm">
          {[["Conservador", model.conservativeBalance], ["Esperado · mismo calendario", model.expectedBalance], ["Optimista", model.optimisticBalance]].map(([label, amount]) => <div className="flex min-h-12 items-center justify-between gap-4" key={label}><dt className="text-storm">{label}</dt><dd className="tabular-nums text-ink">{money(Number(amount))}</dd></div>)}
        </dl>
        <p className="mt-3 text-xs leading-5 text-storm">El esperado usa los compromisos del calendario y el gasto habitual restante. Los otros escenarios conservan la amplitud del modelo móvil de ritmo reciente y se ajustan a ese mismo cierre.</p>
        <p className="mt-2 text-xs leading-5 text-storm">Base estadística: {model.confidenceLabel} · {model.confidence}/100. Este indicador describe el historial usado; no es una probabilidad de acertar.</p>
        <dl className="mt-4 divide-y divide-white/[0.07] text-sm">
          {[["Simulación · percentil 10", model.monteCarloLowBalance], ["Simulación · mediana", model.monteCarloMedianBalance], ["Simulación · percentil 90", model.monteCarloHighBalance]].map(([label, amount]) => <div className="flex min-h-12 items-center justify-between gap-4" key={label}><dt className="text-storm">{label}</dt><dd className="tabular-nums text-ink">{money(Number(amount))}</dd></div>)}
        </dl>
        <p className="mt-3 text-xs leading-5 text-storm">En {model.pressureProbability}% de 800 simulaciones, el cierre queda por debajo de {money(model.pressureThreshold)}. Ese umbral es el 85% de la caja actual si es positiva, o el 115% si ya es negativa. No es la probabilidad de impago ni garantiza cobertura diaria.</p>
        <p className="mt-2 text-xs leading-5 text-storm">Se remuestrean los últimos 30 días y se introducen variaciones en cobros y pagos. Una base corta o gastos excepcionales limitan la lectura; las bandas no son límites mínimos o máximos del saldo real.</p>
      </details>
      <div className="mt-5 border-t border-white/[0.07] pt-4"><h4 className="text-sm font-semibold text-ink">Qué revisar primero</h4>
        <p className="mt-2 text-xs leading-5 text-storm">Hasta cuatro cobros o pagos pendientes, ordenados por vencimiento, importe y presión de caja de la semana. El monto corresponde a la próxima cuota pendiente o al saldo sin plan.</p>
        <div className="mt-3 divide-y divide-white/[0.07]">{result.recommendations.map(row => <Link className="block py-4" key={row.id} to={`/app/obligations?resource=${row.id}`}>
          <div className="flex items-baseline justify-between gap-4"><p className="text-sm font-medium text-ink">{row.actionLabel}: {row.title}</p><span className="shrink-0 text-sm tabular-nums text-ink">{money(row.amount)} ›</span></div>
          <p className="mt-1 text-xs text-storm">{due(row.daysUntilDue)} · {row.subtitle} · prioridad {row.score}/100</p>
          <p className="mt-2 text-xs leading-5 text-storm">{row.reason}</p>
        </Link>)}</div>
        {!result.recommendations.length ? <p className="mt-3 text-sm text-storm">No hay una prioridad clara con estos compromisos.</p> : null}
        <p className="mt-3 text-xs leading-5 text-storm">Abrir una prioridad solo permite revisar el registro. No cobra, paga, reserva dinero ni cambia sus fechas.</p>
      </div>
    </>}
  </section>;
}
