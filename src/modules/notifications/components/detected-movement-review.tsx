import { useCallback, useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Modal, ModalFooter, ModalHeader } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { useToast } from "../../../components/ui/toast-provider";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDateTime } from "../../../lib/formatting/dates";
import { useCreateMovementMutation, getQueryErrorMessage, type WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import { useDetectedMovementReviewQuery } from "../../../services/queries/detected-movements";
import { QuickMovementDialog } from "../../movements/components/quick-movement-dialog";
import { detectedInputSignature, detectedMovementDraft, detectionPending, possibleDetectedDuplicate,
  reconciliationCandidateForDetectedInput, type DetectionMovementInput } from "../lib/detected-movement";
import type { MovementRecord } from "../../../types/domain";

export function DetectedMovementReview({ id, snapshot, userId, proAccessEnabled, onClose }: {
  id: number; snapshot: WorkspaceSnapshot; userId: string; proAccessEnabled: boolean; onClose: () => void;
}) {
  const { store, review, settings, resolve, undo, invalidate, invalidateFinances } = useDetectedMovementReviewQuery(userId, snapshot.workspace.id, id);
  const create = useCreateMovementMutation(snapshot.workspace.id, userId);
  const { showToast } = useToast();
  const { schedule } = useUndoQueue();
  const registeredMovementId = useRef<number | null>(null);
  const [duplicate, setDuplicate] = useState<{ movement: MovementRecord; signature: string } | null>(null);
  const allowAnother = useRef<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [actionError, setActionError] = useState("");
  const clearDuplicate = useCallback(() => { setDuplicate(null); allowAnother.current = null; }, []);
  const suggestion = review.data?.suggestion;
  const register = useMutation({ mutationFn: async (input: DetectionMovementInput) => {
    const result = await store!.register(id, input, snapshot.accounts, (value) => create.mutateAsync(value), async (fresh, candidate) => {
      const matched = reconciliationCandidateForDetectedInput(fresh, input, snapshot.accounts, candidate)
        ?? possibleDetectedDuplicate(input, snapshot.accounts, snapshot.movements);
      const signature = detectedInputSignature(input);
      if (matched && allowAnother.current !== signature) {
        setDuplicate({ movement: matched, signature });
        throw new Error("Hay un movimiento parecido. Confirma si es el mismo o si deseas registrar otro.");
      }
    }, snapshot.catalogs.categories);
    if (!result.readingUpdated) showToast({ title: "Movimiento confirmado", description: "El registro está guardado; el aviso no pudo marcarse leído. Puedes hacerlo desde la bandeja.", tone: "info" });
    registeredMovementId.current = result.movementId;
    return result.movementId;
  }, onError: () => { void review.refetch(); } });
  const restore = useMutation({ mutationFn: () => store!.restoreDiscarded(id), onSuccess: invalidate });
  const busy = register.isPending || resolve.isPending || restore.isPending || undo.isPending;

  async function undoRegistered(movementId: number) {
    setActionError("");
    try {
      await undo.mutateAsync(movementId);
      setConfirmUndo(false);
      showToast({ title: "Registro deshecho", description: "La detección vuelve a estar pendiente. El estado de lectura del aviso no cambia.", tone: "success" });
    } catch (error) {
      setActionError(getQueryErrorMessage(error, "No se pudo deshacer el registro."));
      void review.refetch();
    }
  }

  async function resolveDetection(status: "discarded" | "duplicate", movementId: number | null = null) {
    if (!suggestion || busy) return;
    setActionError("");
    try {
      const result = await resolve.mutateAsync([suggestion, status, movementId]);
      if (!result.readingUpdated) showToast({ title: "Detección resuelta", description: "El aviso sigue sin leer; puedes marcarlo desde la bandeja.", tone: "info" });
      setConfirmDiscard(false);
      await review.refetch();
    } catch (error) { setActionError(getQueryErrorMessage(error, "No se pudo resolver la detección.")); void review.refetch(); }
  }

  const close = () => { if (!busy) onClose(); };
  if (!store || review.isPending || settings.isPending || review.isError || settings.isError || !suggestion || !detectionPending(suggestion)) {
    const error = review.error ?? settings.error;
    let content: ReactNode;
    if (!store) {
      content = <p className="text-sm text-storm">No hay una sesión disponible para consultar esta detección.</p>;
    } else if (error) {
      content = <div className="space-y-3"><p role="alert" className="text-sm text-storm">{getQueryErrorMessage(error, "No se pudo abrir la revisión.")}</p><Button onClick={() => { void review.refetch(); void settings.refetch(); }} variant="secondary">Reintentar</Button></div>;
    } else if (review.isPending || settings.isPending) {
      content = <p role="status" className="text-sm text-storm">Consultando la detección y su estado actual...</p>;
    } else if (!suggestion) {
      content = <p className="text-sm text-storm">La detección no está disponible en este espacio o ya fue eliminada.</p>;
    } else {
      const message = suggestion.status === "discarded"
        ? "Esta detección fue omitida. No se creó un movimiento."
        : suggestion.status === "duplicate"
          ? "Esta detección ya corresponde a un movimiento existente."
          : "Este movimiento ya fue registrado. No se creará otro.";
      content = <div className="space-y-4">
        <p className="text-sm text-storm">{message}</p>
        <p className="text-sm text-ink">{suggestion.description} · {formatCurrency(suggestion.amount, suggestion.currencyCode)}</p>
        {suggestion.movementId ? <Link className="text-sm font-semibold text-ink underline underline-offset-4" to={`/app/movements?period=all&movement=${suggestion.movementId}`}>Ver movimiento</Link> : null}
        {confirmUndo && suggestion.status === "registered" && suggestion.movementId ? <div className="space-y-3 border-t border-white/10 pt-3">
          <p className="text-sm text-storm">Se eliminará el registro completo y la detección volverá a pendiente. Si fue editado, vinculado o tiene comprobantes, no se eliminará.</p>
          <Button disabled={busy} onClick={() => void undoRegistered(suggestion.movementId!)} variant="secondary">Confirmar deshacer registro</Button>
        </div> : null}
      </div>;
    }
    return <Modal labelledBy="detected-review-title" onClose={close} size="md">
      <ModalHeader title="Movimiento detectado" titleId="detected-review-title" onClose={close} />
      <ModalBody>{content}{actionError ? <p role="alert" className="mt-4 text-sm text-ink">{actionError}</p> : null}</ModalBody>
      <ModalFooter>
        {suggestion?.status === "discarded" ? <Button disabled={busy} onClick={() => { void restore.mutateAsync().catch((error) => showToast({ title: "No se pudo deshacer la omisión", description: getQueryErrorMessage(error, "Actualiza la revisión."), tone: "error" })); }} variant="secondary">Deshacer omisión</Button> : null}
        {suggestion?.status === "registered" && suggestion.movementId ? <Button disabled={busy} onClick={() => setConfirmUndo((current) => !current)} variant="secondary">{confirmUndo ? "Cancelar" : "Deshacer registro"}</Button> : null}
        <Button disabled={busy} onClick={close} variant="secondary">Cerrar</Button>
      </ModalFooter>
    </Modal>;
  }
  const draft = detectedMovementDraft(suggestion, snapshot.accounts, snapshot.catalogs.categories, settings.data ?? []);
  return <QuickMovementDialog
    allowSplit={false}
    postedOnly
    sourceCurrencyCode={suggestion.currencyCode}
    initialDraft={draft.form}
    initialKind={draft.kind}
    isSubmitting={busy}
    onDraftChange={clearDuplicate}
    onClose={close}
    onCreated={(message) => {
      invalidate();
      const movementId = registeredMovementId.current;
      const originalStore = store;
      if (movementId && originalStore) schedule({
        label: message,
        // The save already committed; this queue only exposes its existing Undo UI.
        onCommit: () => {},
        onUndo: async () => {
          try {
            await originalStore.undoRegistration(id, movementId);
            await invalidateFinances();
            showToast({ title: "Registro deshecho", description: "La detección vuelve a estar pendiente.", tone: "success" });
          } catch (error) {
            void invalidateFinances();
            showToast({ title: "No se pudo deshacer", description: getQueryErrorMessage(error, "Abre la detección para comprobar el registro antes de reintentar."), tone: "error" });
          }
        },
      });
      else showToast({ title: "Detección registrada", description: message, tone: "success" });
      onClose();
    }}
    proAccessEnabled={proAccessEnabled}
    snapshot={snapshot}
    submitMovement={(input) => register.mutateAsync(input)}
    title="Revisar movimiento detectado"
    userId={userId}
    workspaceId={snapshot.workspace.id}
    context={<div className="space-y-3">
      <p>{suggestion.appLabel}{suggestion.packageName === "email:inbound" ? " · por correo" : ""} · {formatDateTime(suggestion.occurredAt)}</p>
      <p>Revisa cuenta, tipo e importe antes de guardar. Cerrar no confirma ni marca leído el aviso.</p>
      {suggestion.status === "needs_review" || suggestion.movementType === "unknown" ? <p className="text-ink">La detección necesita tu revisión; el tipo no se confirmó automáticamente.</p> : null}
      {duplicate ? <div className="space-y-3 border-y border-white/10 py-3"><p className="font-semibold text-ink">Posible coincidencia: {duplicate.movement.description}</p><p>{formatDateTime(duplicate.movement.occurredAt)} · #{duplicate.movement.id}</p><div className="flex flex-wrap gap-4"><button disabled={busy} className="font-semibold text-ink underline underline-offset-4" onClick={() => void resolveDetection("duplicate", duplicate.movement.id)} type="button">Es el mismo movimiento</button><button disabled={busy} className="text-ink underline underline-offset-4" onClick={() => { allowAnother.current = duplicate.signature; setDuplicate(null); }} type="button">Es otro; permitir guardar</button></div></div> : null}
      {actionError ? <p role="alert" className="text-ink">{actionError}</p> : null}
      {confirmDiscard ? <div className="space-y-2 border-t border-white/10 pt-3"><p>¿Omitir esta detección? No se creará un movimiento ni cambiarán tus saldos.</p><div className="flex gap-4"><button disabled={busy} className="font-semibold text-ink" onClick={() => void resolveDetection("discarded")} type="button">Confirmar omisión</button><button disabled={busy} onClick={() => setConfirmDiscard(false)} type="button">Cancelar</button></div></div> : <button disabled={busy} className="text-xs underline underline-offset-4" onClick={() => setConfirmDiscard(true)} type="button">Omitir detección</button>}
    </div>}
  />;
}
