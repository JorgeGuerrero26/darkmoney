import { formatCurrency } from "../../../lib/formatting/money";
import type { buildDashboardHistory } from "../lib/dashboard-history";

type HistoryMonth = ReturnType<typeof buildDashboardHistory>["months"][number];

/** Neto mensual con eje cero; no grafica importes incompletos ni meses futuros. */
export function DashboardHistoryChart({ months, currency, onSelect }: {
  months: HistoryMonth[]; currency: string; onSelect: (dateFrom: string) => void;
}) {
  const known = months.filter((month) => !month.isFuture && month.unconvertedCount === 0 && (month.income > 0.009 || month.expense > 0.009));
  const maxNet = Math.max(1, ...known.map((month) => Math.abs(month.net)));
  return <div aria-label="Neto de cada mes" className="mt-6 flex gap-1 sm:gap-2">
    {months.map((month) => {
      const available = known.includes(month);
      const height = available ? Math.max(2, Math.abs(month.net) / maxNet * 100) : 0;
      const description = month.isFuture ? `${month.label}: mes futuro` : month.unconvertedCount ? `${month.label}: faltan conversiones` : available ? `${month.label}: ${formatCurrency(month.net, currency)}` : `${month.label}: sin movimientos`;
      return <button key={month.dateFrom} type="button" disabled={!available} aria-label={description}
        onClick={() => onSelect(month.dateFrom)} className="min-w-0 flex-1 rounded-sm text-xs text-storm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-default">
        <span className="flex h-16 items-end justify-center" aria-hidden="true">{available && month.net > 0 ? <span className="w-full max-w-8 rounded-t bg-[#86CE96]" style={{ height: `${height}%` }} /> : null}</span>
        <span className="block border-t border-white/20" aria-hidden="true" />
        <span className="flex h-16 items-start justify-center" aria-hidden="true">{available && month.net < 0 ? <span className="w-full max-w-8 rounded-b bg-[#E2A07E]" style={{ height: `${height}%` }} /> : null}</span>
        <span className="mt-2 block truncate uppercase">{month.label}</span>
      </button>;
    })}
  </div>;
}
