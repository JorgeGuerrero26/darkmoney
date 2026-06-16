import { CheckCircle2, History, PencilLine, Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/status-badge";
import { createLongPressHandlers, wasRecentLongPress } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { RecurringIncomeSummary } from "../../../types/domain";
import { getStatusOption, getStatusTone } from "../lib/recurring-income-presenters";

type RecurringIncomeGridProps = {
  income: RecurringIncomeSummary[];
  selectedIds: Set<number>;
  selectedCount: number;
  onToggleSelect: (id: number) => void;
  onEdit: (income: RecurringIncomeSummary) => void;
  onConfirm: (id: number) => void;
  onHistory: (id: number) => void;
  onDelete: (id: number) => void;
};

export function RecurringIncomeGrid({
  income,
  selectedIds,
  selectedCount,
  onToggleSelect,
  onEdit,
  onConfirm,
  onHistory,
  onDelete,
}: RecurringIncomeGridProps) {
  return (
    <div className="space-y-4">
      {income.map((item) => {
        const statusOption = getStatusOption(item.status);
        const isSelected = selectedIds.has(item.id);
        const longPressHandlers = createLongPressHandlers(() => onToggleSelect(item.id));

        return (
          <article
            className={`glass-panel-soft relative rounded-[24px] p-5 transition duration-200 hover:border-white/16 ${isSelected ? "border-pine/25 ring-2 ring-pine/30" : ""}`}
            key={item.id}
            onClick={(e) => {
              if (wasRecentLongPress()) return;
              if (selectedCount === 0) return;
              if (e.target instanceof HTMLElement && e.target.closest('button, a, input, label, [role="button"]')) return;
              onToggleSelect(item.id);
            }}
            {...longPressHandlers}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-storm/85">
                    {item.frequencyLabel}
                  </span>
                  <StatusBadge status={statusOption.label} tone={getStatusTone(item.status)} />
                </div>
                <p className="mt-4 font-display text-2xl font-semibold text-ink">{item.name}</p>
                <p className="mt-2 text-sm text-storm">
                  {item.payer}
                  {item.accountName ? ` - ${item.accountName}` : ""}
                  {item.categoryName ? ` - ${item.categoryName}` : ""}
                </p>
                {item.description ? <p className="mt-3 text-sm leading-7 text-storm">{item.description}</p> : null}
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 text-right">
                <p className="text-xs uppercase tracking-[0.22em] text-storm/75">Monto</p>
                <p className="mt-2 font-display text-2xl font-semibold text-ink">{formatCurrency(item.amount, item.currencyCode)}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-storm">Proxima llegada</p>
                <p className="mt-2 text-sm font-medium text-ink">{formatDate(item.nextExpectedDate)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-storm">Recordatorio</p>
                <p className="mt-2 text-sm font-medium text-ink">{item.remindDaysBefore} dias antes</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
              {item.status === "active" ? (
                <Button onClick={() => onConfirm(item.id)} variant="secondary">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirmar llegada
                </Button>
              ) : null}
              <Button onClick={() => onEdit(item)} variant="secondary">
                <PencilLine className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button onClick={() => onHistory(item.id)} variant="ghost">
                <History className="mr-2 h-4 w-4" />
                Historial
              </Button>
              <Button className="text-[#ffb4bc] hover:text-white" onClick={() => onDelete(item.id)} variant="ghost">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
