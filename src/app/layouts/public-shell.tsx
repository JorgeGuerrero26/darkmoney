import { BookText, FileBadge2, Landmark, Mail, Phone } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { BrandBanner, BrandLogo } from "../../components/ui/brand-logo";
import { Button } from "../../components/ui/button";
import { PUBLIC_CONTACT, PUBLIC_CONTACT_LINKS } from "../../lib/public-contact";
import { useAuth } from "../../modules/auth/auth-context";

const publicNavigation = [
  { to: "/pricing", label: "Planes" },
  { to: "/terms", label: "Terminos" },
  { to: "/privacy", label: "Privacidad" },
  { to: "/refunds", label: "Devoluciones" },
  { to: PUBLIC_CONTACT.claimsBookPath, label: "Libro" },
];

export function PublicShell() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-glow text-ink">
      {/* Contenido principal: ancho completo con el mismo padding horizontal que el footer */}
      <div className="flex w-full flex-col gap-6 px-4 pt-5 sm:px-6 lg:px-8">
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
                  Informacion publica, contacto y politicas
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

        <div className="pb-16">
          <Outlet />
        </div>
      </div>

      {/* Footer full-width */}
      <footer className="border-t border-white/[0.06] bg-[rgba(5,7,10,0.72)] backdrop-blur-xl">
        <div className="w-full px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3">
                <BrandLogo
                  className="h-10 w-10 rounded-[12px]"
                  imageClassName="scale-[1.02] object-[center_48%]"
                />
                <p className="font-display text-base font-semibold text-ink">DarkMoney</p>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-7 text-storm">
                Plataforma web para organizar dinero propio y compartido desde un solo lugar.
              </p>
            </div>

            {/* Navegacion */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-storm/60">
                Navegacion
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {publicNavigation.map((item) => (
                  <li key={item.to}>
                    <Link
                      className="text-sm text-storm transition hover:text-ink"
                      to={item.to}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contacto */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-storm/60">
                Contacto
              </p>
              <ul className="mt-4 flex flex-col gap-3 text-sm text-storm">
                <li>
                  <a
                    className="flex items-center gap-2.5 transition hover:text-ink"
                    href={PUBLIC_CONTACT_LINKS.email}
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0 text-pine" />
                    {PUBLIC_CONTACT.supportEmail}
                  </a>
                </li>
                <li>
                  <a
                    className="flex items-center gap-2.5 transition hover:text-ink"
                    href={PUBLIC_CONTACT_LINKS.phone}
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0 text-pine" />
                    {PUBLIC_CONTACT.supportPhoneDisplay}
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Landmark className="h-3.5 w-3.5 shrink-0 text-pine" />
                  {PUBLIC_CONTACT.cityCountry}
                </li>
                <li className="flex items-center gap-2.5">
                  <FileBadge2 className="h-3.5 w-3.5 shrink-0 text-pine" />
                  {PUBLIC_CONTACT.taxIdLabel} {PUBLIC_CONTACT.taxIdValue}
                </li>
              </ul>
            </div>

            {/* Libro de Reclamaciones */}
            <div className="flex flex-col justify-start">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-storm/60">
                Legal
              </p>
              <Link
                className="mt-4 flex items-center gap-2.5 rounded-[20px] border border-gold/20 bg-gold/[0.08] px-4 py-3.5 text-sm font-semibold text-gold transition hover:border-gold/30 hover:bg-gold/[0.13]"
                to={PUBLIC_CONTACT.claimsBookPath}
              >
                <BookText className="h-4 w-4 shrink-0" />
                Libro de
                <br />
                Reclamaciones
              </Link>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-6">
            <p className="text-xs text-storm/50">
              © {new Date().getFullYear()} DarkMoney. Todos los derechos reservados.
            </p>
            <div className="flex flex-wrap gap-4">
              {publicNavigation.slice(1, 4).map((item) => (
                <Link
                  className="text-xs text-storm/50 transition hover:text-storm"
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
