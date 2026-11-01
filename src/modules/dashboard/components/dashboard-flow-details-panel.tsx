import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import type { SharedObligationSummary } from "../../../types/domain";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDate } from "../../../lib/formatting/dates";
import type { buildDashboardCashflow } from "../lib/projection/build-dashboard-cashflow";
import { buildDashboardFlowDetails } from "../lib/projection/dashboard-flow-details";
import { limaClock } from "../lib/projection/lima-calendar";
import { projectionLineHref } from "../lib/projection/projection-links";

const rowClassName = "flex min-h-14 items-center justify-between gap-4 border-b border-white/[0.07] py-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40";
const transferDateTime = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
function nativeAmount(amount: number | null | undefined, currency: string | null) {
  return amount != null && Number.isFinite(amount) && amount >= 0 && currency ? formatCurrency(amount, currency) : "Importe por comprobar";
}

export function DashboardFlowDetailsPanel({ snapshot, shared, cashflow, ctx, now }: {
  snapshot: WorkspaceSnapshot; shared: SharedObligationSummary[]; cashflow: ReturnType<typeof buildDashboardCashflow>;
  ctx: ParityConversionCtx; now: Date;
}) {
  const model = useMemo(() => buildDashboardFlowDetails(snapshot, shared, cashflow, ctx, now), [snapshot, shared, cashflow, ctx, now]);
  const [days, setDays] = useState("7"), [allReceivables, setAllReceivables] = useState(false), [allCharges, setAllCharges] = useState(false);
  const [selection, setSelection] = useState<{ kind: "window" } | { kind: "route"; key: string } | null>(null);
  const window = model.windows.find(row => String(row.days) === days)!;
  const previous = model.windows.find(row => row.days === (days === "15" ? 7 : 15));
  const sameAsEarlier = days !== "7" && window.complete && previous?.complete && previous.expectedInflow === window.expectedInflow && previous.expectedOutflow === window.expectedOutflow && previous.scheduledCount === window.scheduledCount;
  const route = selection?.kind === "route" ? model.routes.find(row => row.key === selection.key) : null;
  const money = (value: number) => formatCurrency(value, ctx.displayCurrency);
  const when = (day: string | null, invalid = false) => {
    if (!day) return invalid ? "Fecha por comprobar" : "Sin fecha";
    const diff = differenceInCalendarDays(parseISO(day), limaClock(now));
    return diff < 0 ? `Venció hace ${-diff} días` : diff === 0 ? "Vence hoy" : `En ${diff} días`;
  };
  const transferTime = (stamp: string) => transferDateTime.format(new Date(stamp));

  return <div aria-label="Detalle del flujo" className="mt-7 space-y-7">
    <section className="border-t border-white/[0.07] pt-5" aria-label="Próximas semanas">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-semibold text-ink">Próximas semanas</h3>
        <SegmentedControl ariaLabel="Plazo de compromisos" value={days} options={[7,15,30].map(value => ({ value: String(value), label: `${value} d` }))} onChange={value => { setDays(value); setSelection(null); }} />
      </div>
      <p className="mt-2 text-xs leading-5 text-storm">Desde hoy hasta {formatDate(window.endDay)}, incluidos los compromisos vencidos que siguen pendientes. No incluye el gasto habitual sin fecha.</p>
      {window.complete ? <dl className="mt-3 text-sm">
        {[["Entra", window.expectedInflow], ["Sale", -window.expectedOutflow], [`Caja con compromisos al ${formatDate(window.endDay)}`, window.estimatedBalance]].map(([label, value]) => <div className={rowClassName} key={label}><dt className="text-storm">{label}</dt><dd className="shrink-0 tabular-nums text-ink">{money(Number(value))}</dd></div>)}
      </dl> : <p className="mt-3 text-sm leading-6 text-storm" role="status">El calendario o la caja tienen importes sin comprobar. No mostramos un total parcial de esta ventana.</p>}
      {sameAsEarlier ? <p className="mt-3 text-xs text-storm">No hay cobros ni pagos nuevos frente al plazo de {previous!.days} días.</p> : null}
      {window.commitments.length || !window.complete ? <Button className="mt-3" variant="ghost" onClick={() => setSelection({ kind: "window" })}>Ver compromisos{window.complete ? ` (${window.commitments.length})` : " disponibles"}</Button> : <p className="mt-3 text-sm text-storm">No hay compromisos con fecha en este plazo.</p>}
    </section>

    <section className="border-t border-white/[0.07] pt-5" aria-label="Por cobrar">
      <div className="flex items-baseline justify-between gap-4"><h3 className="text-base font-semibold text-ink">Por cobrar</h3><p className="text-sm tabular-nums text-ink">{model.receivablesTotal === null ? "Total sin conversión completa" : money(model.receivablesTotal)}</p></div>
      <p className="mt-2 text-xs leading-5 text-storm">Saldo pendiente de los registros activos, desde tu lado. No es solo lo que vence en este plazo ni se suma de nuevo a la proyección.</p>
      {model.receivablesMissing ? <p className="mt-3 text-xs leading-5 text-storm" role="status">El total queda sin calcular; los registros sin conversión se muestran en su moneda original.</p> : null}
      <div className="mt-3">{(allReceivables ? model.receivables : model.receivables.slice(0,5)).map(row => {
        const to = projectionLineHref({ kind: "obligation_receivable", refId: row.id });
        const content = <><span className="min-w-0"><span className="block font-medium text-ink">{row.counterparty?.trim() || row.title}</span><span className="mt-1 block text-xs text-storm">{row.title} · {when(row.dueDay, row.invalidDate)}</span></span><span className="shrink-0 text-right tabular-nums text-ink">{row.amount === null ? nativeAmount(row.nativeAmount, row.currency) : money(row.amount)}{to ? " ›" : ""}{row.amount === null ? <span className="mt-1 block text-xs text-storm">Sin conversión</span> : null}</span></>;
        return to ? <Link className={rowClassName} key={row.id} to={to}>{content}</Link> : <div className={rowClassName} key={row.id}>{content}</div>;
      })}</div>
      {!model.receivables.length ? <p className="mt-3 text-sm text-storm">No hay registros activos por cobrar.</p> : null}
      {!allReceivables && model.receivables.length > 5 ? <Button className="mt-3" variant="ghost" onClick={() => setAllReceivables(true)}>Ver los {model.receivables.length} registros</Button> : null}
    </section>

    <section className="border-t border-white/[0.07] pt-5" aria-label="Cobros de suscripciones">
      <div className="flex items-baseline justify-between gap-4"><h3 className="text-base font-semibold text-ink">Suscripciones</h3><p className="text-sm tabular-nums text-ink">{model.chargesTotal === null ? "Total por comprobar" : money(model.chargesTotal)}</p></div>
      <p className="mt-2 text-xs leading-5 text-storm">Cobros del calendario: hoy y los próximos 30 días, hasta {formatDate(model.endDay)}. Una suscripción puede tener más de un cobro.</p>
      {model.chargesMissing ? <p className="mt-3 text-xs leading-5 text-storm" role="status">Faltan conversiones o fechas válidas. No presentamos la suma conocida como el total.</p> : null}
      <div className="mt-3">{(allCharges ? model.charges : model.charges.slice(0,5)).map((row, index) => {
        const to = projectionLineHref({ kind: "subscription", refId: row.id });
        const content = <><span className="min-w-0"><span className="block font-medium text-ink">{row.title}</span><span className="mt-1 block text-xs text-storm">{formatDate(row.day)}</span></span><span className="shrink-0 text-right tabular-nums text-ink">{row.amount === null ? nativeAmount(row.nativeAmount, row.currency) : money(row.amount)}{to ? " ›" : ""}{row.amount === null ? <span className="mt-1 block text-xs text-storm">{row.missingConversion ? "Sin conversión" : "Calendario por comprobar"}</span> : null}</span></>;
        return to ? <Link className={rowClassName} key={`${row.id}:${row.day}:${index}`} to={to}>{content}</Link> : <div className={rowClassName} key={`${row.id}:${row.day}:${index}`}>{content}</div>;
      })}</div>
      {!model.charges.length ? <p className="mt-3 text-sm text-storm">{model.chargesMissing ? "Revisa los calendarios de suscripciones antes de concluir que no habrá cobros." : "No hay cobros previstos en este plazo."}</p> : null}
      {!allCharges && model.charges.length > 5 ? <Button className="mt-3" variant="ghost" onClick={() => setAllCharges(true)}>Ver los {model.charges.length} cobros</Button> : null}
    </section>

    <section className="border-t border-white/[0.07] pt-5" aria-label="Transferencias entre cuentas">
      <h3 className="text-base font-semibold text-ink">Entre tus cuentas</h3><p className="mt-2 text-xs leading-5 text-storm">Transferencias aplicadas · últimos 90 días ({model.routeFrom} a {model.today}). No cuentan como gasto.</p>
      {!model.routesRanked ? <p className="mt-3 text-xs leading-5 text-storm" role="status">Hay importes sin conversión. Puedes revisar todas las rutas; no elegimos las tres principales sobre un total parcial.</p> : <p className="mt-2 text-xs text-storm">Las tres rutas con mayor importe, valoradas desde la cuenta de origen.</p>}
      <div className="mt-3">{model.routes.map(row => <button aria-label={`Ver ruta ${row.srcName} a ${row.dstName}`} className={`${rowClassName} w-full`} key={row.key} onClick={() => setSelection({ kind: "route", key: row.key })} type="button">
        <span><span className="block font-medium text-ink">{row.srcName} → {row.dstName}</span><span className="mt-1 block text-xs text-storm">{row.transfers.length} {row.transfers.length === 1 ? "transferencia" : "transferencias"}</span></span><span className="shrink-0 tabular-nums text-ink">{row.total === null ? "Total sin conversión" : money(row.total)} ›</span>
      </button>)}</div>
      {!model.routes.length ? <p className="mt-3 text-sm text-storm">No hay transferencias aplicadas en estos 90 días.</p> : null}
    </section>

    {selection?.kind === "window" || route ? <Modal presentation="side" className={`${resourceEditorSurfaceClassName} lg:!max-w-[440px] lg:!rounded-none`} labelledBy="flow-detail-title" onClose={() => setSelection(null)}>
      <ResourceEditorHeader onClose={() => setSelection(null)} title={route ? `${route.srcName} → ${route.dstName}` : `Compromisos · ${days} días`} titleId="flow-detail-title" />
      <ModalBody>{route ? <>
        <p className="mb-3 text-xs leading-5 text-storm">{route.transfers.length} {route.transfers.length === 1 ? "transferencia" : "transferencias"} de estos 90 días. {route.total === null ? "El total no se puede comprobar todavía." : `Total desde el origen: ${money(route.total)}.`} Abrir un registro no crea otro traspaso.</p>
        {[...route.transfers].sort((a,b) => new Date(b.movement.occurredAt).getTime() - new Date(a.movement.occurredAt).getTime()).map(row => <Link className={rowClassName} key={row.movement.id} to={`/app/movements?period=all&movement=${row.movement.id}`}>
          <span className="min-w-0"><span className="block font-medium text-ink">{row.movement.description.trim() || "Transferencia"}</span><span className="mt-1 block text-xs text-storm">{transferTime(row.movement.occurredAt)} · Lima</span><span className="mt-1 block text-xs text-storm">{nativeAmount(row.movement.sourceAmount, row.sourceCurrency)} → {nativeAmount(row.movement.destinationAmount, row.destinationCurrency)}</span></span><span className="shrink-0 tabular-nums text-ink">{row.amount === null ? "Sin conversión" : money(row.amount)} ›</span>
        </Link>)}
      </> : <>
        <p className="mb-3 text-xs leading-5 text-storm">Hasta {formatDate(window.endDay)}; incluye vencidos pendientes y excluye gasto habitual sin fecha. Abrir una línea no cobra ni paga.</p>
        {!window.complete ? <p className="mb-3 text-sm text-storm" role="status">Estos son solo los compromisos disponibles; la caja o el calendario todavía están incompletos.</p> : null}
        {window.commitments.map((row, index) => {
          const to = projectionLineHref(row), content = <><span className="min-w-0"><span className="block font-medium text-ink">{row.label}</span><span className="mt-1 block text-xs text-storm">{row.dueDate ? formatDate(row.dueDate) : "Fecha por comprobar"} · {row.source === "scheduled" ? "Programado" : "Estimado"}</span></span><span className="shrink-0 tabular-nums text-ink">{money(row.direction === "inflow" ? row.amount : -row.amount)}{to ? " ›" : ""}</span></>;
          return to ? <Link className={rowClassName} key={index} to={to}>{content}</Link> : <div className={rowClassName} key={index}>{content}</div>;
        })}
        {!window.commitments.length ? <p className="text-sm text-storm">{window.complete ? "No hay compromisos con fecha en este plazo." : "No hay líneas disponibles para revisar; esto no acredita que no existan compromisos."}</p> : null}
      </>}</ModalBody>
    </Modal> : null}
  </div>;
}
