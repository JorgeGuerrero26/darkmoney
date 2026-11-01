import { formatCurrency } from "../../../lib/formatting/money";
import type { buildDashboardCashflow } from "../lib/projection/build-dashboard-cashflow";

type ProjectionMonth = ReturnType<typeof buildDashboardCashflow>["projection"]["months"][number];

/** Los saldos futuros se comparan sobre un eje cero común. */
export function DashboardProjectionChart({ months, currency, onSelect }: {
  months: ProjectionMonth[]; currency: string; onSelect: (monthKey: string) => void;
}) {
  const maxBalance = Math.max(1, ...months.map((month) => Math.abs(month.closingBalance)));
  return <div aria-label="Saldos proyectados por mes" className="mt-6 flex gap-1 sm:gap-2">
    {months.map((month) => {
      const date = new Date(`${month.monthKey}-01T12:00:00Z`);
      const label = new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "UTC" }).format(date);
      const height = Math.max(2, Math.abs(month.closingBalance) / maxBalance * 100);
      return <button key={month.monthKey} type="button" aria-label={`${label}: ${formatCurrency(month.closingBalance, currency)}`}
        onClick={() => onSelect(month.monthKey)} className="min-w-0 flex-1 rounded-sm text-xs text-storm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">
        <span className="flex h-16 items-end justify-center" aria-hidden="true">{month.closingBalance > 0 ? <span className="w-full max-w-8 rounded-t bg-ink" style={{ height: `${height}%` }} /> : null}</span>
        <span className="block border-t border-white/20" aria-hidden="true" />
        <span className="flex h-16 items-start justify-center" aria-hidden="true">{month.closingBalance < 0 ? <span className="w-full max-w-8 rounded-b bg-[#E2A07E]" style={{ height: `${height}%` }} /> : null}</span>
        <span className="mt-2 block truncate">{label}</span>
      </button>;
    })}
  </div>;
}
