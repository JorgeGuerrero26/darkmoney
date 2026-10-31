import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import { DashboardDetectionQuickAction } from "./dashboard-detection-quick-action";
import { prepareDetectionQuickSave } from "../../notifications/lib/detection-quick-save";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDateTime } from "../../../lib/formatting/dates";
import { useDetectedMovements } from "../../../services/queries/detected-movements";

export function DashboardDetectedMovements({ userId, workspaceId, snapshot, canEdit = false, proAccessEnabled = false }: { userId?: string; workspaceId: number; snapshot?: WorkspaceSnapshot; canEdit?: boolean; proAccessEnabled?: boolean }) {
  const { pending, settings, store, invalidateFinances } = useDetectedMovements(userId, workspaceId, Boolean(userId), Boolean(userId && canEdit));
  const [saved, setSaved] = useState<number[]>([]);
  useEffect(() => { if (pending.data) setSaved(previous => previous.filter(id => pending.data!.some(row => row.id === id))); }, [pending.data]);
  const rows = pending.data?.filter(row => !saved.includes(row.id)) ?? [];
  if (pending.isPending || (!pending.isError && !rows.length)) return null;
  const first = rows[0];
  const quickReady = Boolean(first && userId && snapshot && canEdit && store && settings?.isSuccess && !settings.isFetching &&
    prepareDetectionQuickSave(first, snapshot.accounts, snapshot.catalogs.categories, settings.data ?? [], userId, workspaceId));
  return <section aria-labelledby="dashboard-detections-title" className="rounded-[14px] border border-white/[0.08] bg-[#1a1917] p-5">
    {pending.isError ? <><h2 className="font-semibold text-ink" id="dashboard-detections-title">Movimientos detectados</h2><p className="mt-2 text-sm text-storm" role="alert">No pudimos consultar las detecciones pendientes.</p><button className="mt-3 min-h-11 text-sm font-semibold text-ink" onClick={() => void pending.refetch()} type="button">Reintentar</button></> : first ? <>
      <div className="flex items-center justify-between gap-4"><h2 className="text-xs uppercase tracking-wider text-storm" id="dashboard-detections-title">Por revisar · {rows.length}</h2><Link className="text-sm font-semibold text-ink" to="/app/notifications?detected=pending">Ver {rows.length === 1 ? "la detección" : `las ${rows.length}`}</Link></div>
      <div className="mt-4 flex items-baseline justify-between gap-4"><p className="min-w-0 truncate font-display text-lg font-semibold text-ink">{first.description || "Movimiento sin descripción"}</p><p className="shrink-0 text-lg font-semibold tabular-nums text-ink">{Number.isFinite(first.amount) && first.amount >= 0 ? `${first.movementType === "expense" ? "−" : first.movementType === "income" ? "+" : ""}${formatCurrency(first.amount, first.currencyCode)}` : "Importe por revisar"}</p></div>
      <p className="mt-1 text-sm text-storm">{first.movementType === "income" ? "Ingreso" : first.movementType === "expense" ? "Gasto" : first.movementType === "transfer" ? "Transferencia" : "Tipo por revisar"} · {Number.isFinite(Date.parse(first.occurredAt)) ? formatDateTime(first.occurredAt) : "Fecha por revisar"} · {first.appLabel}</p>
      {userId && snapshot && canEdit && settings?.isSuccess && !settings.isFetching ? <DashboardDetectionQuickAction key={`${workspaceId}:${first.id}`} suggestion={first} snapshot={snapshot} userId={userId} settings={settings.data ?? []} store={store} enabled={canEdit} proAccessEnabled={proAccessEnabled} onSaved={id => setSaved(previous => [...previous, id])} invalidateFinances={invalidateFinances} /> : null}
      <div className="mt-4 flex justify-end border-t border-white/[0.07] pt-4"><Link className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-void" to={`/app/notifications?detected=${first.id}&detectedOrigin=pending`}>{quickReady ? "Revisar" : "Revisar y guardar"}</Link></div>
    </> : null}
  </section>;
}
