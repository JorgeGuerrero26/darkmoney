import { Outlet } from "react-router-dom";

import { BrandLogo } from "../../components/ui/brand-logo";

export function AuthShell() {
  return (
    <main className="min-h-screen bg-glow px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-shell/80 shadow-haze backdrop-blur-2xl xl:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between bg-gradient-to-br from-shell via-void to-shell px-10 py-10 text-ink xl:flex">
          <div className="space-y-6">
            <div className="space-y-4">
              <BrandLogo
                className="h-24 w-24 rounded-[28px]"
                imageClassName="scale-[1.02] object-[center_48%]"
              />
              <p className="text-sm uppercase tracking-[0.24em] text-storm/72">
                Dark Money
              </p>
            </div>
            <div className="max-w-lg space-y-4">
              <p className="text-sm uppercase tracking-[0.28em] text-storm/80">
                finanzas personales y compartidas
              </p>
              <h1 className="font-display text-5xl font-semibold leading-tight">
                Control claro para el dinero propio y el que se comparte.
              </h1>
              <p className="text-lg leading-8 text-storm">
                Workspaces personales, cuentas compartidas, actividad en tiempo real y una
                experiencia pensada para que todo se entienda de un vistazo.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(108,241,196,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(242,182,73,0.12),transparent_28%),linear-gradient(165deg,rgba(10,16,24,0.98),rgba(6,10,16,0.94))] p-6 shadow-[0_28px_72px_rgba(3,8,14,0.42)]">
              <div className="absolute -right-12 top-0 h-32 w-32 rounded-full bg-[rgba(108,241,196,0.16)] blur-3xl" />
              <div className="absolute -bottom-12 left-4 h-28 w-28 rounded-full bg-[rgba(242,182,73,0.12)] blur-3xl" />

              <div className="relative space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-storm/80">
                      Pulso del workspace
                    </p>
                    <p className="mt-3 font-display text-3xl font-semibold leading-none text-ink">
                      +18.4%
                    </p>
                    <p className="mt-2 text-sm text-storm">
                      Mas claridad sobre cuentas, deudas y pagos compartidos.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-storm/85">
                    En vivo
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-[1.45fr_0.95fr]">
                  <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                    <p className="text-[0.65rem] uppercase tracking-[0.24em] text-storm/75">
                      Flujo semanal
                    </p>
                    <div className="mt-5 flex h-28 items-end gap-3">
                      <div className="w-full rounded-t-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))]" style={{ height: "38%" }} />
                      <div className="w-full rounded-t-[18px] bg-[linear-gradient(180deg,rgba(108,241,196,0.82),rgba(108,241,196,0.16))]" style={{ height: "62%" }} />
                      <div className="w-full rounded-t-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))]" style={{ height: "48%" }} />
                      <div className="w-full rounded-t-[18px] bg-[linear-gradient(180deg,rgba(242,182,73,0.78),rgba(242,182,73,0.16))]" style={{ height: "84%" }} />
                      <div className="w-full rounded-t-[18px] bg-[linear-gradient(180deg,rgba(108,241,196,0.92),rgba(108,241,196,0.18))]" style={{ height: "100%" }} />
                      <div className="w-full rounded-t-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))]" style={{ height: "54%" }} />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-[0.62rem] uppercase tracking-[0.22em] text-storm/60">
                      <span>Lun</span>
                      <span>Mar</span>
                      <span>Mie</span>
                      <span>Jue</span>
                      <span>Vie</span>
                      <span>Sab</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-[0.65rem] uppercase tracking-[0.24em] text-storm/75">
                        Estado general
                      </p>
                      <div className="mt-4 flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-[conic-gradient(from_180deg_at_50%_50%,rgba(108,241,196,0.95)_0deg,rgba(108,241,196,0.32)_220deg,rgba(255,255,255,0.08)_220deg,rgba(255,255,255,0.08)_360deg)]">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-shell text-xs font-semibold text-ink">
                            72%
                          </div>
                        </div>
                        <div className="space-y-2 text-sm text-storm">
                          <p>Cuentas al dia</p>
                          <p>Alertas visibles</p>
                          <p>Pagos ordenados</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                      <p className="text-[0.65rem] uppercase tracking-[0.24em] text-storm/75">
                        Actividad
                      </p>
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm">
                          <span className="text-storm">Transferencias</span>
                          <span className="text-ink">12</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm">
                          <span className="text-storm">Suscripciones</span>
                          <span className="text-ink">5</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm">
                          <span className="text-storm">Obligaciones</span>
                          <span className="text-ink">3</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-panel-soft rounded-3xl p-5">
              <p className="text-sm uppercase tracking-[0.22em] text-storm/80">Saldo compartido</p>
              <p className="mt-3 font-display text-4xl">$14,280</p>
              <p className="mt-2 text-sm text-storm">
                Actualizacion casi inmediata entre miembros.
              </p>
            </div>
            <div className="glass-panel-soft rounded-3xl p-5">
              <p className="text-sm uppercase tracking-[0.22em] text-storm/80">Proximos pagos</p>
              <p className="mt-3 font-display text-4xl">5</p>
              <p className="mt-2 text-sm text-storm">
                Suscripciones y obligaciones visibles sin perseguir planillas.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md space-y-8">
            <div className="space-y-3 xl:hidden">
              <BrandLogo
                className="h-20 w-20 rounded-[24px]"
                imageClassName="scale-[1.02] object-[center_48%]"
              />
              <h1 className="font-display text-3xl font-semibold leading-tight">
                Finanzas personales y compartidas sin friccion.
              </h1>
            </div>

            <Outlet />
          </div>
        </section>
      </div>
    </main>
  );
}
