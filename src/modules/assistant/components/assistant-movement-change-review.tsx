import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { formatCurrency } from "../../../lib/formatting/money";
import { useAssistantMovementChangeMutation } from "../../../services/queries/workspace-data";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { useProFeatureAccess } from "../../shared/use-pro-feature-access";
import { movementChangeLines, type AssistantMovementChange } from "../lib/movement-change";

/**
 * Tarjeta para corregir o borrar un gasto/ingreso que propuso el Asistente (móvil: AssistantDraftCard
 * con Aplicar/Borrar). Nada se aplica sin el clic explícito; un resultado incierto no se reenvía.
 */
export function AssistantMovementChangeReview({ change, userId, workspaceId, onClose, onSaved, onUnconfirmed }: {
  change: AssistantMovementChange; userId: string; workspaceId: number;
  onClose: () => void; onSaved: (note: string) => void; onUnconfirmed: (note: string) => void;
}) {
  const auth = useAuth(), { activeWorkspace } = useActiveWorkspace(), access = useProFeatureAccess();
  const mutation = useAssistantMovementChangeMutation(workspaceId, userId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const sameScope = activeWorkspace?.id === workspaceId && auth.user?.id === userId && !activeWorkspace?.isArchived && access.canAccessProFeatures;
  const scope = useRef(sameScope); scope.current = sameScope;
  const isDelete = change.action === "delete";
  const kind = change.movementType === "expense" ? "gasto" : "ingreso";
  const Kind = kind[0].toUpperCase() + kind.slice(1);
  const money = (amount: number) => formatCurrency(amount, change.currency);
  const lines = movementChangeLines(change, money);

  async function confirm() {
    if (lock.current || !sameScope) return;
    lock.current = true; setSaving(true); setError("");
    let sent = false;
    try {
      sent = true;
      await mutation.mutateAsync({ change, workspaceId, isCurrent: () => alive.current && scope.current });
      if (alive.current) onSaved(isDelete ? `${Kind} #${change.movementId} borrado.` : `${Kind} #${change.movementId} corregido.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo aplicar.";
      const definite = Boolean(cause && typeof cause === "object" && "definite" in cause);
      const code = cause && typeof cause === "object" && "code" in cause ? String((cause as { code?: unknown }).code ?? "") : "";
      // Solo un rechazo explícito (lectura previa o SQL) deja editar; lo demás queda por comprobar y no se repite.
      if (sent && !definite && !/^(22|23|42)[A-Z0-9]{3}$/.test(code)) { if (alive.current) onUnconfirmed(`${message} No se reenviará: revisa el movimiento #${change.movementId}.`); return; }
      if (alive.current) setError(message);
    } finally {
      lock.current = false; if (alive.current) setSaving(false);
    }
  }

  return <Modal className="!max-w-[560px]" labelledBy="assistant-change-title" onClose={() => { if (!lock.current) onClose(); }} size="lg">
    <ResourceEditorHeader disabled={saving} onClose={onClose} title={isDelete ? `Borrar ${kind}` : `Corregir ${kind}`} titleId="assistant-change-title" />
    <ModalBody className="space-y-4">
      <p className="font-display text-3xl font-semibold tabular-nums text-ink">{money(change.after.amount ?? change.before.amount)}</p>
      <dl className="divide-y divide-white/[0.08] rounded-xl border border-white/[0.08] px-4">
        {lines.map((line, index) => <div className="flex min-h-11 items-center justify-between gap-4 py-2 text-sm" key={`${line.label}-${index}`}><dt className="text-storm">{line.label}</dt><dd className="text-right text-ink">{line.value}</dd></div>)}
      </dl>
      <p className="text-xs text-storm">{isDelete ? "Borrar no se puede deshacer." : "Solo cambia lo que se muestra; el resto del movimiento queda igual."} Antes de aplicar se comprueba que el movimiento siga como lo vio el Asistente.</p>
      {!sameScope ? <p className="text-sm text-storm" role="status">Vuelve al espacio de esta conversación para aplicarlo.</p> : null}
      {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button className={isDelete ? "!border-rose-400/40 !bg-rose-500/15 !text-rose-200 hover:!bg-rose-500/25" : ""} disabled={saving || !sameScope} onClick={() => void confirm()} variant={isDelete ? "secondary" : "primary"}>{saving ? (isDelete ? "Borrando…" : "Aplicando…") : isDelete ? "Borrar" : "Aplicar"}</Button>
        <Button disabled={saving} onClick={onClose} variant="ghost">Cancelar</Button>
        {!isDelete ? <Link className="text-sm text-storm underline underline-offset-4" to={`/app/movements?period=all&movement=${change.movementId}`}>Ver movimiento</Link> : null}
      </div>
    </ModalBody>
  </Modal>;
}
