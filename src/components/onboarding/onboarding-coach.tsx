import { Sparkles, ArrowRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { Workspace } from "../../types/domain";
import type { WorkspaceSnapshot } from "../../services/queries/workspace-data";
import { Button } from "../ui/button";

const TUTORIAL_STORAGE_KEY = "darkmoney.onboarding-coach.v1";

type Step = {
  key: "accounts" | "categories" | "movements" | "workspace";
  title: string;
  description: string;
  route: string;
  ctaLabel: string;
  focusButtonId?: string;
};

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function OnboardingCoach({
  activeWorkspace,
  snapshot,
  isSnapshotLoading,
  refetchSnapshot,
  isDisabled,
}: {
  activeWorkspace: Workspace | null;
  snapshot: WorkspaceSnapshot | null | undefined;
  isSnapshotLoading: boolean;
  refetchSnapshot?: () => Promise<unknown> | void;
  isDisabled?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (!isBrowser()) return false;
    return Boolean(window.localStorage.getItem(TUTORIAL_STORAGE_KEY));
  });

  const [isAdvancing, setIsAdvancing] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [highlight, setHighlight] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    borderRadius: number;
  } | null>(null);

  useEffect(() => {
    if (!isBrowser()) return;
    setIsDismissed(Boolean(window.localStorage.getItem(TUTORIAL_STORAGE_KEY)));
  }, []);

  const steps = useMemo(() => {
    const hasWorkspace = Boolean(activeWorkspace);
    const hasAccounts = Boolean(snapshot?.accounts?.some((a) => !a.isArchived));
    const hasCategories = Boolean(snapshot?.catalogs?.categoriesCount);
    const hasMovements = Boolean(snapshot?.movements?.length);

    const missing: Step[] = [];

    if (!hasWorkspace) {
      missing.push({
        key: "workspace",
        title: "Creemos tu primer workspace",
        description: "Antes de registrar finanzas, necesitamos un espacio activo donde todo quede ordenado.",
        route: "/app/settings",
        ctaLabel: "Ir a Configuración",
      });
    }

    if (!hasAccounts) {
      missing.push({
        key: "accounts",
        title: "Tu primera cuenta",
        description: "Las cuentas son la base para que los movimientos tengan origen y destino.",
        route: "/app/accounts",
        ctaLabel: "Ir a Cuentas",
        focusButtonId: "onboarding-coach-cta-create-account",
      });
    }

    if (!hasCategories) {
      missing.push({
        key: "categories",
        title: "Tu primera categoría",
        description: "Con categorías, el sistema entiende tus gastos e ingresos y los agrupa con sentido.",
        route: "/app/categories",
        ctaLabel: "Ir a Categorías",
        focusButtonId: "onboarding-coach-cta-create-category",
      });
    }

    if (!hasMovements) {
      missing.push({
        key: "movements",
        title: "Tu primer movimiento",
        description: "Registra un gasto/ingreso real. Con eso el dashboard empieza a leer patrones.",
        route: "/app/movements",
        ctaLabel: "Ir a Movimientos",
        focusButtonId: "onboarding-coach-cta-create-movement",
      });
    }

    return {
      missingSteps: missing,
      isComplete: missing.length === 0,
    };
  }, [activeWorkspace, snapshot]);

  useEffect(() => {
    if (isDismissed) return;
    if (isSnapshotLoading) return;
    if (!steps.isComplete) return;

    // Marcamos como completado para que no vuelva a mostrarse.
    if (!isBrowser()) return;
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "completed");
    setIsDismissed(true);
  }, [isDismissed, isSnapshotLoading, steps.isComplete]);

  const step = steps.missingSteps[0];
  const stepRoute = step?.route ?? "";
  const stepKey = step?.key ?? null;
  const isOnCorrectRoute = Boolean(step) && location.pathname === stepRoute;
  const shouldRender =
    !isDisabled && !isDismissed && !isSnapshotLoading && !steps.isComplete && Boolean(step) && !isPaused;

  useEffect(() => {
    if (!isPaused) return;
    const timerId = window.setTimeout(() => {
      setIsPaused(false);
    }, 12000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isPaused]);

  useEffect(() => {
    setValidationMessage("");
  }, [stepKey]);

  // Auto-progresión: si el paso actual cambia por actualización del snapshot,
  // navega automáticamente al nuevo módulo (para que el usuario no tenga que tocar "Listo").
  const lastStepKeyRef = useRef<Step["key"] | null>(null);
  const lastRoutedStepKeyRef = useRef<Step["key"] | null>(null);

  useEffect(() => {
    if (!isBrowser()) return;

    if (!shouldRender || !stepKey) return;

    // Si estamos en una ruta distinta al módulo del paso, primero llevamos al usuario ahí.
    if (lastRoutedStepKeyRef.current === stepKey) return;
    lastRoutedStepKeyRef.current = stepKey;

    if (location.pathname !== stepRoute) {
      navigate(stepRoute);
    }
  }, [shouldRender, stepKey, stepRoute, location.pathname, navigate]);

  useEffect(() => {
    if (!isBrowser()) return;

    if (steps.isComplete || !stepKey) return;

    if (lastStepKeyRef.current === null) {
      lastStepKeyRef.current = stepKey;
      return;
    }

    if (lastStepKeyRef.current === stepKey) return;

    lastStepKeyRef.current = stepKey;

    if (location.pathname !== stepRoute) {
      navigate(stepRoute);
    }
  }, [stepKey, stepRoute, steps.isComplete, location.pathname, navigate]);

  useEffect(() => {
    if (!isBrowser()) return;

    if (isDisabled) {
      setHighlight(null);
      return;
    }

    if (!step || !isOnCorrectRoute || !step.focusButtonId) {
      setHighlight(null);
      return;
    }

    const focusButtonId = step.focusButtonId;
    const el = document.getElementById(focusButtonId);
    if (!(el instanceof HTMLElement)) {
      setHighlight(null);
      return;
    }

    // Mantiene al usuario enfocado en el CTA del paso.
    el.scrollIntoView?.({ block: "center", behavior: "smooth" });
    el.focus?.();

    const rect = el.getBoundingClientRect();
    setHighlight({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      borderRadius: 16,
    });

    function onResize() {
      const nextEl = document.getElementById(focusButtonId);
      if (!(nextEl instanceof HTMLElement)) return;
      const nextRect = nextEl.getBoundingClientRect();
      setHighlight({
        left: nextRect.left,
        top: nextRect.top,
        width: nextRect.width,
        height: nextRect.height,
        borderRadius: 16,
      });
    }

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [isDisabled, isOnCorrectRoute, step?.focusButtonId, stepKey, stepRoute]);
  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-void/50 p-4 backdrop-blur-md pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial inicial"
    >
      {highlight ? (
        <div
          className="pointer-events-none fixed z-[101] border-2 border-pine/70 shadow-[0_0_0_6px_rgba(107,228,197,0.18)]"
          style={{
            left: highlight.left,
            top: highlight.top,
            width: highlight.width,
            height: highlight.height,
            borderRadius: highlight.borderRadius,
          }}
        />
      ) : null}

      <div className="pointer-events-auto w-full max-w-xl rounded-[32px] border border-white/10 bg-shell/90 p-8 text-ink shadow-[0_40px_130px_rgba(0,0,0,0.65)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[24px] bg-gradient-to-br from-ember/30 via-[#8a9fff]/25 to-pine/25 border border-white/10">
              <Sparkles className="h-6 w-6 text-pine" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-storm/85">Tutorial inicial</p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">{step.title}</h2>
            </div>
          </div>

          <button
            aria-label="Omitir tutorial"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition hover:bg-white/[0.08] hover:text-ink"
            onClick={() => {
              if (!isBrowser()) return;
              window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "dismissed");
              setIsDismissed(true);
            }}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-7 text-storm">{step.description}</p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              setValidationMessage("");

              if (!isOnCorrectRoute) {
                navigate(step.route);
                return;
              }

              // Pausa temporal del coach para que puedas interactuar con
              // "Crear primera..." sin que el modal reaparezca de inmediato.
              setIsPaused(true);

              // En la ruta correcta, "Listo" fuerza una relectura para que el coach avance
              // cuando el usuario haya completado el paso.
              setIsAdvancing(true);
              Promise.resolve(refetchSnapshot?.())
                .catch(() => null)
                .finally(() => {
                  setIsAdvancing(false);
                  const stillSameStep = steps.missingSteps[0]?.key === stepKey;
                  if (stillSameStep) {
                    setValidationMessage(
                      "Aún falta completar este paso. Usa el botón 'Crear primera...' y luego vuelve a pulsar 'Listo, seguir'.",
                    );
                  }
                });
            }}
            disabled={isAdvancing}
          >
            {isOnCorrectRoute ? (isAdvancing ? "Actualizando..." : "Listo, seguir") : step.ctaLabel}
            {!isOnCorrectRoute ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
          </Button>
          <Button
            onClick={() => {
              if (!isBrowser()) return;
              window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "dismissed");
              setIsDismissed(true);
            }}
            variant="ghost"
          >
            Omitir
          </Button>
        </div>

        {validationMessage ? (
          <p className="mt-4 text-xs leading-6 text-ember">{validationMessage}</p>
        ) : null}

        <p className="mt-5 text-xs leading-6 text-storm/80">
          Tip: en la pantalla que te abrimos vas a ver un botón que dice “Crear primera…”. Usalo para completar este paso.
        </p>
      </div>
    </div>
  );
}

