import { useEffect, useState } from "react";

const PENDING_INVITE_STORAGE_KEY = "darkmoney.pending-invite";
const PENDING_INVITE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const PENDING_INVITE_EVENT_NAME = "darkmoney:pending-invite-change";

export type PendingInvite = {
  kind: "obligation" | "workspace";
  path: string;
  token: string;
  savedAt: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isSafePath(path: string) {
  return path.startsWith("/") && !path.startsWith("//");
}

export function isInvitePath(path?: string | null) {
  if (typeof path !== "string" || !isSafePath(path)) {
    return false;
  }

  return path.startsWith("/share/obligations/") || path.startsWith("/share/workspaces/");
}

function notifyPendingInviteChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(PENDING_INVITE_EVENT_NAME));
}

export function readPendingInvite() {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(PENDING_INVITE_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<PendingInvite>;

    if (
      (parsedValue.kind !== "obligation" && parsedValue.kind !== "workspace") ||
      typeof parsedValue.path !== "string" ||
      !isSafePath(parsedValue.path) ||
      typeof parsedValue.token !== "string" ||
      typeof parsedValue.savedAt !== "string"
    ) {
      window.localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
      return null;
    }

    const savedAt = new Date(parsedValue.savedAt);

    if (
      Number.isNaN(savedAt.getTime()) ||
      Date.now() - savedAt.getTime() > PENDING_INVITE_MAX_AGE_MS
    ) {
      window.localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
      return null;
    }

    return parsedValue as PendingInvite;
  } catch {
    window.localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
    return null;
  }
}

export function resolvePostAuthPath(nextPath?: string | null) {
  if (typeof nextPath === "string" && isSafePath(nextPath)) {
    return nextPath;
  }

  return "/app";
}

export function savePendingInvite(invite: Omit<PendingInvite, "savedAt">) {
  if (!canUseStorage() || !isSafePath(invite.path)) {
    return;
  }

  window.localStorage.setItem(
    PENDING_INVITE_STORAGE_KEY,
    JSON.stringify({
      ...invite,
      savedAt: new Date().toISOString(),
    } satisfies PendingInvite),
  );
  notifyPendingInviteChange();
}

export function clearPendingInvite() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
  notifyPendingInviteChange();
}

export function usePendingInvite() {
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(() => readPendingInvite());

  useEffect(() => {
    function syncPendingInvite() {
      setPendingInvite(readPendingInvite());
    }

    syncPendingInvite();

    window.addEventListener("storage", syncPendingInvite);
    window.addEventListener(PENDING_INVITE_EVENT_NAME, syncPendingInvite);

    return () => {
      window.removeEventListener("storage", syncPendingInvite);
      window.removeEventListener(PENDING_INVITE_EVENT_NAME, syncPendingInvite);
    };
  }, []);

  return pendingInvite;
}
