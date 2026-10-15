import { useState, type FormEvent, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { ResourceEditorDestination, ResourceEditorHeader } from "../../../components/ui/resource-editor";
import type { PickerOption } from "../../../components/ui/searchable-picker";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary, AttachmentSummary, ObligationSummary } from "../../../types/domain";
import { CompactAttachmentField, CompactPendingAttachmentField } from "../../attachments/components/compact-attachment-field";
import { Picker, Field, Input, Textarea } from "./obligation-editor-dialog";
import { getCurrencyLabel, type FeedbackState } from "../lib/obligation-editor-model";
import { parsePaymentPlan, coverPlan } from "../lib/payment-plan";
const parseOptionalNumber = (value: string) => value.trim() ? Number(value.replace(",", ".")) : null;
export type PaymentFormState = {
  amount: string;
  eventDate: string;
  installmentNo: string;
  description: string;
  notes: string;
  registerAccountMovement: boolean;
  accountId: string;
};
export type ObligationPaymentDialogProps = {
  accessMessage: string;
  accounts: AccountSummary[];
  attachments: AttachmentSummary[];
  canManageReceipts: boolean;
  editEventAmount: number | null;
  feedback: FeedbackState | null;
  formState: PaymentFormState;
  isEditMode: boolean;
  isSaving: boolean;
  isUploadingReceipt: boolean;
  obligation: ObligationSummary;
  onCancel: () => void;
  onDeleteReceipt: (attachment: AttachmentSummary) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadReceipt: (file: File) => Promise<void>;
  pendingReceiptFile: File | null;
  updatePendingReceiptFile: (file: File | null) => void;
  updateFormState: <Field extends keyof PaymentFormState>(
    field: Field,
    value: PaymentFormState[Field],
  ) => void;
  context?: ReactNode;
};
export function ObligationPaymentDialog(props: ObligationPaymentDialogProps) {
  const { accessMessage, accounts, attachments, canManageReceipts, editEventAmount, feedback, formState, isEditMode, isSaving, isUploadingReceipt, obligation, onCancel, onDeleteReceipt, onSubmit, onUploadReceipt, pendingReceiptFile, updateFormState, updatePendingReceiptFile } = props;
  const [panel, setPanel] = useState<"main" | "details">("main");
  const amount = parseOptionalNumber(formState.amount) ?? 0;
  const pendingBefore = obligation.pendingAmount + (editEventAmount ?? 0);
  const pendingAfter = Math.max(0, pendingBefore - amount);
  const isReceivable = obligation.direction === "receivable";
  const paymentNoun = isReceivable ? "cobro" : "pago";
  const accountOptions = accounts.filter((account) => (!account.isArchived || String(account.id) === formState.accountId) && account.currencyCode === obligation.currencyCode).map<PickerOption>((account) => ({ value: String(account.id), label: account.name, description: `${account.type} · ${account.currencyCode}`, leadingLabel: account.currencyCode, leadingColor: "#6b6459" }));
  const selectedAccount = accounts.find((account) => String(account.id) === formState.accountId) ?? null;
  const balanceAfter = selectedAccount ? selectedAccount.currentBalance + (isReceivable ? amount : -amount) : null;
  const plan = parsePaymentPlan(obligation.paymentPlan)
    ?? (obligation.installmentCount ? { mode: "equal" as const, count: obligation.installmentCount } : null);
  const coverage = plan ? coverPlan(
    plan,
    obligation.principalAmount,
    obligation.currentPrincipalAmount ?? obligation.principalAmount,
    obligation.startDate,
    obligation.events.filter((item) => item.eventType === "payment").map((item) => ({ amount: item.amount, date: item.eventDate })),
  ) : [];
  const nextInstallment = coverage.find((item) => item.status !== "covered");
  const remainingInInstallment = nextInstallment?.remaining ?? 0;
  const installmentEffect = nextInstallment && amount > 0
    ? amount < remainingInInstallment
      ? `Quedarán ${formatCurrency(remainingInInstallment - amount, obligation.currencyCode)} pendientes de esta cuota.`
      : amount === remainingInInstallment
        ? "Completa esta cuota exacta."
        : `Completa esta cuota y adelanta ${formatCurrency(amount - remainingInInstallment, obligation.currencyCode)} de la siguiente.`
    : null;

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3"><form className="resource-editor flex max-h-[calc(100dvh-24px)] w-full max-w-[640px] flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[#1a1917] shadow-none" noValidate onSubmit={onSubmit}>
    <ResourceEditorHeader disabled={isSaving} onBack={panel === "details" ? () => setPanel("main") : undefined} onClose={onCancel} title={panel === "main" ? (isEditMode ? `Editar ${paymentNoun}` : `Registrar ${paymentNoun}`) : `Detalles del ${paymentNoun}`} />
    <div className="overflow-y-auto px-5 py-5 sm:px-7">{props.context ? <div className="mb-4 text-sm text-storm">{props.context}</div> : null}{feedback ? <FormFeedbackBanner className="mb-5" description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}{panel === "main" ? <div className="space-y-5">
      <Field label={`Monto del ${paymentNoun} (${getCurrencyLabel(obligation.currencyCode).symbol})`}><Input autoFocus className="h-16 font-display text-[2rem] font-semibold" id="payment-amount" inputMode="decimal" min="0" onChange={(event) => updateFormState("amount", event.target.value)} placeholder="0.00" step="0.01" type="number" value={formState.amount} /></Field>
      {!isEditMode && nextInstallment ? <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311] px-4 py-3 text-sm"><div className="flex items-center justify-between gap-4"><span className="text-storm">Cuota {nextInstallment.seq} de {coverage.length} · {formatDate(nextInstallment.dueDate)}</span><strong className="tabular-nums text-ink">{formatCurrency(remainingInInstallment, obligation.currencyCode)}</strong></div>{installmentEffect ? <p className="mt-2 text-xs text-storm">{installmentEffect}</p> : null}</div> : null}
      <div className="flex min-h-14 items-center justify-between border-y border-white/[0.09] text-sm"><span className="text-storm">Pendiente después</span><strong className="text-lg tabular-nums text-ink">{formatCurrency(pendingAfter, obligation.currencyCode)}</strong></div>
      <Field label="Cuándo"><DatePickerField appearance="compact" onChange={(value) => updateFormState("eventDate", value)} value={formState.eventDate} /></Field>
      <div className="flex min-h-14 items-center justify-between gap-4 border-y border-white/[0.09]"><div><p className="font-semibold text-ink">Movimiento en cuenta</p><p className="mt-1 text-xs text-storm">{isReceivable ? "Suma el cobro al saldo." : "Descuenta el pago del saldo."}</p></div><button aria-pressed={formState.registerAccountMovement} className={`relative h-7 w-12 rounded-full border transition ${formState.registerAccountMovement ? "border-[#d8d2c7]/60 bg-white/[0.12]" : "border-white/[0.12] bg-white/[0.03]"}`} onClick={() => updateFormState("registerAccountMovement", !formState.registerAccountMovement)} type="button"><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#e8e3da] transition ${formState.registerAccountMovement ? "left-[25px]" : "left-1"}`} /></button></div>
      {formState.registerAccountMovement ? <><Field label={isReceivable ? "Cuenta de abono" : "Cuenta de débito"}><Picker disabled={!accountOptions.length} emptyMessage={`No hay cuentas en ${obligation.currencyCode}.`} onChange={(value) => updateFormState("accountId", value)} options={accountOptions} placeholderDescription="Cuenta afectada." placeholderLabel="Selecciona una cuenta" queryPlaceholder="Buscar cuenta..." value={formState.accountId} /></Field>{selectedAccount && balanceAfter !== null ? <div className="flex min-h-12 items-center justify-between border-b border-white/[0.09] text-sm"><span className="text-storm">Saldo después</span><strong className="tabular-nums text-ink">{formatCurrency(balanceAfter, selectedAccount.currencyCode)}</strong></div> : null}</> : null}
      <ResourceEditorDestination onClick={() => setPanel("details")} summary="Descripción, notas y comprobante" />
    </div> : <div className="space-y-5"><Field label="Descripción"><Input maxLength={120} onChange={(event) => updateFormState("description", event.target.value)} placeholder="Cuota del mes o referencia" value={formState.description} /></Field><Field label="Notas"><Textarea className="min-h-24" onChange={(event) => updateFormState("notes", event.target.value)} placeholder="Número de operación u otra nota" value={formState.notes} /></Field>{isEditMode ? <CompactAttachmentField accessMessage={accessMessage} attachments={attachments} canManage={canManageReceipts} isUploading={isUploadingReceipt} onDelete={(attachment) => void onDeleteReceipt(attachment)} onUpload={(file) => void onUploadReceipt(file)} /> : <CompactPendingAttachmentField canUpload={canManageReceipts} file={pendingReceiptFile} lockedMessage={accessMessage} onChange={updatePendingReceiptFile} />}</div>}</div>
    <footer className="border-t border-white/[0.08] px-5 py-4 sm:px-7"><Button className="w-full" disabled={isSaving} type="submit">{isSaving ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : isEditMode ? "Guardar cambios" : `Registrar ${paymentNoun}`}</Button></footer>
  </form></div>;
}
