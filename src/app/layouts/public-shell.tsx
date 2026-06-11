import { useEffect, useState } from "react";
import {
  BookText,
  FileBadge2,
  Landmark,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  X,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { BrandLogo } from "../../components/ui/brand-logo";
import { getButtonClassName } from "../../components/ui/button";
import { PUBLIC_CONTACT, PUBLIC_CONTACT_LINKS } from "../../lib/public-contact";
import { useAuth } from "../../modules/auth/auth-context";

const headerNavigation = [
  { to: "/", label: "Inicio", end: true },
  { to: "/#producto", label: "Producto", end: false },
  { to: "/pricing", label: "Planes", end: false },
];

const legalNavigation = [
  { to: "/terms", label: "Términos" },
  { to: "/privacy", label: "Privacidad" },
  { to: "/refunds", label: "Devoluciones" },
];

export function PublicShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  return (
    <div className="min-h-screen bg-glow text-ink">
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled || mobileMenuOpen
            ? "border-b border-white/[0.06] bg-canvas/80 backdrop-blur-xl"
            : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            className="flex items-center gap-2.5"
            to="/"
          >
            <BrandLogo
              className="h-9 w-9 rounded-xl"
              imageClassName="scale-[1.02] object-[center_48%]"
              loading="eager"
            />
            <span className="font-display text-base font-semibold tracking-tight text-ink">
              DarkMoney
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {headerNavigation.map((item) =>
              item.to.includes("#") ? (
                <Link
                  className="rounded-full px-4 py-2 text-sm font-medium text-storm transition hover:text-ink"
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                </Link>
              ) : (
                <NavLink
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive ? "bg-white/[0.06] text-ink" : "text-storm hover:text-ink"
                    }`
                  }
                  end={item.end}
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="hidden items-center gap-2.5 md:flex">
            <Link
              className={getButtonClassName({ variant: "ghost", className: "px-4 py-2" })}
              to={user ? "/app" : "/auth/login"}
            >
              {user ? "Ir a la app" : "Entrar"}
            </Link>
            {!user ? (
              <Link
                className={getButtonClassName({ className: "px-4 py-2" })}
                to="/auth/register"
              >
                Crear cuenta
              </Link>
            ) : null}
          </div>

          <button
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-ink transition hover:bg-white/[0.07] md:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            type="button"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-white/[0.06] bg-canvas/95 px-4 pb-6 pt-4 backdrop-blur-xl md:hidden">
            <nav className="flex flex-col gap-1">
              {headerNavigation.map((item) => (
                <Link
                  className="rounded-xl px-4 py-3 text-sm font-medium text-storm transition hover:bg-white/[0.05] hover:text-ink"
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2.5">
              <Link
                className={getButtonClassName({ variant: "ghost" })}
                to={user ? "/app" : "/auth/login"}
              >
                {user ? "Ir a la app" : "Entrar"}
              </Link>
              {!user ? (
                <Link
                  className={getButtonClassName()}
                  to="/auth/register"
                >
                  Crear cuenta
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      <main
        className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8"
        id="main"
      >
        <Outlet />
      </main>

      <footer className="relative bg-[rgba(4,6,9,0.85)]">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pine/30 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_50%_0%,rgba(107,228,197,0.06),transparent_70%)]"
        />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr] sm:grid-cols-2">
            <div>
              <div className="flex items-center gap-3">
                <BrandLogo
                  className="h-11 w-11 rounded-[14px]"
                  imageClassName="scale-[1.02] object-[center_48%]"
                />
                <div>
                  <p className="font-display text-lg font-semibold tracking-tight text-ink">
                    DarkMoney
                  </p>
                  <p className="text-xs text-storm/70">Finanzas claras, propias y compartidas</p>
                </div>
              </div>
              <p className="mt-5 max-w-xs text-sm leading-7 text-storm">
                Plataforma web para organizar dinero propio y compartido desde un solo lugar.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <a
                  aria-label="Enviar correo"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-storm transition hover:border-pine/30 hover:bg-pine/10 hover:text-pine"
                  href={PUBLIC_CONTACT_LINKS.email}
                >
                  <Mail className="h-4 w-4" />
                </a>
                <a
                  aria-label="Llamar por teléfono"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-storm transition hover:border-pine/30 hover:bg-pine/10 hover:text-pine"
                  href={PUBLIC_CONTACT_LINKS.phone}
                >
                  <Phone className="h-4 w-4" />
                </a>
                <a
                  aria-label="Escribir por WhatsApp"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-storm transition hover:border-pine/30 hover:bg-pine/10 hover:text-pine"
                  href={PUBLIC_CONTACT_LINKS.whatsapp}
                  rel="noreferrer"
                  target="_blank"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/80">
                Producto
              </p>
              <ul className="mt-5 flex flex-col gap-3.5">
                <li>
                  <Link
                    className="text-sm text-storm transition hover:translate-x-0.5 hover:text-pine"
                    to="/"
                  >
                    Inicio
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-storm transition hover:translate-x-0.5 hover:text-pine"
                    to="/#producto"
                  >
                    Funcionalidades
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-storm transition hover:translate-x-0.5 hover:text-pine"
                    to="/pricing"
                  >
                    Planes
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/80">
                Legal
              </p>
              <ul className="mt-5 flex flex-col gap-3.5">
                {legalNavigation.map((item) => (
                  <li key={item.to}>
                    <Link
                      className="text-sm text-storm transition hover:translate-x-0.5 hover:text-pine"
                      to={item.to}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/80">
                Contacto
              </p>
              <ul className="mt-5 flex flex-col gap-3.5 text-sm text-storm">
                <li className="flex items-center gap-2.5">
                  <Landmark className="h-3.5 w-3.5 shrink-0 text-pine/70" />
                  {PUBLIC_CONTACT.cityCountry}
                </li>
                <li className="flex items-center gap-2.5">
                  <FileBadge2 className="h-3.5 w-3.5 shrink-0 text-pine/70" />
                  {PUBLIC_CONTACT.taxIdLabel} {PUBLIC_CONTACT.taxIdValue}
                </li>
              </ul>
              <Link
                className="mt-6 inline-flex items-center gap-2.5 rounded-[18px] border border-gold/20 bg-gold/[0.08] px-4 py-3 text-sm font-semibold text-gold transition hover:border-gold/35 hover:bg-gold/[0.14] hover:shadow-[0_0_24px_rgba(215,190,123,0.12)]"
                to={PUBLIC_CONTACT.claimsBookPath}
              >
                <BookText className="h-4 w-4 shrink-0" />
                Libro de Reclamaciones
              </Link>
            </div>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-7">
            <p className="text-xs text-storm/50">
              © {new Date().getFullYear()} DarkMoney. Todos los derechos reservados.
            </p>
            <p className="text-xs text-storm/40">
              Hecho en {PUBLIC_CONTACT.cityCountry}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
