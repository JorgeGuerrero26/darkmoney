import { Link } from "react-router-dom";
import { Modal, ModalFooter, ModalHeader } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { MovementRecord } from "../../../types/domain";
import { getMovementDisplayInfo, movementActsAsIncome } from "../../movements/lib/movement-form";
import { selectNotificationDayMovements } from "../lib/notification-day";

export function NotificationDayDialog({ day, movements, baseCurrency, onClose }: {
  day: string; movements: MovementRecord[]; baseCurrency: string; onClose: () => void;
}) {
  const rows = selectNotificationDayMovements(movements, day);
  return <Modal labelledBy="notification-day-title" onClose={onClose} size="md">
    <ModalHeader title={`Movimientos del ${formatDate(day)}`} titleId="notification-day-title" description="Día del resumen · movimientos aplicados, no la fecha en que abriste el aviso." onClose={onClose} />
    <ModalBody>
      {rows.length ? <div className="divide-y divide-white/10">{rows.map((row) => {
        const display = getMovementDisplayInfo(row, baseCurrency);
        return <Link className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm hover:bg-white/[0.03]" key={row.id} to={`/app/movements?period=all&movement=${row.id}`}>
          <div className="min-w-0"><p className="font-medium text-ink">{row.description}</p><p className="text-xs text-storm">{row.movementType === "transfer" ? "Transferencia" : movementActsAsIncome(row) ? "Ingreso" : "Gasto"} · {display.accountLabel}</p></div>
          <span className="shrink-0 tabular-nums text-ink">{display.amount === null ? "—" : formatCurrency(display.amount, display.currencyCode)}</span>
        </Link>;
      })}</div> : <p className="py-5 text-sm text-storm">No hay movimientos aplicados ese día.</p>}
    </ModalBody>
    <ModalFooter><Link className="min-h-11 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-canvas" to={`/app/movements?from=${day}&to=${day}&status=posted`}>Ver el día en Movimientos</Link></ModalFooter>
  </Modal>;
}
