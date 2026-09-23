import { BarChart3, ChevronRight, CircleCheck, MoreHorizontal, PencilLine, Pin, Play, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";

import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { SubscriptionSummary } from "../../../types/domain";
import { getFrequencyOption, getStatusOption } from "../lib/subscriptions-presenters";

type SubscriptionTableProps = {
  subscriptions: SubscriptionSummary[];
  selectedIds: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onEdit: (subscription: SubscriptionSummary) => void;
  onOpen: (subscription: SubscriptionSummary) => void;
  onPay: (subscription: SubscriptionSummary) => void;
  onReactivate: (subscription: SubscriptionSummary) => void;
  onAnalytics: (id: number) => void;
  onDelete: (id: number) => void;
};

function sectionLabel(subscription: SubscriptionSummary, today: string) {
  if (subscription.status === "paused") return "Pausadas";
  if (subscription.status === "cancelled") return "Canceladas";
  return subscription.nextDueDate < today ? "Atrasadas" : "Próximas";
}

export function SubscriptionTable({
  subscriptions,
  selectedIds,
  allSelected,
  someSelected,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  onEdit,
  onOpen,
  onPay,
  onReactivate,
  onAnalytics,
  onDelete,
}: SubscriptionTableProps) {
  const [openActionsId, setOpenActionsId] = useState<number | null>(null);
  return (
    <section aria-label="Suscripciones" className="border-y border-white/[0.08]">
      <div className="flex min-h-11 items-center gap-3 border-b border-white/[0.08] py-2.5 text-[13px] text-storm">
        <SelectionCheckbox ariaLabel="Seleccionar todas" checked={allSelected} indeterminate={someSelected} onChange={() => (allSelected ? onClearAll() : onSelectAll())} />
        <span>Seleccionar todas</span>
        <span className="ml-auto">{subscriptions.length} en esta página</span>
      </div>
      {subscriptions.map((subscription, index) => {
        const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
        const section = sectionLabel(subscription, today);
        const previous = index > 0 ? sectionLabel(subscriptions[index - 1], today) : null;
        return <Fragment key={subscription.id}>
        {section !== previous ? <div className="border-b border-white/[0.08] px-1 py-3 font-public-mono text-[11px] uppercase tracking-[0.13em] text-storm">{section}</div> : null}
        <article
          className={`group grid min-h-[68px] cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.06] transition-colors duration-150 last:border-b-0 hover:bg-white/[0.035] sm:grid-cols-[auto_minmax(0,1.3fr)_minmax(130px,0.6fr)_auto] ${selectedIds.has(subscription.id) ? "bg-white/[0.045]" : ""}`}
          onClick={() => onOpen(subscription)}
          onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(subscription); } }}
          role="button"
          tabIndex={0}
        >
          <span onClick={(event) => event.stopPropagation()}>
            <SelectionCheckbox ariaLabel={"Seleccionar " + subscription.name} checked={selectedIds.has(subscription.id)} onChange={() => onToggleSelect(subscription.id)} />
          </span>
          <div className="min-w-0 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium text-ink">{subscription.name}</p>
              {subscription.isPinned ? <Pin aria-label="Fijada" className="h-3 w-3 shrink-0 text-storm" /> : null}
              {subscription.status !== "active" ? <span className="shrink-0 text-xs text-storm">{getStatusOption(subscription.status).label}</span> : null}
            </div>
            <p className="mt-0.5 truncate text-[13px] text-storm">{subscription.vendor} · {getFrequencyOption(subscription.frequency).label} · {formatDate(subscription.nextDueDate)}</p>
          </div>
          <p className="hidden text-right text-[13px] text-storm sm:block">{subscription.accountName ?? subscription.categoryName ?? ""}</p>
          <div className="flex items-center gap-1 py-3 text-right">
            <p className="mr-1 whitespace-nowrap text-sm font-semibold tabular-nums text-ink">{formatCurrency(subscription.amount, subscription.currencyCode)}</p>
            <div className="relative" onClick={(event) => event.stopPropagation()}>
              <button aria-expanded={openActionsId === subscription.id} aria-label={"Opciones de " + subscription.name} className="grid h-9 w-9 place-items-center rounded-lg text-storm transition hover:bg-white/[0.05] hover:text-ink" onClick={() => setOpenActionsId((current) => current === subscription.id ? null : subscription.id)} type="button"><MoreHorizontal className="h-4 w-4" /></button>
              {openActionsId === subscription.id ? <>
                <button aria-label="Cerrar opciones" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpenActionsId(null)} type="button" />
                <div className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl border border-white/[0.1] bg-[#1b1a18] py-1">
                  <button className="flex h-10 w-full items-center gap-3 px-4 text-left text-sm text-ink hover:bg-white/[0.04]" onClick={() => { setOpenActionsId(null); onOpen(subscription); }} type="button"><ChevronRight className="h-4 w-4" />Ver detalle</button>
                  {subscription.status === "active" ? <button className="flex h-10 w-full items-center gap-3 px-4 text-left text-sm text-ink hover:bg-white/[0.04]" onClick={() => { setOpenActionsId(null); onPay(subscription); }} type="button"><CircleCheck className="h-4 w-4" />Marcar como pagada</button> : null}
                  {subscription.status === "paused" ? <button className="flex h-10 w-full items-center gap-3 px-4 text-left text-sm text-ink hover:bg-white/[0.04]" onClick={() => { setOpenActionsId(null); onReactivate(subscription); }} type="button"><Play className="h-4 w-4" />Reactivar</button> : null}
                  <button className="flex h-10 w-full items-center gap-3 px-4 text-left text-sm text-ink hover:bg-white/[0.04]" onClick={() => { setOpenActionsId(null); onAnalytics(subscription.id); }} type="button"><BarChart3 className="h-4 w-4" />Analizar</button>
                  <button className="flex h-10 w-full items-center gap-3 px-4 text-left text-sm text-ink hover:bg-white/[0.04]" onClick={() => { setOpenActionsId(null); onEdit(subscription); }} type="button"><PencilLine className="h-4 w-4" />Editar</button>
                  <button className="flex h-10 w-full items-center gap-3 border-t border-white/[0.08] px-4 text-left text-sm text-storm hover:bg-white/[0.04] hover:text-ink" onClick={() => { setOpenActionsId(null); onDelete(subscription.id); }} type="button"><Trash2 className="h-4 w-4" />Eliminar</button>
                </div>
              </> : null}
            </div>
            <button aria-label={"Ver " + subscription.name} className="grid h-9 w-6 place-items-center text-storm/70 transition hover:text-ink" onClick={(event) => { event.stopPropagation(); onOpen(subscription); }} type="button"><ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></button>
          </div>
        </article>
        </Fragment>;
      })}
    </section>
  );
}
