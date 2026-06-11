import { Link } from "react-router-dom";

import { getButtonClassName } from "../../../../components/ui/button";
import { Reveal } from "../reveal";

export function FinalCtaSection() {
  return (
    <Reveal>
      <section className="relative overflow-hidden rounded-[32px] border border-pine/20 bg-[radial-gradient(circle_at_50%_-20%,rgba(107,228,197,0.18),transparent_60%)] px-6 py-14 text-center sm:px-12 sm:py-16">
        <div
          aria-hidden="true"
          className="coin-flip mx-auto mb-7 h-28 w-28"
          title="DarkMoney"
        >
          <div className="coin-flip-inner">
            <img
              alt=""
              className="coin-face h-full w-full object-contain drop-shadow-[0_0_24px_rgba(107,228,197,0.25)]"
              decoding="async"
              loading="lazy"
              src="/logo-coin.png"
            />
            <img
              alt=""
              className="coin-face coin-face-back h-full w-full object-contain drop-shadow-[0_0_24px_rgba(107,228,197,0.25)]"
              decoding="async"
              loading="lazy"
              src="/logo-coin-back.png"
            />
          </div>
        </div>
        <h2 className="text-balance font-display text-3xl font-semibold tracking-[-0.035em] text-ink sm:text-5xl">
          Toma el control de tu dinero hoy
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-balance text-base leading-8 text-storm">
          Crea tu cuenta gratis en menos de un minuto y empieza a ver tus finanzas con claridad.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            className={getButtonClassName({ className: "px-6" })}
            to="/auth/register"
          >
            Crear cuenta gratis
          </Link>
          <Link
            className={getButtonClassName({ variant: "ghost", className: "px-6" })}
            to="/pricing"
          >
            Ver planes y precios
          </Link>
        </div>
      </section>
    </Reveal>
  );
}
