import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { formatCurrency } from "../../../lib/formatting/money";
import type { ObligationSummary } from "../../../types/domain";
import { getDirectionLabel, getDirectionVisual, getStatusOption, getStatusTone } from "../lib/obligations-presenters";

type ObligationListProps = {
  obligations: ObligationSummary[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onEdit: (obligation: ObligationSummary) => void;
  onAnalytics: (id: number) => void;
};

export function ObligationList({ obligations, selectedIds, onToggleSelect, onEdit, onAnalytics }: ObligationListProps) {
  return (
    <div className="space-y-3">
      {obligations.map((obligation) => {
        const directionVisual = getDirectionVisual(obligation.direction);
        const DirectionIcon = directionVisual.icon;
        const statusOption = getStatusOption(obligation.status);

        return (
          <article
            className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/16"
            key={obligation.id}
          >
            <SelectionCheckbox
              ariaLabel={`Seleccionar ${obligation.title}`}
              checked={selectedIds.has(obligation.id)}
              onChange={() => onToggleSelect(obligation.id)}
            />
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 text-white"
              style={{ background: `linear-gradient(160deg, ${directionVisual.color}, rgba(8,13,20,0.72))` }}
            >
              <DirectionIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{obligation.title}</p>
              <p className="text-xs text-storm">
                {obligation.counterparty} · {getDirectionLabel(obligation.direction)}
              </p>
            </div>
            <div className="hidden shrink-0 flex-col text-right sm:flex">
              <p className="text-sm font-semibold text-ink">{formatCurrency(obligation.pendingAmount, obligation.currencyCode)}</p>
              <p className="text-xs text-storm">pendiente</p>
            </div>
            <StatusBadge status={statusOption.label} tone={getStatusTone(obligation.status)} />
            <Button className="shrink-0 py-1.5 text-xs" onClick={() => onAnalytics(obligation.id)} variant="ghost">
              Análisis
            </Button>
            <Button className="shrink-0 py-1.5 text-xs" onClick={() => onEdit(obligation)} variant="ghost">
              Ver
            </Button>
          </article>
        );
      })}
    </div>
  );
}
