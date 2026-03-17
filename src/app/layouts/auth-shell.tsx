import { ArrowRightLeft, PiggyBank, Shield, Wallet } from "lucide-react";
import { Outlet } from "react-router-dom";

import { BrandLogo } from "../../components/ui/brand-logo";

const features = [
  {
    icon: Wallet,
    title: "Cuentas en un solo lugar",
    description: "Seguí el saldo de cada cuenta y vé a dónde va tu dinero.",
  },
  {
    icon: ArrowRightLeft,
    title: "Movimientos con contexto",
    description: "Categorías, contrapartes y presupuestos en cada registro.",
  },
  {
    icon: PiggyBank,
    title: "Presupuestos por categoría",
    description: "Fijá límites y recibí alertas antes de pasarlos.",
  },
  {
    icon: Shield,
    title: "Workspaces compartidos",
    description: "Finanzas en pareja, familia o negocio sin perder privacidad.",
  },
];

export function AuthShell() {
  return (
    <main className="min-h-screen bg-glow px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-shell/80 shadow-haze backdrop-blur-2xl xl:grid-cols-[1fr_1fr]">
        <section className="hidden flex-col justify-between bg-gradient-to-br from-shell via-void to-shell px-10 py-12 text-ink xl:flex">
          <div className="space-y-10">
            <div className="space-y-5">
              <BrandLogo
                className="h-20 w-20 rounded-[24px]"
                imageClassName="scale-[1.02] object-[center_48%]"
              />
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-storm/70">
                  Dark Money
                </p>
                <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">
                  Control claro para el dinero propio y el que se comparte.
                </h1>
                <p className="mt-4 text-base leading-8 text-storm">
                  Workspaces personales y compartidos, con actividad en tiempo
                  real y todo lo que necesitás en una sola vista.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    className="flex items-start gap-4 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4"
                    key={feature.title}
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-white/[0.06] ring-1 ring-white/10">
                      <Icon className="h-4 w-4 text-pine" />
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="glass-panel-soft rounded-[22px] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-storm/75">Saldo compartido</p>
              <p className="mt-2 font-display text-3xl font-semibold">$14,280</p>
              <p className="mt-1.5 text-sm text-storm">
                Actualización casi inmediata entre miembros.
              </p>
            </div>
            <div className="glass-panel-soft rounded-[22px] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-storm/75">Próximos pagos</p>
              <p className="mt-2 font-display text-3xl font-semibold">5</p>
              <p className="mt-1.5 text-sm text-storm">
                Suscripciones y deudas visibles de un vistazo.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md space-y-8">
            <div className="space-y-3 xl:hidden">
              <BrandLogo
                className="h-16 w-16 rounded-[20px]"
                imageClassName="scale-[1.02] object-[center_48%]"
              />
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
