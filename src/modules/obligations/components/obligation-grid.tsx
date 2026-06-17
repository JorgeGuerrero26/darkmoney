import { BarChart3, CircleDollarSign, MailPlus, Minus, PencilLine, Plus, Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { ProgressBar } from "../../../components/ui/progress-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { createLongPressHandlers, wasRecentLongPress } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { ObligationShareSummary, ObligationSummary } from "../../../types/domain";
import type { PrincipalAdjustmentMode } from "../lib/obligations-types";
import {
  getDirectionLabel,
  getDirectionTone,
  getDirectionVisual,
  getEventIcon,
  getEventLabel,
  getOriginOption,
  getShareStatusLabel,
  getShareStatusTone,
  getStatusOption,
  getStatusTone,
} from "../lib/obligations-presenters";

type ObligationGridProps = {
  obligations: ObligationSummary[];
  selectedIds: Set<number>;
  selectedCount: number;
  expandedHistoryId: number | null;
  shareByObligationId: Map<number, ObligationShareSummary>;
  canAccessProFeatures: boolean;
  onToggleSelect: (id: number) => void;
  onToggleHistory: (id: number) => void;
  onPayment: (obligation: ObligationSummary) => void;
  onAdjustPrincipal: (obligation: ObligationSummary, mode: PrincipalAdjustmentMode) => void;
  onShare: (obligation: ObligationSummary) => void;
  onAnalytics: (id: number) => void;
  onEdit: (obligation: ObligationSummary) => void;
  onDelete: (id: number) => void;
};

export function ObligationGrid({
  obligations,
  selectedIds,
  selectedCount,
  expandedHistoryId,
  shareByObligationId,
  canAccessProFeatures,
  onToggleSelect,
  onToggleHistory,
  onPayment,
  onAdjustPrincipal,
  onShare,
  onAnalytics,
  onEdit,
  onDelete,
}: ObligationGridProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {obligations.map((obligation) => {
        const directionVisual = getDirectionVisual(obligation.direction);
        const DirectionIcon = directionVisual.icon;
        const statusOption = getStatusOption(obligation.status);
        const lastEvent = obligation.events[0] ?? null;
        const currentShare = shareByObligationId.get(obligation.id);
        const isSelected = selectedIds.has(obligation.id);
        const longPressHandlers = createLongPressHandlers(() => onToggleSelect(obligation.id));

        return (
          <article
            className={`glass-panel-soft relative rounded-[24px] p-6 transition duration-200 hover:border-white/16 ${isSelected ? "border-pine/25 ring-2 ring-pine/30" : ""}`}
            key={obligation.id}
            onClick={(e) => {
              if (wasRecentLongPress()) return;
              if (selectedCount === 0) return;
              if (e.target instanceof HTMLElement && e.target.closest('button, a, input, label, [role="button"]')) return;
              onToggleSelect(obligation.id);
            }}
            {...longPressHandlers}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-display text-2xl font-semibold text-ink">{obligation.title}</h3>
                <p className="mt-1 text-sm text-storm">{obligation.counterparty}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <StatusBadge status={getDirectionLabel(obligation.direction)} tone={getDirectionTone(obligation.direction)} />
                <StatusBadge status={statusOption.label} tone={getStatusTone(obligation.status)} />
                {currentShare ? <StatusBadge status={getShareStatusLabel(currentShare.status)} tone={getShareStatusTone(currentShare.status)} /> : null}
              </div>
            </div>

            <div className="mt-5 space-y-5">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-white/10 text-white"
                  style={{ background: `linear-gradient(160deg, ${directionVisual.color}, rgba(8,13,20,0.72))` }}
                >
                  <DirectionIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/85">
                      {getOriginOption(obligation.originType, obligation.direction).label}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/85">
                      {obligation.currencyCode}
                    </span>
                  </div>
                  {obligation.description ? <p className="mt-3 text-sm leading-7 text-storm">{obligation.description}</p> : null}

                  {currentShare ? (
                    <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-7 text-storm">
                      <p className="font-medium text-ink">
                        {currentShare.status === "accepted"
                          ? `Compartida con ${currentShare.invitedDisplayName ?? currentShare.invitedEmail}`
                          : `Invitacion pendiente para ${currentShare.invitedDisplayName ?? currentShare.invitedEmail}`}
                      </p>
                      <p className="mt-1 text-storm">
                        {currentShare.status === "accepted"
                          ? "La otra persona ya puede verla en modo solo lectura desde su propia cuenta."
                          : "Cuando la otra persona acepte el correo, la vera en su modulo de creditos y deudas."}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Principal</p>
                  <p className="mt-2 font-display text-3xl font-semibold text-ink">
                    {formatCurrency(obligation.currentPrincipalAmount ?? obligation.principalAmount, obligation.currencyCode)}
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Pendiente</p>
                  <p className="mt-2 font-display text-3xl font-semibold text-ink">{formatCurrency(obligation.pendingAmount, obligation.currencyCode)}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-storm/75">Fecha objetivo</p>
                  <p className="mt-3 text-sm font-medium text-ink">{obligation.dueDate ? formatDate(obligation.dueDate) : "Sin fecha"}</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-storm/75">Abonos</p>
                  <p className="mt-3 text-sm font-medium text-ink">{obligation.paymentCount > 0 ? `${obligation.paymentCount} registrados` : "Sin abonos aun"}</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-storm/75">Cuenta sugerida</p>
                  <p className="mt-3 text-sm font-medium text-ink">{obligation.settlementAccountName ?? "Sin cuenta fija"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-sm text-storm">
                  <span>{obligation.installmentLabel}</span>
                  <span>{obligation.progressPercent}% completado</span>
                </div>
                <ProgressBar value={obligation.progressPercent} />
              </div>

              {lastEvent ? (
                <div className="rounded-[20px] border border-white/10 bg-black/15 p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-storm/75">Ultima actividad</p>
                  <p className="mt-2 text-sm font-medium text-ink">
                    {getEventLabel(lastEvent.eventType)} - {formatDate(lastEvent.eventDate)}
                  </p>
                  {lastEvent.reason ? <p className="mt-2 text-sm leading-7 text-storm">{lastEvent.reason}</p> : null}
                </div>
              ) : null}

              {obligation.events.length > 0 ? (
                <div className="rounded-[20px] border border-white/10 bg-black/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[0.68rem] uppercase tracking-[0.18em] text-storm/75">Historial de cambios</p>
                    <button
                      className="rounded text-xs text-pine transition hover:text-pine/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pine/50"
                      onClick={() => onToggleHistory(obligation.id)}
                      type="button"
                    >
                      {expandedHistoryId === obligation.id ? "Ver menos" : `Ver todo (${obligation.events.length})`}
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(expandedHistoryId === obligation.id ? obligation.events : obligation.events.slice(0, 3)).map((eventItem) => (
                      <div className="flex items-start gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3" key={eventItem.id}>
                        <span className="mt-0.5 text-base leading-none" aria-hidden="true">
                          {getEventIcon(eventItem.eventType)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink">
                                {getEventLabel(eventItem.eventType)}
                                {eventItem.installmentNo ? <span className="ml-2 text-xs text-storm/70">#{eventItem.installmentNo}</span> : null}
                              </p>
                              <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-storm/75">{formatDate(eventItem.eventDate)}</p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-ink">{formatCurrency(eventItem.amount, obligation.currencyCode)}</span>
                          </div>
                          {eventItem.reason ? (
                            <p className="mt-1.5 text-xs leading-5 text-storm">{eventItem.reason}</p>
                          ) : eventItem.description ? (
                            <p className="mt-1.5 text-xs leading-5 text-storm">{eventItem.description}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
                <Button disabled={obligation.status === "cancelled" || obligation.pendingAmount <= 0} onClick={() => onPayment(obligation)}>
                  <CircleDollarSign className="mr-2 h-4 w-4" />
                  Registrar abono
                </Button>
                <Button disabled={obligation.status === "cancelled"} onClick={() => onAdjustPrincipal(obligation, "increase")} variant="secondary">
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar monto
                </Button>
                <Button disabled={obligation.status === "cancelled" || obligation.pendingAmount <= 0} onClick={() => onAdjustPrincipal(obligation, "decrease")} variant="secondary">
                  <Minus className="mr-2 h-4 w-4" />
                  Reducir monto
                </Button>
                {canAccessProFeatures ? (
                  <Button onClick={() => onShare(obligation)} variant="secondary">
                    <MailPlus className="mr-2 h-4 w-4" />
                    {currentShare ? (currentShare.status === "pending" ? "Reenviar invitacion" : "Gestionar acceso") : "Compartir"}
                  </Button>
                ) : null}
                <Button onClick={() => onAnalytics(obligation.id)} variant="ghost">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Ver análisis
                </Button>
                <Button onClick={() => onEdit(obligation)} variant="secondary">
                  <PencilLine className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button className="text-[#ffb4bc] hover:text-white" onClick={() => onDelete(obligation.id)} variant="ghost">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
