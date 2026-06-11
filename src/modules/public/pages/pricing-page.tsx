import { Check, Clock, Minus, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";

import { getButtonClassName } from "../../../components/ui/button";
import { usePageMeta } from "../../../hooks/use-page-meta";
import { PUBLIC_CONTACT } from "../../../lib/public-contact";
import { FaqList } from "../components/faq-list";
import { PlanCards } from "../components/plan-cards";
import { Reveal } from "../components/reveal";
import { SectionHeading } from "../components/section-heading";
import { faqs, planComparison } from "../lib/plans-data";

const guarantees = [
  {
    icon: Shield,
    title: "Sin cargos ocultos",
    description: "El precio exacto se muestra antes de confirmar.",
    chipClassName: "bg-pine/10",
    iconClassName: "text-pine",
  },
  {
    icon: Zap,
    title: "Cancelacion libre",
    description: "Cancela cuando quieras desde tu cuenta.",
    chipClassName: "bg-ember/10",
    iconClassName: "text-ember",
  },
  {
    icon: Clock,
    title: "Acceso completo",
    description: "Mantenes Pro hasta el fin del periodo pagado.",
    chipClassName: "bg-gold/10",
    iconClassName: "text-gold",
  },
];

function ComparisonMark({ included }: { included: boolean }) {
  return included ? (
    <Check className="mx-auto h-4 w-4 text-pine" />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-storm/40" />
  );
}

export function PricingPage() {
  usePageMeta({
    title: "Planes y precios",
    description:
      "Planes de DarkMoney: Free gratuito para siempre, o Pro con dashboard avanzado, alertas inteligentes y herramientas premium. Sin cargos ocultos.",
  });

  return (
    <div className="flex flex-col items-center gap-20 pb-10 sm:gap-24">
      <section className="animate-rise-in flex max-w-2xl flex-col items-center gap-5 pt-4 text-center">
        <span className="rounded-full border border-pine/25 bg-pine/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-pine">
          Planes
        </span>
        <h1 className="text-balance font-display text-5xl font-semibold leading-[1.1] tracking-[-0.04em] text-ink sm:text-6xl">
          Simple, transparente,
          <br />
          <span className="text-gradient-pine">sin sorpresas</span>
        </h1>
        <p className="text-balance max-w-lg text-base leading-8 text-storm">
          Empieza gratis y pasa a Pro cuando quieras mas visibilidad, automatizacion y
          herramientas avanzadas sobre tus finanzas.
        </p>
      </section>

      <Reveal className="flex w-full justify-center pt-2">
        <PlanCards highlightPro />
      </Reveal>

      <section className="hidden w-full max-w-3xl md:block">
        <Reveal>
          <SectionHeading
            eyebrow="Comparativa"
            title="Free vs Pro en detalle"
          />
          <div className="glass-panel-soft mt-10 overflow-hidden rounded-[28px]">
            <div className="grid grid-cols-[1fr_120px_120px] border-b border-white/[0.08] bg-white/[0.03] px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-storm">
                Funcionalidad
              </p>
              <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-storm">
                Free
              </p>
              <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-pine">
                Pro
              </p>
            </div>
            {planComparison.map((row, index) => (
              <div
                className={`grid grid-cols-[1fr_120px_120px] items-center px-6 py-3.5 ${
                  index !== planComparison.length - 1 ? "border-b border-white/[0.05]" : ""
                }`}
                key={row.label}
              >
                <p className="text-sm text-storm">{row.label}</p>
                <ComparisonMark included={row.free} />
                <ComparisonMark included={row.pro} />
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="w-full max-w-3xl">
        <Reveal>
          <h2 className="mb-6 text-center font-display text-sm font-semibold uppercase tracking-[0.2em] text-storm">
            Lo que garantizamos
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {guarantees.map((item) => (
              <div
                className="glass-panel-soft flex items-start gap-4 rounded-[24px] p-5"
                key={item.title}
              >
                <div className={`rounded-[14px] p-2.5 ${item.chipClassName}`}>
                  <item.icon className={`h-5 w-5 ${item.iconClassName}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-storm">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="w-full max-w-2xl">
        <Reveal>
          <SectionHeading title="Preguntas frecuentes" />
        </Reveal>
        <Reveal className="mt-8">
          <FaqList items={faqs} />
        </Reveal>
      </section>

      <section className="w-full max-w-3xl">
        <Reveal>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-storm/70">
            <span>Mas informacion:</span>
            <Link
              className="transition hover:text-ink"
              to="/terms"
            >
              Terminos
            </Link>
            <Link
              className="transition hover:text-ink"
              to="/privacy"
            >
              Privacidad
            </Link>
            <Link
              className="transition hover:text-ink"
              to="/refunds"
            >
              Devoluciones
            </Link>
            <Link
              className="transition hover:text-ink"
              to={PUBLIC_CONTACT.claimsBookPath}
            >
              Libro de reclamaciones
            </Link>
          </div>
        </Reveal>
      </section>

      <Reveal>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            className={getButtonClassName({ className: "px-6" })}
            to="/auth/register"
          >
            Crear cuenta gratis
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
