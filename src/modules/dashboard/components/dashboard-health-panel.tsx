import { formatCurrency } from "../../../lib/formatting/money";
import type { buildDashboardHealth } from "../lib/dashboard-health";

export function DashboardHealthPanel({ model, currency }: {
  model: ReturnType<typeof buildDashboardHealth>; currency: string;
}) {
  const { health, baseline, savings, cashCushion, incomeStability, collection } = model;
  const percent = (value: number | null) => value === null ? "Sin dato" : `${value.toFixed(1)}%`;
  const rows = [
    { title: "Reserva", value: cashCushion.days === null ? "Sin dato" : `${cashCushion.days} días`,
      detail: cashCushion.days === null ? "Falta una referencia de gasto o conversión." : `${cashCushion.label} · caja líquida / gasto mensual de referencia.`,
      extra: cashCushion.daysWithCommitments === null ? null : `${cashCushion.daysWithCommitments} días al incluir las salidas comprometidas de los próximos 30 días.` },
    { title: "Ahorro histórico", value: percent(savings.averagePct),
      detail: `Ahorro total / ingresos totales de ${baseline.monthsUsed} meses terminados con actividad.`,
      extra: `Este mes: ${percent(savings.currentPct)}. Tendencia histórica: ${savings.trend}.` },
    { title: "Estabilidad de ingresos", value: incomeStability.label,
      detail: incomeStability.score === null ? "Se necesitan tres meses terminados con ingresos y conversiones completas." : `${incomeStability.score}/100 · variación mensual ${incomeStability.cvPct}%.` },
    { title: "Deudas activas", value: !model.obligationsReady || model.unconvertedPayables > 0 ? "Sin dato" : formatCurrency(model.healthInputs.totalPayable, currency),
      detail: "Desde tu lado: incluye las compartidas que te corresponde pagar." },
    { title: "Pagos vencidos", value: !model.obligationsReady ? "Sin comprobar" : `${health.overdueCount}`,
      detail: "Obligaciones activas por pagar con fecha vencida." },
    { title: "Cobros resueltos", value: collection.rate === null ? collection.label : `${collection.rate}%`,
      detail: collection.rate === null ? "Sin porcentaje hasta tener vencimientos que comprobar." : `${collection.resolved} de ${collection.total} obligaciones por cobrar con vencimiento en los últimos 30 días.`,
      extra: collection.rate === null ? null : "Cuenta registros pagados, no el porcentaje del dinero cobrado." },
  ];
  return <section aria-label="Salud financiera" className="rounded-[9px] border border-white/[0.08] bg-[#1a1917] p-5">
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="text-base font-semibold text-ink">Salud financiera</h2>
      <p aria-label="Nota de salud" className="font-public-mono text-lg tabular-nums text-ink">{health.score === null ? "—" : health.score}<span className="text-xs text-storm"> /100</span></p>
    </div>
    <p className="mt-2 text-xs leading-5 text-storm">{health.headline} La nota usa meses completos, no cambia con el filtro semanal.</p>
    {model.unconvertedHistory + model.unconvertedCurrent + model.unconvertedPayables + model.unconvertedLiquid > 0 ?
      <p role="status" className="mt-2 text-xs leading-5 text-storm">Faltan conversiones: {model.unconvertedHistory} movimientos históricos, {model.unconvertedCurrent} de este mes, {model.unconvertedPayables} deudas y {model.unconvertedLiquid} cuentas líquidas. Los indicadores afectados quedan sin valorar.</p> : null}
    <dl className="mt-4 divide-y divide-white/[0.07] border-t border-white/[0.07]">
      {rows.map(row => <div key={row.title} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-3">
        <dt className="text-sm font-medium text-ink">{row.title}</dt><dd className="max-w-[13rem] text-right text-sm tabular-nums text-ink">{row.value}</dd>
        <dd className="col-span-2 text-xs leading-5 text-storm">{row.detail}{row.extra ? <span className="block">{row.extra}</span> : null}</dd>
      </div>)}
    </dl>
    <details className="mt-3 border-t border-white/[0.07] pt-3 text-xs text-storm">
      <summary className="cursor-pointer font-medium text-ink">Ver meses del cálculo</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">Historial de ahorro; el último mes está en curso y no entra en la media.</caption>
          <thead><tr><th className="py-2 font-medium">Mes</th><th className="py-2 text-right font-medium">Ingresos</th><th className="py-2 text-right font-medium">Gastos</th><th className="py-2 text-right font-medium">Ahorro</th></tr></thead>
          <tbody>{savings.months.map((month, i) => <tr key={month.monthKey} className="border-t border-white/[0.07]">
            <th className="whitespace-nowrap py-2 pr-3 font-normal">{month.monthKey}{i === 6 ? " · en curso" : ""}</th>
            <td className="whitespace-nowrap py-2 pl-3 text-right">{month.unconvertedCount ? "Sin conversión" : formatCurrency(month.income, currency)}</td>
            <td className="whitespace-nowrap py-2 pl-3 text-right">{month.unconvertedCount ? "Sin conversión" : formatCurrency(month.expense, currency)}</td>
            <td className="whitespace-nowrap py-2 pl-3 text-right">{month.unconvertedCount ? "Sin dato" : percent(month.rate)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
