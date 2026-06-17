import { BarChart3, Eye, Lock } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { ProgressBar } from "../../../components/ui/progress-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { SharedObligationSummary } from "../../../types/domain";
import {
  getDirectionTone,
  getDirectionVisual,
  getEventIcon,
  getEventLabel,
  getOriginOption,
  getSharedDirectionDescription,
  getSharedDirectionLabel,
  getStatusOption,
  getStatusTone,
} from "../lib/obligations-presenters";

type SharedObligationsSectionProps = {
  obligations: SharedObligationSummary[];
  viewMode: string;
  onAnalytics: (id: number) => void;
};

export function SharedObligationsSection({ obligations, viewMode, onAnalytics }: SharedObligationsSectionProps) {
  return (
    <SurfaceCard
      action={<StatusBadge status={`${obligations.length} visibles`} tone="neutral" />}
      description="Estos registros fueron compartidos contigo por otros usuarios. Los veras siempre en modo solo lectura, pero con historial, avance y cambios de monto."
      title="Compartidos contigo"
    >
      {viewMode === "list" ? (
        <div className="space-y-3">
          {obligations.map((obligation) => {
            const directionVisual = getDirectionVisual(obligation.direction);
            const DirectionIcon = directionVisual.icon;
            const statusOption = getStatusOption(obligation.status);
            return (
              <article className="flex items-center gap-4 rounded-[22px] border border-[#7aa2ff]/18 bg-white/[0.03] px-5 py-4 transition hover:border-[#7aa2ff]/26" key={`shared-list-${obligation.id}`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 text-white" style={{ background: `linear-gradient(160deg, ${directionVisual.color}, rgba(8,13,20,0.72))` }}>
                  <DirectionIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{obligation.title}</p>
                  <p className="text-xs text-storm">
                    {obligation.share.ownerDisplayName ?? "Usuario DarkMoney"} · {getSharedDirectionLabel(obligation.direction)}
                  </p>
                </div>
                <div className="hidden shrink-0 flex-col text-right sm:flex">
                  <p className="text-sm font-semibold text-ink">{formatCurrency(obligation.pendingAmount, obligation.currencyCode)}</p>
                  <p className="text-xs text-storm">pendiente</p>
                </div>
                <StatusBadge status={statusOption.label} tone={getStatusTone(obligation.status)} />
              </article>
            );
          })}
        </div>
      ) : viewMode === "table" ? (
        <div className="overflow-x-auto rounded-[24px] border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Registro</th>
                <th className="hidden px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 sm:table-cell">Propietario</th>
                <th className="hidden px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 md:table-cell">Direccion</th>
                <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Pendiente</th>
                <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Estado</th>
              </tr>
            </thead>
            <tbody>
              {obligations.map((obligation, index) => {
                const directionVisual = getDirectionVisual(obligation.direction);
                const DirectionIcon = directionVisual.icon;
                const statusOption = getStatusOption(obligation.status);
                return (
                  <tr className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === obligations.length - 1 ? "border-b-0" : ""}`} key={`shared-table-${obligation.id}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 text-white" style={{ background: `linear-gradient(160deg, ${directionVisual.color}, rgba(8,13,20,0.72))` }}>
                          <DirectionIcon className="h-3.5 w-3.5" />
                        </div>
                        <p className="font-medium text-ink">{obligation.title}</p>
                      </div>
                    </td>
                    <td className="hidden px-5 py-3.5 text-storm sm:table-cell">{obligation.share.ownerDisplayName ?? "Usuario DarkMoney"}</td>
                    <td className="hidden px-5 py-3.5 md:table-cell">
                      <StatusBadge status={getSharedDirectionLabel(obligation.direction)} tone={getDirectionTone(obligation.direction)} />
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-ink">{formatCurrency(obligation.pendingAmount, obligation.currencyCode)}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={statusOption.label} tone={getStatusTone(obligation.status)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {obligations.map((obligation) => {
            const directionVisual = getDirectionVisual(obligation.direction);
            const DirectionIcon = directionVisual.icon;
            const statusOption = getStatusOption(obligation.status);
            const lastEvent = obligation.events[0] ?? null;

            return (
              <article className="glass-panel-soft rounded-[24px] border border-[#7aa2ff]/18 p-6 transition duration-200 hover:border-[#7aa2ff]/26" key={`shared-${obligation.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl font-semibold text-ink">{obligation.title}</h3>
                    <p className="mt-1 text-sm text-storm">{obligation.share.ownerDisplayName ?? "Usuario DarkMoney"}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <StatusBadge status="Compartida contigo" tone="info" />
                    <StatusBadge status={getSharedDirectionLabel(obligation.direction)} tone={getDirectionTone(obligation.direction)} />
                    <StatusBadge status={statusOption.label} tone={getStatusTone(obligation.status)} />
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-white/10 text-white" style={{ background: `linear-gradient(160deg, ${directionVisual.color}, rgba(8,13,20,0.72))` }}>
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
                        <span className="rounded-full border border-[#7aa2ff]/18 bg-[#7aa2ff]/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#c8d8ff]">
                          Solo lectura
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-storm">Compartida por {obligation.share.ownerDisplayName ?? "otro usuario"}.</p>
                      <p className="mt-2 text-sm leading-7 text-storm/85">{getSharedDirectionDescription(obligation.direction)}</p>
                      {obligation.description ? <p className="mt-3 text-sm leading-7 text-storm">{obligation.description}</p> : null}
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
                        <span className="text-xs text-storm/60">
                          {obligation.events.length} evento{obligation.events.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {obligation.events.slice(0, 2).map((eventItem) => (
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
                    <Button onClick={() => onAnalytics(obligation.id)} variant="secondary">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Ver análisis
                    </Button>
                    <Button disabled variant="secondary">
                      <Eye className="mr-2 h-4 w-4" />
                      Solo seguimiento
                    </Button>
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-storm">
                      <Lock className="mr-2 h-4 w-4" />
                      Solo lectura para ti
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </SurfaceCard>
  );
}
