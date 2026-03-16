import { AlertTriangle, Home, RefreshCcw } from "lucide-react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";

import { Button } from "../../../components/ui/button";

type RouteErrorContent = {
  eyebrow: string;
  title: string;
  description: string;
  detail: string | null;
  statusLabel: string | null;
};

function getRouteErrorContent(error: unknown): RouteErrorContent {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        eyebrow: "Ruta no disponible",
        title: "Esta pantalla ya no vive aqui",
        description:
          "La ruta que intentaste abrir no existe, cambio de lugar o todavia no esta conectada dentro del flujo principal.",
        detail:
          typeof error.data === "string" && error.data.trim().length > 0 ? error.data : null,
        statusLabel: `${error.status} ${error.statusText}`.trim(),
      };
    }

    return {
      eyebrow: "Navegacion interrumpida",
      title: "Se cruzo un error al cargar esta vista",
      description:
        "La app encontro un problema inesperado mientras intentaba renderizar la pantalla. Puedes recargar o volver al inicio sin perder el contexto general.",
      detail:
        typeof error.data === "string"
          ? error.data
          : error.data
            ? JSON.stringify(error.data, null, 2)
            : null,
      statusLabel: `${error.status} ${error.statusText}`.trim(),
    };
  }

  if (error instanceof Error) {
    return {
      eyebrow: "Error inesperado",
      title: "Algo se desalineo dentro de la app",
      description:
        "No deberias ver una pantalla tecnica cruda. Dejamos esta vista mas limpia para que puedas recuperarte rapido y seguir trabajando.",
      detail: error.message,
      statusLabel: error.name,
    };
  }

  return {
    eyebrow: "Error inesperado",
    title: "La pantalla no pudo terminar de cargar",
    description:
      "Se produjo un fallo no identificado. Puedes reintentar ahora o volver al inicio mientras revisamos el problema.",
    detail: null,
    statusLabel: null,
  };
}

export function RouteErrorPage() {
  const error = useRouteError();
  const content = getRouteErrorContent(error);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#040812] px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(55,110,211,0.18),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.16),_transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-position:center] [background-size:72px_72px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center justify-center">
        <section className="glass-panel-strong relative w-full overflow-hidden rounded-[36px] border border-white/10 bg-[#08101b]/92 p-7 shadow-[0_40px_120px_rgba(0,0,0,0.45)] sm:p-10">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          <div className="pointer-events-none absolute -right-16 top-12 h-44 w-44 rounded-full bg-[#2f6fed]/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 bottom-8 h-40 w-40 rounded-full bg-[#28b48d]/12 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm">
              <AlertTriangle className="h-3.5 w-3.5 text-gold" />
              {content.eyebrow}
            </div>

            <h1 className="mt-6 max-w-2xl font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              {content.title}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-storm sm:text-base">
              {content.description}
            </p>

            {content.statusLabel ? (
              <div className="mt-6 inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-ink/85">
                {content.statusLabel}
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                className="gap-2"
                onClick={() => window.location.reload()}
              >
                <RefreshCcw className="h-4 w-4" />
                Reintentar
              </Button>

              <Link to="/">
                <Button
                  className="gap-2"
                  variant="secondary"
                >
                  <Home className="h-4 w-4" />
                  Volver al inicio
                </Button>
              </Link>
            </div>

            {content.detail ? (
              <details className="mt-8 rounded-[24px] border border-white/10 bg-black/20 p-4 text-sm text-storm">
                <summary className="cursor-pointer list-none font-medium text-ink">
                  Ver detalle tecnico
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-storm/90">
                  {content.detail}
                </pre>
              </details>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
