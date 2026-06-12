import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { onboardingSteps } from "./onboarding-steps";
import type { TourCounts } from "./onboarding-steps";

type OnboardingTourProps = {
  step: number;
  counts: TourCounts;
  onNavigate: (route: string) => void;
  onSetStep: (step: number) => void;
  onDismiss: () => void;
  onComplete: () => void;
};

/**
 * Tour interactivo. Anti-bug por diseño:
 * - El card vive anclado abajo (nunca cubre el centro de la pantalla).
 * - El spotlight es un único div con pointer-events-none cuyo "oscurecido" es la
 *   sombra del recorte: el elemento destacado queda 100% clickeable.
 */
export function OnboardingTour({
  step,
  counts,
  onNavigate,
  onSetStep,
  onDismiss,
  onComplete,
}: OnboardingTourProps) {
  const currentStep = onboardingSteps[Math.min(step, onboardingSteps.length - 1)];
  const isLastStep = step >= onboardingSteps.length - 1;
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const baselineRef = useRef<TourCounts>(counts);
  const lastStepRef = useRef(-1);

  // Línea base de conteos al entrar a cada paso (para el avance reactivo).
  if (lastStepRef.current !== step) {
    lastStepRef.current = step;
    baselineRef.current = counts;
  }

  // Navegación automática al entrar al paso.
  useEffect(() => {
    if (currentStep.route) {
      onNavigate(currentStep.route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep.id]);

  // Avance reactivo: el paso se completa cuando el usuario crea el dato real.
  useEffect(() => {
    if (currentStep.advanceWhen && currentStep.advanceWhen(counts, baselineRef.current)) {
      goNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, currentStep.id]);

  // Medición continua del target (soporta rutas lazy, scroll y resize).
  useEffect(() => {
    if (!currentStep.target) {
      setTargetRect(null);
      return;
    }

    let frame = 0;

    function measure() {
      const element = document.querySelector(`[data-tour="${currentStep.target}"]`);
      setTargetRect(element ? element.getBoundingClientRect() : null);
      frame = requestAnimationFrame(measure);
    }

    measure();
    return () => cancelAnimationFrame(frame);
  }, [currentStep.target]);

  // Si el target existe pero está fuera de pantalla, acercarlo (sin centrarlo
  // detrás de nada: el card vive abajo a la derecha).
  useEffect(() => {
    if (!currentStep.target) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const element = document.querySelector(`[data-tour="${currentStep.target}"]`);
      element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [currentStep.id, currentStep.target]);

  function goNext() {
    if (isLastStep) {
      onComplete();
      return;
    }

    onSetStep(step + 1);
  }

  return (
    <>
      {targetRect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[94] rounded-2xl border-2 border-pine/70 shadow-[0_0_0_9999px_rgba(5,7,11,0.55)] transition-all duration-300"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      ) : null}

      <div className="glass-panel-strong animate-rise-in fixed inset-x-3 bottom-3 z-[95] rounded-[24px] bg-shell/95 p-5 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[22rem]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-pine/80">
            Tutorial · {Math.min(step + 1, onboardingSteps.length)}/{onboardingSteps.length}
          </p>
          <button
            aria-label="Saltar tutorial"
            className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-storm/60 transition hover:bg-white/[0.06] hover:text-ink"
            onClick={onDismiss}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <h3 className="mt-2 font-display text-lg font-semibold tracking-[-0.02em] text-ink">
          {currentStep.title}
        </h3>
        <p className="mt-1.5 text-sm leading-6 text-storm">{currentStep.description}</p>

        {currentStep.advanceWhen ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-pine">
            <span className="inline-flex h-2 w-2 animate-soft-pulse rounded-full bg-pine" />
            Esperando tu primera acción — el tour avanza solo.
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            className="text-xs text-storm/60 transition hover:text-storm"
            onClick={onDismiss}
            type="button"
          >
            Saltar tour
          </button>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-storm transition hover:text-ink"
                onClick={() => onSetStep(step - 1)}
                type="button"
              >
                Atrás
              </button>
            ) : null}
            <button
              className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-void transition hover:brightness-105"
              onClick={goNext}
              type="button"
            >
              {currentStep.ctaLabel ?? "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
