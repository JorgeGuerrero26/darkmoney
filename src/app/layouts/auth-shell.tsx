import { ArrowLeft, ArrowRightLeft, PiggyBank, Shield, Wallet } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

import { BrandLogo } from "../../components/ui/brand-logo";

const features = [
  {
    icon: Wallet,
    title: "Cuentas en un solo lugar",
    description: "Seguí el saldo de cada cuenta y vé a dónde va tu dinero.",
    chipClassName: "border-pine/20 bg-pine/10",
    iconClassName: "text-pine",
  },
  {
    icon: ArrowRightLeft,
    title: "Movimientos con contexto",
    description: "Categorías, contrapartes y presupuestos en cada registro.",
    chipClassName: "border-ember/20 bg-ember/10",
    iconClassName: "text-ember",
  },
  {
    icon: PiggyBank,
    title: "Presupuestos por categoría",
    description: "Fijá límites y recibí alertas antes de pasarlos.",
    chipClassName: "border-gold/20 bg-gold/10",
    iconClassName: "text-gold",
  },
  {
    icon: Shield,
    title: "Workspaces compartidos",
    description: "Finanzas en pareja, familia o negocio sin perder privacidad.",
    chipClassName: "border-pine/20 bg-pine/10",
    iconClassName: "text-pine",
  },
];

export function AuthShell() {
  return (
    <main className="min-h-screen bg-glow px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[32px] border border-white/[0.08] bg-shell/80 shadow-haze backdrop-blur-2xl xl:grid-cols-[1.05fr_1fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-shell via-void to-shell px-10 py-12 text-ink xl:flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-pine/10 blur-[110px]" />
            <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-ember/10 blur-[110px]" />
          </div>

          <div className="relative space-y-10">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <BrandLogo
                  className="h-14 w-14 rounded-2xl"
                  imageClassName="scale-[1.02] object-[center_48%]"
                  loading="eager"
                />
                <div>
                  <p className="font-display text-lg font-semibold tracking-tight text-ink">
                    DarkMoney
                  </p>
                  <p className="text-xs uppercase tracking-[0.22em] text-pine/70">
                    Finanzas sin fricción
                  </p>
                </div>
              </div>
              <div>
                <h1 className="font-display text-4xl font-semibold leading-tight tracking-[-0.03em]">
                  Control claro para el dinero propio
                  <br />
                  <span className="text-gradient-pine">y el que se comparte.</span>
                </h1>
                <p className="mt-4 max-w-md text-base leading-8 text-storm">
                  Workspaces personales y compartidos, con actividad en tiempo real y todo lo
                  que necesitás en una sola vista.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    className="flex items-start gap-4 rounded-[22px] border border-white/[0.07] bg-white/[0.03] px-4 py-4 transition hover:border-white/[0.12] hover:bg-white/[0.045]"
                    key={feature.title}
                  >
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border ${feature.chipClassName}`}
                    >
                      <Icon className={`h-4 w-4 ${feature.iconClassName}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{feature.title}</p>
                      <p className="mt-1 text-sm leading-6 text-storm">{feature.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative mt-10 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-pine/15 bg-[radial-gradient(circle_at_top_left,rgba(107,228,197,0.08),transparent_60%)] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-storm/75">
                Saldo compartido
              </p>
              <p className="mt-2 font-display text-3xl font-semibold text-ink">$14,280</p>
              <p className="mt-1.5 text-sm text-storm">
                Actualización casi inmediata entre miembros.
              </p>
            </div>
            <div className="rounded-[22px] border border-ember/15 bg-[radial-gradient(circle_at_top_left,rgba(142,165,255,0.08),transparent_60%)] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-storm/75">Próximos pagos</p>
              <p className="mt-2 font-display text-3xl font-semibold text-ink">5</p>
              <p className="mt-1.5 text-sm text-storm">
                Suscripciones y deudas visibles de un vistazo.
              </p>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center p-6 sm:p-10">
          <Link
            className="absolute left-6 top-6 inline-flex items-center gap-1.5 text-xs font-medium text-storm/70 transition hover:text-ink sm:left-10 sm:top-8"
            to="/"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al inicio
          </Link>

          <div className="w-full max-w-md space-y-8 pt-8">
            <div className="space-y-4 xl:hidden">
              <div className="flex items-center gap-3">
                <BrandLogo
                  className="h-12 w-12 rounded-2xl"
                  imageClassName="scale-[1.02] object-[center_48%]"
                  loading="eager"
                />
                <p className="font-display text-lg font-semibold tracking-tight text-ink">
                  DarkMoney
                </p>
              </div>
              <h1 className="font-display text-2xl font-semibold leading-tight">
                Finanzas personales y compartidas sin fricción.
              </h1>
            </div>

            <Outlet />
          </div>
        </section>
      </div>
    </main>
  );
}
