import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { formatDateTime } from "../../../lib/formatting/dates";
import { formatMovementStatusLabel } from "../../../lib/formatting/labels";
import { formatCurrency } from "../../../lib/formatting/money";
import type { MovementRecord } from "../../../types/domain";
import {
  getMovementDisplayInfo,
  getMovementStatusTone,
  getMovementTypeOption,
  getMovementTypeTone,
} from "../lib/movement-form";

type MovementsGridProps = {
  movements: MovementRecord[];
  baseCurrencyCode: string;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onOpen: (movement: MovementRecord) => void;
};

export function MovementsGrid({
  movements,
  baseCurrencyCode,
  selectedIds,
  onToggleSelect,
  onOpen,
}: MovementsGridProps) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
      {movements.map((movement) => {
        const movementTypeOption = getMovementTypeOption(movement.movementType);
        const displayInfo = getMovementDisplayInfo(movement, baseCurrencyCode);

        return (
          <article
            className="glass-panel-soft flex flex-col gap-4 rounded-[24px] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-white/15"
            key={movement.id}
          >
            <div className="flex items-start justify-between gap-3">
              <SelectionCheckbox
                checked={selectedIds.has(movement.id)}
                onChange={() => onToggleSelect(movement.id)}
              />
              <StatusBadge status={movementTypeOption.label} tone={getMovementTypeTone(movement.movementType)} />
            </div>

            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{movement.description}</p>
              <p className="mt-0.5 truncate text-xs text-storm/70">
                {movement.category} · {movement.counterparty}
              </p>
            </div>

            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-[0.62rem] uppercase tracking-[0.18em] text-storm/60">{displayInfo.accountLabel}</p>
              <p className="mt-1 font-display text-xl font-semibold text-ink">
                {displayInfo.amount !== null
                  ? formatCurrency(displayInfo.amount, displayInfo.currencyCode)
                  : "—"}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-storm/70">
                <StatusBadge status={formatMovementStatusLabel(movement.status)} tone={getMovementStatusTone(movement.status)} />
                <span className="truncate">{formatDateTime(movement.occurredAt)}</span>
              </div>
              <Button className="shrink-0 py-1.5 text-xs" onClick={() => onOpen(movement)} variant="ghost">
                Ver
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
