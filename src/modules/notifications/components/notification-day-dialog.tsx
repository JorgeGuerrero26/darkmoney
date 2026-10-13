import { Link } from "react-router-dom";
import { Paperclip } from "lucide-react";
import { Modal, ModalFooter, ModalHeader } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { MovementRecord } from "../../../types/domain";
import { getMovementDisplayInfo, getMovementTypeOption } from "../../movements/lib/movement-form";
import { buildDayMovements, type DayMovementKind } from "../lib/day-movements-model";
import { useDayAttachmentCounts } from "../../../services/queries/day-attachment-counts";

export function NotificationDayDialog({ day, movements, baseCurrency, displayCurrency = baseCurrency, exchangeRateMap, workspaceId, userId, onClose }: {
  day: string; movements: MovementRecord[]; baseCurrency: string; displayCurrency?: string;
  exchangeRateMap: Map<string, number>; workspaceId: number; userId?: string; onClose: () => void;
}) {
  const model = buildDayMovements(movements.filter((row) => row.workspaceId === workspaceId), day, { baseCurrency, displayCurrency, exchangeRateMap });
  const rowCount = model.income.count + model.expense.count + model.transfer.count;
  const attachments = useDayAttachmentCounts(userId, workspaceId, rowCount > 0);
  const sections: { kind: DayMovementKind; label: string }[] = [
    { kind: "income", label: "Ingresos" }, { kind: "expense", label: "Gastos" }, { kind: "transfer", label: "Transferencias" },
  ];
  return <Modal labelledBy="notification-day-title" onClose={onClose} size="md">
    <ModalHeader title={`Movimientos del ${formatDate(day)}`} titleId="notification-day-title" description="Ingresos, gastos y transferencias del día del resumen." onClose={onClose} />
    <ModalBody>
      <dl className="space-y-2 border-b border-white/[0.07] pb-4 text-sm" aria-label={`Resumen en ${displayCurrency}`}>
        <div className="flex justify-between gap-3"><dt className="text-storm">Ingresos</dt><dd className="tabular-nums text-ink">{formatCurrency(model.income.amount, displayCurrency)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-storm">Gastos</dt><dd className="tabular-nums text-ink">{formatCurrency(model.expense.amount, displayCurrency)}</dd></div>
        <div className="flex justify-between gap-3 pt-1 font-semibold text-ink"><dt>Ahorro del día{model.excludedCount ? " (parcial)" : ""}</dt><dd className="tabular-nums">{formatCurrency(model.savings, displayCurrency)}</dd></div>
      </dl>
      <p className="mt-2 text-xs leading-5 text-storm">Ingresos − gastos. Los traspasos entre tus cuentas no cambian el ahorro.</p>
      <p className="mt-1 text-xs leading-5 text-storm">Resumen en {displayCurrency}. Cada movimiento conserva su moneda.</p>
      {model.excludedCount > 0 ? <p className="mt-2 text-xs leading-5 text-storm" role="status">{model.excludedCount} sin conversión o moneda conocida no suman. Totales parciales.</p> : null}
      <div className="mt-5 space-y-5">{sections.map(({ kind, label }) => <section key={kind} aria-label={label}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.07] pb-2 text-sm">
          <h3 className="font-semibold text-ink">{label} <span className="font-normal text-storm">({model[kind].count})</span></h3>
          {model[kind].count > 0 ? <p className="text-xs tabular-nums text-storm">{model[kind].excludedCount ? "Subtotal parcial · " : ""}{formatCurrency(model[kind].amount, displayCurrency)}</p> : null}
        </div>
        {model.groups[kind].length ? <div className="divide-y divide-white/[0.07]">{model.groups[kind].map((entry) => {
          const row = entry.movement;
          const account = getMovementDisplayInfo(row, baseCurrency).accountLabel.replace(" -> ", " → ");
          const time = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(row.occurredAt));
          const attachmentCount = attachments.isError ? 0 : attachments.data?.[row.id] ?? 0;
          return <Link className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm transition-colors duration-150 hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-1 focus-visible:outline-ink motion-reduce:transition-none" key={row.id} to={`/app/movements?period=all&movement=${row.id}`}>
            <div className="min-w-0"><p className="font-medium text-ink">{row.description.trim() || `Movimiento #${row.id}`}</p><p className="mt-1 text-xs leading-5 text-storm">{[getMovementTypeOption(row.movementType).label, row.category?.replace("Sin categoria", "Sin categoría"), account !== "-" ? account : null, time].filter(Boolean).join(" · ")}</p>
              {attachmentCount > 0 ? <span className="inline-flex items-center gap-1 text-xs text-storm" aria-label={`${attachmentCount} comprobantes`}><Paperclip aria-hidden="true" className="h-3 w-3" />{attachmentCount}</span> : null}
            </div>
            <span className="shrink-0 tabular-nums text-ink">{entry.amount === null || !entry.currencyCode ? "—" : formatCurrency(entry.amount, entry.currencyCode)}</span>
          </Link>;
        })}</div> : <p className="py-3 text-sm text-storm">Nada que mostrar este día.</p>}
      </section>)}</div>
      {attachments.isError ? <p className="mt-3 text-xs text-storm">Comprobantes no disponibles. Los movimientos sí están completos.</p> : null}
    </ModalBody>
    <ModalFooter><Link className="min-h-11 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-canvas" to={`/app/movements?from=${day}&to=${day}&status=posted`}>Ver el día en Movimientos</Link></ModalFooter>
  </Modal>;
}
