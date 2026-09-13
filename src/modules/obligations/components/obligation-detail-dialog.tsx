import { Archive, ArchiveRestore, BarChart3, Pencil, Plus, Share2, Trash2, X } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { ObligationEventSummary, ObligationSummary } from "../../../types/domain";
import { getDirectionLabel, getEventLabel, getOriginOption, getStatusOption } from "../lib/obligations-presenters";

type PrincipalAdjustmentMode = "increase" | "decrease";

type ObligationDetailDialogProps = {
  obligation: ObligationSummary;
  canShare: boolean;
  onClose: () => void;
  onPayment: (obligation: ObligationSummary) => void;
  onAdjust: (obligation: ObligationSummary, mode: PrincipalAdjustmentMode) => void;
  onShare: (obligation: ObligationSummary) => void;
  onAnalytics: (id: number) => void;
  onEdit: (obligation: ObligationSummary) => void;
  onDelete: (id: number) => void;
  onArchive: (obligation: ObligationSummary, archived: boolean) => void;
  onEditEvent: (obligation: ObligationSummary, event: ObligationEventSummary) => void;
  onDeleteEvent: (obligation: ObligationSummary, event: ObligationEventSummary) => void;
};

export function ObligationDetailDialog({
  obligation,
  canShare,
  onClose,
  onPayment,
  onAdjust,
  onShare,
  onAnalytics,
  onEdit,
  onDelete,
  onArchive,
  onEditEvent,
  onDeleteEvent,
}: ObligationDetailDialogProps) {
  const currentPrincipal = obligation.currentPrincipalAmount ?? obligation.principalAmount;
  const paidAmount = Math.max(0, currentPrincipal - obligation.pendingAmount);
  const status = getStatusOption(obligation.status);
  const origin = getOriginOption(obligation.originType, obligation.direction);
  const canDelete = obligation.events.every((event) => event.eventType === "opening");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" role="presentation">
      <section aria-modal="true" className="flex max-h-[calc(100dvh-24px)] w-full max-w-[760px] flex-col overflow-hidden rounded-[20px] border border-white/[0.12] bg-[#181715]" role="dialog">
        <header className="flex items-start gap-4 border-b border-white/[0.08] px-5 py-4 sm:px-7">
          <div className="min-w-0 flex-1">
            <p className="font-public-mono text-[10px] uppercase tracking-[0.18em] text-storm">{getDirectionLabel(obligation.direction)} · {status.label}</p>
            <h2 className="mt-1 truncate font-display text-2xl font-semibold text-ink">{obligation.title}</h2>
            <p className="mt-1 text-sm text-storm">{obligation.counterparty}</p>
          </div>
          <button aria-label="Cerrar detalle" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-storm transition hover:bg-white/[0.05] hover:text-ink" onClick={onClose} type="button"><X className="h-5 w-5" /></button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          <section className="border-b border-white/[0.08] pb-5">
            <p className="font-public-mono text-[10px] uppercase tracking-[0.18em] text-storm">Pendiente</p>
            <p className="mt-1 font-display text-4xl font-semibold tracking-[-0.03em] text-ink">{formatCurrency(obligation.pendingAmount, obligation.currencyCode)}</p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full bg-[#d8d2c7]" style={{ width: `${Math.max(0, Math.min(100, obligation.progressPercent))}%` }} /></div>
            <div className="mt-2 flex justify-between text-xs text-storm"><span>Pagado {formatCurrency(paidAmount, obligation.currencyCode)}</span><span>{Math.round(obligation.progressPercent)}%</span></div>
          </section>

          <dl className="divide-y divide-white/[0.07] border-b border-white/[0.08]">
            <DetailRow label="Principal" value={formatCurrency(currentPrincipal, obligation.currencyCode)} />
            <DetailRow label="Origen" value={origin.label} />
            <DetailRow label="Inicio" value={formatDate(obligation.startDate)} />
            <DetailRow label="Vencimiento" value={obligation.dueDate ? formatDate(obligation.dueDate) : "Sin fecha"} />
            <DetailRow label="Cuenta" value={obligation.settlementAccountName ?? "Sin asignar"} />
            <DetailRow label="Plan" value={obligation.installmentLabel} />
          </dl>

          {(obligation.description || obligation.notes) ? <section className="border-b border-white/[0.08] py-5"><p className="font-public-mono text-[10px] uppercase tracking-[0.18em] text-storm">Notas</p><p className="mt-2 text-sm leading-6 text-ink/90">{obligation.description || obligation.notes}</p></section> : null}

          <section className="py-5">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-ink">Historial</h3><button className="text-sm text-storm underline-offset-4 hover:text-ink hover:underline" onClick={() => onAnalytics(obligation.id)} type="button">Ver análisis</button></div>
            {obligation.events.length ? <div className="mt-3 divide-y divide-white/[0.07] border-y border-white/[0.08]">{obligation.events.slice(0, 6).map((event) => <div className="flex min-h-14 items-center gap-3 py-2" key={event.id}><div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink">{getEventLabel(event.eventType)}</p><p className="truncate text-xs text-storm">{formatDate(event.eventDate)}{event.description ? ` · ${event.description}` : ""}</p></div><p className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatCurrency(event.amount, obligation.currencyCode)}</p>{event.eventType === "payment" || event.eventType === "principal_increase" || event.eventType === "principal_decrease" ? <><button className="text-xs text-storm hover:text-ink" onClick={() => onEditEvent(obligation, event)} type="button">Editar</button><button aria-label="Eliminar evento" className="text-storm hover:text-ink" onClick={() => onDeleteEvent(obligation, event)} type="button"><Trash2 className="h-4 w-4" /></button></> : null}</div>)}</div> : <p className="mt-3 text-sm text-storm">Todavía no hay movimientos registrados.</p>}
          </section>
        </div>

        <footer className="border-t border-white/[0.08] px-5 py-4 sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => onPayment(obligation)}><Plus className="mr-2 h-4 w-4" />Registrar abono</Button>
            <Button onClick={() => onAdjust(obligation, "increase")} variant="secondary">Agregar monto</Button>
            <button className="px-2 text-sm text-storm underline-offset-4 hover:text-ink hover:underline" onClick={() => onAdjust(obligation, "decrease")} type="button">Reducir monto</button>
            <div className="ml-auto flex items-center gap-1">
              {canShare ? <button aria-label="Compartir" className="flex h-10 w-10 items-center justify-center rounded-lg text-storm hover:bg-white/[0.05] hover:text-ink" onClick={() => onShare(obligation)} type="button"><Share2 className="h-4 w-4" /></button> : null}
              <button aria-label="Análisis" className="flex h-10 w-10 items-center justify-center rounded-lg text-storm hover:bg-white/[0.05] hover:text-ink" onClick={() => onAnalytics(obligation.id)} type="button"><BarChart3 className="h-4 w-4" /></button>
              <button aria-label="Editar" className="flex h-10 w-10 items-center justify-center rounded-lg text-storm hover:bg-white/[0.05] hover:text-ink" onClick={() => onEdit(obligation)} type="button"><Pencil className="h-4 w-4" /></button>
              {canDelete ? <button aria-label="Eliminar" className="flex h-10 w-10 items-center justify-center rounded-lg text-storm hover:bg-white/[0.05] hover:text-ink" onClick={() => onDelete(obligation.id)} type="button"><Trash2 className="h-4 w-4" /></button> : obligation.status === "cancelled" ? <button aria-label="Restaurar" className="flex h-10 w-10 items-center justify-center rounded-lg text-storm hover:bg-white/[0.05] hover:text-ink" onClick={() => onArchive(obligation, false)} type="button"><ArchiveRestore className="h-4 w-4" /></button> : <button aria-label="Archivar" className="flex h-10 w-10 items-center justify-center rounded-lg text-storm hover:bg-white/[0.05] hover:text-ink" onClick={() => onArchive(obligation, true)} type="button"><Archive className="h-4 w-4" /></button>}
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-14 items-center justify-between gap-6 py-2"><dt className="text-sm font-medium text-ink">{label}</dt><dd className="text-right text-sm text-storm">{value}</dd></div>;
}
