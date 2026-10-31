import { format } from "date-fns";
import { Link } from "react-router-dom";
import type { BudgetOverview } from "../../../types/domain";
import type { BudgetComputedMetrics } from "../../budgets/lib/budget-metrics";
import { formatCurrency } from "../../../lib/formatting/money";
import { convertDashboardAmount } from "../lib/dashboard-format";
import { limaClock } from "../lib/projection/lima-calendar";

export function DashboardSimpleBudgets({ budgets, metrics, baseCurrency, rates, now }: {
  budgets: BudgetOverview[]; metrics: Map<number, BudgetComputedMetrics>; baseCurrency: string; rates: Map<string, number>; now: Date;
}) {
  const day = format(limaClock(now), "yyyy-MM-dd");
  const rows = budgets.filter(b => b.isActive && b.limitAmount > 0 && b.periodStart <= day && b.periodEnd >= day).map(budget => {
    const result = metrics.get(budget.id);
    const complete = result !== undefined && result.contributions.every(row => {
      const converted = convertDashboardAmount({ amount: row.nativeAmount, currencyCode: row.nativeCurrencyCode, baseCurrencyCode: baseCurrency, targetCurrencyCode: budget.currencyCode, exchangeRateMap: rates });
      return converted !== null && Number.isFinite(converted);
    });
    return { budget, complete };
  }).filter(row => !row.complete || row.budget.usedPercent >= 80)
    .sort((a, b) => Number(!b.complete) - Number(!a.complete) || b.budget.usedPercent - a.budget.usedPercent).slice(0, 3);
  if (!rows.length) return null;
  return <section className="mt-7" aria-label="Presupuestos que requieren atención"><h3 className="font-display text-lg font-semibold text-ink">Presupuestos</h3><div className="mt-3 divide-y divide-white/[0.07]">{rows.map(({ budget, complete }) => {
    const difference = Math.abs(budget.limitAmount - budget.spentAmount);
    return <Link key={budget.id} to={`/app/budgets?resource=${budget.id}`} className="block py-4 text-sm"><span className="flex items-center justify-between gap-3"><span className="font-medium text-ink">{budget.name}</span><span className="tabular-nums text-ink">{complete ? budget.spentAmount > budget.limitAmount ? `${formatCurrency(difference, budget.currencyCode)} de más` : `Quedan ${formatCurrency(difference, budget.currencyCode)}` : "Consumo por comprobar"} ›</span></span>{complete ? <span className="mt-1 block text-xs text-storm">{formatCurrency(budget.spentAmount, budget.currencyCode)} de {formatCurrency(budget.limitAmount, budget.currencyCode)}</span> : <span className="mt-1 block text-xs text-storm">Faltan datos o conversiones para calcular el consumo.</span>}</Link>;
  })}</div></section>;
}
