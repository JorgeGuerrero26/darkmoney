import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { BrandLogo } from "../../components/ui/brand-logo";
import { PUBLIC_CONTACT, PUBLIC_CONTACT_LINKS } from "../../lib/public-contact";
import { useAuth } from "../../modules/auth/auth-context";

const headerNavigation = [
  { to: "/#producto", label: "Producto" },
  { to: "/pricing", label: "Planes" },
  { to: "/pricing#preguntas", label: "Preguntas" },
];

const primaryButton =
  "inline-flex h-9 items-center justify-center rounded-lg bg-[#f4f1ec] px-[18px] text-[13.5px] font-semibold text-[#141312] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f1ec]";

export function PublicShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isHomePage = location.pathname === "/";

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (location.hash) {
      return;
    }

    window.scrollTo({ behavior: "auto", left: 0, top: 0 });
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [location.hash, location.pathname]);

  const isNavigationActive = (to: string) => {
    if (to === "/#producto") {
      return isHomePage;
    }

    if (to.includes("#")) {
      return location.pathname === "/pricing" && location.hash === "#preguntas";
    }

    return location.pathname === to && location.hash !== "#preguntas";
  };

  return (
    <div className="font-public-body min-h-screen bg-[#141312] text-[#f4f1ec]">
      <header className="sticky top-0 z-50 border-b border-[#f4f1ec]/[0.07] bg-[#141312]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] w-full max-w-[1240px] items-center gap-5 px-5 sm:px-8 lg:gap-[34px] lg:px-11">
          <Link className="flex flex-none items-center gap-2.5" to="/">
            <BrandLogo className="h-8 w-8 rounded-lg" loading="eager" />
            <span className="font-public-display text-base font-semibold tracking-[-0.02em] text-[#f4f1ec]">
              DarkMoney
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-[26px] md:flex">
            {headerNavigation.map((item) => (
              <Link
                className={`text-[13.5px] transition hover:text-[#f4f1ec] ${
                  isNavigationActive(item.to)
                    ? "font-medium text-[#f4f1ec]"
                    : "text-[#a39c90]"
                }`}
                key={item.to}
                to={item.to}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto hidden flex-none items-center gap-4 md:flex">
            <Link
              className="text-[13.5px] font-medium text-[#c4beb4] transition hover:text-[#f4f1ec]"
              to={user ? "/app" : "/auth/login"}
            >
              {user ? "Ir a la app" : "Entrar"}
            </Link>
            {!user ? (
              <Link className={primaryButton} to="/auth/register">
                Crear cuenta
              </Link>
            ) : null}
          </div>

          <button
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[#f4f1ec]/15 text-[#f4f1ec] md:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            type="button"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-[#f4f1ec]/[0.07] bg-[#141312] px-5 py-5 md:hidden">
            <nav className="flex flex-col">
              {headerNavigation.map((item) => (
                <Link
                  className="border-b border-[#f4f1ec]/[0.07] py-3 text-sm text-[#c4beb4] last:border-0"
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-5 flex items-center gap-4">
              <Link className="text-sm font-medium text-[#c4beb4]" to={user ? "/app" : "/auth/login"}>
                {user ? "Ir a la app" : "Entrar"}
              </Link>
              {!user ? (
                <Link className={primaryButton} to="/auth/register">
                  Crear cuenta
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      <main
        className={
          isHomePage
            ? "w-full"
            : "mx-auto w-full max-w-6xl px-5 pb-24 pt-12 sm:px-8 lg:px-11"
        }
        id="main"
      >
        <Outlet />
      </main>

      <footer className="border-t border-[#f4f1ec]/[0.07] bg-[#0f0e0d]">
        <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 py-9 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr] lg:gap-9 lg:px-11 lg:py-[38px]">
          <div className="flex min-w-0 flex-col gap-[11px]">
            <div className="flex items-center gap-[9px]">
              <BrandLogo className="h-7 w-7 rounded-[7px] bg-[#1a1917]" />
              <span className="font-public-display text-[14.5px] font-semibold tracking-[-0.02em] text-[#f4f1ec]">
                DarkMoney
              </span>
            </div>
            <p className="max-w-[34ch] text-[12.5px] leading-[1.55] text-[#8e877c]">
              Plataforma para organizar dinero propio y compartido desde un solo lugar.
            </p>
          </div>

          <FooterColumn title="Producto">
            <Link to="/">Inicio</Link>
            <Link to="/#producto">Funcionalidades</Link>
            <Link to="/pricing">Planes</Link>
          </FooterColumn>

          <FooterColumn title="Legal">
            <Link to="/terms">Términos</Link>
            <Link to="/privacy">Privacidad</Link>
            <Link to="/refunds">Devoluciones</Link>
            <Link className="text-[#f4f1ec]" to={PUBLIC_CONTACT.claimsBookPath}>
              Libro de Reclamaciones
            </Link>
          </FooterColumn>

          <FooterColumn title="Contacto">
            <span>{PUBLIC_CONTACT.cityCountry}</span>
            <span className="tabular-nums">
              {PUBLIC_CONTACT.taxIdLabel} {PUBLIC_CONTACT.taxIdValue}
            </span>
            <a href={PUBLIC_CONTACT_LINKS.email}>{PUBLIC_CONTACT.supportEmail}</a>
          </FooterColumn>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-[9px] text-[12.5px] text-[#a39c90] [&_a]:transition [&_a:hover]:text-[#f4f1ec]">
      <span className="font-public-mono text-[10px] font-medium uppercase tracking-[0.13em] text-[#a39c90]">
        {title}
      </span>
      {children}
    </div>
  );
}
