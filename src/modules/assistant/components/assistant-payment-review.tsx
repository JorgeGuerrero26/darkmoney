import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { DataState } from "../../../components/ui/data-state";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { formatCurrency } from "../../../lib/formatting/money";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { useProFeatureAccess } from "../../shared/use-pro-feature-access";
import { useReceiptFeatureAccess } from "../../attachments/use-receipt-feature-access";
import { prepareReceiptUpload, uploadPreparedReceipt, deleteStoredReceipt } from "../../attachments/receipt-utils";
import { SubscriptionPaymentDialog } from "../../subscriptions/components/subscription-payment-dialog";
import { validateSubscriptionPayment, type SubscriptionPaymentInput } from "../../subscriptions/lib/subscription-payment-input";
import { markSubscriptionPaid, todayPeru } from "../../subscriptions/lib/subscription-actions";
import { ObligationPaymentDialog, type PaymentFormState } from "../../obligations/components/obligation-payment-dialog";
import { useWorkspaceSnapshotQuery, useRegisterObligationPaymentMutation, useCreateAttachmentRecordMutation, mirrorObligationEventAttachmentsToMovement, getQueryErrorMessage, type ObligationPaymentFormInput } from "../../../services/queries/workspace-data";
import { paymentTargets, resolvePaymentTarget, resolvePaymentAccount, validateObligationPayment } from "../lib/payment-proposal";
import type { AssistantMovementDraft } from "../lib/movement-proposal";
import { validAssistantDay } from "../lib/movement-proposal";
import { createAssistantResourceSaver } from "../lib/resource-proposal-save";

type Input = { kind: "subscription"; id: number; value: SubscriptionPaymentInput } | { kind: "obligation"; id: number; value: ObligationPaymentFormInput };
export type AssistantPaymentSession = { targetId?: number | null; dueDate?: string; value?: PaymentFormState; subscriptionInput?: Partial<SubscriptionPaymentInput>;
  eventId?: number; movementId?: number | null; nextDueDate?: string; saver?: ReturnType<typeof createAssistantResourceSaver<Input>>;
  live?: { current: () => boolean; insert: (input: Input) => Promise<void> } };

export function AssistantPaymentReview({ draft, userId, workspaceId, session, onClose, onSaved, onUnconfirmed }: {
  draft: AssistantMovementDraft; userId: string; workspaceId: number; session: AssistantPaymentSession;
  onClose: () => void; onSaved: (note: string) => void; onUnconfirmed: (note: string) => void;
}) {
  const auth = useAuth(), { activeWorkspace } = useActiveWorkspace(), access = useProFeatureAccess(), receipts = useReceiptFeatureAccess();
  const query = useWorkspaceSnapshotQuery(activeWorkspace, auth.user?.id, auth.profile), client = useQueryClient();
  const payment = useRegisterObligationPaymentMutation(workspaceId, userId), attachment = useCreateAttachmentRecordMutation(workspaceId, userId);
  const alive = useRef(true), scope = useRef(false), lock = useRef(false), dirty = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  scope.current = auth.user?.id === userId && activeWorkspace?.id === workspaceId && !activeWorkspace?.isArchived;
  const scoped = scope.current && !query.isPlaceholderData && query.data?.workspace.id === workspaceId;
  const ready = scoped && access.canAccessProFeatures && !query.isFetching && !query.isError;
  const [targetId, setTargetId] = useState<number | null | undefined>(session.targetId);
  const [value, setValue] = useState<PaymentFormState | null>(session.value ?? null);
  const [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false), [unsaved, setUnsaved] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    if (scoped && query.data && targetId === undefined) { const id = resolvePaymentTarget(draft, query.data); session.targetId = id; setTargetId(id); }
  }, [scoped, query.data, targetId, draft, session]);
  useEffect(() => {
    if (!scoped || !query.data || !targetId) return;
    const account = resolvePaymentAccount(draft, query.data);
    if (!session.subscriptionInput) session.subscriptionInput = { amount: draft.amount, paidDate: draft.occurredAt ?? todayPeru(), accountId: account ?? 0 };
    const sub = query.data.subscriptions.find(row => row.id === targetId);
    if (draft.operation === "pay_subscription" && session.dueDate === undefined) session.dueDate = sub?.nextDueDate;
    setValue(previous => {
      if (previous) return previous;
      const next = { amount: String(draft.amount), eventDate: draft.occurredAt ?? todayPeru(), installmentNo: "", description: draft.description ?? "", notes: "", registerAccountMovement: true, accountId: account ? String(account) : "" };
      session.value = next; return next;
    });
  }, [scoped, query.data, targetId, draft, session]);
  session.live = { current: () => alive.current && ready, insert: async input => {
    if (!query.data) throw new Error("Espera la lectura del espacio.");
    if (input.kind === "subscription") {
      const target = query.data.subscriptions.find(row => row.id === input.id && row.workspaceId === workspaceId);
      if (!target) throw new Error("La suscripción ya no está disponible.");
      session.nextDueDate = await markSubscriptionPaid(target, input.value, { isCurrent: () => alive.current && scope.current });
      if (!validAssistantDay(session.nextDueDate)) throw new Error("El servidor no confirmó la próxima fecha del cobro.");
      // Invalidation is read-only housekeeping, not evidence of a failed financial write.
      void client.invalidateQueries({ queryKey: ["workspace-snapshot"] }).catch(() => undefined);
      void client.invalidateQueries({ queryKey: ["subscription-occurrences", workspaceId, userId, input.id] }).catch(() => undefined);
    } else {
      const result = await payment.mutateAsync({ ...input.value, userId, workspaceId });
      if (!Number.isSafeInteger(result.eventId) || !result.eventId || result.eventId <= 0 || input.value.registerAccountMovement && (!Number.isSafeInteger(result.movementId) || !result.movementId || result.movementId <= 0)) throw new Error("El servidor no confirmó el abono completo.");
      session.eventId = result.eventId; session.movementId = result.movementId;
    }
  } };
  if (!session.saver) session.saver = createAssistantResourceSaver<Input>({ isCurrent: () => session.live?.current() ?? false,
    isDefiniteRejection: () => false, // Both native payment contracts contain multiple writes.
    insert: input => { if (!session.live) throw new Error("La revisión ya no está disponible."); return session.live.insert(input); } });
  function close() { if (session.saver?.confirmed()) { onClose(); return; } if (lock.current) return; if (dirty.current) setUnsaved(true); else onClose(); }
  function update<Field extends keyof PaymentFormState>(field: Field, fieldValue: PaymentFormState[Field]) {
    setValue(previous => { if (!previous) return previous; const next = { ...previous, [field]: fieldValue }; session.value = next; return next; }); dirty.current = true; setError(null);
  }
  async function save(input: Input) {
    if (lock.current || unsaved) return;
    lock.current = true; setSaving(true); setError(null);
    try {
      await session.saver!.save(input);
      const saved = session.saver!.confirmed(); if (!saved) return;
      let receiptPending = Boolean(file);
      if (saved.kind === "obligation" && file && receipts.canUploadReceipts && alive.current && scope.current) {
        try {
          const prepared = await prepareReceiptUpload({ workspaceId, entityType: "obligation-event", entityId: session.eventId!, file });
          if (!scope.current || !alive.current) throw new Error("Cambió el contexto del comprobante.");
          await uploadPreparedReceipt(prepared);
          try {
            if (!scope.current || !alive.current) throw new Error("Cambió el contexto del comprobante.");
            await attachment.mutateAsync({ workspaceId, entityType: "obligation-event", entityId: session.eventId!, uploadedByUserId: userId,
              bucketName: prepared.bucketName, filePath: prepared.filePath, fileName: prepared.fileName, mimeType: prepared.mimeType, sizeBytes: prepared.sizeBytes, width: prepared.width, height: prepared.height });
          } catch (cause) { await deleteStoredReceipt(prepared.bucketName, prepared.filePath).catch(() => undefined); throw cause; }
          if (session.movementId) await mirrorObligationEventAttachmentsToMovement({ workspaceId, eventId: session.eventId!, movementId: session.movementId, userId });
          receiptPending = false;
        } catch { receiptPending = true; }
      }
      if (alive.current && scope.current) onSaved(saved.kind === "subscription"
        ? `Pago de suscripción #${saved.id}: ${formatCurrency(saved.value.amount, draft.currency)}, ${saved.value.paidDate}, cuenta #${saved.value.accountId}. Se registró el gasto y el próximo cobro pasó a ${session.nextDueDate}.`
        : `Abono #${session.eventId} del crédito/deuda #${saved.id}: ${formatCurrency(saved.value.amount, draft.currency)}, ${saved.value.eventDate}. ${saved.value.registerAccountMovement ? `Movimiento #${session.movementId} en cuenta #${saved.value.accountId}.` : "Sin movimiento en cuenta, por elección explícita."}${receiptPending ? " Comprobante pendiente: adjúntalo desde el módulo, sin repetir el abono." : ""}`);
    } catch (cause) {
      if (alive.current && scope.current) {
        if (session.saver!.uncertain()) onUnconfirmed("Resultado del pago incierto: comprueba el historial, el saldo y la próxima fecha en el módulo antes de repetirlo. Alguna fase podría haberse guardado.");
        else setError(getQueryErrorMessage(cause, "No se pudo preparar el pago."));
      }
      throw cause;
    } finally { lock.current = false; if (alive.current) setSaving(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!value || !query.data || !targetId || lock.current) return;
    try { await save({ kind: "obligation", id: targetId, value: validateObligationPayment(value, query.data, targetId) }); }
    catch (cause) { if (alive.current && scope.current && !session.saver!.uncertain()) setError(getQueryErrorMessage(cause, "Revisa el abono.")); }
  }
  if (!scoped || !query.data) return <DataState title="Comprobando el espacio" description="No se registra ningún pago al abrir la propuesta." action={<><Button onClick={() => void query.refetch()}>Reintentar lectura</Button><Button variant="ghost" onClick={onClose}>Cerrar revisión</Button></>} />;
  const targets = paymentTargets(draft, query.data), target = targets.find(row => row.id === targetId);
  if (!target || !value) return <Modal onClose={close} labelledBy="assistant-payment-target"><ResourceEditorHeader onClose={close} title="Elige qué vas a pagar o cobrar" titleId="assistant-payment-target" /><ModalBody><p className="mb-4 text-sm text-storm">La propuesta no identifica un único registro activo en {draft.currency}. No se elige uno automáticamente.</p>{targets.map(row => <button className="flex min-h-14 w-full items-center justify-between border-b border-white/10 text-left text-ink" key={row.id} onClick={() => { session.targetId = row.id; session.dueDate = undefined; session.subscriptionInput = undefined; setTargetId(row.id); dirty.current = true; }} type="button">{row.name}<span className="text-sm text-storm">{row.party} ›</span></button>)}{!targets.length ? <p className="text-sm text-storm">No hay registros compatibles. Revisa el módulo antes de continuar.</p> : null}</ModalBody></Modal>;
  const context = <p>Propuesta del Asistente para «{target.name}». Revisa monto, fecha y cuenta antes de confirmar. {error ?? (!ready ? "Espera la lectura del espacio actual; sin acceso Pro no se puede registrar desde el Asistente." : "Abrir este formulario no mueve dinero.")}</p>;
  const subscription = query.data.subscriptions.find(row => row.id === targetId);
  const obligation = query.data.obligations.find(row => row.id === targetId);
  return <>{draft.operation === "pay_subscription" && subscription ? <SubscriptionPaymentDialog subscription={subscription} accounts={query.data.accounts} initialInput={session.subscriptionInput} isPending={saving} context={context} onClose={close}
    onInputChange={input => { session.subscriptionInput = input; dirty.current = true; }} onPay={async input => {
      if (session.dueDate !== subscription.nextDueDate) throw new Error("El próximo cobro cambió durante la revisión. Cierra y comprueba el historial antes de registrar otro pago.");
      await save({ kind: "subscription", id: subscription.id, value: validateSubscriptionPayment(subscription, query.data!.accounts, input) });
    }} /> : obligation ? <ObligationPaymentDialog obligation={obligation} accounts={query.data.accounts.filter(row => row.workspaceId === workspaceId)} formState={value} updateFormState={update} context={context}
      accessMessage={receipts.accessMessage} canManageReceipts={receipts.canUploadReceipts} attachments={[]} editEventAmount={null} feedback={error ? { tone: "error", title: "Revisa el abono", description: error } : null}
      isEditMode={false} isSaving={saving} isUploadingReceipt={false} onCancel={close} onSubmit={submit} pendingReceiptFile={file} updatePendingReceiptFile={next => { setFile(next); dirty.current = true; }} onUploadReceipt={async () => {}} onDeleteReceipt={async () => {}} /> : null}
    {unsaved ? <UnsavedChangesDialog onKeepEditing={() => setUnsaved(false)} onDiscard={() => { session.value = undefined; session.subscriptionInput = undefined; onClose(); }} /> : null}</>;
}
