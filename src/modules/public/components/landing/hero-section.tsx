import { Link } from "react-router-dom";

import { getButtonClassName } from "../../../../components/ui/button";

export function HeroSection() {
  return (
    <section className="relative flex flex-col items-center gap-6 pb-16 pt-14 text-center sm:pt-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-4rem] -z-20 h-[150%] w-screen -translate-x-1/2 overflow-hidden"
      >
        <img
          alt=""
          className="h-full w-full object-cover opacity-80 [mask-image:linear-gradient(180deg,black_55%,transparent_96%)]"
          decoding="async"
          src="/hero-darkmoney.jpg"
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-visible"
      >
        <div className="animate-float-slow absolute -top-20 left-[8%] h-72 w-72 rounded-full bg-pine/15 blur-[120px]" />
        <div className="animate-float-slower absolute -top-10 right-[6%] h-80 w-80 rounded-full bg-ember/12 blur-[120px]" />
      </div>

      <div className="animate-rise-in flex flex-col items-center gap-6">
        <span className="rounded-full border border-pine/25 bg-pine/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-pine">
          Finanzas personales y colaborativas
        </span>

        <h1 className="text-balance font-display text-5xl font-semibold leading-[1.05] tracking-[-0.045em] text-ink sm:text-7xl">
          Tu dinero, claro
          <br />
          <span className="text-gradient-pine">y bajo control</span>
        </h1>

        <p className="max-w-xl text-balance text-base leading-8 text-storm sm:text-lg">
          Cuentas, movimientos, suscripciones, deudas y espacios compartidos en un solo lugar.
          Sin hojas de calculo, sin sorpresas.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
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
            Ver planes
          </Link>
        </div>

        <p className="text-xs text-storm/60">Gratis para siempre · Sin tarjeta de credito</p>
      </div>
    </section>
  );
}
