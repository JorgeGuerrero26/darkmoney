import { Link } from "react-router-dom";

const primaryButton =
  "inline-flex h-12 items-center justify-center rounded-[9px] bg-[#f4f1ec] px-6 text-[15px] font-semibold text-[#141312] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f1ec]";
const secondaryButton =
  "inline-flex h-12 items-center justify-center rounded-[9px] border border-[#f4f1ec]/20 px-[22px] text-[15px] font-medium text-[#f4f1ec] transition hover:-translate-y-0.5 hover:border-[#f4f1ec]/35 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f1ec]";

export function FinalCtaSection() {
  return (
    <section className="border-t border-[#f4f1ec]/[0.07]">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col items-start gap-8 px-5 py-11 sm:px-8 md:flex-row md:items-center md:justify-between md:gap-10 lg:px-11 lg:py-[46px]">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <h2 className="font-public-display text-[30px] font-semibold leading-[1.12] tracking-[-0.028em] text-[#f4f1ec]">
            Toma el control de tu dinero hoy
          </h2>
          <p className="max-w-[44ch] text-[14.5px] leading-[1.5] text-[#a39c90]">
            Crea tu cuenta gratis en menos de un minuto y empieza a ver tus finanzas con claridad.
          </p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-3">
          <Link className={primaryButton} to="/auth/register">
            Crear cuenta gratis
          </Link>
          <Link className={secondaryButton} to="/pricing">
            Ver planes
          </Link>
        </div>
      </div>
    </section>
  );
}
