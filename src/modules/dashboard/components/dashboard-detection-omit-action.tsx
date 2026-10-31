import { useEffect, useRef, useState } from "react";
import { useToast } from "../../../components/ui/toast-provider";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import type { useDetectedMovements } from "../../../services/queries/detected-movements";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import type { DetectedMovement } from "../../notifications/lib/detected-movement";

export function DashboardDetectionOmitAction({ suggestion, workspaceId, omissions, disabled, onBusyChange }: {
  suggestion: DetectedMovement; workspaceId: number; omissions: ReturnType<typeof useDetectedMovements>["omissions"];
  disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const [error, setError] = useState("");
  const locked = useRef(false), mounted = useRef(true);
  const { showToast } = useToast(); const { schedule } = useUndoQueue();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function omit() {
    if (locked.current || disabled) return;
    if (useWorkspaceStore.getState().activeWorkspaceId !== workspaceId) { setError("Cambió el espacio. Abre de nuevo la detección."); return; }
    locked.current = true; onBusyChange(true); setError("");
    try {
      const result = await omissions.mutateAsync({ action: "omit", suggestions: [suggestion], markNotificationsRead: true });
      if (!result.changes.length) { if (mounted.current) setError("La detección cambió o no se pudo actualizar. Revisa la bandeja antes de reintentar."); return; }
      schedule({ label: "Detección omitida", duration: 3000, onCommit: () => {}, onUndo: async () => {
        if (useWorkspaceStore.getState().activeWorkspaceId !== workspaceId) { showToast({ title: "No se deshizo la omisión", description: "Vuelve al espacio donde omitiste la detección.", tone: "info" }); return; }
        const restored = await omissions.mutateAsync({ action: "restore", changes: result.changes });
        showToast({ title: restored.changes.length ? "Detección recuperada" : "La detección ya cambió", description: restored.failed ? "No se pudo comprobar la recuperación." : "El estado de lectura del aviso no cambia.", tone: restored.failed ? "error" : "info" });
      } });
      if (!result.readingUpdated) showToast({ title: "Detección omitida", description: "La omisión se guardó, pero el aviso sigue sin leer.", tone: "info" });
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "No se pudo omitir. Reintenta."); }
    finally { locked.current = false; onBusyChange(false); }
  }
  return <div>{error ? <p role="alert" className="mt-3 text-sm text-storm">{error}</p> : null}<button type="button" disabled={disabled} onClick={() => void omit()} className="min-h-11 text-sm text-storm underline underline-offset-4 disabled:opacity-50">{error ? "Reintentar omisión" : "Omitir"}</button></div>;
}
