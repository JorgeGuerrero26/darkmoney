import { Check, MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { RecurringIncomeSummary } from "../../../types/domain";
import { getFrequencyOption, getStatusOption } from "../lib/recurring-income-presenters";

type RecurringIncomeListProps = {
  income: RecurringIncomeSummary[];
  selectedIds: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  onClearAll: () => void;
  onToggleSelect: (id: number) => void;
  onEdit: (income: RecurringIncomeSummary) => void;
  onConfirm: (id: number) => void;
  onHistory: (id: number) => void;
  onDelete: (id: number) => void;
};

export function RecurringIncomeList({
  income,
  selectedIds,
  allSelected,
  someSelected,
  onSelectAll,
  onClearAll,
  onToggleSelect,
  onEdit,
  onConfirm,
  onHistory,
  onDelete,
}: RecurringIncomeListProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <section aria-label="Ingresos fijos registrados" className="min-w-0">
      <div className="flex h-11 items-center justify-between border-b border-white/[0.08] text-xs text-storm">
        <label className="flex items-center gap-2.5">
          <SelectionCheckbox checked={allSelected} indeterminate={someSelected} onChange={allSelected ? onClearAll : onSelectAll} />
          Seleccionar todos
        </label>
        <span>{income.length} en esta página</span>
      </div>
      {income.map((item) => (
        <article className="relative flex min-h-[76px] items-center gap-3 border-b border-white/[0.08] py-3" key={item.id}>
          <SelectionCheckbox checked={selectedIds.has(item.id)} onChange={() => onToggleSelect(item.id)} />
          <button className="min-w-0 flex-1 text-left outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50" onClick={() => onEdit(item)} type="button">
            <span className="block truncate text-sm font-semibold text-ink">{item.name}</span>
            <span className="mt-0.5 block truncate text-xs text-storm">
              {getFrequencyOption(item.frequency).label}
              {item.payer ? ` · ${item.payer}` : ""}
              {item.categoryName ? ` · ${item.categoryName}` : ""}
              {item.status !== "active" ? ` · ${getStatusOption(item.status).label}` : ""}
            </span>
          </button>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums text-ink">{formatCurrency(item.amount, item.currencyCode)}</p>
            <p className="mt-0.5 text-xs text-storm">{item.status === "active" && item.nextExpectedDate < todayDate ? "Pendiente · " : ""}{formatDate(item.nextExpectedDate)}</p>
          </div>
          <button aria-expanded={openMenuId === item.id} aria-label={`Acciones de ${item.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-storm transition hover:bg-white/[0.05] hover:text-ink" onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)} type="button"><MoreHorizontal className="h-4 w-4" /></button>
          {openMenuId === item.id ? (
            <>
              <button aria-label="Cerrar acciones" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpenMenuId(null)} type="button" />
              <div className="absolute right-0 top-[calc(100%-4px)] z-40 min-w-44 overflow-hidden rounded-xl border border-white/10 bg-[#1b1a18] py-1">
                {item.status === "active" ? <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink hover:bg-white/[0.05]" onClick={() => { setOpenMenuId(null); onConfirm(item.id); }} type="button"><Check className="h-4 w-4" />Confirmar llegada</button> : null}
                <button className="w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-white/[0.05]" onClick={() => { setOpenMenuId(null); onHistory(item.id); }} type="button">Ver historial</button>
                <button className="w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-white/[0.05]" onClick={() => { setOpenMenuId(null); onEdit(item); }} type="button">Editar</button>
                <button className="w-full border-t border-white/[0.08] px-4 py-2.5 text-left text-sm text-[#e7aaa5] hover:bg-white/[0.05]" onClick={() => { setOpenMenuId(null); onDelete(item.id); }} type="button">Eliminar</button>
              </div>
            </>
          ) : null}
        </article>
      ))}
    </section>
  );
}
