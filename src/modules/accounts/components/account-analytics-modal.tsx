import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  TrendingUp,
  X,
} from "lucide-react";
import { useMemo, useRef } from "react";

import { Button } from "../../../components/ui/button";
import { useFocusTrap } from "../../../components/ui/use-focus-trap";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDate } from "../../../lib/formatting/dates";
import type { AccountSummary, MovementRecord } from "../../../types/domain";

// ─── helpers ─────────────────────────────────────────────────────────────────

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key: string) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es", { month: "short", year: "2-digit" });
}

function getLast6MonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(getMonthKey(d));
  }
  return keys;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// ─── mini SVG charts ──────────────────────────────────────────────────────────

function BalanceLineChart({
  points,
  currencyCode,
  color,
}: {
  points: Array<{ label: string; balance: number }>;
  currencyCode: string;
  color: string;
}) {
  if (points.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-storm/60">
        Necesitas al menos 2 movimientos para ver la evolución.
      </p>
    );
  }

  const w = 580;
  const h = 180;
  const px = 16;
  const py = 20;

  const balances = points.map((p) => p.balance);
  const maxB = Math.max(...balances);
  const minB = Math.min(...balances);
  const range = Math.max(1, maxB - minB);

  const stepX = points.length > 1 ? (w - px * 2) / (points.length - 1) : 0;
  const getY = (v: number) => py + ((maxB - v) / range) * (h - py * 2);

  const coords = points.map((p, i) => ({
    x: px + stepX * i,
    y: getY(p.balance),
    ...p,
  }));

  const linePath = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPath = `${px},${h - py} ${linePath} ${px + stepX * (points.length - 1)},${h - py}`;

  const hexColor = color || "#6be4c5";

  return (
    <div className="overflow-x-auto">
      <svg
        className="min-w-[380px] w-full"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`acct-fill-${hexColor.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={`${hexColor}44`} />
            <stop offset="100%" stopColor={`${hexColor}04`} />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((step, i) => (
          <line
            key={i}
            stroke="rgba(255,255,255,0.07)"
            strokeDasharray="4 6"
            x1={px}
            x2={w - px}
            y1={py + (h - py * 2) * step}
            y2={py + (h - py * 2) * step}
          />
        ))}
        <polygon fill={`url(#acct-fill-${hexColor.replace("#", "")})`} points={areaPath} />
        <polyline
          fill="none"
          points={linePath}
          stroke={hexColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        {coords.map((c, i) => (
          <g key={i}>
            <title>{`${c.label}: ${formatCurrency(c.balance, currencyCode)}`}</title>
            <circle cx={c.x} cy={c.y} fill={hexColor} r="4" opacity="0.9" />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex justify-between px-2">
        <span className="text-[0.62rem] text-storm/60">{points[0].label}</span>
        <span className="text-[0.62rem] text-storm/60">{points[points.length - 1].label}</span>
      </div>
      <div className="mt-1 flex justify-between px-2">
        <span className="text-xs font-medium text-storm/80">{formatCurrency(balances[0], currencyCode)}</span>
        <span className="text-xs font-medium text-storm/80">{formatCurrency(balances[balances.length - 1], currencyCode)}</span>
      </div>
    </div>
  );
}

function MonthlyFlowChart({
  months,
  currencyCode,
}: {
  months: Array<{ key: string; income: number; expense: number }>;
  currencyCode: string;
}) {
  const maxVal = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));

  return (
    <div className="mt-3 flex items-end gap-2 h-36">
      {months.map((m) => {
        const incomeH = clamp((m.income / maxVal) * 120, 0, 120);
        const expenseH = clamp((m.expense / maxVal) * 120, 0, 120);

        return (
          <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end gap-0.5" style={{ height: 120 }}>
              <div
                className="flex-1 rounded-t-[4px] bg-pine/70"
                style={{ height: incomeH || 2, minHeight: 2 }}
                title={`Ingresos: ${formatCurrency(m.income, currencyCode)}`}
              />
              <div
                className="flex-1 rounded-t-[4px] bg-ember/70"
                style={{ height: expenseH || 2, minHeight: 2 }}
                title={`Gastos: ${formatCurrency(m.expense, currencyCode)}`}
              />
            </div>
            <span className="text-[0.58rem] text-storm/60 whitespace-nowrap">{getMonthLabel(m.key)}</span>
          </div>
        );
      })}
    </div>
  );
}

function CategoryBars({
  items,
  currencyCode,
}: {
  items: Array<{ name: string; amount: number }>;
  currencyCode: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.amount));

  return (
    <div className="mt-3 space-y-2.5">
      {items.map((item) => (
        <div key={item.name}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-storm">{item.name}</span>
            <span className="shrink-0 text-xs font-medium text-ink">
              {formatCurrency(item.amount, currencyCode)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-ember/60"
              style={{ width: `${(item.amount / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

type AccountAnalyticsModalProps = {
  account: AccountSummary;
  movements: MovementRecord[];
  onClose: () => void;
};

export function AccountAnalyticsModal({
  account,
  movements,
  onClose,
}: AccountAnalyticsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  // ── filter movements for this account ──────────────────────────────────────
  const accountMovements = useMemo(
    () =>
      movements.filter(
        (m) =>
          m.status !== "voided" &&
          (m.sourceAccountId === account.id || m.destinationAccountId === account.id),
      ),
    [movements, account.id],
  );

  const postedMovements = useMemo(
    () => accountMovements.filter((m) => m.status === "posted"),
    [accountMovements],
  );

  // ── key metrics ────────────────────────────────────────────────────────────
  const { totalIn, totalOut } = useMemo(() => {
    let tin = 0;
    let tout = 0;
    for (const m of postedMovements) {
      if (m.destinationAccountId === account.id && m.destinationAmount !== null) {
        tin += m.destinationAmount;
      }
      if (m.sourceAccountId === account.id && m.sourceAmount !== null) {
        tout += m.sourceAmount;
      }
    }
    return { totalIn: tin, totalOut: tout };
  }, [postedMovements, account.id]);

  const netFlow = totalIn - totalOut;

  // ── balance over time (running balance, monthly resolution) ────────────────
  const balancePoints = useMemo(() => {
    const sorted = [...postedMovements].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );

    // Group into months
    const monthMap = new Map<string, number>(); // monthKey -> delta
    for (const m of sorted) {
      const key = getMonthKey(new Date(m.occurredAt));
      const prev = monthMap.get(key) ?? 0;
      const inflow = m.destinationAccountId === account.id ? (m.destinationAmount ?? 0) : 0;
      const outflow = m.sourceAccountId === account.id ? (m.sourceAmount ?? 0) : 0;
      monthMap.set(key, prev + inflow - outflow);
    }

    if (monthMap.size === 0) return [];

    // Build running balance from openingBalance
    const keys = [...monthMap.keys()].sort();
    let running = account.openingBalance;
    return keys.map((key) => {
      running += monthMap.get(key) ?? 0;
      return { label: getMonthLabel(key), balance: running };
    });
  }, [postedMovements, account.id, account.openingBalance]);

  // ── monthly cashflow (last 6 months) ──────────────────────────────────────
  const monthlyFlow = useMemo(() => {
    const last6 = getLast6MonthKeys();
    const result = last6.map((key) => ({ key, income: 0, expense: 0 }));

    for (const m of postedMovements) {
      const key = getMonthKey(new Date(m.occurredAt));
      const slot = result.find((r) => r.key === key);
      if (!slot) continue;

      const isExpenseType = ["expense", "subscription_payment"].includes(m.movementType);
      const isIncomeType = ["income", "refund"].includes(m.movementType);

      if (m.destinationAccountId === account.id && isIncomeType) {
        slot.income += m.destinationAmount ?? 0;
      }
      if (m.sourceAccountId === account.id && isExpenseType) {
        slot.expense += m.sourceAmount ?? 0;
      }
    }

    return result;
  }, [postedMovements, account.id]);

  // ── top expense categories ─────────────────────────────────────────────────
  const topCategories = useMemo(() => {
    const catMap = new Map<string, number>();
    for (const m of postedMovements) {
      if (m.sourceAccountId !== account.id) continue;
      if (!["expense", "subscription_payment"].includes(m.movementType)) continue;
      const name = m.category || "Sin categoría";
      catMap.set(name, (catMap.get(name) ?? 0) + (m.sourceAmount ?? 0));
    }
    return [...catMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [postedMovements, account.id]);

  // ── recent movements ───────────────────────────────────────────────────────
  const recentMovements = useMemo(
    () =>
      [...accountMovements]
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 8),
    [accountMovements],
  );

  const metricCards = [
    {
      label: "Total entradas",
      value: formatCurrency(totalIn, account.currencyCode),
      tone: "success" as const,
      icon: ArrowUpCircle,
    },
    {
      label: "Total salidas",
      value: formatCurrency(totalOut, account.currencyCode),
      tone: "danger" as const,
      icon: ArrowDownCircle,
    },
    {
      label: "Flujo neto",
      value: formatCurrency(netFlow, account.currencyCode),
      tone: netFlow >= 0 ? ("success" as const) : ("danger" as const),
      icon: TrendingUp,
    },
    {
      label: "Movimientos",
      value: String(accountMovements.length),
      tone: "neutral" as const,
      icon: BarChart3,
    },
  ];

  return (
    <div
      aria-labelledby="analytics-title"
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
            className="absolute -left-16 -top-16 h-56 w-56 rounded-full blur-3xl opacity-30"
            style={{ backgroundColor: account.color }}
          />
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#6f86ff]/12 blur-3xl" />
        </div>

        {/* Header */}
        <div className="relative flex items-start justify-between gap-4 border-b border-white/[0.07] px-6 py-5">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{ backgroundColor: account.color }}
            >
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
                Análisis de cuenta
              </p>
              <h2
                className="font-display text-2xl font-semibold text-ink"
                id="analytics-title"
              >
                {account.name}
              </h2>
              <p className="mt-0.5 text-sm text-storm/70">
                {account.type} · {account.currencyCode}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              aria-label="Cerrar análisis"
              className="rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-storm transition hover:bg-white/[0.08] hover:text-ink"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="font-display text-2xl font-semibold text-ink">
              {formatCurrency(account.currentBalance, account.currencyCode)}
            </p>
            <p className="text-xs text-storm/60">Saldo actual</p>
          </div>
        </div>

        <div className="relative space-y-6 p-5 sm:p-6">

          {/* ── Metric cards ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metricCards.map(({ label, value, tone, icon: Icon }) => (
              <div
                className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4"
                key={label}
              >
                <div className="mb-3 flex items-center gap-2">
                  <Icon
                    className={`h-4 w-4 ${
                      tone === "success"
                        ? "text-pine"
                        : tone === "danger"
                          ? "text-ember"
                          : "text-storm"
                    }`}
                  />
                  <span className="text-[0.62rem] uppercase tracking-[0.2em] text-storm/70">
                    {label}
                  </span>
                </div>
                <p
                  className={`font-display text-xl font-semibold ${
                    tone === "success"
                      ? "text-pine"
                      : tone === "danger"
                        ? "text-ember"
                        : "text-ink"
                  }`}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* ── Balance over time ── */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <h3 className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
              Saldo en el tiempo
            </h3>
            <p className="mb-4 text-xs text-storm/50">
              Evolución mensual del saldo partiendo del saldo inicial.
            </p>
            <BalanceLineChart
              color={account.color}
              currencyCode={account.currencyCode}
              points={balancePoints}
            />
          </section>

          {/* ── Monthly cashflow + top categories ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
              <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
                Flujo mensual
              </h3>
              <p className="mt-0.5 text-xs text-storm/50">Últimos 6 meses — entradas vs salidas.</p>
              <div className="mt-3 flex items-center gap-3 text-[0.65rem] text-storm/60">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-pine/70" />
                  Entradas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-ember/70" />
                  Salidas
                </span>
              </div>
              <MonthlyFlowChart
                currencyCode={account.currencyCode}
                months={monthlyFlow}
              />
            </section>

            <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
              <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
                Top categorías de gasto
              </h3>
              <p className="mt-0.5 text-xs text-storm/50">
                Las categorías con mayor volumen de salidas.
              </p>
              {topCategories.length > 0 ? (
                <CategoryBars
                  currencyCode={account.currencyCode}
                  items={topCategories}
                />
              ) : (
                <p className="mt-6 text-center text-sm text-storm/50">
                  Sin gastos categorizados aún.
                </p>
              )}
            </section>
          </div>

          {/* ── Recent movements ── */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <h3 className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
              Movimientos recientes
            </h3>
            {recentMovements.length === 0 ? (
              <p className="py-4 text-center text-sm text-storm/50">
                No hay movimientos registrados para esta cuenta.
              </p>
            ) : (
              <div className="space-y-2">
                {recentMovements.map((m) => {
                  const isIn = m.destinationAccountId === account.id;
                  const amount = isIn ? (m.destinationAmount ?? 0) : (m.sourceAmount ?? 0);
                  const currency = isIn
                    ? (m.destinationCurrencyCode ?? account.currencyCode)
                    : (m.sourceCurrencyCode ?? account.currencyCode);

                  return (
                    <div
                      className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-black/10 px-3 py-2.5"
                      key={m.id}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${
                          isIn ? "bg-pine/25" : "bg-ember/25"
                        }`}
                      >
                        {isIn ? (
                          <ArrowUpCircle className="h-3.5 w-3.5 text-pine" />
                        ) : (
                          <ArrowDownCircle className="h-3.5 w-3.5 text-ember" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-ink">{m.description}</p>
                        <p className="text-[0.62rem] text-storm/60">
                          {m.category !== "Sin categoria" ? `${m.category} · ` : ""}{formatDate(new Date(m.occurredAt).toISOString())}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-semibold ${isIn ? "text-pine" : "text-ember"}`}
                        >
                          {isIn ? "+" : "-"}{formatCurrency(amount, currency)}
                        </p>
                        <p className="text-[0.6rem] uppercase tracking-[0.15em] text-storm/50">
                          {m.status}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Footer */}
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
