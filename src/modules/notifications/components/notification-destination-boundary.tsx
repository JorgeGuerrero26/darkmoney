import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { useToast } from "../../../components/ui/toast-provider";
import { useNotificationDestination } from "../../../services/queries/notification-destination";
import { getQueryErrorMessage, useMarkNotificationReadMutation } from "../../../services/queries/workspace-data";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import type { Workspace } from "../../../types/domain";
import { notificationDestinationHref, notificationId } from "../lib/notification-navigation";

/** Do not mount resource pages (or their form/renewal effects) in the wrong space. */
export function NotificationDestinationBoundary({ children, userId, activeWorkspace, snapshotWorkspaceId, snapshotLoading, snapshotError, onRetrySnapshot }: {
  children: ReactNode; userId?: string; activeWorkspace: Workspace | null;
  snapshotWorkspaceId?: number; snapshotLoading: boolean; snapshotError: unknown; onRetrySnapshot: () => void;
}) {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const rawId = params.get("noticeId");
  const noticeId = notificationId(rawId);
  const destination = useNotificationDestination(userId, noticeId);
  const read = useMarkNotificationReadMutation(userId);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const key = rawId == null ? "" : `${userId}:${rawId}:${location.pathname}`;
  const intent = useRef(key);
  intent.current = key;
  const alive = useRef(true);
  const opened = useRef("");
  const readAttempt = useRef("");
  const switching = useRef(false);
  const [switchError, setSwitchError] = useState<{ key: string; message: string } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (!key) { opened.current = ""; readAttempt.current = ""; } }, [key]);

  const target = destination.data;
  const currentSpaceMatches = !target?.workspace || activeWorkspace?.id === target.workspace.id;
  const needsSnapshot = target?.scope !== "global";
  const snapshotReady = !needsSnapshot || Boolean(activeWorkspace && snapshotWorkspaceId === activeWorkspace.id && !snapshotLoading && !snapshotError);
  const canonicalUrl = target ? new URL(target.href, "https://internal.invalid") : null;
  const currentTargetParams = [...params].filter(([name]) => name !== "noticeId").sort();
  const resourceParams = ["resource", "duplicateFrom", "movement", "detected", "day", "paymentRequest", "event", "notificationKind"];
  // Resource pages consume their opening params. A reload after closing should stay
  // in the verified space, not reopen the original modal or recreate a draft.
  const consumedResource = canonicalUrl && resourceParams.some((name) => canonicalUrl.searchParams.has(name)) &&
    !resourceParams.some((name) => params.has(name)) && currentTargetParams.every(([name, value]) => canonicalUrl.searchParams.get(name) === value);
  const initialRouteMatches = !canonicalUrl || (location.pathname === canonicalUrl.pathname &&
    (consumedResource || JSON.stringify(currentTargetParams) === JSON.stringify([...canonicalUrl.searchParams].sort())));
  const verified = rawId !== null && params.getAll("noticeId").length === 1 && Boolean(noticeId && userId && target && !destination.isError &&
    (!destination.isFetching || opened.current === key) && currentSpaceMatches && snapshotReady);
  const redirect = verified && opened.current !== key && !initialRouteMatches;
  const ready = verified && !redirect;

  useEffect(() => {
    if (redirect && target) navigate(notificationDestinationHref(target.href, target.id), { replace: true });
  }, [redirect, target, navigate]);
  useEffect(() => {
    if (!ready || !target) return;
    opened.current = key;
    if (!target.shouldMarkRead || readAttempt.current === key) return;
    readAttempt.current = key;
    void read.mutateAsync(target.id).catch(() => {
      if (alive.current && intent.current === key) showToast({ title: "El aviso se abrió", description: "No pudimos marcarlo como leído. Puedes volver a intentarlo en Avisos.", tone: "error" });
    });
  }, [ready, target, key, read, showToast]);

  async function confirmSpace() {
    if (switching.current || !target?.workspace || !userId) return;
    switching.current = true;
    const expectedKey = key;
    const expectedWorkspace = target.workspace.id;
    const originalSpace = useWorkspaceStore.getState().activeWorkspaceId;
    try {
      // Recheck membership/canonical scope after the user has seen the confirmation.
      const result = await destination.refetch();
      if (!alive.current || intent.current !== expectedKey) return;
      if (useWorkspaceStore.getState().activeWorkspaceId !== originalSpace) throw new Error("Cambiaste de espacio mientras comprobábamos el aviso. Vuelve a elegir.");
      if (result.isError || !result.data?.workspace) throw result.error ?? new Error("No se pudo confirmar el acceso.");
      if (result.data.workspace.id !== expectedWorkspace) throw new Error("El destino del aviso cambió. Revisa de nuevo el espacio.");
      const workspace = result.data.workspace;
      queryClient.setQueryData<Workspace[]>(["workspaces", userId], (current) => {
        const previous = current ?? [];
        return previous.some((row) => row.id === workspace.id)
          ? previous.map((row) => row.id === workspace.id ? workspace : row)
          : [...previous, workspace];
      });
      useWorkspaceStore.getState().setActiveWorkspaceId(workspace.id);
      setSwitchError(null);
    } catch (error) {
      if (alive.current && intent.current === expectedKey) setSwitchError({ key: expectedKey, message: getQueryErrorMessage(error, "No se pudo confirmar el acceso al espacio.") });
    } finally { switching.current = false; }
  }

  if (rawId === null) return children;
  const back = <Button onClick={() => navigate("/app/notifications", { replace: true })} variant="ghost">Volver a Avisos</Button>;
  if (!noticeId || params.getAll("noticeId").length !== 1 || !userId) return <DataState title="Aviso no válido" description="No se puede abrir este enlace con la sesión actual." action={back} tone="error" />;
  if (destination.isError) return <DataState title="No se pudo abrir el aviso" description={getQueryErrorMessage(destination.error, "No se pudo comprobar el destino.")} action={<div className="flex flex-wrap gap-2"><Button onClick={() => { void destination.refetch(); }}>Reintentar</Button>{back}</div>} tone="error" />;
  if (destination.isPending || (destination.isFetching && opened.current !== key) || !target || redirect) return <DataState title="Comprobando el aviso" description="Consultando su destino y tus permisos. No se han abierto datos de otro espacio." action={back} />;
  if (!currentSpaceMatches && target.workspace) return <DataState title={`Este aviso pertenece a ${target.workspace.name}`} description={switchError?.key === key ? switchError.message : "Para abrirlo, cambia al espacio del aviso. No se guardarán movimientos ni se resolverán solicitudes al cambiar."} action={<div className="flex flex-wrap gap-2"><Button onClick={() => { void confirmSpace(); }}>Cambiar a {target.workspace.name}</Button>{back}</div>} tone={switchError?.key === key ? "error" : "neutral"} />;
  if (needsSnapshot && snapshotError) return <DataState title="No se pudo cargar el espacio del aviso" description="El destino no se abrirá con datos anteriores o de otro espacio." action={<div className="flex flex-wrap gap-2"><Button onClick={onRetrySnapshot}>Reintentar</Button>{back}</div>} tone="error" />;
  if (!snapshotReady) return <DataState title="Cargando el espacio del aviso" description="Esperando los datos del espacio correcto antes de abrir el registro." action={back} />;
  return children;
}
