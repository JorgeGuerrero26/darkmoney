import { useState } from "react";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { MovementRecord } from "../../../types/domain";
import { buildSubscriptionPaymentReceipts } from "../lib/payment-receipts";

type Props = { movements: MovementRecord[]; workspaceId: number; subscriptionId: number;
  currencyCode: string; onOpenMovement: (id: number) => void };

export function SubscriptionPaymentsHistory({ movements, workspaceId, subscriptionId, currencyCode, onOpenMovement }: Props) {
  const [expanded, setExpanded] = useState(false);
  const history = buildSubscriptionPaymentReceipts(movements, workspaceId);
  const payments = history.payments.filter(payment=>payment.subscriptionId===subscriptionId);
  const unconfirmed = history.issues.some(issue=>issue.subscriptionIds.includes(subscriptionId));
  return <section>
    <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-storm">Pagos anotados{unconfirmed ? " · sin confirmar" : ` · ${payments.length}`}</h3>
    {unconfirmed ? <p className="mb-3 text-sm text-storm" role="alert">Hay una división incompleta o incompatible. Actualiza para confirmar el historial; no se usa su importe como total.</p> : null}
    {payments.length ? <div className="divide-y divide-white/[0.08]">{(expanded ? payments : payments.slice(0,12)).map(payment=><button
      aria-label={`Abrir movimiento del ${formatDate(payment.occurredAt)}`} className="flex w-full justify-between gap-4 py-3 text-left text-sm hover:bg-white/[0.03]"
      key={payment.id} onClick={()=>onOpenMovement(payment.id)} type="button">
      <span className="text-storm">{formatDate(payment.occurredAt)}{payment.receiptPartIds.length>1 ? ` · ${payment.receiptPartIds.length} partes` : ""} ›</span>
      <span className="font-semibold text-ink">{formatCurrency(payment.sourceAmount ?? payment.destinationAmount ?? 0,payment.sourceCurrencyCode ?? currencyCode)}</span>
    </button>)}</div> : !unconfirmed ? <p className="text-sm text-storm">Ninguno todavía. Cada vez que la marques como pagada, el gasto aparece aquí.</p> : null}
    {payments.length>12 ? <button className="mt-3 text-sm text-ink underline-offset-4 hover:underline" onClick={()=>setExpanded(value=>!value)} type="button">
      {expanded ? "Mostrar menos" : `Ver los ${payments.length-12} restantes`}</button> : null}
  </section>;
}
