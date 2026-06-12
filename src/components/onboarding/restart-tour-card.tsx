import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "../ui/button";
import { SurfaceCard } from "../ui/surface-card";
import { restartOnboardingTour } from "./use-onboarding-tour";

export function RestartTourCard() {
  const navigate = useNavigate();

  return (
    <SurfaceCard
      action={<Sparkles className="h-5 w-5 text-pine" />}
      description="Vuelve a recorrer la guía interactiva: cuentas, movimientos, categorías, contactos y dashboard."
      title="Tutorial interactivo"
    >
      <Button
        onClick={() => {
          restartOnboardingTour();
          navigate("/app");
        }}
        variant="secondary"
      >
        Ver tutorial de nuevo
      </Button>
    </SurfaceCard>
  );
}
