import { BarChart3, ChevronRight } from "lucide-react";

import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { ObligationSummary } from "../../../types/domain";
import { getDirectionLabel, getStatusOption } from "../lib/obligations-presenters";

type ObligationTableProps = {
  obligations: ObligationSummary[];
  selectedIds: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onOpen: (obligation: ObligationSummary) => void;
  onAnalytics: (id: number) => void;
};

export function ObligationTable({
  obligations,
  selectedIds,
  allSelected,
  someSelected,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  onOpen,
  onAnalytics,
}: ObligationTableProps) {
  return (
    <section aria-label="Créditos y deudas" className="border-y border-white/[0.08]">
      <div className="flex min-h-11 items-center gap-3 border-b border-white/[0.08] py-2.5 text-[13px] text-storm">
        <SelectionCheckbox ariaLabel="Seleccionar todos" checked={allSelected} indeterminate={someSelected} onChange={() => (allSelected ? onClearAll() : onSelectAll())} />
        <span>Seleccionar todos</span>
        <span className="ml-auto">{obligations.length} en esta página</span>
      </div>

      {obligations.map((obligation) => {
        const status = getStatusOption(obligation.status);
        const due = obligation.dueDate ? ` · vence ${formatDate(obligation.dueDate)}` : "";
        return (
          <article className={`group grid min-h-[68px] cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.06] transition-colors duration-150 last:border-b-0 hover:bg-white/[0.035] sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(150px,0.7fr)_auto] ${selectedIds.has(obligation.id) ? "bg-white/[0.045]" : ""}`} key={obligation.id} onClick={() => onOpen(obligation)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(obligation); } }} role="button" tabIndex={0}>
            <div onClick={(event) => event.stopPropagation()}>
              <SelectionCheckbox ariaLabel={`Seleccionar ${obligation.title}`} checked={selectedIds.has(obligation.id)} onChange={() => onToggleSelect(obligation.id)} />
            </div>
            <div className="min-w-0 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-medium text-ink">{obligation.title}</p>
              </div>
              <p className="mt-0.5 truncate text-[13px] text-storm">{getDirectionLabel(obligation.direction)} · {obligation.counterparty} · {status.label}{due}</p>
            </div>
            <div className="hidden min-w-0 text-right sm:block">
              <p className="text-xs text-storm">Pagado {Math.round(obligation.progressPercent)}%</p>
              <div className="ml-auto mt-2 h-px w-28 overflow-hidden bg-white/10"><div className="h-full bg-[#d8d2c7]" style={{ width: `${Math.max(0, Math.min(100, obligation.progressPercent))}%` }} /></div>
            </div>
            <div className="flex items-center gap-1 py-3 text-right">
              <div className="mr-1">
                <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-ink">{formatCurrency(obligation.pendingAmount, obligation.currencyCode)}</p>
                <p className="text-xs text-storm">pendiente</p>
              </div>
              <button aria-label={`Ver análisis de ${obligation.title}`} className="hidden h-9 w-9 items-center justify-center rounded-lg text-storm transition hover:bg-white/[0.05] hover:text-ink md:flex" onClick={(event) => { event.stopPropagation(); onAnalytics(obligation.id); }} type="button"><BarChart3 className="h-4 w-4" /></button>
              <ChevronRight className="h-4 w-4 text-storm/70 transition-transform group-hover:translate-x-0.5" />
            </div>
          </article>
        );
      })}
    </section>
  );
}
