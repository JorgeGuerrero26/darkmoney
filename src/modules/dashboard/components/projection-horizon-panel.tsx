import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import type { SharedObligationSummary } from "../../../types/domain";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { formatCurrency } from "../../../lib/formatting/money";
import { buildDashboardCashflow, type ProjectionSupplement } from "../lib/projection/build-dashboard-cashflow";
import { projectionLineHref } from "../lib/projection/projection-links";
import { DashboardScenariosPanel } from "./dashboard-scenarios-panel";
import { DashboardFlowDetailsPanel } from "./dashboard-flow-details-panel";

export function ProjectionHorizonPanel({ snapshot, shared, supplement, ctx, now, ready, onRetry }: {
  snapshot: WorkspaceSnapshot; shared: SharedObligationSummary[]; supplement: ProjectionSupplement | null; ctx: ParityConversionCtx;
  now: Date; ready: boolean; onRetry: () => void;
}) {
  const [horizon, setHorizon] = useState("6"), [expanded, setExpanded] = useState(false), [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const model = useMemo(() => ready && supplement?.workspaceId === snapshot.workspace.id ? buildDashboardCashflow(snapshot, shared, supplement, ctx, now, Number(horizon)) : null, [ready, snapshot, shared, supplement, ctx, now, horizon]);
  const firstNegative = model?.projection.months.find(month => month.closingBalance < 0), lastMonth = model?.projection.months[Number(horizon) - 1];
  const unconvertedCount = model ? model.liquid.unconvertedCount + model.projection.unconvertedCount + (model.typicalSpend.unconvertedCount ?? 0) : 0;
  const month = model?.projection.months.find(row => row.monthKey === selectedMonth);
  const href = projectionLineHref;
  return <section aria-label="Proyección de caja" className="border-t border-white/[0.07] pt-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-semibold text-ink">Proyección de caja</h2><SegmentedControl ariaLabel="Horizonte de proyección" value={horizon} options={[3,6,12].map(value => ({ value: String(value), label: `${value} meses` }))} onChange={value => { setHorizon(value); setExpanded(false); setSelectedMonth(null); }} /></div>
    <p className="mt-2 text-xs leading-5 text-storm">Mismo calendario que el cierre del mes: cuotas, suscripciones, ingresos previstos, tarjetas y movimientos planeados. El gasto habitual es una estimación basada en meses terminados; no una promesa de saldo.</p>
    {!model ? <p className="mt-4 text-sm text-storm" role="status">Falta comprobar el calendario completo. <button className="text-ink underline underline-offset-4" onClick={onRetry} type="button">Reintentar lectura</button></p> : unconvertedCount ? <p className="mt-4 text-sm text-storm" role="status">{unconvertedCount} cuentas, compromisos o gastos históricos sin conversión. No mostramos un saldo final parcial ni afirmamos que la caja esté cubierta.</p> : <>
      <p className="mt-5 text-xs text-storm">Saldo estimado al cerrar {lastMonth?.monthKey}</p><p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">{formatCurrency(model.projection.endingBalance, ctx.displayCurrency)}</p>
      <p className="mt-2 text-sm text-storm">{firstNegative ? `El primer cierre mensual negativo aparece en ${firstNegative.monthKey}.` : "No aparece un cierre mensual negativo en este plazo; dentro de un mes todavía puede haber días sin cobertura."}</p>
      <div className="mt-5 divide-y divide-white/[0.07]">{(expanded ? model.projection.months : model.projection.months.slice(0,3)).map(row => <button className="flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left" key={row.monthKey} onClick={() => setSelectedMonth(row.monthKey)} type="button"><div><p className="text-sm font-medium text-ink">{row.monthKey}{row.isPartial ? " · desde hoy" : ""}</p><p className="mt-1 text-xs text-storm">Entra {formatCurrency(row.inflowTotal, ctx.displayCurrency)} · sale {formatCurrency(row.outflowTotal, ctx.displayCurrency)} · {Math.round(row.scheduledShare * 100)}% programado</p></div><span className="text-sm tabular-nums text-ink">{formatCurrency(row.closingBalance, ctx.displayCurrency)} ›</span></button>)}</div>
      {!expanded && model.projection.months.length > 3 ? <Button variant="ghost" onClick={() => setExpanded(true)}>Ver los {horizon} meses</Button> : null}
      <DashboardScenariosPanel key={`${snapshot.workspace.id}:${ctx.displayCurrency}`} snapshot={snapshot} shared={shared} cashflow={model} ctx={ctx} now={now} />
    </>}
    {model ? <DashboardFlowDetailsPanel key={`flow:${snapshot.workspace.id}:${ctx.displayCurrency}`} snapshot={snapshot} shared={shared} cashflow={model} ctx={ctx} now={now} /> : null}
    {model && month && !unconvertedCount ? <Modal labelledBy="projection-month-title" onClose={() => setSelectedMonth(null)}><ResourceEditorHeader onClose={() => setSelectedMonth(null)} title={`${month.monthKey} · de dónde sale`} titleId="projection-month-title" /><ModalBody><p className="text-sm text-storm">Apertura {formatCurrency(month.openingBalance, ctx.displayCurrency)} · cierre {formatCurrency(month.closingBalance, ctx.displayCurrency)}</p><div className="mt-4 divide-y divide-white/10">{[...month.inflows.map(line => ({ line, sign: 1 })), ...month.outflows.map(line => ({ line, sign: -1 }))].map(({line,sign}, index) => { const to=href(line); const content=<><span className="text-ink">{line.label}<span className="mt-1 block text-xs text-storm">{line.dueDate ?? "Durante el mes"} · {line.source === "estimated" ? "Estimado" : "Programado"}</span></span><span className="shrink-0 tabular-nums text-ink">{formatCurrency(sign * line.amount, ctx.displayCurrency)}{to ? " ›" : ""}</span></>; return to ? <Link className="flex min-h-16 items-center justify-between gap-4 py-3 text-sm" key={index} to={to}>{content}</Link> : <div className="flex min-h-16 items-center justify-between gap-4 py-3 text-sm" key={index}>{content}</div>; })}</div><p className="mt-4 text-xs leading-5 text-storm">Abrir una línea solo lleva al registro; no cobra, paga ni altera el calendario. El porcentaje programado describe la composición, no la probabilidad de que ocurra.</p></ModalBody></Modal> : null}
  </section>;
}
