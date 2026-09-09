import { Link } from "react-router-dom";

import { usePageMeta } from "../../../hooks/use-page-meta";
import { PUBLIC_CONTACT } from "../../../lib/public-contact";
import { FaqList } from "../components/faq-list";
import { PlanCards } from "../components/plan-cards";
import { faqs, planComparison } from "../lib/plans-data";

const guarantees = [
  {
    title: "Precio claro",
    description: "S/ 19 al mes, con IGV incluido y sin cargos ocultos.",
  },
  {
    title: "Cancelación libre",
    description: "Cancela cuando quieras desde la configuración de tu cuenta.",
  },
  {
    title: "Acceso hasta el cierre",
    description: "Mantienes Pro hasta que termine el periodo que ya pagaste.",
  },
];

export function PricingPage() {
  usePageMeta({
    title: "Planes y precios",
    description:
      "Planes de DarkMoney: Free gratuito para siempre y Pro por S/ 19 al mes con IGV incluido.",
  });

  return (
    <div className="pb-4">
      <section className="grid gap-10 border-b border-[#f4f1ec]/[0.07] pb-14 pt-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-end lg:pb-16">
        <div>
          <span className="font-public-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#a39c90]">
            Planes
          </span>
          <h1 className="font-public-display mt-5 max-w-[11ch] text-[clamp(2.8rem,6vw,3.75rem)] font-semibold leading-[1.03] tracking-[-0.035em] text-[#f4f1ec]">
            Simple, transparente, sin sorpresas
          </h1>
          <p className="mt-5 max-w-[38ch] text-[15px] leading-[1.55] text-[#a39c90]">
            Empieza gratis y pasa a Pro cuando quieras más visibilidad, automatización y
            herramientas avanzadas.
          </p>
        </div>
        <PlanCards highlightPro />
      </section>

      <section className="border-b border-[#f4f1ec]/[0.07] py-14 lg:py-16">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <h2 className="font-public-display text-[34px] font-semibold leading-[1.1] tracking-[-0.028em] text-[#f4f1ec]">
            Free vs. Pro, sin letra pequeña
          </h2>
          <p className="max-w-[36ch] text-[14px] leading-[1.55] text-[#a39c90]">
            Lo esencial siempre está disponible. Pro añade análisis y automatización.
          </p>
        </div>

        <div className="mt-9 overflow-hidden rounded-xl border border-[#f4f1ec]/[0.08]">
          <div className="grid grid-cols-[minmax(0,1fr)_78px_78px] bg-[#1a1917] px-4 py-4 sm:grid-cols-[minmax(0,1fr)_120px_120px] sm:px-6">
            <p className="font-public-mono text-[10px] font-medium uppercase tracking-[0.13em] text-[#a39c90]">
              Funcionalidad
            </p>
            <p className="font-public-mono text-center text-[10px] font-medium uppercase tracking-[0.13em] text-[#a39c90]">
              Free
            </p>
            <p className="font-public-mono text-center text-[10px] font-medium uppercase tracking-[0.13em] text-[#f4f1ec]">
              Pro
            </p>
          </div>
          {planComparison.map((row) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_78px_78px] items-center border-t border-[#f4f1ec]/[0.07] bg-[#141312] px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_120px_120px] sm:px-6"
              key={row.label}
            >
              <p className="pr-3 text-[13.5px] text-[#c4beb4]">{row.label}</p>
              <p className="text-center text-[13px] text-[#8e877c]">{row.free ? "Incluido" : "—"}</p>
              <p className="text-center text-[13px] font-medium text-[#f4f1ec]">
                {row.pro ? "Incluido" : "—"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-[#f4f1ec]/[0.07] py-14 lg:py-16">
        <h2 className="font-public-display text-[30px] font-semibold tracking-[-0.025em] text-[#f4f1ec]">
          Lo que garantizamos
        </h2>
        <div className="mt-8 grid overflow-hidden rounded-xl border border-[#f4f1ec]/[0.08] bg-[#f4f1ec]/[0.08] md:grid-cols-3">
          {guarantees.map((item) => (
            <article className="m-px bg-[#1a1917] px-6 py-6" key={item.title}>
              <h3 className="font-public-display text-base font-semibold text-[#f4f1ec]">
                {item.title}
              </h3>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-[#a39c90]">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="scroll-mt-24 border-b border-[#f4f1ec]/[0.07] py-14 lg:grid lg:grid-cols-[0.7fr_1.3fr] lg:gap-16 lg:py-16"
        id="preguntas"
      >
        <div>
          <span className="font-public-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#a39c90]">
            Preguntas
          </span>
          <h2 className="font-public-display mt-4 text-[34px] font-semibold leading-[1.1] tracking-[-0.028em] text-[#f4f1ec]">
            Antes de empezar
          </h2>
        </div>
        <div className="mt-8 lg:mt-0">
          <FaqList items={faqs} />
        </div>
      </section>

      <section className="flex flex-col items-start justify-between gap-8 py-12 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-public-display text-[28px] font-semibold tracking-[-0.025em] text-[#f4f1ec]">
            Empieza con tus finanzas claras
          </h2>
          <p className="mt-2 text-sm text-[#a39c90]">Sin tarjeta y sin compromisos.</p>
        </div>
        <Link
          className="inline-flex h-12 items-center justify-center rounded-[9px] bg-[#f4f1ec] px-6 text-[15px] font-semibold text-[#141312] transition hover:bg-white"
          to="/auth/register"
        >
          Crear cuenta gratis
        </Link>
      </section>

      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[#f4f1ec]/[0.07] pt-6 text-xs text-[#8e877c]">
        <span>Más información:</span>
        <Link className="transition hover:text-[#f4f1ec]" to="/terms">Términos</Link>
        <Link className="transition hover:text-[#f4f1ec]" to="/privacy">Privacidad</Link>
        <Link className="transition hover:text-[#f4f1ec]" to="/refunds">Devoluciones</Link>
        <Link className="transition hover:text-[#f4f1ec]" to={PUBLIC_CONTACT.claimsBookPath}>
          Libro de Reclamaciones
        </Link>
      </div>
    </div>
  );
}
