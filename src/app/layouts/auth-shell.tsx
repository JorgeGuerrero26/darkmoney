import { ArrowLeft } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

import { BrandLogo } from "../../components/ui/brand-logo";

const movements = [
  { label: "Yape a Lucía", meta: "Hoy · Cuenta Principal", amount: "− 45.00" },
  { label: "Sueldo AGV", meta: "Ayer · Cuenta Sueldo", amount: "+ 2,630.50", income: true },
  { label: "Rappi", meta: "Ayer · Alimentación", amount: "− 32.90" },
];

export function AuthShell() {
  return (
    <main className="font-public-body min-h-[100dvh] bg-[#0f0e0d] text-[#f4f1ec] lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
      <div className="mx-auto grid min-h-[100dvh] w-full max-w-[1240px] lg:h-full lg:min-h-0 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="hidden overflow-hidden border-r border-[#f4f1ec]/[0.07] bg-[#141312] px-12 py-8 lg:flex lg:h-full lg:flex-col">
          <Link className="flex items-center gap-2.5 self-start" to="/">
            <BrandLogo className="h-8 w-8 rounded-lg" loading="eager" />
            <span className="font-public-display text-base font-semibold tracking-[-0.02em]">
              DarkMoney
            </span>
          </Link>

          <div className="my-auto max-w-[510px] py-6">
            <span className="font-public-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#a39c90]">
              Finanzas personales y compartidas
            </span>
            <h1 className="font-public-display mt-4 text-[clamp(2.5rem,6.2vh,3rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
              Lo que importa, claro desde el inicio.
            </h1>
            <p className="mt-4 max-w-[39ch] text-[15px] leading-[1.55] text-[#a39c90]">
              Entra a tus cuentas, movimientos y compromisos con la misma claridad que ves en
              cada pantalla de DarkMoney.
            </p>

            <div className="mt-6 overflow-hidden rounded-xl border border-[#f4f1ec]/[0.08] bg-[#1a1917]">
              <div className="border-b border-[#f4f1ec]/[0.08] px-6 py-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#a39c90]">
                  Disponible hoy
                </p>
                <p className="font-public-display mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                  S/ 4,226.92
                </p>
                <p className="mt-2 text-xs text-[#8e877c]">
                  En 3 cuentas · comprometido este mes: S/ 1,180
                </p>
              </div>
              <div className="px-6">
                {movements.map((movement) => (
                  <div
                    className="flex items-center gap-4 border-b border-[#f4f1ec]/[0.07] py-3 last:border-0"
                    key={movement.label}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{movement.label}</p>
                      <p className="mt-1 text-[11px] text-[#8e877c]">{movement.meta}</p>
                    </div>
                    <p
                      className={`font-public-display text-sm font-semibold tabular-nums ${
                        movement.income ? "text-[#86ce96]" : "text-[#f4f1ec]"
                      }`}
                    >
                      {movement.amount}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-[#6f6961]">DarkMoney · Chiclayo, Perú</p>
        </section>

        <section className="relative flex min-h-[100dvh] items-center justify-center bg-[#0f0e0d] px-5 py-20 sm:px-10 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:px-14 lg:py-10">
          <Link
            className="absolute left-5 top-6 inline-flex items-center gap-2 text-xs font-medium text-[#8e877c] transition hover:text-[#f4f1ec] sm:left-10 sm:top-8"
            to="/"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al inicio
          </Link>

          <div className="w-full max-w-[430px]">
            <Link className="mb-10 flex items-center gap-2.5 lg:hidden" to="/">
              <BrandLogo className="h-9 w-9 rounded-lg" loading="eager" />
              <span className="font-public-display text-base font-semibold tracking-[-0.02em]">
                DarkMoney
              </span>
            </Link>
            <Outlet />
          </div>
        </section>
      </div>
    </main>
  );
}
