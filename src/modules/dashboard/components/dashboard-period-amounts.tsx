import { formatCurrency } from "../../../lib/formatting/money";
import type { buildDashboardPeriodSummary } from "../lib/dashboard-period-summary";

export function DashboardPeriodAmounts({ totals, currency }: { totals: ReturnType<typeof buildDashboardPeriodSummary>; currency: string }) {
  if (totals.unconvertedCount) return <span role="status">No se pueden calcular las entradas y salidas: faltan conversiones de {totals.unconvertedCount} {totals.unconvertedCount === 1 ? "movimiento" : "movimientos"}.</span>;
  return <>Este período entraron <span className="text-pine">{formatCurrency(totals.income, currency)}</span> y salieron <span className="text-ink">{formatCurrency(totals.expense, currency)}</span>.</>;
}
