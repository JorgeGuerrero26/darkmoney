import { useEffect, useState } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { SubscriptionPaymentDialog } from "./subscription-payment-dialog";
import { Modal } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { DetailFieldRow } from "../../../components/ui/detail-field-row";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary, CategorySummary, MovementRecord, SubscriptionSummary } from "../../../types/domain";
import { subscriptionStandingCopy } from "../lib/subscription-standing";

import { useSubscriptionOccurrences } from "../lib/subscription-actions";
import { subscriptionRecurrencePhrase } from "../lib/subscription-detail-presentation";
import { SubscriptionPaymentsHistory } from "./subscription-payments-history";

type Props = {
  subscription: SubscriptionSummary;
  initialPanel?: "detail" | "pay";
  accounts: AccountSummary[];
  categories: CategorySummary[];
  movements: MovementRecord[];
  isPending: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAnalytics: () => void;
  onStatus: (status: SubscriptionSummary["status"]) => void;
  onPin: () => void;
  onDelete: () => void;
  onPay: (input: { paidDate: string; amount: number; accountId: number; dueDate?: string }) => Promise<void>;
  onOpenMovement: (movementId: number) => void;
  onAssignAccount: (accountId: number | null) => void;
  onAssignCategory: (categoryId: number | null) => void;
  canWrite?: boolean;
  userId?: string;
  errorMessage?: string;
};

export function SubscriptionDetailDialog({ subscription, initialPanel = "detail", accounts, categories, movements, isPending, onClose, onEdit, onAnalytics, onStatus, onPin, onDelete, onPay, onOpenMovement, onAssignAccount, onAssignCategory, canWrite = false, userId, errorMessage }: Props) {
  const [panel, setPanel] = useState<"detail" | "pay" | "account" | "category">(canWrite ? initialPanel : "detail");
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setPanel(canWrite ? initialPanel : "detail");
    setMenuOpen(false);
  }, [subscription.id, initialPanel, canWrite]);
  const eligibleAccounts = accounts.filter((account) => account.workspaceId === subscription.workspaceId && !account.isArchived && account.currencyCode === subscription.currencyCode);
  const eligibleCategories = categories.filter((category) => category.isActive && (category.kind === "expense" || category.kind === "both"));
  const occurrencesQuery = useSubscriptionOccurrences(subscription.id, subscription.workspaceId, userId);
  const calendarReady = Boolean(occurrencesQuery.isSuccess && !occurrencesQuery.error && !occurrencesQuery.isFetching && !occurrencesQuery.isPlaceholderData);
  const standingUnverified = subscription.status === "active" && !calendarReady;
  const standing = subscriptionStandingCopy({
    subscription,
    today: new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10),
    formatAmount: (value) => formatCurrency(value, subscription.currencyCode),
    formatDate,
    occurrences: calendarReady ? occurrencesQuery.data : undefined,
  });

  if (panel === "pay" && canWrite) return <SubscriptionPaymentDialog subscription={subscription} accounts={accounts} isPending={isPending} occurrences={calendarReady ? occurrencesQuery.data : undefined} onClose={onClose} onBack={() => setPanel("detail")} onPay={onPay} />;

  return <Modal className="!max-w-[640px]" labelledBy="subscription-detail-title" onClose={onClose} size="lg">
      <ResourceEditorHeader disabled={isPending} accessory={panel === "detail" ? <div className="relative"><button aria-label="Más acciones de suscripción" aria-expanded={menuOpen} className="grid h-9 w-9 place-items-center rounded-lg text-storm hover:bg-white/[0.04]" onClick={() => setMenuOpen((open) => !open)} type="button"><MoreVertical className="h-4 w-4" /></button>{menuOpen ? <><button aria-label="Cerrar acciones" className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} type="button" /><div className="absolute left-0 top-10 z-50 w-52 rounded-xl border border-white/10 bg-[#1b1a18] py-1 text-sm">{[
        { label: "Ver analítica", action: onAnalytics },
        ...(canWrite ? [
        { label: subscription.isPinned ? "Quitar de fijadas" : "Fijar en la lista", action: onPin },
        ...(subscription.status === "active" ? [{ label: "Pausar suscripción", action: () => onStatus("paused") }] : []),
        ...(subscription.status !== "cancelled" ? [{ label: "Cancelar suscripción", action: () => onStatus("cancelled") }] : []),
        { label: "Eliminar suscripción", action: onDelete },
        ] : []),
      ].map(({ label, action }) => <button className="flex min-h-11 w-full items-center px-4 text-left text-ink hover:bg-white/[0.04] disabled:opacity-40" disabled={isPending} key={label} onClick={() => { setMenuOpen(false); action(); }} type="button">{label}</button>)}</div></> : null}</div> : undefined} onBack={panel !== "detail" ? () => setPanel("detail") : undefined} onClose={onClose} title={panel === "account" ? "Se paga con" : panel === "category" ? "Categoría" : subscription.name} titleId="subscription-detail-title" />
      <ModalBody className="space-y-5">
        {errorMessage ? <p className="text-sm text-red-300" role="alert">{errorMessage}</p> : null}
        {occurrencesQuery.error ? <p className="text-sm text-storm" role="status">No se pudo comprobar el calendario de cobros. Actualiza antes de interpretar el estado.</p> : null}
        {panel === "detail" ? <>
          <div className="border-b border-white/[0.08] pb-5 text-center"><p className="text-xs uppercase tracking-[0.12em] text-storm">Suscripción · {standingUnverified ? "Por comprobar" : standing.label}</p><p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">{formatCurrency(subscription.amount, subscription.currencyCode)}</p><p className="mt-1 text-sm text-storm">{subscriptionRecurrencePhrase(subscription)}</p><p className="mt-2 text-sm leading-6 text-storm">{standingUnverified ? "El estado de los cobros requiere una lectura actual del calendario." : standing.detail}</p></div>
          <div>
            <DetailFieldRow label="Nombre" value={subscription.name} />
            {subscription.vendor?.trim() ? <DetailFieldRow label="Proveedor" value={subscription.vendor} /> : null}
            <DetailFieldRow label="Estado" value={{ active: "Activa", paused: "Pausada", cancelled: "Cancelada" }[subscription.status]} />
            <DetailFieldRow label="Moneda" value={subscription.currencyCode} />
            <DetailFieldRow label="Se repite" value={subscriptionRecurrencePhrase(subscription)} />
            <DetailFieldRow label="Fecha de inicio" value={formatDate(subscription.startDate)} />
            <DetailFieldRow label="Próximo cobro" value={formatDate(subscription.nextDueDate)} />
            {subscription.endDate ? <DetailFieldRow label="Fecha de fin" value={formatDate(subscription.endDate)} /> : null}
            <DetailFieldRow label="Avisarme antes" value={subscription.remindDaysBefore > 0 ? `${subscription.remindDaysBefore} ${subscription.remindDaysBefore === 1 ? "día" : "días"}` : "Sin aviso"} />
            <DetailFieldRow disabled={isPending || !canWrite} label="Se paga con" onClick={canWrite ? () => setPanel("account") : undefined} value={subscription.accountName ?? "Sin cuenta"} />
            <DetailFieldRow disabled={isPending || !canWrite} label="Categoría" onClick={canWrite ? () => setPanel("category") : undefined} value={subscription.categoryName ?? "Sin categoría"} />
            <DetailFieldRow label="Anotar gasto solo" value={subscription.autoCreateMovement ? (subscription.accountId ? "Sí" : "Requiere cuenta") : "No"} />
            {subscription.description?.trim() ? <DetailFieldRow label="Descripción" value={subscription.description} /> : null}
            {subscription.notes?.trim() ? <DetailFieldRow label="Notas" value={subscription.notes} /> : null}
            <DetailFieldRow label="Fijada en la lista" value={subscription.isPinned ? "Sí" : "No"} />
          </div>
          <SubscriptionPaymentsHistory key={subscription.id} movements={movements} workspaceId={subscription.workspaceId} subscriptionId={subscription.id} currencyCode={subscription.currencyCode} onOpenMovement={onOpenMovement} />
        </> : panel === "account" ? <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]"><button className="flex min-h-[54px] w-full items-center justify-between gap-4 py-3 text-left text-storm" disabled={isPending} onClick={() => { onAssignAccount(null); setPanel("detail"); }} type="button">Sin cuenta</button>{eligibleAccounts.map((account) => <button className="flex min-h-[54px] w-full items-center justify-between gap-4 py-3 text-left" disabled={isPending} key={account.id} onClick={() => { onAssignAccount(account.id); setPanel("detail"); }} type="button"><span className="text-ink">{account.name}</span><span className="text-sm text-storm">{account.currencyCode}</span></button>)}</div> : <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]"><button className="flex min-h-[54px] w-full items-center justify-between gap-4 py-3 text-left text-storm" disabled={isPending} onClick={() => { onAssignCategory(null); setPanel("detail"); }} type="button">Sin categoría</button>{eligibleCategories.map((category) => <button className="flex min-h-[54px] w-full items-center justify-between gap-4 py-3 text-left text-ink" disabled={isPending} key={category.id} onClick={() => { onAssignCategory(category.id); setPanel("detail"); }} type="button">{category.name}<span className="text-storm">›</span></button>)}</div>}
      </ModalBody>
      {panel === "detail" ? <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-white/[0.08] px-6 py-4">{canWrite ? <><Button disabled={isPending} onClick={onEdit} variant="secondary">Editar</Button>{subscription.status === "active" ? <Button disabled={isPending} onClick={() => setPanel("pay")}>{subscription.nextDueDate < new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10) ? "Poner al día" : "Registrar pago"}</Button> : <Button disabled={isPending} onClick={() => onStatus("active")}>Reactivar</Button>}</> : <Button onClick={onClose} variant="secondary">Cerrar</Button>}</footer> : null}
  </Modal>;
}
