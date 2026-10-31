import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { formatCurrency } from "../../../lib/formatting/money";
import { buildDashboardHistory, dashboardHistoryYears } from "../lib/dashboard-history";
import { monthReading } from "../lib/history-view";
import { DashboardHistoryChart } from "./dashboard-history-chart";

export function DashboardHistoryPanel({ snapshot, ctx, now, ready, onRetry, renderExplanation }: {
  snapshot: WorkspaceSnapshot; ctx: ParityConversionCtx; now: Date; ready: boolean; onRetry: () => void;
  renderExplanation?: (model: ReturnType<typeof buildDashboardHistory>) => ReactNode;
}) {
  const years = dashboardHistoryYears(snapshot, now);
  const [selectedYear, setSelectedYear] = useState(Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "America/Lima" }).format(now)));
  const [expanded, setExpanded] = useState(false), [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const year = years.includes(selectedYear) ? selectedYear : years[0];
  const model = useMemo(() => buildDashboardHistory(snapshot, ctx, year, now), [snapshot, ctx, year, now]);
  const observed = model.months.filter(month => !month.isFuture && (month.income > 0.009 || month.expense > 0.009 || month.unconvertedCount > 0));
  const descending = [...observed].reverse(), month = model.months.find(row => row.dateFrom === selectedMonth);
  const monthName = (date: string) => new Intl.DateTimeFormat("es-PE", { month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const monthHref = (from: string, to: string, categoryId?: number | null) => {
    const params = new URLSearchParams({ from, to, status: "posted" });
    if (categoryId !== undefined) params.set("categoryId", categoryId === null ? "none" : String(categoryId));
    return `/app/movements?${params}`;
  };
  const comparison = model.comparison;
  return <section className="border-t border-white/[0.07] pt-6" aria-label="Historial anual">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-semibold text-ink">Historial anual</h2><label className="text-sm text-storm">Año <select className="ml-2 h-10 rounded-lg border border-white/10 bg-[#1a1917] px-3 text-ink" aria-label="Año del historial" onChange={event => { setSelectedYear(Number(event.target.value)); setExpanded(false); setSelectedMonth(null); }} value={year}>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
    <details className="mt-2 text-xs leading-5 text-storm"><summary className="cursor-pointer">Cómo se calcula</summary><p className="mt-2">Ingresos y salidas aplicados, sin traspasos ni correcciones de saldo. El mes actual llega hasta hoy; los meses futuros no suman.</p></details>
    {!ready ? <p role="status" className="mt-4 text-sm text-storm">Comprobando el historial completo del espacio… <button className="text-ink underline underline-offset-4" type="button" onClick={onRetry}>Reintentar lectura</button></p> : <>
      {!observed.length ? <p className="mt-4 text-sm text-storm">Aún no hay ingresos ni gastos registrados en {year}.</p> : <>
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-x-11">
        <div>
        {model.totals ? <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-y border-white/[0.08] py-4"><div><p className="text-xs text-storm">Neto de {year}{year === Number(model.today.slice(0, 4)) ? " · en curso" : ""}</p><p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">{formatCurrency(model.totals.net, ctx.displayCurrency)}</p></div><dl className="space-y-1 text-sm text-storm"><div>Entró <span className="tabular-nums text-ink">{formatCurrency(model.totals.income, ctx.displayCurrency)}</span></div><div>Salió <span className="tabular-nums text-ink">{formatCurrency(model.totals.expense, ctx.displayCurrency)}</span></div><div>{model.totals.savingsRate === null ? "Sin ingresos para calcular la tasa de ahorro" : `Ahorro: ${model.totals.savingsRate.toFixed(1)}% de los ingresos`}</div></dl></div> : <p className="mt-4 text-sm text-storm" role="status">{model.unconvertedCount} movimientos sin conversión. No mostramos un total anual ni factores sobre importes parciales.</p>}
        <DashboardHistoryChart months={model.months} currency={ctx.displayCurrency} onSelect={setSelectedMonth} />
        </div>
        <div>
        <div className="mt-4 divide-y divide-white/[0.07]">{(expanded ? descending : descending.slice(0, 4)).map(row => <button className="flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left" key={row.dateFrom} onClick={() => setSelectedMonth(row.dateFrom)} type="button"><div><p className="text-sm font-medium capitalize text-ink">{monthName(row.dateFrom)}</p><p className="mt-1 text-xs text-storm">{row.unconvertedCount ? "Faltan conversiones" : monthReading(row, model.months, row.dateFrom.slice(0, 7) === model.today.slice(0, 7))}</p></div><span className="text-sm tabular-nums text-ink">{row.unconvertedCount ? "Sin total" : formatCurrency(row.net, ctx.displayCurrency)} ›</span></button>)}</div>
        {!expanded && descending.length > 4 ? <Button variant="ghost" onClick={() => setExpanded(true)}>Ver los {descending.length} meses</Button> : null}
        {comparison ? <div className="mt-5 border-y border-white/[0.07] py-4"><h3 className="text-sm font-semibold text-ink">{comparison.title}</h3><p className="mt-2 text-sm text-storm">Últimos tres meses con actividad ({comparison.recent[0].dateFrom.slice(0, 7)} a {comparison.recent[comparison.recent.length - 1].dateFrom.slice(0, 7)}): {formatCurrency(comparison.recentAverage, ctx.displayCurrency)}/mes. Tres anteriores ({comparison.previous[0].dateFrom.slice(0, 7)} a {comparison.previous[comparison.previous.length - 1].dateFrom.slice(0, 7)}): {formatCurrency(comparison.previousAverage, ctx.displayCurrency)}/mes.</p></div> : null}
        <div className="mt-5"><h3 className="text-sm font-semibold text-ink">Lo que hace variar tus meses</h3>{model.factors ? <><p className="mt-2 text-xs leading-5 text-storm">{model.factors.body} Es una asociación estadística, no una causa demostrada; los importes son gasto acumulado del año.</p><div className="mt-3 divide-y divide-white/[0.07]">{model.factors.topCategories.map(category => <Link className="flex min-h-14 items-center justify-between gap-4 text-sm" key={category.categoryId ?? "none"} to={monthHref(`${year}-01-01`, year === Number(model.today.slice(0, 4)) ? model.today : `${year}-12-31`, category.categoryId)}><span className="text-ink">{category.name}<span className="ml-2 text-xs text-storm">{category.direction === "sube_con_el_cambio" ? "Sube con el cambio" : "Se mueve en sentido contrario"}</span></span><span className="tabular-nums text-ink">{formatCurrency(category.amount, ctx.displayCurrency)} ›</span></Link>)}</div></> : <p className="mt-2 text-xs leading-5 text-storm">Se necesitan tres meses con gasto, dos categorías y variación observable, con conversiones completas.</p>}</div>
        </div>
        </div>
      </>}
    </>}
    {ready && model.complete && (model.changePoint || model.clusters.length > 0) ? <details className="mt-5 border-t border-white/[0.07] pt-4">
      <summary className="cursor-pointer py-2 text-sm font-medium text-ink">Cambios y tipos de meses de {year}</summary>
      <p className="mt-2 text-xs leading-5 text-storm">Señales descriptivas sobre meses con actividad del año seleccionado, no causas demostradas. El mes actual está incompleto; una ausencia de registros no demuestra ausencia de gasto. Hasta cuatro tipos de meses; los importes son promedios de neto.</p>
      {model.changePoint ? <div className="mt-3 border-b border-white/[0.07] pb-4"><p className="text-sm font-medium text-ink">{model.changePoint.title}</p><p className="mt-2 text-xs leading-5 text-storm">{model.changePoint.body} Se comparan tres meses con actividad con los tres anteriores con actividad.</p></div> : <p className="mt-3 text-xs text-storm">Sin cambio dominante; hacen falta al menos seis meses con actividad y una variación suficiente.</p>}
      <div className="mt-3 divide-y divide-white/[0.07]">{model.clusters.slice(0, 4).map(cluster => <div className="py-3" key={cluster.kind}>
        <div className="flex items-baseline justify-between gap-4"><p className="text-sm font-medium text-ink">{cluster.title} · {cluster.count} {cluster.count === 1 ? "mes" : "meses"}</p><p className="shrink-0 text-sm tabular-nums text-ink">{formatCurrency(cluster.averageNet, ctx.displayCurrency)}/mes</p></div>
        <p className="mt-1 text-xs leading-5 text-storm">{cluster.monthLabels.join(" · ")} · {cluster.description}</p>
      </div>)}</div>
    </details> : null}
    {renderExplanation?.(model)}
    {ready && month ? <Modal presentation="side" onClose={() => setSelectedMonth(null)} labelledBy="history-month-title"><ResourceEditorHeader onClose={() => setSelectedMonth(null)} title={`${monthName(month.dateFrom)} de ${year}`} titleId="history-month-title" /><ModalBody><p className="text-xs text-storm">{month.dateFrom} a {month.dateTo} · {month.totalCount} registros aplicados</p><p className="mt-3 text-2xl font-semibold tabular-nums text-ink">{month.unconvertedCount ? "Sin total: faltan conversiones" : formatCurrency(month.net, ctx.displayCurrency)}</p><p className="mt-2 text-sm text-storm">{month.correctionIds.length} correcciones excluidas del neto.</p><div className="mt-5 divide-y divide-white/10">{month.movements.slice(0, 4).map(row => <Link className="flex min-h-14 items-center justify-between gap-4 text-sm" key={row.id} to={`/app/movements?period=all&movement=${row.id}`}><span className="text-ink">{row.title}{row.correction ? " · corrección, no suma al neto" : ""}</span><span className="tabular-nums text-storm">{row.amount === null ? "Sin conversión" : `${row.income ? "+" : "−"}${formatCurrency(row.amount, ctx.displayCurrency)}`}</span></Link>)}</div><Link className="mt-5 inline-block text-sm text-ink underline underline-offset-4" to={monthHref(month.dateFrom, month.dateTo)}>Ver movimientos del mes</Link></ModalBody></Modal> : null}
  </section>;
}
