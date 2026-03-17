import { AlertTriangle, ChevronDown, Copy, Home, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";

import { Button } from "../../../components/ui/button";

type RouteErrorContent = {
  eyebrow: string;
  title: string;
  description: string;
  detail: string | null;
  statusLabel: string | null;
  tone: "error" | "warning" | "neutral";
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
        tone: "warning",
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
      tone: "error",
    };
  }

  if (error instanceof Error) {
    return {
      eyebrow: "Error inesperado",
      title: "Algo se desalineo dentro de la app",
      description:
        "No deberias ver una pantalla tecnica cruda. Dejamos esta vista mas limpia para que puedas recuperarte rapido y seguir trabajando.",
      detail: error.stack ?? error.message,
      statusLabel: error.name,
      tone: "error",
    };
  }

  return {
    eyebrow: "Error inesperado",
    title: "La pantalla no pudo terminar de cargar",
    description:
      "Se produjo un fallo no identificado. Puedes reintentar ahora o volver al inicio mientras revisamos el problema.",
    detail: null,
    statusLabel: null,
    tone: "neutral",
  };
}

export function RouteErrorPage() {
  const error = useRouteError();
  const content = getRouteErrorContent(error);
  const [detailOpen, setDetailOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const glowColor =
    content.tone === "error"
      ? "bg-[#c0392b]/10"
      : content.tone === "warning"
        ? "bg-[#d97706]/10"
        : "bg-[#2f6fed]/10";

  const badgeColor =
    content.tone === "error"
      ? "border-[#c0392b]/30 bg-[#c0392b]/10 text-[#ff8a80]"
      : content.tone === "warning"
        ? "border-[#d97706]/30 bg-[#d97706]/10 text-[#fbbf24]"
        : "border-white/10 bg-white/[0.04] text-storm";

  const iconColor =
    content.tone === "error"
      ? "text-[#ff8a80]"
      : content.tone === "warning"
        ? "text-gold"
        : "text-storm";

  function handleCopy() {
    if (!content.detail) return;
    void navigator.clipboard.writeText(content.detail).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#040812] px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(55,110,211,0.12),_transparent_50%),radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.10),_transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center justify-center">
        <section className="relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-[#07101c]/95 p-7 shadow-[0_40px_120px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-10">
          {/* top shimmer */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          {/* glow orb */}
          <div className={`pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full ${glowColor} blur-3xl`} />

          <div className="relative">
            {/* eyebrow */}
            <div className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] ${badgeColor}`}>
              <AlertTriangle className={`h-3 w-3 ${iconColor}`} />
              {content.eyebrow}
            </div>

            {/* title */}
            <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {content.title}
            </h1>

            {/* description */}
            <p className="mt-3 text-sm leading-7 text-storm">
              {content.description}
            </p>

            {/* status label */}
            {content.statusLabel ? (
              <div className="mt-5 inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs font-mono font-medium text-storm/80">
                {content.statusLabel}
              </div>
            ) : null}

            {/* actions */}
            <div className="mt-7 flex flex-wrap gap-3">
              <Button className="gap-2" onClick={() => window.location.reload()}>
                <RefreshCcw className="h-4 w-4" />
                Reintentar
              </Button>
              <Link to="/">
                <Button className="gap-2" variant="secondary">
                  <Home className="h-4 w-4" />
                  Volver al inicio
                </Button>
              </Link>
            </div>

            {/* technical detail */}
            {content.detail ? (
              <div className="mt-7 overflow-hidden rounded-[20px] border border-white/10 bg-black/25">
                <button
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-medium text-ink/80 transition hover:text-ink"
                  onClick={() => setDetailOpen((v) => !v)}
                  type="button"
                >
                  <span>Ver detalle tecnico</span>
                  <ChevronDown className={`h-4 w-4 text-storm transition-transform duration-200 ${detailOpen ? "rotate-180" : ""}`} />
                </button>
                {detailOpen ? (
                  <div className="border-t border-white/8 px-5 pb-5 pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm/60">Traza de error</p>
                      <button
                        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.65rem] text-storm transition hover:text-ink"
                        onClick={handleCopy}
                        type="button"
                      >
                        <Copy className="h-3 w-3" />
                        {copied ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                    <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-all text-[0.65rem] leading-5 text-storm/75">
                      {content.detail}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
