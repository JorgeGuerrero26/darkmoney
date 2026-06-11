import { Check } from "lucide-react";
import { Link } from "react-router-dom";

import { getButtonClassName } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/status-badge";
import { freeFeatures, PRO_REGISTER_PATH, proFeatures } from "../lib/plans-data";

type PlanCardsProps = {
  compact?: boolean;
  highlightPro?: boolean;
};

export function PlanCards({ compact = false, highlightPro = false }: PlanCardsProps) {
  const freeList = compact ? freeFeatures.slice(0, 4) : freeFeatures;
  const proList = compact ? proFeatures.slice(0, 4) : proFeatures;

  return (
    <div className="grid w-full max-w-3xl gap-5 md:grid-cols-2">
      <article className="glass-panel-soft flex flex-col rounded-[32px] p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-storm">Plan</p>
          <h3 className="mt-2 font-display text-3xl font-semibold text-ink">Free</h3>
          <div className="mt-4 flex items-end gap-1.5">
            <span className="font-display text-5xl font-semibold leading-none text-ink">$0</span>
            <span className="mb-1 text-sm text-storm">/ para siempre</span>
          </div>
          <p className="mt-4 text-sm leading-7 text-storm">
            Para empezar a ordenar tus finanzas y construir historial desde el dia uno.
          </p>
        </div>

        <ul className="mt-8 flex flex-col gap-3.5">
          {freeList.map((feature) => (
            <li
              className="flex items-start gap-3"
              key={feature}
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-pine" />
              <span className="text-sm text-storm">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-10">
          <Link
            className={getButtonClassName({ className: "w-full", variant: "secondary" })}
            to="/auth/register"
          >
            Empezar gratis
          </Link>
        </div>
      </article>

      <article
        className={`relative flex flex-col overflow-hidden rounded-[32px] border border-pine/25 bg-[radial-gradient(circle_at_top_left,rgba(107,228,197,0.13),transparent_45%),linear-gradient(160deg,rgba(255,255,255,0.07),rgba(5,9,16,0.88)_65%)] p-8 ${
          highlightPro
            ? "border-pine/35 shadow-[0_0_60px_rgba(107,228,197,0.12)] lg:scale-[1.03]"
            : ""
        }`}
      >
        {highlightPro ? (
          <span className="absolute left-1/2 top-0 -translate-x-1/2 rounded-b-2xl border border-t-0 border-pine/30 bg-pine/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-pine">
            Recomendado
          </span>
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_45%)]" />
        <div className={`relative flex flex-1 flex-col ${highlightPro ? "pt-4" : ""}`}>
          <div>
            <div className="flex items-center gap-2.5">
              <p className="text-xs uppercase tracking-[0.22em] text-storm">Plan</p>
              <StatusBadge
                status="Popular"
                tone="success"
              />
            </div>
            <h3 className="mt-2 font-display text-3xl font-semibold text-ink">Pro</h3>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.2em] text-storm">Precio</p>
              <p className="mt-1.5 text-sm leading-6 text-storm">
                El importe exacto, moneda e impuestos se muestran en el checkout antes de
                confirmar.
              </p>
            </div>
            <p className="mt-4 text-sm leading-7 text-storm">
              Para quienes quieren analisis profundo, automatizacion y herramientas avanzadas.
            </p>
          </div>

          <ul className="mt-8 flex flex-col gap-3.5">
            {proList.map((feature) => (
              <li
                className="flex items-start gap-3"
                key={feature}
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-pine" />
                <span className="text-sm text-ink">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-10">
            <Link
              className={getButtonClassName({ className: "w-full" })}
              to={PRO_REGISTER_PATH}
            >
              Empezar con Pro
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
