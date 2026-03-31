import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Info, X } from "lucide-react";

import { Button } from "../../../components/ui/button";
import {
  getDashboardMetricHelp,
  type DashboardMetricChart,
} from "./dashboard-metric-help-content";

type DashboardHelpContextValue = {
  open: (metricId: string) => void;
  close: () => void;
};

const DashboardHelpContext = createContext<DashboardHelpContextValue | null>(null);

function HelpChartDemo({ chart }: { chart: DashboardMetricChart }) {
  if (!chart) {
    return null;
  }

  if (chart === "monthly-net-bars") {
    const heights = [35, 55, 40, 70, 45, 60];
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">Ejemplo visual</p>
        <p className="mt-2 text-sm leading-6 text-storm">
          Cada barra representa un mes; la altura es proporcional al ahorro neto de ese mes (positivo arriba).
        </p>
        <div className="mt-3 flex h-28 items-end gap-1.5">
          {heights.map((h, i) => (
            <div
              className="min-w-0 flex-1 rounded-t-md bg-gradient-to-t from-pine/50 to-pine"
              key={i}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (chart === "savings-capacity") {
    return (
      <div className="mt-4 rounded-2xl border border-gold/22 bg-gold/10 p-4">
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-gold">Ejemplo numérico</p>
        <p className="mt-2 text-sm leading-6 text-storm">
          Ingresos del período: S/ 4 000 · Ahorro neto: S/ 640
        </p>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[16%] rounded-full bg-gold" />
        </div>
        <p className="mt-2 text-xs text-storm">Capacidad de ahorro = 640 ÷ 4 000 = 16%.</p>
      </div>
    );
  }

  if (chart === "income-expense-bars") {
    return (
      <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-pine">Ingresos</p>
          <div className="mt-2 flex h-20 items-end rounded-xl bg-pine/10 p-2">
            <div className="h-[72%] w-full rounded-lg bg-pine" />
          </div>
        </div>
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ember">Gastos</p>
          <div className="mt-2 flex h-20 items-end rounded-xl bg-ember/10 p-2">
            <div className="h-[55%] w-full rounded-lg bg-ember" />
          </div>
        </div>
      </div>
    );
  }

  if (chart === "category-compare") {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">Comparación rápida</p>
        <p className="mt-2 text-sm text-storm">Barra larga = período actual; barra tenue = período anterior.</p>
        <div className="mt-3 space-y-2">
          <div className="h-2 rounded-full bg-white/[0.08]">
            <div className="h-full w-[80%] rounded-full bg-gradient-to-r from-ember to-gold" />
          </div>
          <div className="h-2 rounded-full bg-white/[0.08]">
            <div className="h-full w-[55%] rounded-full bg-white/35" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function DashboardHelpModal({ id, onClose }: { id: string; onClose: () => void }) {
  const article = getDashboardMetricHelp(id);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      aria-labelledby="dashboard-metric-help-title"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
    >
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div className="relative z-[1] max-h-[min(88vh,720px)] w-full max-w-lg overflow-y-auto rounded-[28px] border border-white/12 bg-[#12151c] p-6 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink" id="dashboard-metric-help-title">
            {article.title}
          </h2>
          <Button
            aria-label="Cerrar"
            className="h-10 w-10 shrink-0 rounded-[14px] px-0"
            onClick={onClose}
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 space-y-4 text-sm leading-7 text-storm">
          {article.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          {article.bullets && article.bullets.length > 0 ? (
            <ul className="list-disc space-y-2 pl-5">
              {article.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {article.example ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">Ejemplo</p>
              <p className="mt-2 text-sm leading-7 text-ink/90">{article.example}</p>
            </div>
          ) : null}
          <HelpChartDemo chart={article.chart ?? null} />
        </div>
      </div>
    </div>
  );
}

export function DashboardHelpProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const close = useCallback(() => setOpenId(null), []);
  const open = useCallback((metricId: string) => setOpenId(metricId), []);

  useEffect(() => {
    if (!openId) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, close]);

  return (
    <DashboardHelpContext.Provider value={{ open, close }}>
      {children}
      {openId ? <DashboardHelpModal id={openId} onClose={close} /> : null}
    </DashboardHelpContext.Provider>
  );
}

export function DashboardHelpTrigger({
  metricId,
  className = "",
}: {
  metricId: string;
  className?: string;
}) {
  const ctx = useContext(DashboardHelpContext);
  if (!ctx) {
    return null;
  }

  return (
    <button
      aria-label={`Más información: ${metricId}`}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/14 bg-white/[0.06] text-storm transition hover:border-gold/35 hover:bg-white/[0.1] hover:text-gold ${className}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        ctx.open(metricId);
      }}
      type="button"
    >
      <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
    </button>
  );
}

export function DashboardKpiHelpWrap({
  metricId,
  className = "",
  children,
}: {
  metricId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute right-2 top-2 z-[1] sm:right-3 sm:top-3">
        <DashboardHelpTrigger metricId={metricId} />
      </div>
      <div className="pr-10">{children}</div>
    </div>
  );
}
