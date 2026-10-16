import { Loader2, Sparkles } from "lucide-react";

import { InfoTip } from "../../../components/ui/info-tip";
import {
  buildDashboardAiTextParts,
  DASHBOARD_AI_TONE_OPTIONS,
  type DashboardAiComplexTerm,
  type DashboardAiTone,
  type DashboardAiToneResponse,
} from "../lib/dashboard-ai-content";

type DashboardAiSummaryPanelProps = {
  tone: DashboardAiTone;
  onToneChange: (tone: DashboardAiTone) => void;
  response: DashboardAiToneResponse | null;
  isPending: boolean;
  limitReached: boolean;
  errorMessage: string | null;
  onGenerate: () => void;
  unavailableReason?: string | null;
  title?: string;
  description?: string;
  contextLabel?: string;
};

function TermPopover({ term }: { term: DashboardAiComplexTerm }) {
  return (
    <InfoTip
      ariaLabel={`Qué significa ${term.term}`}
      title={term.term}
    >
      {term.explanation}
    </InfoTip>
  );
}

function ReplyText({
  reply,
  complexTerms,
}: {
  reply: string;
  complexTerms: DashboardAiComplexTerm[];
}) {
  const parts = buildDashboardAiTextParts(reply, complexTerms);

  return (
    <p className="whitespace-pre-line text-sm leading-7 text-storm">
      {parts.map((part, index) =>
        part.type === "term" ? (
          <span
            className="inline-flex items-center gap-0.5 font-medium text-ink underline decoration-dotted underline-offset-4"
            key={`term-${index}`}
          >
            {part.value}
            <TermPopover term={part.term} />
          </span>
        ) : (
          <span key={`text-${index}`}>{part.value}</span>
        ),
      )}
    </p>
  );
}

export function DashboardAiSummaryPanel({
  tone,
  onToneChange,
  response,
  isPending,
  limitReached,
  errorMessage,
  onGenerate,
  unavailableReason,
  title = "Tu situación explicada",
  description = "Revisa caja, cierre previsto, ahorro y pendientes del espacio actual. La consulta solo se envía al pulsar Generar.",
  contextLabel,
}: DashboardAiSummaryPanelProps) {
  const activeToneOption = DASHBOARD_AI_TONE_OPTIONS.find((option) => option.id === tone);
  const ctaLabel =
    tone === "managerial" ? "Generar informe" : "Generar explicación";

  return (
    <section
      className="rounded-[9px] border border-white/[0.08] bg-[#1a1917] p-5"
    >
      <div className="relative">
        {/* Badge */}
        <div className="flex items-center gap-2 text-xs text-storm">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Explicación con IA</span>
        </div>

        {/* Header */}
        <h3 className="mt-4 font-display text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
          {title}
        </h3>
        <p className="mt-1.5 text-sm leading-6 text-storm">
          {description}
        </p>
        {contextLabel ? <p className="mt-2 text-xs leading-5 text-storm">{contextLabel}</p> : null}

        {/* Selector de tono */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {DASHBOARD_AI_TONE_OPTIONS.map((option) => {
            const isActive = option.id === tone;
            return (
              <button
                aria-pressed={isActive}
                disabled={isPending}
                className={`flex-1 rounded-[9px] border px-4 py-3 text-left transition-colors duration-150 ${
                  isActive
                    ? "border-white/25 bg-white/[0.08]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/16"
                }`}
                key={option.id}
                onClick={() => onToneChange(option.id)}
                type="button"
              >
                <span
                  className={`text-sm font-semibold ${isActive ? "text-ink" : "text-storm"}`}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-storm/70">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <button
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[9px] bg-ink px-5 py-3 text-sm font-semibold text-void transition-colors duration-150 hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={isPending || limitReached || Boolean(unavailableReason)}
          onClick={onGenerate}
          type="button"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparando explicación...
            </>
          ) : limitReached && !response ? (
            "Consulta de hoy usada"
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {response ? "Actualizar explicación" : ctaLabel}
            </>
          )}
        </button>
        {unavailableReason ? <p role="status" className="mt-3 text-xs leading-5 text-storm">{unavailableReason}</p> : null}

        {/* Error */}
        {errorMessage ? (
          <p role="alert" className="mt-3 text-xs leading-5 text-rosewood">
            {errorMessage}
          </p>
        ) : null}

        {/* Estado: cargando sin respuesta previa */}
        {isPending && !response ? (
          <div className="mt-5 space-y-2.5">
            <div className="h-3 w-full animate-soft-pulse rounded-full bg-white/[0.06]" />
            <div className="h-3 w-[92%] animate-soft-pulse rounded-full bg-white/[0.06]" />
            <div className="h-3 w-[78%] animate-soft-pulse rounded-full bg-white/[0.06]" />
          </div>
        ) : null}

        {/* Respuesta generada */}
        {response ? (
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
                <Sparkles className="h-3 w-3" />
                IA · {activeToneOption?.label ?? "Resumen"}
              </span>
              <span className="text-[0.65rem] text-storm/60">
                Toca las palabras resaltadas para ver su explicación simple.
              </span>
            </div>
            <p className="mb-3 text-xs text-storm">Generada el {new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" }).format(new Date(response.generatedAt))}. Es una lectura guardada, no una actualización en vivo.</p>
            <ReplyText complexTerms={response.complexTerms} reply={response.reply} />
          </div>
        ) : !isPending ? (
          <p className="mt-4 text-xs leading-6 text-storm/60">
            La IA interpreta el resumen; no registra movimientos ni cambia tus datos financieros. {limitReached ? "Vuelve mañana para una nueva lectura." : ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}
