import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Modal, ModalHeader, ModalFooter } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { useToast } from "../../../components/ui/toast-provider";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDateTime } from "../../../lib/formatting/dates";
import { useDetectedMovements } from "../../../services/queries/detected-movements";
import { getQueryErrorMessage } from "../../../services/queries/workspace-data";
import type { DetectedMovement } from "../lib/detected-movement";
import type { DetectionOmissionInput } from "../lib/detection-omissions";
import { useWorkspaceStore } from "../../../stores/workspace-store";

export function DetectedMovementInbox({ userId, workspaceId, onOpen }: { userId: string; workspaceId: number; onOpen: (id: number) => void }) {
  const { pending, omissions } = useDetectedMovements(userId, workspaceId, true, false);
  const { showToast } = useToast();
  const { schedule } = useUndoQueue();
  const [confirmation, setConfirmation] = useState<DetectedMovement[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const inFlight = useRef<Promise<unknown> | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function run(input: DetectionOmissionInput): Promise<void> {
    if (locked.current) {
      if (input.action === "restore") {
        await inFlight.current?.catch(() => {});
        return run(input);
      }
      return;
    }
    if (input.action === "restore" && useWorkspaceStore.getState().activeWorkspaceId !== workspaceId) {
      showToast({ title: "No se deshizo la omisión", description: "Vuelve a la lista del espacio donde omitiste las detecciones.", tone: "info" });
      return;
    }
    if (!mounted.current && input.action !== "restore") return;
    locked.current = true;
    if (mounted.current) { setBusy(true); setError(""); }
    try {
      const request = omissions.mutateAsync(input);
      inFlight.current = request;
      const result = await request;
      if (mounted.current) setConfirmation(null);
      if (mounted.current && (result.failed || result.skipped)) setError([
        result.failed ? `No se pudo confirmar el resultado de ${result.failed} detecciones. Actualiza la lista antes de reintentar.` : "",
        result.skipped ? `${result.skipped} ya cambiaron en otro dispositivo; se conservó su estado actual.` : "",
      ].filter(Boolean).join(" "));
      if (input.action === "omit" && result.changes.length) {
        schedule({
          label: result.changes.length === 1 ? "Detección omitida" : `${result.changes.length} detecciones omitidas`,
          onCommit: () => {},
          onUndo: () => run({ action: "restore", changes: result.changes }),
        });
        if (!result.readingUpdated) showToast({ title: "Detección omitida", description: "El aviso no pudo marcarse leído; la omisión sí quedó guardada.", tone: "info" });
      } else if (input.action === "restore") showToast({
        title: result.changes.length ? "Detecciones recuperadas" : "Las detecciones ya cambiaron",
        description: result.failed ? "No se pudieron recuperar todas. Actualiza la lista para comprobar su estado."
          : "Se conserva lo registrado o modificado después. El estado de lectura del aviso no cambia.",
        tone: result.failed ? "error" : "info",
      });
    } catch (cause) {
      const message = getQueryErrorMessage(cause, "No se pudieron actualizar las detecciones.");
      if (mounted.current) setError(message);
      showToast({ title: "No se pudo completar la acción", description: message, tone: "error" });
    } finally {
      locked.current = false;
      inFlight.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  const closeConfirmation = () => { if (!locked.current) setConfirmation(null); };
  return <section aria-label="Detecciones pendientes del espacio" className="pt-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-xl font-semibold text-ink">Por confirmar</h2>
      <div className="flex gap-4">
        <button className="text-sm text-storm hover:text-ink disabled:opacity-40" disabled={busy || !pending.data?.length} onClick={() => { if (!locked.current) setConfirmation([...(pending.data ?? [])]); }} type="button">Omitir todos</button>
        <button className="text-sm text-storm hover:text-ink disabled:opacity-40" disabled={busy || pending.isFetching} onClick={() => void pending.refetch()} type="button">Actualizar</button>
      </div>
    </div>
    <p className="mt-2 text-sm text-storm">El estado de las detecciones es independiente de si leíste el aviso. Ninguna se registra al abrir esta lista.</p>
    {error ? <p role="alert" className="mt-3 text-sm text-storm">{error}</p> : null}
    {busy ? <p role="status" className="mt-3 text-sm text-storm">Actualizando detecciones...</p> : null}
    {pending.isPending ? <p className="py-8 text-sm text-storm">Consultando detecciones...</p> : pending.isError ? <div className="space-y-3 py-8"><p role="alert" className="text-sm text-storm">{getQueryErrorMessage(pending.error, "No se pudo cargar la lista.")}</p><Button onClick={() => void pending.refetch()} variant="secondary">Reintentar</Button></div> : pending.data?.length ? <ul className="mt-5 divide-y divide-white/10 border-y border-white/10">{pending.data.map((row) => <li className="flex items-center gap-4" key={row.id}><button className="flex min-h-16 min-w-0 flex-1 items-center justify-between gap-4 py-4 text-left hover:bg-white/[0.03] disabled:opacity-40" disabled={busy} onClick={() => onOpen(row.id)} type="button"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{row.description}</span><span className="mt-1 block text-xs text-storm">{row.appLabel} · {formatDateTime(row.occurredAt)}{row.status === "needs_review" ? " · Necesita revisión" : ""}</span></span><span className="shrink-0 text-sm tabular-nums text-ink">{formatCurrency(row.amount, row.currencyCode)} ›</span></button><button aria-label={`Omitir ${row.description}`} className="min-h-11 text-sm text-storm hover:text-ink disabled:opacity-40" disabled={busy} onClick={() => void run({ action: "omit", suggestions: [row], markNotificationsRead: true })} type="button">Omitir</button></li>)}</ul> : <p className="py-8 text-sm text-storm">No hay detecciones pendientes en este espacio.</p>}
    {confirmation ? <Modal labelledBy="omit-detections-title" onClose={closeConfirmation} size="sm" disableOutsideClose={busy}>
      <ModalHeader title="Omitir detecciones" titleId="omit-detections-title" onClose={busy ? undefined : closeConfirmation} />
      <ModalBody><p className="text-sm leading-6 text-storm">Se omitirán las {confirmation.length} detecciones de esta confirmación. Las que lleguen después no se incluirán. Tus avisos se conservan sin cambiar su lectura; no se crean movimientos ni cambian saldos.</p></ModalBody>
      <ModalFooter><Button disabled={busy} onClick={closeConfirmation} variant="secondary">Cancelar</Button><Button disabled={busy} onClick={() => void run({ action: "omit", suggestions: confirmation, markNotificationsRead: false })}>{busy ? "Omitiendo..." : "Omitir todos"}</Button></ModalFooter>
    </Modal> : null}
  </section>;
}
