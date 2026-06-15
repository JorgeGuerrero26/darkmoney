import { Loader2, Sparkles } from "lucide-react";

import { InfoTip } from "../../../components/ui/info-tip";
import {
  buildDashboardAiTextParts,
  DASHBOARD_AI_TONE_OPTIONS,
  GEMINI_BRAND,
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
            className="inline-flex items-center gap-0.5 font-medium text-pine"
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
}: DashboardAiSummaryPanelProps) {
  const activeToneOption = DASHBOARD_AI_TONE_OPTIONS.find((option) => option.id === tone);
  const ctaLabel =
    tone === "managerial" ? "Ver informe gerencial" : "Hablar con mi asesor personal";

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(142,165,255,0.08),rgba(107,228,197,0.05)_45%,rgba(5,9,16,0.9))] p-5 sm:p-6"
    >
      {/* Glows de marca */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute -left-12 -top-12 h-44 w-44 rounded-full blur-[90px]"
          style={{ backgroundColor: `${GEMINI_BRAND.blue}26` }}
        />
        <div
          className="absolute -right-10 top-10 h-40 w-40 rounded-full blur-[90px]"
          style={{ backgroundColor: `${GEMINI_BRAND.coral}1f` }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-36 w-44 rounded-full blur-[90px]"
          style={{ backgroundColor: `${GEMINI_BRAND.teal}1f` }}
        />
      </div>

      <div className="relative">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-pine" />
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink">
            Impulsado por IA
          </span>
          <span className="flex items-center gap-1">
            {[GEMINI_BRAND.blue, GEMINI_BRAND.coral, GEMINI_BRAND.gold, GEMINI_BRAND.teal].map(
              (color) => (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  key={color}
                  style={{ backgroundColor: color }}
                />
              ),
            )}
          </span>
        </div>

        {/* Header */}
        <h3 className="mt-4 font-display text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
          Tu situación explicada
        </h3>
        <p className="mt-1.5 text-sm leading-6 text-storm">
          Una capa inteligente lee las señales de tu dashboard y las convierte en una explicación
          accionable.
        </p>

        {/* Selector de tono */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {DASHBOARD_AI_TONE_OPTIONS.map((option) => {
            const isActive = option.id === tone;
            return (
              <button
                className={`flex-1 rounded-2xl border px-4 py-3 text-left transition duration-200 ${
                  isActive
                    ? "border-pine/30 bg-pine/10"
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
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-void transition duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={isPending || limitReached}
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

        {/* Error */}
        {errorMessage ? (
          <p className="mt-3 rounded-2xl border border-rosewood/20 bg-rosewood/[0.07] px-4 py-2.5 text-xs leading-5 text-rosewood">
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
          <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-pine/20 bg-pine/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-pine">
                <Sparkles className="h-3 w-3" />
                IA · {activeToneOption?.label ?? "Resumen"}
              </span>
              <span className="text-[0.65rem] text-storm/60">
                Toca las palabras resaltadas para ver su explicación simple.
              </span>
            </div>
            <ReplyText complexTerms={response.complexTerms} reply={response.reply} />
          </div>
        ) : !isPending ? (
          <p className="mt-4 text-xs leading-6 text-storm/60">
            La IA interpreta tu resumen del dashboard y te dice en lenguaje simple cómo estás
            parado hoy y qué conviene atender primero. {limitReached ? "Vuelve mañana para una nueva lectura." : ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}
