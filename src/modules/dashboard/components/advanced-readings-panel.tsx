import { Link } from "react-router-dom";
import { formatCurrency } from "../../../lib/formatting/money";
import type { buildAdvancedReadings } from "../lib/dashboard-advanced-readings";

export function AdvancedReadingsPanel({ model, currency }: { model: ReturnType<typeof buildAdvancedReadings>; currency: string }) {
  const { concentration: c, seasonal: s } = model;
  const delta = (value: number | null) => value === null ? "Sin referencia" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  const link = new URLSearchParams({ from: c.from, to: c.to });
  if (c.topCategoryId !== null) link.set("categoryId", String(c.topCategoryId));
  return <section aria-label="Lecturas avanzadas" className="grid items-start gap-5 border-t border-white/[0.07] pt-6 lg:grid-cols-2">
    <article className="rounded-[9px] border border-white/[0.08] bg-[#1a1917] p-5">
      <h2 className="text-base font-semibold text-ink">Concentración de salidas</h2>
      <p className="mt-2 text-sm text-storm">{c.label}{c.hhi !== null ? ` · HHI ${c.hhi.toFixed(3)}` : ""}</p>
      <p className="mt-2 text-xs leading-5 text-storm">Salidas aplicadas del mes actual por categoría, incluida «Sin categoría». HHI suma las participaciones al cuadrado; más cerca de 1 significa más concentración.</p>
      {c.unconvertedCount ? <p role="status" className="mt-3 text-sm text-storm">{c.unconvertedCount} salidas sin conversión. No calculamos participaciones sobre un total parcial.</p> :
        c.topShare !== null ? <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/[0.07] pt-4 text-sm">
          <span className="text-ink">{c.topCategory} · {c.topShare}%</span>
          <Link className="text-ink underline underline-offset-4" to={`/app/movements?${link}`}>{c.topCategoryId === null ? "Ver el mes" : "Ver categoría"}</Link>
        </div> : <p className="mt-4 text-sm text-storm">No hay salidas aplicadas en este mes.</p>}
    </article>
    <article className="rounded-[9px] border border-white/[0.08] bg-[#1a1917] p-5">
      <h2 className="text-base font-semibold text-ink">Mismo mes del año pasado</h2>
      <p className="mt-2 text-xs leading-5 text-storm">{s.currentFrom} a {s.currentTo} (en curso) frente a {s.previousFrom} a {s.previousTo} (mes completo). Los cortes no tienen la misma duración; no implica por sí solo una mejora.</p>
      {!s.hasHistory ? <p role="status" className="mt-4 text-sm text-storm">Se necesitan al menos tres movimientos aplicados de ingreso o gasto en ese mes del año pasado.</p> :
        !s.complete ? <p role="status" className="mt-4 text-sm text-storm">{s.unconvertedCount} movimientos sin conversión. Comparación no disponible.</p> :
          <dl className="mt-4 divide-y divide-white/[0.07] border-t border-white/[0.07]">
            {[{ label: "Ingresos", current: s.curIncome, previous: s.prevIncome, change: s.incomeDelta }, { label: "Gastos", current: s.curExpense, previous: s.prevExpense, change: s.expenseDelta }].map(row =>
              <div key={row.label} className="grid grid-cols-[1fr_auto] gap-1 py-3 text-sm">
                <dt className="text-ink">{row.label}</dt><dd className="text-right tabular-nums text-ink">{delta(row.change)}</dd>
                <dd className="col-span-2 text-xs text-storm">Actual {formatCurrency(row.current, currency)} · año pasado {formatCurrency(row.previous, currency)}</dd>
              </div>)}
          </dl>}
    </article>
  </section>;
}
