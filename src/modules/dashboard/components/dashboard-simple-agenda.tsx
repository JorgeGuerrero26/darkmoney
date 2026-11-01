import { addDays, format } from "date-fns";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDate } from "../../../lib/formatting/dates";
import type { buildDashboardCashflow } from "../lib/projection/build-dashboard-cashflow";
import { limaCalendarDay, limaClock } from "../lib/projection/lima-calendar";
import { projectionLineHref } from "../lib/projection/projection-links";

export function DashboardSimpleAgenda({ cashflow, currency, now, ready, failed, onRetry }: {
  cashflow: ReturnType<typeof buildDashboardCashflow>; currency: string; now: Date; ready: boolean; failed: boolean; onRetry: () => void;
}) {
  const today = format(limaClock(now), "yyyy-MM-dd"), until = format(addDays(limaClock(now), 30), "yyyy-MM-dd");
  const months = cashflow.projection.months.filter(month => month.monthKey >= today.slice(0, 7) && month.monthKey <= until.slice(0, 7));
  const complete = months.some(month => month.monthKey === today.slice(0, 7)) && months.some(month => month.monthKey === until.slice(0, 7)) && months.every(month => month.unconvertedCount === 0);
  if (!ready || !complete) return <section className="mt-7" aria-label="Lo que viene"><h3 className="font-display text-lg font-semibold text-ink">Lo que viene</h3><p role="status" className="mt-2 text-sm text-storm">{failed ? "No se pudieron comprobar los próximos compromisos." : ready ? "No se pudieron comprobar todos los compromisos o sus conversiones." : "Comprobando los próximos compromisos…"}{failed ? <button className="ml-2 underline" onClick={onRetry} type="button">Reintentar</button> : null}</p></section>;
  const items = months.flatMap(month => [
    ...month.inflows.map(line => ({ line, direction: "in" as const })),
    ...month.outflows.map(line => ({ line, direction: "out" as const })),
  ]).filter(({ line }) => line.kind !== "typical_spend" && line.dueDate && limaCalendarDay(line.dueDate) === line.dueDate && line.dueDate >= today && line.dueDate <= until && Number.isFinite(line.amount) && line.amount > 0)
    .sort((a, b) => a.line.dueDate!.localeCompare(b.line.dueDate!) || a.line.label.localeCompare(b.line.label)).slice(0, 4);
  if (!items.length) return null;
  return <section className="mt-7" aria-label="Lo que viene"><h3 className="font-display text-lg font-semibold text-ink">Lo que viene</h3><p className="mt-1 text-xs text-storm">Próximos 30 días</p><div className="mt-3 divide-y divide-white/[0.07]">{items.map(({ line, direction }, index) => {
    const href = projectionLineHref(line);
    const content = <><span className="min-w-0"><span className="block font-medium text-ink">{line.label}</span><span className="mt-1 block text-xs text-storm">{formatDate(line.dueDate!)}{line.source === "estimated" ? " · Estimado" : ""}</span></span><span className="shrink-0 tabular-nums text-ink">{direction === "in" ? "+" : "−"}{formatCurrency(line.amount, currency)}{href ? " ›" : ""}</span></>;
    return href ? <Link key={`${line.kind}:${line.refId}:${line.dueDate}:${index}`} to={href} className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm">{content}</Link> : <div key={`${line.kind}:${line.dueDate}:${index}`} className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm">{content}</div>;
  })}</div></section>;
}
