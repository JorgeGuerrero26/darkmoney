import { ArrowRight, ScanSearch } from "lucide-react";
import { Link } from "react-router-dom";

import { useDetectedMovements } from "../../../services/queries/detected-movements";

export function DashboardDetectedMovements({ userId, workspaceId }: { userId?: string; workspaceId: number }) {
  const { pending } = useDetectedMovements(userId, workspaceId, Boolean(userId), false);
  if (pending.isPending || (!pending.isError && !pending.data?.length)) return null;

  return (
    <section aria-labelledby="dashboard-detections-title" className="rounded-[9px] border border-white/[0.08] bg-[#1a1917] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-storm"><ScanSearch aria-hidden="true" className="h-5 w-5" /></span>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink" id="dashboard-detections-title">Movimientos detectados</h2>
            <p className="mt-1 text-sm text-storm">
              {pending.isError ? "No pudimos consultar las detecciones pendientes." : `${pending.data?.length} ${pending.data?.length === 1 ? "movimiento pendiente" : "movimientos pendientes"} de revisión. No se registran hasta que los confirmes.`}
            </p>
          </div>
        </div>
        {pending.isError ? <button className="min-h-11 text-left text-sm font-semibold text-ink hover:text-pine" onClick={() => void pending.refetch()} type="button">Reintentar</button> : <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink transition hover:text-pine" to="/app/notifications?detected=pending">Revisar detecciones <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>}
      </div>
    </section>
  );
}
