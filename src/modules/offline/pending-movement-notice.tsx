import { useState } from "react";
import { Modal } from "../../components/ui/modal";
import { ModalBody } from "../../components/ui/modal-body";
import { ResourceEditorHeader } from "../../components/ui/resource-editor";
import { useOfflineMovementQueue } from "./use-offline-movement-queue";

/** Shows only locally persisted records from the active user and workspace. */
export function PendingMovementNotice() {
  const { userId, workspaceId, query, retry, sync } = useOfflineMovementQueue({ autoSync: true });
  const [open, setOpen] = useState(false), [message, setMessage] = useState("");
  const rows = query.data ?? [], pending = rows.filter(row => row.state === "pending").length, review = rows.filter(row => row.state === "needs_review").length;
  if (!userId || !workspaceId) return null;
  if (query.isError) return <p role="status" className="mt-3 text-sm text-storm">No se pudo comprobar el almacenamiento de cambios sin conexión.</p>;
  if (!rows.length) return null;
  const busy = sync.isPending || retry.isPending;
  async function send() {
    setMessage("");
    try {
      const result = await sync.mutateAsync();
      setMessage(!result.locked ? "Otra pestaña está enviando o este navegador no admite el bloqueo necesario." : result.interrupted ? "El envío se interrumpió. Los cambios pendientes se conservan." : result.needsReview ? `${result.needsReview} ${result.needsReview === 1 ? "cambio necesita" : "cambios necesitan"} revisión.` : `${result.sent} ${result.sent === 1 ? "cambio enviado" : "cambios enviados"}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron enviar los cambios."); }
  }
  return <>
    <button type="button" className={`mt-3 rounded-lg border px-3 py-2 text-left text-sm ${review ? "border-rosewood/25 bg-rosewood/10 text-rosewood" : "border-gold/25 bg-gold/10 text-gold"}`} onClick={() => { setMessage(""); setOpen(true); }}>
      {sync.isPending ? "Enviando cambios…" : review ? `${review} ${review === 1 ? "cambio necesita" : "cambios necesitan"} revisión` : `${pending} ${pending === 1 ? "movimiento por enviar" : "movimientos por enviar"}`} ›
    </button>
    {open ? <Modal presentation="side" labelledBy="pending-movements-title" onClose={() => setOpen(false)}><ResourceEditorHeader title="Cambios por enviar" titleId="pending-movements-title" onClose={() => setOpen(false)} /><ModalBody>
      <p className="text-sm text-storm">Guardados en este navegador para este usuario y espacio. No se incluyen detecciones.</p>
      <div className="mt-4 divide-y divide-white/[0.07]">{rows.map(row => <div className="py-4" key={row.dedupeKey}><p className="font-medium text-ink">{row.input.description}</p><p className="mt-1 text-xs text-storm">{row.state === "needs_review" ? "Necesita revisión" : "Por enviar"} · {new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(new Date(row.createdAt))}</p>{row.error ? <p className="mt-2 text-sm text-storm">{row.error}</p> : null}{row.state === "needs_review" ? <button type="button" disabled={busy} className="mt-2 text-sm text-ink underline disabled:opacity-50" onClick={() => void retry.mutateAsync(row).then(() => setMessage("El cambio está listo para intentar enviarse."), error => setMessage(error instanceof Error ? error.message : "No se pudo preparar el reintento."))}>Preparar reintento</button> : null}</div>)}</div>
      {message ? <p role="status" className="mt-4 text-sm text-storm">{message}</p> : null}
      <button type="button" disabled={busy || pending === 0} className="mt-5 min-h-11 rounded-lg border border-white/15 px-4 text-sm font-semibold text-ink disabled:opacity-50" onClick={() => void send()}>{sync.isPending ? "Enviando…" : "Intentar enviar ahora"}</button>
    </ModalBody></Modal> : null}
  </>;
}
