import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Target,
  X,
} from "lucide-react";
import { useMemo, useRef } from "react";

import { Button } from "../../../components/ui/button";
import { useFocusTrap } from "../../../components/ui/use-focus-trap";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDate } from "../../../lib/formatting/dates";
import type { BudgetOverview, MovementRecord } from "../../../types/domain";

// ─── helpers ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getWeekKey(date: Date, periodStart: Date): number {
  const ms = date.getTime() - periodStart.getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

function getDaysBetween(start: Date, end: Date) {
  return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

// ─── progress gauge ───────────────────────────────────────────────────────────

function ProgressGauge({
  usedPercent,
  spentAmount,
  limitAmount,
  remainingAmount,
  currencyCode,
  isOverLimit,
  isNearLimit,
  alertPercent,
}: {
  usedPercent: number;
  spentAmount: number;
  limitAmount: number;
  remainingAmount: number;
  currencyCode: string;
  isOverLimit: boolean;
  isNearLimit: boolean;
  alertPercent: number;
}) {
  const barPct = clamp(usedPercent, 0, 100);
  const alertPct = clamp(alertPercent, 0, 100);
  const color = isOverLimit ? "#f27a86" : isNearLimit ? "#f5c842" : "#6be4c5";

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
            Progreso del presupuesto
          </p>
          <p className="mt-1 font-display text-3xl font-semibold" style={{ color }}>
            {usedPercent.toFixed(1)}%
          </p>
          <p className="mt-0.5 text-xs text-storm/60">
            {formatCurrency(spentAmount, currencyCode)} de {formatCurrency(limitAmount, currencyCode)}
          </p>
        </div>
        <div className="text-right">
          {isOverLimit ? (
            <div className="flex items-center gap-1.5 text-[#f27a86]">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-semibold">Excedido</span>
            </div>
          ) : isNearLimit ? (
            <div className="flex items-center gap-1.5 text-[#f5c842]">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-semibold">En riesgo</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-pine">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-semibold">En control</span>
            </div>
          )}
          <p className="mt-1 text-xs text-storm/60">
            {remainingAmount >= 0
              ? `Queda ${formatCurrency(remainingAmount, currencyCode)}`
              : `Excede por ${formatCurrency(Math.abs(remainingAmount), currencyCode)}`}
          </p>
        </div>
      </div>

      {/* Bar */}
      <div className="relative mt-4 h-3 rounded-full bg-white/[0.08]">
        {/* Alert marker */}
        <div
          className="absolute top-0 h-full w-0.5 rounded-full bg-white/25"
          style={{ left: `${alertPct}%` }}
          title={`Alerta al ${alertPct}%`}
        />
        {/* Fill */}
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${barPct}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[0.6rem] text-storm/50">
        <span>0</span>
        <span>Alerta {alertPercent}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

// ─── weekly bar chart ─────────────────────────────────────────────────────────

function WeeklyChart({
  weeks,
  currencyCode,
  color,
}: {
  weeks: Array<{ label: string; amount: number }>;
  currencyCode: string;
  color: string;
}) {
  const maxVal = Math.max(1, ...weeks.map((w) => w.amount));

  if (weeks.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-storm/50">Sin datos de semanas.</p>
    );
  }

  return (
    <div className="mt-3 flex items-end gap-1.5 h-28">
      {weeks.map((w) => {
        const barH = clamp((w.amount / maxVal) * 96, 0, 96);
        return (
          <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-[4px]"
              style={{
                height: barH || 2,
                minHeight: 2,
                backgroundColor: w.amount > 0 ? `${color}cc` : "rgba(255,255,255,0.06)",
              }}
              title={`${w.label}: ${formatCurrency(w.amount, currencyCode)}`}
            />
            <span className="text-[0.56rem] text-storm/50 whitespace-nowrap">{w.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── horizontal bars ──────────────────────────────────────────────────────────

function HorizontalBars({
  items,
  currencyCode,
  color,
}: {
  items: Array<{ name: string; amount: number; count: number }>;
  currencyCode: string;
  color: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.amount));

  return (
    <div className="mt-3 space-y-3">
      {items.map((item) => (
        <div key={item.name}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-storm">{item.name}</span>
            <span className="shrink-0 text-xs font-medium text-ink">
              {formatCurrency(item.amount, currencyCode)}
              <span className="ml-1 text-storm/50">({item.count})</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.amount / max) * 100}%`, backgroundColor: `${color}88` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

type BudgetAnalyticsModalProps = {
  budget: BudgetOverview;
  movements: MovementRecord[];
  displayCurrencyCode: string;
  onClose: () => void;
};

export function BudgetAnalyticsModal({
  budget,
  movements,
  displayCurrencyCode: _displayCurrencyCode,
  onClose,
}: BudgetAnalyticsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  const color = budget.isOverLimit ? "#f27a86" : budget.isNearLimit ? "#f5c842" : "#6be4c5";
  const currencyCode = budget.currencyCode;

  // ── filter movements for this budget ──────────────────────────────────────
  const budgetMovements = useMemo(() => {
    const start = budget.periodStart;
    const end = budget.periodEnd;

    return movements.filter((m) => {
      if (m.status !== "posted") return false;
      if (!["expense", "subscription_payment"].includes(m.movementType)) return false;

      const date = m.occurredAt.slice(0, 10);
      if (date < start || date > end) return false;

      if (budget.categoryId && m.categoryId !== budget.categoryId) return false;
      if (budget.accountId && m.sourceAccountId !== budget.accountId) return false;

      return true;
    });
  }, [movements, budget]);

  // ── weekly spending within the period ─────────────────────────────────────
  const weeklyData = useMemo(() => {
    const start = new Date(`${budget.periodStart}T00:00:00`);
    const end = new Date(`${budget.periodEnd}T23:59:59`);
    const totalDays = getDaysBetween(start, end);
    const numWeeks = Math.max(1, Math.ceil(totalDays / 7));

    const weeks: Array<{ label: string; amount: number }> = Array.from(
      { length: numWeeks },
      (_, i) => {
        const weekStart = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        return { label: `S${i + 1} ${weekStart.toLocaleDateString("es", { day: "2-digit", month: "2-digit" })}`, amount: 0 };
      },
    );

    for (const m of budgetMovements) {
      const date = new Date(m.occurredAt);
      const weekIdx = getWeekKey(date, start);
      if (weekIdx >= 0 && weekIdx < weeks.length) {
        weeks[weekIdx].amount += m.sourceAmount ?? 0;
      }
    }

    return weeks;
  }, [budgetMovements, budget.periodStart, budget.periodEnd]);

  // ── top categories (only if not category-scoped) ──────────────────────────
  const topCategories = useMemo(() => {
    if (budget.categoryId) return [];
    const catMap = new Map<string, { amount: number; count: number }>();
    for (const m of budgetMovements) {
      const name = m.category || "Sin categoría";
      const prev = catMap.get(name) ?? { amount: 0, count: 0 };
      catMap.set(name, { amount: prev.amount + (m.sourceAmount ?? 0), count: prev.count + 1 });
    }
    return [...catMap.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [budgetMovements, budget.categoryId]);

  // ── top accounts (only if not account-scoped) ─────────────────────────────
  const topAccounts = useMemo(() => {
    if (budget.accountId) return [];
    const accMap = new Map<string, { amount: number; count: number }>();
    for (const m of budgetMovements) {
      const name = m.sourceAccountName ?? "Cuenta desconocida";
      const prev = accMap.get(name) ?? { amount: 0, count: 0 };
      accMap.set(name, { amount: prev.amount + (m.sourceAmount ?? 0), count: prev.count + 1 });
    }
    return [...accMap.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [budgetMovements, budget.accountId]);

  // ── recent movements ───────────────────────────────────────────────────────
  const recentMovements = useMemo(
    () =>
      [...budgetMovements]
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 8),
    [budgetMovements],
  );

  const metricCards = [
    {
      label: "Gastado",
      value: formatCurrency(budget.spentAmount, currencyCode),
      sublabel: `${budget.usedPercent.toFixed(1)}% del límite`,
      colorClass: budget.isOverLimit ? "text-ember" : "text-ink",
    },
    {
      label: "Límite",
      value: formatCurrency(budget.limitAmount, currencyCode),
      sublabel: `Alerta al ${budget.alertPercent}%`,
      colorClass: "text-ink",
    },
    {
      label: "Restante",
      value: formatCurrency(Math.abs(budget.remainingAmount), currencyCode),
      sublabel: budget.remainingAmount < 0 ? "excedido" : "disponible",
      colorClass: budget.remainingAmount < 0 ? "text-ember" : "text-pine",
    },
    {
      label: "Movimientos",
      value: String(budget.movementCount),
      sublabel: `en el periodo`,
      colorClass: "text-ink",
    },
  ];

  const periodLabel = `${formatDate(budget.periodStart)} — ${formatDate(budget.periodEnd)}`;

  return (
    <div
      aria-labelledby="budget-analytics-title"
      aria-modal="true"
      className="fixed inset-0 z-[80] isolate flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-xl p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div
        className="animate-rise-in relative w-full max-w-4xl rounded-[36px] border border-white/10 bg-[#050a12]/96 shadow-[0_40px_130px_rgba(0,0,0,0.7)] my-auto"
        onMouseDown={(e) => e.stopPropagation()}
        ref={dialogRef}
      >
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[36px]">
          <div
            className="absolute -left-16 -top-16 h-56 w-56 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: color }}
          />
          <div
            className="absolute right-0 bottom-0 h-44 w-44 rounded-full blur-3xl opacity-15"
            style={{ backgroundColor: color }}
          />
        </div>

        {/* Header */}
        <div className="relative flex items-start justify-between gap-4 border-b border-white/[0.07] px-6 py-5">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{ backgroundColor: `${color}25`, border: `1px solid ${color}40` }}
            >
              <Target className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
                Análisis de presupuesto
              </p>
              <h2
                className="font-display text-2xl font-semibold text-ink"
                id="budget-analytics-title"
              >
                {budget.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-storm/60">
                  <Calendar className="h-3 w-3" />
                  {periodLabel}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em]"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {budget.scopeLabel}
                </span>
                {!budget.isActive ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[0.62rem] text-storm/60 uppercase tracking-[0.14em]">
                    Inactivo
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <button
            aria-label="Cerrar análisis"
            className="rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-storm transition hover:bg-white/[0.08] hover:text-ink"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative space-y-5 p-5 sm:p-6">

          {/* ── Progress gauge ── */}
          <ProgressGauge
            alertPercent={budget.alertPercent}
            currencyCode={currencyCode}
            isNearLimit={budget.isNearLimit}
            isOverLimit={budget.isOverLimit}
            limitAmount={budget.limitAmount}
            remainingAmount={budget.remainingAmount}
            spentAmount={budget.spentAmount}
            usedPercent={budget.usedPercent}
          />

          {/* ── Metric cards ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metricCards.map(({ label, value, sublabel, colorClass }) => (
              <div
                className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4"
                key={label}
              >
                <p className="mb-2 text-[0.62rem] uppercase tracking-[0.2em] text-storm/70">
                  {label}
                </p>
                <p className={`font-display text-xl font-semibold ${colorClass}`}>{value}</p>
                <p className="mt-1 text-[0.62rem] text-storm/50">{sublabel}</p>
              </div>
            ))}
          </div>

          {/* ── Weekly spending chart ── */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
              Evolución semanal
            </h3>
            <p className="mt-0.5 text-xs text-storm/50">
              Gasto por semana dentro del período del presupuesto.
            </p>
            <WeeklyChart
              color={color}
              currencyCode={currencyCode}
              weeks={weeklyData}
            />
          </section>

          {/* ── Categories + Accounts ── */}
          {(topCategories.length > 0 || topAccounts.length > 0) ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {topCategories.length > 0 ? (
                <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                  <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
                    Por categoría
                  </h3>
                  <p className="mt-0.5 text-xs text-storm/50">
                    Categorías con mayor gasto en este presupuesto.
                  </p>
                  <HorizontalBars
                    color={color}
                    currencyCode={currencyCode}
                    items={topCategories}
                  />
                </section>
              ) : null}

              {topAccounts.length > 0 ? (
                <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                  <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
                    Por cuenta
                  </h3>
                  <p className="mt-0.5 text-xs text-storm/50">
                    Cuentas que más gastaron en este período.
                  </p>
                  <HorizontalBars
                    color={color}
                    currencyCode={currencyCode}
                    items={topAccounts}
                  />
                </section>
              ) : null}
            </div>
          ) : null}

          {/* ── Recent movements ── */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <h3 className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
              Movimientos del periodo
            </h3>
            {recentMovements.length === 0 ? (
              <p className="py-4 text-center text-sm text-storm/50">
                No hay movimientos aplicados en este período con el scope configurado.
              </p>
            ) : (
              <div className="space-y-2">
                {recentMovements.map((m) => {
                  const amount = m.sourceAmount ?? 0;
                  const movCurrency = m.sourceCurrencyCode ?? currencyCode;

                  return (
                    <div
                      className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-black/10 px-3 py-2.5"
                      key={m.id}
                    >
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        <BarChart3 className="h-3.5 w-3.5" style={{ color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-ink">{m.description}</p>
                        <p className="text-[0.62rem] text-storm/60">
                          {m.category !== "Sin categoria" ? `${m.category} · ` : ""}
                          {m.sourceAccountName ?? "—"} · {formatDate(new Date(m.occurredAt).toISOString())}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-ember">
                        -{formatCurrency(amount, movCurrency)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex justify-end">
            <Button onClick={onClose} variant="ghost">
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
