import { CheckCircle2, History } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { RecurringIncomeSummary } from "../../../types/domain";
import { getStatusOption, getStatusTone } from "../lib/recurring-income-presenters";

type RecurringIncomeListProps = {
  income: RecurringIncomeSummary[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onEdit: (income: RecurringIncomeSummary) => void;
  onConfirm: (id: number) => void;
  onHistory: (id: number) => void;
};

export function RecurringIncomeList({
  income,
  selectedIds,
  onToggleSelect,
  onEdit,
  onConfirm,
  onHistory,
}: RecurringIncomeListProps) {
  return (
    <div className="space-y-3">
      {income.map((item) => {
        const statusOption = getStatusOption(item.status);

        return (
          <article
            className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/16"
            key={item.id}
          >
            <SelectionCheckbox checked={selectedIds.has(item.id)} onChange={() => onToggleSelect(item.id)} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{item.name}</p>
              <p className="text-xs text-storm">
                {item.payer}
                {item.categoryName ? ` · ${item.categoryName}` : ""} · {item.frequencyLabel}
              </p>
            </div>
            <div className="hidden shrink-0 flex-col text-right sm:flex">
              <p className="text-sm font-semibold text-ink">{formatCurrency(item.amount, item.currencyCode)}</p>
              <p className="text-xs text-storm">{formatDate(item.nextExpectedDate)}</p>
            </div>
            <StatusBadge status={statusOption.label} tone={getStatusTone(item.status)} />
            {item.status === "active" ? (
              <Button className="shrink-0 py-1.5 text-xs" onClick={() => onConfirm(item.id)} variant="ghost">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Confirmar
              </Button>
            ) : null}
            <Button className="shrink-0 py-1.5 text-xs" onClick={() => onHistory(item.id)} variant="ghost">
              <History className="mr-1 h-3.5 w-3.5" />
            </Button>
            <Button className="shrink-0 py-1.5 text-xs" onClick={() => onEdit(item)} variant="ghost">
              Editar
            </Button>
          </article>
        );
      })}
    </div>
  );
}
