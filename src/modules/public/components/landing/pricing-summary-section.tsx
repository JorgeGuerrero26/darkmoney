import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { PlanCards } from "../plan-cards";
import { Reveal } from "../reveal";
import { SectionHeading } from "../section-heading";

export function PricingSummarySection() {
  return (
    <section>
      <Reveal>
        <SectionHeading
          description="Sin cargos ocultos. El plan Free es gratuito para siempre y Pro se cancela cuando quieras."
          eyebrow="Planes"
          title="Empieza gratis, crece a Pro"
        />
      </Reveal>

      <Reveal className="mt-12 flex justify-center">
        <PlanCards compact />
      </Reveal>

      <div className="mt-8 flex justify-center">
        <Link
          className="group inline-flex items-center gap-2 text-sm font-semibold text-pine transition hover:text-ink"
          to="/pricing"
        >
          Ver comparativa completa
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
