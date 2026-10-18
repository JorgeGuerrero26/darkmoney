import { Check, MoreHorizontal, Pin, Pause, Play } from "lucide-react";
import { useState } from "react";

import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { RecurringIncomeSummary } from "../../../types/domain";
import { getFrequencyOption, getStatusOption } from "../lib/recurring-income-presenters";
import { validIncomeCalendarDay } from "../lib/recurring-income-parity";

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
  onPin: (income: RecurringIncomeSummary) => void;
  onPause: (income: RecurringIncomeSummary) => void;
  canWrite?: boolean;
  isPending?: boolean;
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
  onPin,
  onPause,
  canWrite = false,
  isPending = false,
}: RecurringIncomeListProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const todayDate = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);

  return (
    <section aria-label="Ingresos fijos registrados" className="min-w-0">
      <div className="flex h-11 items-center justify-between border-b border-white/[0.08] text-xs text-storm">
        <label className="flex items-center gap-2.5">
          <SelectionCheckbox ariaLabel="Seleccionar todas" checked={allSelected} indeterminate={someSelected} onChange={allSelected ? onClearAll : onSelectAll} />
          Seleccionar todos
        </label>
        <span>{income.length} en esta página</span>
      </div>
      {income.map((item, index) => {
        const section = item.status === "active" ? item.nextExpectedDate < todayDate ? "Sin confirmar" : "Próximos" : item.status === "paused" ? "Pausados" : "Cancelados";
        const previous = income[index - 1];
        const previousSection = previous ? previous.status === "active" ? previous.nextExpectedDate < todayDate ? "Sin confirmar" : "Próximos" : previous.status === "paused" ? "Pausados" : "Cancelados" : null;
        return <div key={item.id}>
        {section !== previousSection ? <p className="border-b border-white/[0.08] py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-storm">{section}</p> : null}
        <article className="relative flex min-h-[76px] items-center gap-3 border-b border-white/[0.08] py-3" key={item.id}>
          <SelectionCheckbox ariaLabel={`Seleccionar ${item.name}`} checked={selectedIds.has(item.id)} onChange={() => onToggleSelect(item.id)} />
          <button className="min-w-0 flex-1 text-left outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50" onClick={() => onHistory(item.id)} type="button">
            <span className="block truncate text-sm font-semibold text-ink">{item.isPinned ? <Pin aria-label="Fijado" className="mr-1 inline h-3 w-3" /> : null}{item.name}</span>
            <span className="mt-0.5 block truncate text-xs text-storm">
              {getFrequencyOption(item.frequency).label}
              {item.payer ? ` · ${item.payer}` : ""}
              {item.categoryName ? ` · ${item.categoryName}` : ""}
              {item.status !== "active" ? ` · ${getStatusOption(item.status).label}` : ""}
            </span>
          </button>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums text-ink">{formatCurrency(item.amount, item.currencyCode)}</p>
            <p className="mt-0.5 text-xs text-storm">{validIncomeCalendarDay(item.nextExpectedDate) ? <>{item.status === "active" && item.nextExpectedDate < todayDate ? "Sin confirmar · " : ""}{formatDate(item.nextExpectedDate)}</> : "Fecha por comprobar"}</p>
          </div>
          <button aria-expanded={openMenuId === item.id} aria-label={`Acciones de ${item.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-storm transition hover:bg-white/[0.05] hover:text-ink" onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)} type="button"><MoreHorizontal className="h-4 w-4" /></button>
          {openMenuId === item.id ? (
            <>
              <button aria-label="Cerrar acciones" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpenMenuId(null)} type="button" />
              <div className="absolute right-0 top-[calc(100%-4px)] z-40 min-w-44 overflow-hidden rounded-xl border border-white/10 bg-[#1b1a18] py-1">
                {canWrite && item.status === "active" ? <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink hover:bg-white/[0.05]" disabled={isPending} onClick={() => { setOpenMenuId(null); onConfirm(item.id); }} type="button"><Check className="h-4 w-4" />Confirmar llegada</button> : null}
                <button className="w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-white/[0.05]" onClick={() => { setOpenMenuId(null); onHistory(item.id); }} type="button">Ver historial</button>
                {canWrite ? <fieldset className="border-0 p-0" disabled={isPending}>
                <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink hover:bg-white/[0.05]" onClick={() => { setOpenMenuId(null); onPin(item); }} type="button"><Pin className="h-4 w-4" />{item.isPinned ? "Desfijar" : "Fijar"}</button>
                {item.status !== "cancelled" ? <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink hover:bg-white/[0.05]" onClick={() => { setOpenMenuId(null); onPause(item); }} type="button">{item.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{item.status === "active" ? "Pausar" : "Reactivar"}</button> : null}
                <button className="w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-white/[0.05]" onClick={() => { setOpenMenuId(null); onEdit(item); }} type="button">Editar</button>
                <button className="w-full border-t border-white/[0.08] px-4 py-2.5 text-left text-sm text-[#e7aaa5] hover:bg-white/[0.05]" onClick={() => { setOpenMenuId(null); onDelete(item.id); }} type="button">Eliminar</button>
                </fieldset> : null}
              </div>
            </>
          ) : null}
        </article>
        </div>;
      })}
    </section>
  );
}
