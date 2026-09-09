import { Link } from "react-router-dom";

import { freeFeatures, PRO_REGISTER_PATH, proFeatures } from "../lib/plans-data";

type PlanCardsProps = {
  compact?: boolean;
  highlightPro?: boolean;
};

const secondaryButton =
  "inline-flex h-11 w-full items-center justify-center rounded-[9px] border border-[#f4f1ec]/20 px-5 text-sm font-medium text-[#f4f1ec] transition hover:border-[#f4f1ec]/35 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f1ec]";
const primaryButton =
  "inline-flex h-11 w-full items-center justify-center rounded-[9px] bg-[#f4f1ec] px-5 text-sm font-semibold text-[#141312] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f1ec]";

export function PlanCards({ compact = false, highlightPro = false }: PlanCardsProps) {
  const freeList = compact ? freeFeatures.slice(0, 4) : freeFeatures;
  const proList = compact ? proFeatures.slice(0, 4) : proFeatures;

  return (
    <div className="grid w-full max-w-[820px] gap-4 md:grid-cols-2">
      <article className="flex flex-col gap-4 rounded-xl border border-[#f4f1ec]/[0.08] bg-[#1a1917] p-[26px] pb-7">
        <div className="flex flex-col gap-2.5">
          <span className="font-public-mono text-[11px] font-medium uppercase tracking-[0.13em] text-[#a39c90]">
            Free
          </span>
          <div className="flex flex-wrap items-baseline gap-[7px]">
            <strong className="font-public-display text-[38px] font-semibold leading-none tracking-[-0.03em] text-[#f4f1ec] tabular-nums">
              S/ 0
            </strong>
            <span className="text-[13.5px] text-[#a39c90]">para siempre</span>
          </div>
          <p className="text-[13.5px] leading-[1.5] text-[#a39c90]">
            Para empezar a ordenar tus finanzas y construir historial desde el día uno.
          </p>
        </div>

        <ul className="flex flex-col gap-[9px] border-t border-[#f4f1ec]/[0.07] pt-[15px]">
          {freeList.map((feature) => (
            <li className="text-[13.5px] leading-[1.4] text-[#c4beb4]" key={feature}>
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-1">
          <Link className={secondaryButton} to="/auth/register">
            Empezar gratis
          </Link>
        </div>
      </article>

      <article
        className={`flex flex-col gap-4 rounded-xl border bg-[#211f1c] p-[26px] pb-7 ${
          highlightPro
            ? "border-[#f4f1ec]/30 shadow-[0_18px_55px_rgba(0,0,0,0.22)]"
            : "border-[#f4f1ec]/20"
        }`}
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-[9px]">
            <span className="font-public-mono text-[11px] font-medium uppercase tracking-[0.13em] text-[#f4f1ec]">
              Pro
            </span>
            <span className="font-public-mono rounded-[3px] bg-[#f4f1ec] px-[7px] py-1 text-[9.5px] font-medium uppercase leading-none tracking-[0.11em] text-[#141312]">
              Popular
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-[7px]">
            <strong className="font-public-display text-[38px] font-semibold leading-none tracking-[-0.03em] text-[#f4f1ec] tabular-nums">
              S/ 19
            </strong>
            <span className="text-[13.5px] text-[#a39c90]">al mes · IGV incluido</span>
          </div>
          <p className="text-[13.5px] leading-[1.5] text-[#c4beb4]">
            Para quienes quieren análisis profundo, automatización y herramientas avanzadas.
          </p>
        </div>

        <ul className="flex flex-col gap-[9px] border-t border-[#f4f1ec]/[0.09] pt-[15px]">
          {proList.map((feature) => (
            <li className="text-[13.5px] leading-[1.4] text-[#f4f1ec]" key={feature}>
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-1">
          <Link className={primaryButton} to={PRO_REGISTER_PATH}>
            Empezar con Pro
          </Link>
        </div>
      </article>
    </div>
  );
}
