import { Link } from "react-router-dom";

import { DashboardPreview } from "./dashboard-preview";

const primaryButton =
  "inline-flex h-12 items-center justify-center rounded-[9px] bg-[#f4f1ec] px-6 text-[15px] font-semibold text-[#141312] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f1ec]";
const secondaryButton =
  "inline-flex h-12 items-center justify-center rounded-[9px] border border-[#f4f1ec]/20 px-[22px] text-[15px] font-medium text-[#f4f1ec] transition hover:-translate-y-0.5 hover:border-[#f4f1ec]/35 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f1ec]";

export function HeroSection() {
  return (
    <section className="mx-auto grid w-full max-w-[1240px] items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:px-11 lg:py-[60px]">
      <div className="flex min-w-0 flex-col items-start gap-[22px]">
        <span className="font-public-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#a39c90]">
          Finanzas personales y compartidas
        </span>
        <h1 className="text-balance font-public-display text-[clamp(3.25rem,6vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-[#f4f1ec]">
          Tu dinero, claro y bajo control
        </h1>
        <p className="max-w-[34ch] text-[16.5px] leading-[1.55] text-[#c4beb4]">
          Cuentas, movimientos, suscripciones, deudas y espacios compartidos en un solo lugar.
          Sin hojas de cálculo, sin sorpresas.
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Link className={primaryButton} to="/auth/register">
            Crear cuenta gratis
          </Link>
          <Link className={secondaryButton} to="/pricing">
            Ver planes
          </Link>
        </div>
        <span className="text-[13px] text-[#8e877c]">
          Gratis para siempre · sin tarjeta de crédito
        </span>
      </div>

      <div className="flex min-w-0 justify-center lg:justify-end">
        <DashboardPreview />
      </div>
    </section>
  );
}
