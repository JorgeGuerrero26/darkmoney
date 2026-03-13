import { WalletCards } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

export function AuthShell() {
  return (
    <main className="min-h-screen bg-glow px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-shell/80 shadow-haze backdrop-blur-2xl xl:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between bg-gradient-to-br from-shell via-void to-shell px-10 py-10 text-ink xl:flex">
          <div className="space-y-6">
            <span className="inline-flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-storm">
              <WalletCards className="h-4 w-4" />
              DarkMoney
            </span>
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
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-ink">
                <WalletCards className="h-4 w-4" />
                DarkMoney
              </span>
              <h1 className="font-display text-3xl font-semibold leading-tight">
                Finanzas personales y compartidas sin friccion.
              </h1>
            </div>

            <Outlet />

            <div className="glass-panel rounded-3xl p-5 text-sm text-storm">
              <p className="font-medium text-ink">Estado actual del scaffold</p>
              <p className="mt-2 leading-7">
                Las pantallas de autenticacion ya estan listas. La conexion real con Supabase Auth
                es el siguiente paso una vez se configuren las credenciales del proyecto.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-ink">
                <NavLink
                  className="underline decoration-white/20 underline-offset-4 transition hover:text-ink"
                  to="/auth/login"
                >
                  Login
                </NavLink>
                <NavLink
                  className="underline decoration-white/20 underline-offset-4 transition hover:text-ink"
                  to="/auth/register"
                >
                  Registro
                </NavLink>
                <NavLink
                  className="underline decoration-white/20 underline-offset-4 transition hover:text-ink"
                  to="/auth/recovery"
                >
                  Recuperacion
                </NavLink>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
