import { Link, NavLink, Outlet } from "react-router-dom";

import { BrandBanner, BrandLogo } from "../../components/ui/brand-logo";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../modules/auth/auth-context";

const publicNavigation = [
  { to: "/pricing", label: "Pricing" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/refunds", label: "Refunds" },
];

export function PublicShell() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-glow px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-7xl flex-col gap-6">
        <header className="glass-panel-strong overflow-hidden rounded-[32px] p-4 sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Link className="shrink-0" to="/pricing">
                <BrandLogo
                  className="h-16 w-16 rounded-[20px]"
                  imageClassName="scale-[1.02] object-[center_48%]"
                />
              </Link>
              <div className="min-w-0">
                <p className="text-[0.7rem] uppercase tracking-[0.26em] text-storm/75">
                  DarkMoney
                </p>
                <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em] text-ink sm:text-3xl">
                  Informacion publica y politicas
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-storm">
                  SaaS de finanzas personales y colaborativas con cuentas, movimientos,
                  suscripciones, deudas y espacios compartidos.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:items-end">
              <nav className="flex flex-wrap gap-2">
                {publicNavigation.map((item) => (
                  <NavLink
                    className={({ isActive }) =>
                      `rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? "border-pine/25 bg-pine/10 text-pine"
                          : "border-white/10 bg-white/[0.03] text-storm hover:border-white/18 hover:text-ink"
                      }`
                    }
                    key={item.to}
                    to={item.to}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="flex flex-wrap gap-3">
                <Link to={user ? "/app" : "/auth/login"}>
                  <Button variant="ghost">{user ? "Ir a la app" : "Entrar"}</Button>
                </Link>
                {!user ? (
                  <Link to="/auth/register">
                    <Button>Crear cuenta</Button>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <BrandBanner
          className="hidden h-52 sm:block"
          imageClassName="object-cover object-center"
        />

        <Outlet />

        <footer className="glass-panel-soft rounded-[28px] px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">DarkMoney</p>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-storm">
                Plataforma web para organizar dinero propio y compartido desde un solo
                lugar.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-storm">
              {publicNavigation.map((item) => (
                <Link className="transition hover:text-ink" key={item.to} to={item.to}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
