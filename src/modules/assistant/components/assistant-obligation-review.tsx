import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { formatCurrency } from "../../../lib/formatting/money";
import { useWorkspaceSnapshotQuery, useCreateObligationMutation, useCreateAttachmentRecordMutation, getQueryErrorMessage, type ObligationFormInput } from "../../../services/queries/workspace-data";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { useProFeatureAccess } from "../../shared/use-pro-feature-access";
import { useReceiptFeatureAccess } from "../../attachments/use-receipt-feature-access";
import { prepareReceiptUpload, uploadPreparedReceipt, deleteStoredReceipt } from "../../attachments/receipt-utils";
import { ObligationEditorDialog } from "../../obligations/components/obligation-editor-dialog";
import { applyObligationFormRules, getOpeningImpact, type ObligationFormState } from "../../obligations/lib/obligation-editor-model";
import { buildObligationEditorInput } from "../../obligations/lib/obligation-editor-input";
import { describePlan, expandPaymentPlan } from "../../obligations/lib/payment-plan";
import { prepareObligationProposal, type AssistantObligationDraft } from "../lib/obligation-proposal";
import { createAssistantResourceSaver } from "../lib/resource-proposal-save";

type Input = ObligationFormInput & { userId: string; workspaceId: number };
export type AssistantObligationSession = { value?: ObligationFormState; createdId?: number; saver?: ReturnType<typeof createAssistantResourceSaver<Input>>;
  live?: { current: () => boolean; insert: (input: Input) => Promise<void> } };

export function AssistantObligationReview({ draft, userId, workspaceId, session, onClose, onSaved, onUnconfirmed }: {
  draft: AssistantObligationDraft; userId: string; workspaceId: number; session: AssistantObligationSession;
  onClose: () => void; onSaved: (note: string) => void; onUnconfirmed: (note: string) => void;
}) {
  const auth = useAuth(), { activeWorkspace } = useActiveWorkspace(), access = useProFeatureAccess(), receipts = useReceiptFeatureAccess();
  const query = useWorkspaceSnapshotQuery(activeWorkspace, auth.user?.id, auth.profile);
  const mutation = useCreateObligationMutation(workspaceId, userId), attachment = useCreateAttachmentRecordMutation(workspaceId, userId);
  const alive = useRef(true), scope = useRef(false), lock = useRef(false), dirty = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  scope.current = auth.user?.id === userId && activeWorkspace?.id === workspaceId && !activeWorkspace?.isArchived;
  const scoped = scope.current && !query.isPlaceholderData && query.data?.workspace.id === workspaceId;
  const ready = scoped && access.canAccessProFeatures && !query.isFetching && !query.isError;
  const [value, setValue] = useState<ObligationFormState | null>(() => session.value ?? null);
  const [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false), [unsaved, setUnsaved] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => { if (scoped && query.data) setValue(previous => previous ?? prepareObligationProposal(draft, query.data)); }, [scoped, query.data, draft]);
  session.live = { current: () => alive.current && ready, insert: async input => {
    const id = await mutation.mutateAsync(input);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error("El servidor no confirmó el identificador del registro.");
    session.createdId = id;
  } };
  if (!session.saver) session.saver = createAssistantResourceSaver<Input>({ isCurrent: () => session.live?.current() ?? false,
    // Native creation also inserts an opening event and may compensate earlier writes. A SQL
    // error alone does not prove that all phases were rolled back; never blindly replay it.
    isDefiniteRejection: () => false,
    insert: input => { if (!session.live) throw new Error("El formulario ya no está disponible."); return session.live.insert(input); } });
  function close() { if (lock.current) return; if (dirty.current) setUnsaved(true); else onClose(); }
  function update<Field extends keyof ObligationFormState>(field: Field, fieldValue: ObligationFormState[Field]) {
    setValue(previous => { if (!previous) return previous; const next = applyObligationFormRules({ ...previous, [field]: fieldValue }); session.value = next; return next; });
    dirty.current = true; setError(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current || unsaved || !value || !query.data) return;
    setError(null); lock.current = true; setSaving(true);
    try {
      const input = buildObligationEditorInput(value, query.data);
      await session.saver!.save({ ...input, userId, workspaceId });
      const saved = session.saver!.confirmed();
      let receiptPending = Boolean(file);
      if (saved && file && receipts.canUploadReceipts && alive.current && scope.current) {
        try {
          const prepared = await prepareReceiptUpload({ workspaceId, entityType: "obligation", entityId: session.createdId!, file });
          if (!alive.current || !scope.current) throw new Error("Cambió el contexto del comprobante.");
          await uploadPreparedReceipt(prepared);
          try {
            if (!alive.current || !scope.current) throw new Error("Cambió el contexto del comprobante.");
            await attachment.mutateAsync({ workspaceId, entityType: "obligation", entityId: session.createdId!, uploadedByUserId: userId,
              bucketName: prepared.bucketName, filePath: prepared.filePath, fileName: prepared.fileName, mimeType: prepared.mimeType,
              sizeBytes: prepared.sizeBytes, width: prepared.width, height: prepared.height });
          } catch (e) { await deleteStoredReceipt(prepared.bucketName, prepared.filePath).catch(() => undefined); throw e; }
          receiptPending = false;
        } catch { receiptPending = true; }
      }
      if (saved && alive.current && scope.current) {
        const plan = describePlan(saved.paymentPlan ?? null, saved.principalAmount, saved.startDate, amount => formatCurrency(amount, saved.currencyCode)) ?? "Sin plan de cuotas";
        onSaved(`${saved.direction === "receivable" ? "Crédito" : "Deuda"} #${session.createdId}: «${saved.title}», ${formatCurrency(saved.principalAmount, saved.currencyCode)}. ${plan}. ${saved.openingImpact === "none" ? "Sin movimiento de apertura en cuentas." : "Se registró la apertura en la cuenta que elegiste."}${receiptPending ? " El comprobante quedó pendiente; no vuelvas a crear el registro." : ""}`);
      }
    } catch (e) {
      if (alive.current && scope.current) {
        if (session.saver!.uncertain()) onUnconfirmed("No se pudo confirmar la creación completa. Comprueba Créditos y deudas y la apertura antes de repetir: alguna fase podría haberse guardado.");
        else setError(getQueryErrorMessage(e, "No se pudo preparar el crédito o deuda."));
      }
    } finally { lock.current = false; if (alive.current) setSaving(false); }
  }
  if (!scoped || !query.data || !value) return <DataState title={query.isError ? "No se pudo preparar la propuesta" : "Comprobando el espacio"}
    description="No se crea un crédito o deuda ni se mueve dinero al abrir la propuesta." action={<div className="flex gap-3"><Button onClick={() => void query.refetch()}>Reintentar lectura</Button><Button variant="ghost" onClick={onClose}>Cerrar revisión</Button></div>} />;
  const opening = getOpeningImpact(value.direction, value.originType, value.manualOpeningImpact);
  const rows = value.paymentPlan ? expandPaymentPlan(value.paymentPlan, Number(value.principalAmount) || 0, value.startDate) : [];
  const adjustedDates = value.paymentPlan?.mode === "custom" && value.paymentPlan.agreed.some((row, i) => row.dueDate && row.dueDate !== rows[i]?.dueDate);
  return <><ObligationEditorDialog formState={value} updateFormState={update} onSubmit={submit} closeEditor={close} clearFieldError={() => setError(null)}
    accounts={query.data.accounts.filter(a => a.workspaceId === workspaceId)} counterparties={query.data.catalogs.counterparties} baseCurrencyCode={query.data.workspace.baseCurrencyCode}
    isCreateMode isSaving={saving} feedback={error ? { tone: "error", title: "Revisa el registro", description: error } : null} invalidFields={new Set()}
    canManageReceipts={receipts.canUploadReceipts} accessMessage={receipts.accessMessage} pendingReceiptFile={file} updatePendingReceiptFile={next => { setFile(next); dirty.current = true; }}
    attachments={[]} isUploadingReceipt={false} selectedObligation={null} handleUploadReceipt={async () => {}} handleDeleteReceipt={async () => {}} onEditEvent={() => {}} onDeleteEvent={() => {}}
    canShareObligations={false} shareAccessMessage="Después de crear el registro puedes compartirlo desde Créditos y deudas." currentShare={null} shareFormState={{ invitedEmail: "", message: "" }} updateShareFormState={() => {}}
    context={<p>Propuesta del Asistente. Revisa contraparte, fechas y cuotas. {opening === "none" ? "Se creará sin mover dinero de una cuenta." : `Elegiste una apertura con ${opening === "inflow" ? "entrada" : "salida"} de dinero: revisa la cuenta antes de confirmar.`} {adjustedDates ? "Hay fechas que se cruzan: revisa el calendario calculado en Plan de pagos; se ordenan por meses como en móvil." : ""}</p>} />
    {unsaved ? <UnsavedChangesDialog onKeepEditing={() => setUnsaved(false)} onDiscard={() => { session.value = undefined; onClose(); }} /> : null}</>;
}
