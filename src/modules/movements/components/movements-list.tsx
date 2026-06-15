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

type MovementsListProps = {
  movements: MovementRecord[];
  baseCurrencyCode: string;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onOpen: (movement: MovementRecord) => void;
};

export function MovementsList({
  movements,
  baseCurrencyCode,
  selectedIds,
  onToggleSelect,
  onOpen,
}: MovementsListProps) {
  return (
    <div className="space-y-2">
      {movements.map((movement) => {
        const movementTypeOption = getMovementTypeOption(movement.movementType);
        const displayInfo = getMovementDisplayInfo(movement, baseCurrencyCode);

        return (
          <article
            className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-3.5 transition hover:border-white/16"
            key={movement.id}
          >
            <SelectionCheckbox
              checked={selectedIds.has(movement.id)}
              onChange={() => onToggleSelect(movement.id)}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{movement.description}</p>
              <p className="text-xs text-storm">
                {movement.category} · {movement.counterparty} · {formatDateTime(movement.occurredAt)}
              </p>
            </div>
            <div className="hidden gap-2 sm:flex">
              <StatusBadge status={movementTypeOption.label} tone={getMovementTypeTone(movement.movementType)} />
              <StatusBadge status={formatMovementStatusLabel(movement.status)} tone={getMovementStatusTone(movement.status)} />
            </div>
            {displayInfo.amount !== null ? (
              <p className="shrink-0 text-sm font-semibold text-ink">
                {formatCurrency(displayInfo.amount, displayInfo.currencyCode)}
              </p>
            ) : null}
            <Button className="shrink-0 py-1.5 text-xs" onClick={() => onOpen(movement)} variant="ghost">
              Ver
            </Button>
          </article>
        );
      })}
    </div>
  );
}
