import { useEffect, useRef } from "react";
import type { Workspace } from "../../types/domain";

export function canWriteWorkspaceCatalog(workspace: Workspace | null, userId: string | undefined, ready: boolean) {
  return Boolean(userId && workspace && ready && !workspace.isArchived && ["owner", "admin", "member"].includes(workspace.role));
}

/** UI intent boundary, not a replacement for server RLS. Lost access invalidates old callbacks even after A → B → A. */
export function useCatalogWriteScope(workspace: Workspace | null, userId: string | undefined, ready: boolean) {
  const writable = canWriteWorkspaceCatalog(workspace, userId, ready);
  const key = JSON.stringify([userId, workspace?.id, writable]);
  const current = useRef({ key, token: {} });
  if (current.current.key !== key) current.current = { key, token: {} };
  const token = current.current.token;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isCurrent = () => mounted.current && writable && current.current.token === token;
  return { writable, isCurrent, assertCurrent: () => {
    if (!isCurrent()) throw new Error("Los datos o permisos cambiaron. Revisa el espacio antes de guardar.");
  } };
}
