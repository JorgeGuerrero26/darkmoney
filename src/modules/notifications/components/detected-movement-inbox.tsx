import { Button } from "../../../components/ui/button";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDateTime } from "../../../lib/formatting/dates";
import { useDetectedMovements } from "../../../services/queries/detected-movements";
import { getQueryErrorMessage } from "../../../services/queries/workspace-data";

export function DetectedMovementInbox({ userId, workspaceId, onOpen }: { userId: string; workspaceId: number; onOpen: (id: number) => void }) {
  const { pending } = useDetectedMovements(userId, workspaceId, true, false);
  return <section aria-label="Detecciones pendientes del espacio" className="pt-6">
    <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl font-semibold text-ink">Por confirmar</h2><button className="text-sm text-storm hover:text-ink disabled:opacity-40" disabled={pending.isFetching} onClick={() => void pending.refetch()} type="button">Actualizar</button></div>
    <p className="mt-2 text-sm text-storm">El estado de las detecciones es independiente de si leíste el aviso. Ninguna se registra al abrir esta lista.</p>
    {pending.isPending ? <p className="py-8 text-sm text-storm">Consultando detecciones...</p> : pending.isError ? <div className="space-y-3 py-8"><p role="alert" className="text-sm text-storm">{getQueryErrorMessage(pending.error, "No se pudo cargar la lista.")}</p><Button onClick={() => void pending.refetch()} variant="secondary">Reintentar</Button></div> : pending.data?.length ? <ul className="mt-5 divide-y divide-white/10 border-y border-white/10">{pending.data.map((row) => <li key={row.id}><button className="flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left hover:bg-white/[0.03]" onClick={() => onOpen(row.id)} type="button"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{row.description}</span><span className="mt-1 block text-xs text-storm">{row.appLabel} · {formatDateTime(row.occurredAt)}{row.status === "needs_review" ? " · Necesita revisión" : ""}</span></span><span className="shrink-0 text-sm tabular-nums text-ink">{formatCurrency(row.amount, row.currencyCode)} ›</span></button></li>)}</ul> : <p className="py-8 text-sm text-storm">No hay detecciones pendientes en este espacio.</p>}
  </section>;
}
