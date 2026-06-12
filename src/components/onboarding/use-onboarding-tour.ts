import { useCallback, useEffect, useState } from "react";

const TOUR_STORAGE_KEY = "darkmoney.onboarding-tour.v2";
const LEGACY_COACH_KEY = "darkmoney.onboarding-coach.v1";

type TourStatus = "pending" | "active" | "completed" | "dismissed";

type StoredTourState = {
  status: TourStatus;
  step: number;
};

function readStoredTourState(): StoredTourState | null {
  try {
    const rawValue = window.localStorage.getItem(TOUR_STORAGE_KEY);

    if (!rawValue) {
      // Migración: si el coach viejo existió, no molestar a usuarios antiguos.
      if (window.localStorage.getItem(LEGACY_COACH_KEY)) {
        const migrated: StoredTourState = { status: "completed", step: 0 };
        window.localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }

      return null;
    }

    const parsed = JSON.parse(rawValue) as StoredTourState;
    return typeof parsed?.status === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredTourState(state: StoredTourState) {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

const TOUR_SYNC_EVENT = "darkmoney:onboarding-tour";

/** Relanza el tour desde cualquier parte (Configuración, command palette). */
export function restartOnboardingTour() {
  writeStoredTourState({ status: "active", step: 0 });
  window.dispatchEvent(new Event(TOUR_SYNC_EVENT));
}

export function useOnboardingTour({ isWorkspaceEmpty }: { isWorkspaceEmpty: boolean | null }) {
  const [stored, setStored] = useState<StoredTourState | null>(() => readStoredTourState());

  // Sincroniza instancias del hook cuando el tour se relanza desde otro componente.
  useEffect(() => {
    function handleSync() {
      setStored(readStoredTourState());
    }

    window.addEventListener(TOUR_SYNC_EVENT, handleSync);
    return () => window.removeEventListener(TOUR_SYNC_EVENT, handleSync);
  }, []);

  // Auto-arranque: solo workspaces vacíos sin estado previo.
  useEffect(() => {
    if (stored === null && isWorkspaceEmpty === true) {
      const next: StoredTourState = { status: "active", step: 0 };
      writeStoredTourState(next);
      setStored(next);
    }
  }, [isWorkspaceEmpty, stored]);

  const update = useCallback((next: StoredTourState) => {
    writeStoredTourState(next);
    setStored(next);
  }, []);

  const start = useCallback(() => restartOnboardingTour(), []);
  const dismiss = useCallback(
    () => update({ status: "dismissed", step: stored?.step ?? 0 }),
    [stored?.step, update],
  );
  const complete = useCallback(() => update({ status: "completed", step: 0 }), [update]);
  const setStep = useCallback(
    (step: number) => update({ status: "active", step }),
    [update],
  );

  return {
    isActive: stored?.status === "active",
    step: stored?.status === "active" ? stored.step : 0,
    start,
    dismiss,
    complete,
    setStep,
  };
}
