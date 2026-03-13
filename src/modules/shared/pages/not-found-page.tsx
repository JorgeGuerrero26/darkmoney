import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-glow px-4 text-ink">
      <div className="glass-panel-strong max-w-xl rounded-[32px] p-10 text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-storm">404</p>
        <h1 className="mt-4 font-display text-5xl font-semibold">Ruta no encontrada</h1>
        <p className="mt-4 text-sm leading-7 text-storm">
          La estructura principal del proyecto ya esta definida. Solo falta conectar los modulos
          reales para que esta pantalla sea cada vez menos necesaria.
        </p>
        <Link
          className="mt-6 inline-flex"
          to="/app"
        >
          <Button>Volver al dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
