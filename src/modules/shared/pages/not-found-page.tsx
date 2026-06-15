import { Link } from "react-router-dom";

import { getButtonClassName } from "../../../components/ui/button";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-glow px-4 text-ink">
      <div className="glass-panel-strong max-w-xl rounded-[32px] p-10 text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-storm">404</p>
        <h1 className="mt-4 font-display text-5xl font-semibold">Página no encontrada</h1>
        <p className="mt-4 text-sm leading-7 text-storm">
          La página que buscas no existe o fue movida. Vuelve al inicio para continuar.
        </p>
        <Link
          className={getButtonClassName({ className: "mt-6" })}
          to="/"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
