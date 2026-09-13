import { BarChart3, ChevronRight, Unlink } from "lucide-react";

import { formatCurrency } from "../../../lib/formatting/money";
import type { SharedObligationSummary } from "../../../types/domain";
import { getDirectionLabel, getStatusOption } from "../lib/obligations-presenters";

type SharedObligationsSectionProps = {
  obligations: SharedObligationSummary[];
  viewMode: string;
  onAnalytics: (id: number) => void;
  onOpenDetail: (id: number) => void;
  onRemove: (obligation: SharedObligationSummary) => void;
};

export function SharedObligationsSection({ obligations, onAnalytics, onOpenDetail, onRemove }: SharedObligationsSectionProps) {
  return <section><div className="mb-2 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-ink">Compartidos contigo</h3><p className="mt-1 text-xs text-storm">Solo lectura · puedes solicitar abonos o dejar de verlos.</p></div><span className="font-public-mono text-[10px] uppercase tracking-[0.15em] text-storm">{obligations.length} registros</span></div><div className="border-y border-white/[0.08]">{obligations.map((obligation) => <article className="group flex min-h-[68px] cursor-pointer items-center gap-3 border-b border-white/[0.06] py-3 last:border-b-0 hover:bg-white/[0.025]" key={`${obligation.workspaceId}-${obligation.id}`} onClick={() => onOpenDetail(obligation.id)}><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-semibold text-ink">{obligation.title}</p><span className="font-public-mono text-[9px] uppercase tracking-[0.12em] text-storm/70">{getDirectionLabel(obligation.direction)}</span></div><p className="mt-1 truncate text-sm text-storm">{obligation.share.ownerDisplayName ?? "Usuario DarkMoney"} · {getStatusOption(obligation.status).label}</p></div><div className="text-right"><p className="font-semibold tabular-nums text-ink">{formatCurrency(obligation.pendingAmount, obligation.currencyCode)}</p><p className="text-xs text-storm">pendiente</p></div><button aria-label={`Análisis de ${obligation.title}`} className="flex h-9 w-9 items-center justify-center text-storm hover:text-ink" onClick={(event) => { event.stopPropagation(); onAnalytics(obligation.id); }} type="button"><BarChart3 className="h-4 w-4" /></button><button aria-label={`Quitar ${obligation.title}`} className="flex h-9 w-9 items-center justify-center text-storm hover:text-ink" onClick={(event) => { event.stopPropagation(); onRemove(obligation); }} type="button"><Unlink className="h-4 w-4" /></button><ChevronRight className="h-4 w-4 text-storm/70 transition group-hover:translate-x-0.5" /></article>)}</div></section>;
}
