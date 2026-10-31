import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../../components/ui/toast-provider";
import { createDetectedDuplicateChecker } from "../../../services/queries/detection-duplicates";
import { useCreateMovementMutation, type WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import { supabase } from "../../../services/supabase/client";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import { prepareDetectionQuickSave, savePreparedDetection } from "../../notifications/lib/detection-quick-save";
import type { DetectedMovement, DetectionSetting } from "../../notifications/lib/detected-movement";
import type { createDetectedMovementStore } from "../../../services/queries/detected-movement-store";

export function DashboardDetectionQuickAction({ suggestion, snapshot, userId, settings, store, enabled, proAccessEnabled, onSaved, invalidateFinances, disabled, onBusyChange }: {
  suggestion: DetectedMovement; snapshot: WorkspaceSnapshot; userId: string; settings: DetectionSetting[];
  store: ReturnType<typeof createDetectedMovementStore> | null; enabled: boolean; proAccessEnabled: boolean;
  onSaved: (id: number) => void; invalidateFinances: () => Promise<void>; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const create = useCreateMovementMutation(snapshot.workspace.id, userId);
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const locked = useRef(false), controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, [suggestion.id, userId, snapshot.workspace.id]);
  const checker = useMemo(() => supabase ? createDetectedDuplicateChecker(supabase, { userId, workspaceId: snapshot.workspace.id }) : null, [userId, snapshot.workspace.id]);
  const input = enabled ? prepareDetectionQuickSave(suggestion, snapshot.accounts, snapshot.catalogs.categories, settings, userId, snapshot.workspace.id) : null;
  if (!input || !store || !checker) return null;
  const accountId = input.movementType === "income" ? input.destinationAccountId : input.sourceAccountId;
  const accountName = snapshot.accounts.find(account => account.id === accountId)?.name;
  const categoryName = snapshot.catalogs.categories.find(category => category.id === input.categoryId)?.name;
  async function save() {
    if (locked.current || disabled || !store || !checker || !input) return;
    locked.current = true; onBusyChange?.(true); setBusy(true); setError("");
    const abort = new AbortController(); controller.current = abort;
    try {
      const result = await savePreparedDetection(suggestion, input, snapshot.accounts, snapshot.catalogs.categories, settings, {
        store, checker, signal: abort.signal, proAccessEnabled,
        create: value => {
          if (abort.signal.aborted || useWorkspaceStore.getState().activeWorkspaceId !== snapshot.workspace.id) throw new Error("Cambió el espacio. Abre de nuevo la detección antes de guardar.");
          return create.mutateAsync(value);
        },
      });
      if (!abort.signal.aborted) {
        onSaved(suggestion.id);
        showToast({ title: "Movimiento guardado", description: result.readingUpdated ? "La detección se registró." : "El movimiento se guardó; el aviso sigue sin leer.", tone: "success", duration: 3000 });
      }
      void invalidateFinances();
    } catch (reason) {
      if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : "No se pudo guardar. Reintenta o abre la revisión.");
      void invalidateFinances();
    } finally { if (controller.current === abort) controller.current = null; locked.current = false; onBusyChange?.(false); if (!abort.signal.aborted) setBusy(false); }
  }
  return <div className="mt-4 border-t border-white/[0.07] pt-4"><div className="grid grid-cols-2 gap-4 text-sm"><p className="text-storm">Cuenta<span className="mt-1 block font-medium text-ink">{accountName}</span></p><p className="text-storm">Categoría<span className="mt-1 block font-medium text-ink">{categoryName}</span></p></div>{error ? <p role="alert" className="mt-3 text-sm text-storm">{error}</p> : null}<div className="mt-3 flex justify-end"><button type="button" disabled={busy || disabled} onClick={() => void save()} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-void disabled:opacity-50">{busy ? "Guardando…" : error ? "Reintentar" : "Guardar"}</button></div></div>;
}
