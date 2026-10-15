import { formatCurrency } from "../../../lib/formatting/money";
import type { buildDashboardCashflow } from "../lib/projection/build-dashboard-cashflow";

export function CashflowMonthPanel({ model, currency, ready, failed, onRetry }: {
  model: ReturnType<typeof buildDashboardCashflow>; currency: string;
  ready: boolean; failed: boolean; onRetry: () => void;
}) {
  const month = model.projection.months[0];
  const rows = [
    ["Caja disponible hoy", model.liquid.total],
    ["Cobros previstos", model.monthEnd.committedInflow],
    ["Pagos previstos", -model.monthEnd.committedOutflow],
    ["Gasto habitual restante", -model.monthEnd.variableExpenseProjection],
  ] as const;
  return <article className="rounded-[9px] border border-white/[0.08] bg-[#1a1917] p-5" aria-label="Cierre de mes estimado">
    <h2 className="text-[13px] font-medium text-storm">Cierre de mes estimado</h2>
    <p className="mt-3 font-display text-3xl font-semibold text-ink">
      {ready ? formatCurrency(month.closingBalance, currency) : "Sin estimación"}
    </p>
    {!ready ? <div role="status" className="mt-3 text-sm text-storm">
      {failed ? "No pudimos comprobar los datos de proyección. No mostramos un cierre parcial." : "Comprobando cuotas, compras únicas y cambios de ingresos…"}
      {failed ? <button type="button" onClick={onRetry} className="ml-2 font-medium text-ink underline underline-offset-4">Reintentar</button> : null}
    </div> : <>
      <p className="mt-1 text-sm text-storm">Hasta el último día del mes. Inversiones no son caja; las tarjetas se pagan en su fecha.</p>
      <dl className="mt-5 divide-y divide-white/[0.07] border-t border-white/[0.07]">
        {rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
          <dt className="text-storm">{label}</dt><dd className="font-medium tabular-nums text-ink">{formatCurrency(value, currency)}</dd>
        </div>)}
      </dl>
      <p className="mt-2 text-xs leading-5 text-storm">Gasto habitual: mediana de {model.typicalSpend.monthsUsed} meses terminados, sin compras únicas, cuotas ni suscripciones. Solo se estima la parte restante del mes.</p>
      {model.liquid.unconvertedCount + month.unconvertedCount > 0 ?
        <p role="status" className="mt-2 text-xs text-storm">{model.liquid.unconvertedCount} cuentas y {month.unconvertedCount} compromisos de este mes sin conversión no suman.</p> : null}
      <details className="mt-4 border-t border-white/[0.07] pt-3 text-sm">
        <summary className="cursor-pointer text-ink">Ver de dónde sale</summary>
        <ul className="mt-2 divide-y divide-white/[0.07]">
          {[...month.inflows.map(line => ({ ...line, sign: 1 })), ...month.outflows.map(line => ({ ...line, sign: -1 }))].map((line, i) =>
            <li key={`${line.kind}-${line.refId}-${i}`} className="flex items-start justify-between gap-4 py-2">
              <span className="text-storm">{line.label}<span className="block text-xs">{line.dueDate ?? "Resto del mes"} · {line.source === "scheduled" ? "Programado" : "Estimado"}</span></span>
              <span className="shrink-0 tabular-nums text-ink">{formatCurrency(line.amount * line.sign, currency)}</span>
            </li>)}
        </ul>
        <p className="mt-3 text-xs text-storm">Meses usados para el gasto habitual</p>
        <ul>{model.typicalSpend.months.map(row => <li key={row.monthKey} className="flex justify-between gap-4 py-1 text-xs text-storm"><span>{row.monthKey}</span><span>{formatCurrency(row.total, currency)}</span></li>)}</ul>
      </details>
    </>}
  </article>;
}
