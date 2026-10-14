import { useEffect, useState } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { SearchablePicker } from "../../../components/ui/searchable-picker";
import { Modal } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { DetailFieldRow } from "../../../components/ui/detail-field-row";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary, CategorySummary, MovementRecord, SubscriptionSummary } from "../../../types/domain";
import { subscriptionStandingCopy } from "../lib/subscription-standing";
import { computeNextRecurringDate } from "../lib/subscriptions-presenters";
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
  onPay: (input: { paidDate: string; amount: number; accountId: number }) => Promise<void>;
  onOpenMovement: (movementId: number) => void;
  onAssignAccount: (accountId: number | null) => void;
  onAssignCategory: (categoryId: number | null) => void;
};

export function SubscriptionDetailDialog({ subscription, initialPanel = "detail", accounts, categories, movements, isPending, onClose, onEdit, onAnalytics, onStatus, onPin, onDelete, onPay, onOpenMovement, onAssignAccount, onAssignCategory }: Props) {
  const [panel, setPanel] = useState<"detail" | "pay" | "account" | "category">(initialPanel);
  const [amount, setAmount] = useState(String(subscription.amount));
  const [paidDate, setPaidDate] = useState(subscription.nextDueDate);
  const [accountId, setAccountId] = useState(subscription.accountId ? String(subscription.accountId) : "");
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setPanel(initialPanel);
    setAmount(String(subscription.amount));
    setPaidDate(subscription.nextDueDate);
    setAccountId(subscription.accountId ? String(subscription.accountId) : "");
    setError("");
    setMenuOpen(false);
  }, [subscription.id, initialPanel]);
  const eligibleAccounts = accounts.filter((account) => !account.isArchived);
  const eligibleCategories = categories.filter((category) => category.isActive && (category.kind === "expense" || category.kind === "both"));
  const selectedAccount = eligibleAccounts.find((account) => String(account.id) === accountId);
  const nextDueDate = computeNextRecurringDate(subscription.nextDueDate, subscription.frequency, subscription.intervalCount, subscription.dayOfMonth);
  const occurrencesQuery = useSubscriptionOccurrences(subscription.id);
  const standing = subscriptionStandingCopy({
    subscription,
    today: new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10),
    formatAmount: (value) => formatCurrency(value, subscription.currencyCode),
    formatDate,
    occurrences: occurrencesQuery.data,
  });

  async function confirmPayment() {
    if (!selectedAccount) { setError("Elige la cuenta con la que pagaste."); return; }
    const parsedAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !paidDate) { setError("Revisa el monto y la fecha del pago."); return; }
    setError("");
    try {
      await onPay({ paidDate, amount: parsedAmount, accountId: selectedAccount.id });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar el pago.");
    }
  }

  return <Modal className="!max-w-[640px]" labelledBy="subscription-detail-title" onClose={onClose} size="lg">
      <ResourceEditorHeader disabled={isPending} accessory={panel === "detail" ? <div className="relative"><button aria-label="Más acciones de suscripción" aria-expanded={menuOpen} className="grid h-9 w-9 place-items-center rounded-lg text-storm hover:bg-white/[0.04]" onClick={() => setMenuOpen((open) => !open)} type="button"><MoreVertical className="h-4 w-4" /></button>{menuOpen ? <><button aria-label="Cerrar acciones" className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} type="button" /><div className="absolute left-0 top-10 z-50 w-52 rounded-xl border border-white/10 bg-[#1b1a18] py-1 text-sm">{[
        { label: "Ver analítica", action: onAnalytics },
        { label: subscription.isPinned ? "Quitar de fijadas" : "Fijar en la lista", action: onPin },
        ...(subscription.status === "active" ? [{ label: "Pausar suscripción", action: () => onStatus("paused") }] : []),
        ...(subscription.status !== "cancelled" ? [{ label: "Cancelar suscripción", action: () => onStatus("cancelled") }] : []),
        { label: "Eliminar suscripción", action: onDelete },
      ].map(({ label, action }) => <button className="flex min-h-11 w-full items-center px-4 text-left text-ink hover:bg-white/[0.04] disabled:opacity-40" disabled={isPending} key={label} onClick={() => { setMenuOpen(false); action(); }} type="button">{label}</button>)}</div></> : null}</div> : undefined} onBack={panel !== "detail" ? () => setPanel("detail") : undefined} onClose={onClose} title={panel === "pay" ? `${subscription.name} · pago` : panel === "account" ? "Se paga con" : panel === "category" ? "Categoría" : subscription.name} titleId="subscription-detail-title" />
      <ModalBody className="space-y-5">
        {panel === "detail" ? <>
          <div className="border-b border-white/[0.08] pb-5 text-center"><p className="text-xs uppercase tracking-[0.12em] text-storm">Suscripción · {standing.label}</p><p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">{formatCurrency(subscription.amount, subscription.currencyCode)}</p><p className="mt-1 text-sm text-storm">{subscriptionRecurrencePhrase(subscription)}</p><p className="mt-2 text-sm leading-6 text-storm">{standing.detail}</p></div>
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
            <DetailFieldRow disabled={isPending} label="Se paga con" onClick={() => setPanel("account")} value={subscription.accountName ?? "Sin cuenta"} />
            <DetailFieldRow disabled={isPending} label="Categoría" onClick={() => setPanel("category")} value={subscription.categoryName ?? "Sin categoría"} />
            <DetailFieldRow label="Anotar gasto solo" value={subscription.autoCreateMovement ? (subscription.accountId ? "Sí" : "Requiere cuenta") : "No"} />
            {subscription.description?.trim() ? <DetailFieldRow label="Descripción" value={subscription.description} /> : null}
            {subscription.notes?.trim() ? <DetailFieldRow label="Notas" value={subscription.notes} /> : null}
            <DetailFieldRow label="Fijada en la lista" value={subscription.isPinned ? "Sí" : "No"} />
          </div>
          <SubscriptionPaymentsHistory key={subscription.id} movements={movements} workspaceId={subscription.workspaceId} subscriptionId={subscription.id} currencyCode={subscription.currencyCode} onOpenMovement={onOpenMovement} />
        </> : panel === "pay" ? <>
          <label className="block text-[13px] font-medium text-storm" htmlFor="subscription-paid-amount">Cuánto pagaste</label>
          <input className="field-dark !h-16 w-full text-2xl font-semibold" id="subscription-paid-amount" min="0.01" onChange={(event) => { setAmount(event.target.value); setError(""); }} step="0.01" type="number" value={amount} />
          <div className="divide-y divide-white/[0.08] rounded-xl border border-white/[0.08] px-4">
            <div className="flex min-h-[54px] items-center justify-between gap-3"><span className="text-sm text-ink">Se pagó con</span><div className="w-1/2"><SearchablePicker appearance="compact" emptyMessage="No hay cuentas activas." onChange={(value) => { setAccountId(value); setError(""); }} options={eligibleAccounts.map((account) => ({ value: String(account.id), label: account.name, description: account.currencyCode, leadingLabel: account.name.slice(0, 2) }))} placeholderDescription="Cuenta del gasto" placeholderLabel="Elegir cuenta" queryPlaceholder="Buscar cuenta..." value={accountId} /></div></div>
            <div className="flex min-h-[54px] items-center justify-between gap-3"><span className="text-sm text-ink">Cuándo</span><div className="w-1/2"><DatePickerField appearance="compact" onChange={setPaidDate} value={paidDate} /></div></div>
          </div>
          <div className="space-y-2 rounded-xl border border-white/[0.08] px-4 py-3 text-sm"><div className="flex justify-between gap-3"><span className="text-storm">Estaba programado</span><span className="text-ink">{formatDate(subscription.nextDueDate)} · {formatCurrency(subscription.amount, subscription.currencyCode)}</span></div><div className="flex justify-between gap-3"><span className="text-storm">Siguiente cobro</span><span className="font-semibold text-ink">{formatDate(nextDueDate)}</span></div></div>
          {!eligibleAccounts.length ? <p className="text-sm text-storm">No tienes cuentas activas. Crea una en Cuentas antes de registrar el pago.</p> : null}
          {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
        </> : panel === "account" ? <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]"><button className="flex min-h-[54px] w-full items-center justify-between gap-4 py-3 text-left text-storm" disabled={isPending} onClick={() => { onAssignAccount(null); setPanel("detail"); }} type="button">Sin cuenta</button>{eligibleAccounts.map((account) => <button className="flex min-h-[54px] w-full items-center justify-between gap-4 py-3 text-left" disabled={isPending} key={account.id} onClick={() => { onAssignAccount(account.id); setPanel("detail"); }} type="button"><span className="text-ink">{account.name}</span><span className="text-sm text-storm">{account.currencyCode}</span></button>)}</div> : <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]"><button className="flex min-h-[54px] w-full items-center justify-between gap-4 py-3 text-left text-storm" disabled={isPending} onClick={() => { onAssignCategory(null); setPanel("detail"); }} type="button">Sin categoría</button>{eligibleCategories.map((category) => <button className="flex min-h-[54px] w-full items-center justify-between gap-4 py-3 text-left text-ink" disabled={isPending} key={category.id} onClick={() => { onAssignCategory(category.id); setPanel("detail"); }} type="button">{category.name}<span className="text-storm">›</span></button>)}</div>}
      </ModalBody>
      {panel === "detail" ? <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-white/[0.08] px-6 py-4"><Button disabled={isPending} onClick={onEdit} variant="secondary">Editar</Button>{subscription.status === "active" ? <Button disabled={isPending} onClick={() => setPanel("pay")}>{subscription.nextDueDate < new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10) ? "Poner al día" : "Registrar pago"}</Button> : <Button disabled={isPending} onClick={() => onStatus("active")}>Reactivar</Button>}</footer> : null}
      {panel === "pay" ? <div className="border-t border-white/[0.08] px-6 py-4"><p className="mb-3 text-xs text-storm">{selectedAccount ? `Se anotará un gasto en ${selectedAccount.name} y avanzará el próximo cobro.` : "Elige la cuenta para registrar el gasto."}</p><Button className="w-full" disabled={isPending || !eligibleAccounts.length} onClick={() => void confirmPayment()}>{isPending ? "Registrando..." : selectedAccount ? "Confirmar pago" : "Elige la cuenta"}</Button></div> : null}
  </Modal>;
}
