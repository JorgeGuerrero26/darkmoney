import { useRef } from "react";
import { onlineManager, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/auth-context";
import { useWorkspaceStore } from "../../stores/workspace-store";
import { supabase } from "../../services/supabase/client";
import { useCreateMovementMutation } from "../../services/queries/workspace-data";
import { enqueueMovement, listQueuedMovements, retryReviewedMovement, type QueuedMovement, type QueuedMovementInput } from "../../lib/offline/movement-queue";
import { QueueInterruptionError, syncLocalMovementQueue, type QueueScope } from "../../lib/offline/movement-queue-sync";

export function useOfflineMovementQueue() {
  const { user } = useAuth();
  const workspaceId = useWorkspaceStore(state => state.activeWorkspaceId);
  const userId = user?.id;
  const current = useRef({ userId, workspaceId }); current.current = { userId, workspaceId };
  const queryClient = useQueryClient();
  const key = ["offline-movement-queue", userId, workspaceId] as const;
  const query = useQuery({ queryKey: key, enabled: Boolean(userId && workspaceId), networkMode: "always", refetchInterval: 5000,
    queryFn: () => listQueuedMovements(userId!, workspaceId!) });
  const create = useCreateMovementMutation(workspaceId ?? undefined, userId, { networkMode: "always" });
  const active = (scope: QueueScope) => current.current.userId === scope.userId && current.current.workspaceId === scope.workspaceId;
  const online = () => onlineManager.isOnline() && (typeof navigator === "undefined" || navigator.onLine !== false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const enqueue = useMutation({ networkMode: "always", mutationFn: async (input: QueuedMovementInput) => {
    if (!active(input)) throw new Error("Cambió el espacio. Revisa el movimiento antes de guardarlo.");
    return enqueueMovement(input);
  }, onSuccess: refresh });
  const retry = useMutation({ networkMode: "always", mutationFn: async (row: QueuedMovement) => {
    if (!active(row)) throw new Error("Vuelve al espacio donde guardaste el cambio.");
    if (!await retryReviewedMovement(row)) throw new Error("El cambio ya se modificó. Actualiza la lista.");
  }, onSuccess: refresh });
  const sync = useMutation({ networkMode: "always", mutationFn: async () => {
    const client = supabase;
    if (!userId || !workspaceId || !client || !online()) throw new Error("Necesitas conexión y una sesión activa para enviar los cambios.");
    const scope = { userId, workspaceId };
    return syncLocalMovementQueue(scope, async input => {
      let session;
      try { session = await client.auth.getSession(); }
      catch { throw new QueueInterruptionError("No se pudo verificar la sesión. Vuelve a intentarlo."); }
      if (session.error || session.data.session?.user.id !== scope.userId || !active(scope)) throw new QueueInterruptionError("La sesión cambió; vuelve a abrir el espacio antes de enviar.");
      return create.mutateAsync(input);
    }, active, online);
  }, onSettled: refresh });
  return { userId, workspaceId, query, enqueue, retry, sync };
}
