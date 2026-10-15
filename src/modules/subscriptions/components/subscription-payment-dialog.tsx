import { useRef, useState, type ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { SearchablePicker } from "../../../components/ui/searchable-picker";
import { Modal } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary, SubscriptionSummary } from "../../../types/domain";
import { computeNextRecurringDate } from "../lib/subscriptions-presenters";
import { validateSubscriptionPayment, type SubscriptionPaymentInput } from "../lib/subscription-payment-input";

export function SubscriptionPaymentDialog({ subscription, accounts, isPending, onClose, onBack, onPay, initialInput, onInputChange, context }: {
  subscription: SubscriptionSummary; accounts: AccountSummary[]; isPending: boolean;
  onClose: () => void; onBack?: () => void; onPay: (input: SubscriptionPaymentInput) => Promise<void>;
  initialInput?: Partial<SubscriptionPaymentInput>; onInputChange?: (input: SubscriptionPaymentInput) => void; context?: ReactNode;
}) {
  const [amount, setAmount] = useState(String(initialInput?.amount ?? subscription.amount));
  const [paidDate, setPaidDate] = useState(initialInput?.paidDate ?? subscription.nextDueDate);
  const [accountId, setAccountId] = useState(String(initialInput?.accountId ?? subscription.accountId ?? ""));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const lock = useRef(false);
  const eligibleAccounts = accounts.filter(account => account.workspaceId === subscription.workspaceId && !account.isArchived && account.currencyCode === subscription.currencyCode);
  const selectedAccount = eligibleAccounts.find(account => String(account.id) === accountId);
  const nextDueDate = computeNextRecurringDate(subscription.nextDueDate, subscription.frequency, subscription.intervalCount, subscription.dayOfMonth);
  const busy = isPending || saving;
  function update(field: "amount" | "paidDate" | "accountId", value: string) {
    if (field === "amount") setAmount(value);
    if (field === "paidDate") setPaidDate(value);
    if (field === "accountId") setAccountId(value);
    setError("");
    onInputChange?.({ amount: Number((field === "amount" ? value : amount).replace(",", ".")), paidDate: field === "paidDate" ? value : paidDate, accountId: Number(field === "accountId" ? value : accountId) });
  }
  async function confirmPayment() {
    if (lock.current || busy || unconfirmed) return;
    setError("");
    let sent = false;
    try {
      const input = validateSubscriptionPayment(subscription, accounts, { paidDate, amount: Number(amount.replace(",", ".")), accountId: Number(accountId) });
      lock.current = true; setSaving(true);
      sent = true;
      await onPay(input);
      onClose();
    } catch (cause) {
      if (sent) setUnconfirmed(true);
      setError(`${cause instanceof Error ? cause.message : "No se pudo registrar el pago."}${sent ? " No repitas este pago: cierra y comprueba el historial y la próxima fecha; alguna fase podría haberse guardado." : ""}`);
    }
    finally { lock.current = false; setSaving(false); }
  }
  return <Modal className="!max-w-[640px]" labelledBy="subscription-payment-title" onClose={() => { if (!lock.current && !busy) onClose(); }} size="lg">
    <ResourceEditorHeader disabled={busy} onBack={onBack} onClose={onClose} title={`${subscription.name} · pago`} titleId="subscription-payment-title" />
    <ModalBody className="space-y-5">
      {context ? <div className="text-sm text-storm">{context}</div> : null}
      <label className="block text-[13px] font-medium text-storm" htmlFor="subscription-paid-amount">Cuánto pagaste ({subscription.currencyCode})</label>
      <input className="field-dark !h-16 w-full text-2xl font-semibold" disabled={busy} id="subscription-paid-amount" min="0.01" onChange={event => update("amount", event.target.value)} step="0.01" type="number" value={amount} />
      <div className="divide-y divide-white/[0.08] rounded-xl border border-white/[0.08] px-4">
        <div className="flex min-h-[54px] items-center justify-between gap-3"><span className="text-sm text-ink">Se pagó con</span><div className="w-1/2"><SearchablePicker appearance="compact" disabled={busy} emptyMessage={`No hay cuentas activas en ${subscription.currencyCode}.`} onChange={value => update("accountId", value)} options={eligibleAccounts.map(account => ({ value: String(account.id), label: account.name, description: account.currencyCode, leadingLabel: account.name.slice(0, 2) }))} placeholderDescription="Cuenta del gasto" placeholderLabel="Elegir cuenta" queryPlaceholder="Buscar cuenta..." value={accountId} /></div></div>
        <div className="flex min-h-[54px] items-center justify-between gap-3"><span className="text-sm text-ink">Cuándo</span><div className="w-1/2"><DatePickerField appearance="compact" onChange={value => update("paidDate", value)} value={paidDate} /></div></div>
      </div>
      <div className="space-y-2 border-y border-white/[0.08] py-3 text-sm"><div className="flex justify-between gap-3"><span className="text-storm">Estaba programado</span><span className="text-ink">{formatDate(subscription.nextDueDate)} · {formatCurrency(subscription.amount, subscription.currencyCode)}</span></div><div className="flex justify-between gap-3"><span className="text-storm">Siguiente cobro</span><span className="font-semibold text-ink">{formatDate(nextDueDate)}</span></div></div>
      {!eligibleAccounts.length ? <p className="text-sm text-storm">Necesitas una cuenta activa en {subscription.currencyCode} para registrar el pago sin conversión.</p> : null}
      {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
    </ModalBody>
    <footer className="border-t border-white/[0.08] px-6 py-4"><p className="mb-3 text-xs text-storm">{selectedAccount ? `Se anotará un gasto en ${selectedAccount.name} y avanzará el próximo cobro.` : "Elige la cuenta para registrar el gasto."}</p><Button className="w-full" disabled={busy || unconfirmed || !eligibleAccounts.length} onClick={() => void confirmPayment()}>{unconfirmed ? "Comprueba el pago en el historial" : busy ? "Registrando..." : selectedAccount ? "Confirmar pago" : "Elige la cuenta"}</Button></footer>
  </Modal>;
}
