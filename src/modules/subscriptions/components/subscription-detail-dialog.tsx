import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { SearchablePicker } from "../../../components/ui/searchable-picker";
import { Modal } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary, CategorySummary, MovementRecord, SubscriptionSummary } from "../../../types/domain";
import { computeNextRecurringDate, getFrequencyOption } from "../lib/subscriptions-presenters";
import { type SubscriptionOccurrence, useSubscriptionOccurrences } from "../lib/subscription-actions";

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

function standingCopy(subscription: SubscriptionSummary, occurrences?: SubscriptionOccurrence[]) {
  if (subscription.status === "cancelled") return { label: "Cancelada", detail: "Ya no genera cobros. Su historial se conserva." };
  if (subscription.status === "paused") return { label: "Pausada", detail: "No se cobrará hasta que la reactives." };
  const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  if (subscription.nextDueDate === today) return { label: "Se cobra hoy", detail: `Toca hoy, ${formatCurrency(subscription.amount, subscription.currencyCode)}.` };
  if (subscription.nextDueDate > today) return { label: "Al día", detail: `Próximo cobro el ${formatDate(subscription.nextDueDate)}.` };
  const unresolved = occurrences?.filter((occurrence) => occurrence.status === "scheduled" && occurrence.dueDate < today);
  if (unresolved && unresolved.length === 0) return { label: "Al día", detail: `Próximo cobro el ${formatDate(subscription.nextDueDate)}.` };
  if (unresolved?.length) {
    const missedAmount = unresolved.reduce((total, occurrence) => total + occurrence.expectedAmount, 0);
    return { label: "Atrasada", detail: `${unresolved.length === 1 ? "Va 1 cobro" : `Van ${unresolved.length} cobros`} sin anotar, ${formatCurrency(missedAmount, subscription.currencyCode)}.` };
  }
  let cursor = subscription.nextDueDate;
  let missed = 0;
  while (cursor < today && missed < 400) {
    missed += 1;
    const next = computeNextRecurringDate(cursor, subscription.frequency, subscription.intervalCount, subscription.dayOfMonth);
    if (next === cursor) break;
    cursor = next;
  }
  return {
    label: "Atrasada",
    detail: `${missed === 1 ? "Va 1 cobro" : `Van ${missed} cobros`} sin anotar, ${formatCurrency(missed * subscription.amount, subscription.currencyCode)}.`,
  };
}

export function SubscriptionDetailDialog({ subscription, initialPanel = "detail", accounts, categories, movements, isPending, onClose, onEdit, onAnalytics, onStatus, onPin, onDelete, onPay, onOpenMovement, onAssignAccount, onAssignCategory }: Props) {
  const [panel, setPanel] = useState<"detail" | "pay" | "account" | "category">(initialPanel);
  const [amount, setAmount] = useState(String(subscription.amount));
  const [paidDate, setPaidDate] = useState(subscription.nextDueDate);
  const [accountId, setAccountId] = useState(subscription.accountId ? String(subscription.accountId) : "");
  const [error, setError] = useState("");
  const [showAllPayments, setShowAllPayments] = useState(false);
  useEffect(() => {
    setPanel(initialPanel);
    setAmount(String(subscription.amount));
    setPaidDate(subscription.nextDueDate);
    setAccountId(subscription.accountId ? String(subscription.accountId) : "");
    setError("");
    setShowAllPayments(false);
  }, [subscription.id, initialPanel]);
  const eligibleAccounts = accounts.filter((account) => !account.isArchived);
  const eligibleCategories = categories.filter((category) => category.isActive && (category.kind === "expense" || category.kind === "both"));
  const selectedAccount = eligibleAccounts.find((account) => String(account.id) === accountId);
  const payments = movements.filter((movement) => movement.subscriptionId === subscription.id && movement.status === "posted")
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const nextDueDate = computeNextRecurringDate(subscription.nextDueDate, subscription.frequency, subscription.intervalCount, subscription.dayOfMonth);
  const occurrencesQuery = useSubscriptionOccurrences(subscription.id);
  const standing = standingCopy(subscription, occurrencesQuery.data);

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
      <ResourceEditorHeader onBack={panel !== "detail" ? () => setPanel("detail") : undefined} onClose={onClose} title={panel === "pay" ? `${subscription.name} · pago` : panel === "account" ? "Se paga con" : panel === "category" ? "Categoría" : subscription.name} titleId="subscription-detail-title" />
      <ModalBody className="space-y-5">
        {panel === "detail" ? <>
          <div><p className="text-xs uppercase tracking-[0.14em] text-storm">{standing.label}</p><p className="mt-1 font-display text-3xl font-semibold text-ink">{formatCurrency(subscription.amount, subscription.currencyCode)}</p><p className="mt-1 text-sm text-storm">{getFrequencyOption(subscription.frequency).label} · {standing.detail}</p></div>
          {subscription.status === "active" ? <Button className="w-full" onClick={() => setPanel("pay")}>{subscription.nextDueDate < new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10) ? "Ponerla al día" : "Marcar como pagada"}</Button> : <Button className="w-full" disabled={isPending} onClick={() => onStatus("active")}>Reactivar</Button>}
          <div className="divide-y divide-white/[0.08] border-y border-white/[0.08] text-sm">
            <button className="flex min-h-[54px] w-full items-center justify-between gap-4 py-3 text-left transition-colors duration-150 hover:bg-white/[0.03]" onClick={() => setPanel("account")} type="button"><span className="text-storm">Se paga con</span><span className="flex min-w-0 items-center gap-2 text-ink"><span className="truncate">{subscription.accountName ?? "Sin cuenta"}</span><ChevronRight className="h-4 w-4 shrink-0 text-storm" /></span></button>
            <button className="flex min-h-[54px] w-full items-center justify-between gap-4 py-3 text-left transition-colors duration-150 hover:bg-white/[0.03]" onClick={() => setPanel("category")} type="button"><span className="text-storm">Categoría</span><span className="flex min-w-0 items-center gap-2 text-ink"><span className="truncate">{subscription.categoryName ?? "Sin categoría"}</span><ChevronRight className="h-4 w-4 shrink-0 text-storm" /></span></button>
            <div className="flex justify-between gap-4 py-3"><span className="text-storm">Proveedor</span><span className="text-ink">{subscription.vendor}</span></div>
            <div className="flex justify-between gap-4 py-3"><span className="text-storm">Recordatorio</span><span className="text-ink">{subscription.remindDaysBefore} días antes</span></div>
          </div>
          <section><h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-storm">Pagos anotados · {payments.length}</h3>{payments.length ? <div className="divide-y divide-white/[0.08]">{(showAllPayments ? payments : payments.slice(0, 12)).map((payment) => <button aria-label={`Abrir movimiento del ${formatDate(payment.occurredAt)}`} className="flex w-full justify-between gap-4 py-3 text-left text-sm hover:bg-white/[0.03]" key={payment.id} onClick={() => onOpenMovement(payment.id)} type="button"><span className="text-storm">{formatDate(payment.occurredAt)} ›</span><span className="font-semibold text-ink">{formatCurrency(payment.sourceAmount ?? payment.destinationAmount ?? 0, payment.sourceCurrencyCode ?? subscription.currencyCode)}</span></button>)}</div> : <p className="text-sm text-storm">Ninguno todavía. Cada vez que la marques como pagada, el gasto aparece aquí.</p>}{payments.length > 12 ? <button className="mt-3 text-sm text-ink underline-offset-4 hover:underline" onClick={() => setShowAllPayments((value) => !value)} type="button">{showAllPayments ? "Mostrar menos" : `Ver los ${payments.length - 12} restantes`}</button> : null}</section>
          {subscription.description || subscription.notes ? <section className="space-y-2 border-t border-white/[0.08] pt-4 text-sm text-storm">{subscription.description ? <p>{subscription.description}</p> : null}{subscription.notes ? <p>{subscription.notes}</p> : null}</section> : null}
          <div className="flex flex-wrap gap-x-5 gap-y-3 border-t border-white/[0.08] pt-4 text-sm">
            <button className="text-ink hover:underline" onClick={onEdit} type="button">Editar</button><button className="text-ink hover:underline" onClick={onAnalytics} type="button">Analizar</button><button className="text-ink hover:underline" disabled={isPending} onClick={onPin} type="button">{subscription.isPinned ? "Quitar de fijadas" : "Fijar en la lista"}</button>
            {subscription.status === "active" ? <button className="text-ink hover:underline" disabled={isPending} onClick={() => onStatus("paused")} type="button">Pausar</button> : null}
            {subscription.status !== "cancelled" ? <button className="text-ink hover:underline" disabled={isPending} onClick={() => onStatus("cancelled")} type="button">Cancelar</button> : null}
            <button className="text-storm hover:text-ink hover:underline" onClick={onDelete} type="button">Eliminar</button>
          </div>
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
      {panel === "pay" ? <div className="border-t border-white/[0.08] px-6 py-4"><p className="mb-3 text-xs text-storm">{selectedAccount ? `Se anotará un gasto en ${selectedAccount.name} y avanzará el próximo cobro.` : "Elige la cuenta para registrar el gasto."}</p><Button className="w-full" disabled={isPending || !eligibleAccounts.length} onClick={() => void confirmPayment()}>{isPending ? "Registrando..." : selectedAccount ? "Confirmar pago" : "Elige la cuenta"}</Button></div> : null}
  </Modal>;
}
