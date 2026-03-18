import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Hash,
  X,
} from "lucide-react";
import { useMemo, useRef } from "react";

import { Button } from "../../../components/ui/button";
import { useFocusTrap } from "../../../components/ui/use-focus-trap";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDate } from "../../../lib/formatting/dates";
import type { CategoryOverview, MovementRecord } from "../../../types/domain";

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

const KIND_COLORS: Record<string, string> = {
  expense: "#f27a86",
  income: "#6be4c5",
  both: "#6f86ff",
};

const KIND_LABELS: Record<string, string> = {
  expense: "Gasto",
  income: "Ingreso",
  both: "Ambos",
};

// ─── mini charts ─────────────────────────────────────────────────────────────

function MonthlyAmountChart({
  months,
  currencyCode,
  color,
}: {
  months: Array<{ key: string; amount: number }>;
  currencyCode: string;
  color: string;
}) {
  const maxVal = Math.max(1, ...months.map((m) => m.amount));

  return (
    <div className="mt-3 flex items-end gap-2 h-32">
      {months.map((m) => {
        const barH = clamp((m.amount / maxVal) * 108, 0, 108);

        return (
          <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-[5px] transition-all"
              style={{
                height: barH || 2,
                minHeight: 2,
                backgroundColor: m.amount > 0 ? `${color}bb` : "rgba(255,255,255,0.06)",
              }}
              title={`${getMonthLabel(m.key)}: ${formatCurrency(m.amount, currencyCode)}`}
            />
            <span className="text-[0.58rem] text-storm/60 whitespace-nowrap">{getMonthLabel(m.key)}</span>
          </div>
        );
      })}
    </div>
  );
}

function AccountBars({
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
              style={{
                width: `${(item.amount / max) * 100}%`,
                backgroundColor: `${color}88`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

type CategoryAnalyticsModalProps = {
  category: CategoryOverview;
  movements: MovementRecord[];
  baseCurrencyCode: string;
  onClose: () => void;
};

export function CategoryAnalyticsModal({
  category,
  movements,
  baseCurrencyCode,
  onClose,
}: CategoryAnalyticsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  const color = KIND_COLORS[category.kind] ?? "#6f86ff";
  const currencyCode = baseCurrencyCode;

  // ── filter movements for this category ────────────────────────────────────
  const categoryMovements = useMemo(
    () =>
      movements.filter(
        (m) =>
          m.status !== "voided" &&
          m.categoryId === category.id,
      ),
    [movements, category.id],
  );

  const postedMovements = useMemo(
    () => categoryMovements.filter((m) => m.status === "posted"),
    [categoryMovements],
  );

  // ── key metrics ────────────────────────────────────────────────────────────
  const { totalExpense, totalIncome, movementCount } = useMemo(() => {
    let expense = 0;
    let income = 0;
    for (const m of postedMovements) {
      const isExpense = ["expense", "subscription_payment"].includes(m.movementType);
      const isIncome = ["income", "refund"].includes(m.movementType);
      if (isExpense) expense += m.sourceAmount ?? 0;
      if (isIncome) income += m.destinationAmount ?? 0;
    }
    return { totalExpense: expense, totalIncome: income, movementCount: categoryMovements.length };
  }, [postedMovements, categoryMovements]);

  // ── monthly amounts (last 6 months) ───────────────────────────────────────
  const monthlyAmounts = useMemo(() => {
    const last6 = getLast6MonthKeys();
    const result = last6.map((key) => ({ key, amount: 0 }));

    for (const m of postedMovements) {
      const key = getMonthKey(new Date(m.occurredAt));
      const slot = result.find((r) => r.key === key);
      if (!slot) continue;
      const isExpense = ["expense", "subscription_payment"].includes(m.movementType);
      const isIncome = ["income", "refund"].includes(m.movementType);
      if (isExpense) slot.amount += m.sourceAmount ?? 0;
      if (isIncome) slot.amount += m.destinationAmount ?? 0;
    }

    return result;
  }, [postedMovements]);

  // ── top accounts using this category ──────────────────────────────────────
  const topAccounts = useMemo(() => {
    const accountMap = new Map<string, { amount: number; count: number }>();
    for (const m of postedMovements) {
      const isExpense = ["expense", "subscription_payment"].includes(m.movementType);
      const isIncome = ["income", "refund"].includes(m.movementType);
      const name = isExpense
        ? (m.sourceAccountName ?? "Cuenta desconocida")
        : isIncome
          ? (m.destinationAccountName ?? "Cuenta desconocida")
          : null;
      if (!name) continue;
      const amount = isExpense ? (m.sourceAmount ?? 0) : (m.destinationAmount ?? 0);
      const prev = accountMap.get(name) ?? { amount: 0, count: 0 };
      accountMap.set(name, { amount: prev.amount + amount, count: prev.count + 1 });
    }
    return [...accountMap.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [postedMovements]);

  // ── recent movements ───────────────────────────────────────────────────────
  const recentMovements = useMemo(
    () =>
      [...categoryMovements]
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 8),
    [categoryMovements],
  );

  const metricCards = [
    {
      label: "Movimientos",
      value: String(movementCount),
      sublabel: `${category.movementCount} totales`,
      icon: Hash,
      colorClass: "text-storm",
    },
    {
      label: "Total gastos",
      value: formatCurrency(totalExpense, currencyCode),
      sublabel: "en movimientos aplicados",
      icon: ArrowDownCircle,
      colorClass: "text-ember",
    },
    {
      label: "Total ingresos",
      value: formatCurrency(totalIncome, currencyCode),
      sublabel: "en movimientos aplicados",
      icon: ArrowUpCircle,
      colorClass: "text-pine",
    },
    {
      label: "Suscripciones",
      value: String(category.subscriptionCount),
      sublabel: "vinculadas a esta cat.",
      icon: BarChart3,
      colorClass: "text-storm",
    },
  ];

  return (
    <div
      aria-labelledby="cat-analytics-title"
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
            className="absolute -left-16 -top-16 h-56 w-56 rounded-full blur-3xl opacity-25"
            style={{ backgroundColor: color }}
          />
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full blur-3xl opacity-20" style={{ backgroundColor: color }} />
        </div>

        {/* Header */}
        <div className="relative flex items-start justify-between gap-4 border-b border-white/[0.07] px-6 py-5">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{ backgroundColor: `${color}33`, border: `1px solid ${color}44` }}
            >
              <BarChart3 className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
                Análisis de categoría
              </p>
              <h2
                className="font-display text-2xl font-semibold text-ink"
                id="cat-analytics-title"
              >
                {category.name}
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em]"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {KIND_LABELS[category.kind]}
                </span>
                {!category.isActive ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[0.62rem] text-storm/60 uppercase tracking-[0.16em]">
                    Inactiva
                  </span>
                ) : null}
                {category.parentName ? (
                  <span className="text-xs text-storm/50">en {category.parentName}</span>
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

        <div className="relative space-y-6 p-5 sm:p-6">

          {/* ── Metric cards ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metricCards.map(({ label, value, sublabel, colorClass, icon: Icon }) => (
              <div
                className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4"
                key={label}
              >
                <div className="mb-3 flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${colorClass}`} />
                  <span className="text-[0.62rem] uppercase tracking-[0.2em] text-storm/70">
                    {label}
                  </span>
                </div>
                <p className="font-display text-xl font-semibold text-ink">{value}</p>
                <p className="mt-1 text-[0.62rem] text-storm/50">{sublabel}</p>
              </div>
            ))}
          </div>

          {/* ── Monthly volume chart ── */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
              Volumen mensual
            </h3>
            <p className="mt-0.5 mb-1 text-xs text-storm/50">
              Monto total movido en esta categoría — últimos 6 meses.
            </p>
            {monthlyAmounts.every((m) => m.amount === 0) ? (
              <p className="py-6 text-center text-sm text-storm/50">
                Sin movimientos en los últimos 6 meses.
              </p>
            ) : (
              <MonthlyAmountChart
                color={color}
                currencyCode={currencyCode}
                months={monthlyAmounts}
              />
            )}
          </section>

          {/* ── Top accounts + recent movements ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
              <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
                Top cuentas
              </h3>
              <p className="mt-0.5 text-xs text-storm/50">
                Cuentas con mayor volumen en esta categoría.
              </p>
              {topAccounts.length > 0 ? (
                <AccountBars
                  color={color}
                  currencyCode={currencyCode}
                  items={topAccounts}
                />
              ) : (
                <p className="mt-6 text-center text-sm text-storm/50">
                  Sin datos de cuentas aún.
                </p>
              )}
            </section>

            <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
              <h3 className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
                Movimientos recientes
              </h3>
              {recentMovements.length === 0 ? (
                <p className="py-4 text-center text-sm text-storm/50">
                  No hay movimientos con esta categoría.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentMovements.map((m) => {
                    const isExpense = ["expense", "subscription_payment"].includes(m.movementType);
                    const amount = isExpense ? (m.sourceAmount ?? 0) : (m.destinationAmount ?? 0);
                    const movCurrency = isExpense
                      ? (m.sourceCurrencyCode ?? currencyCode)
                      : (m.destinationCurrencyCode ?? currencyCode);
                    const accountName = isExpense
                      ? (m.sourceAccountName ?? "—")
                      : (m.destinationAccountName ?? "—");

                    return (
                      <div
                        className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-black/10 px-3 py-2.5"
                        key={m.id}
                      >
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${color}22` }}
                        >
                          {isExpense ? (
                            <ArrowDownCircle className="h-3.5 w-3.5 text-ember" />
                          ) : (
                            <ArrowUpCircle className="h-3.5 w-3.5 text-pine" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-ink">{m.description}</p>
                          <p className="text-[0.62rem] text-storm/60">
                            {accountName} · {formatDate(new Date(m.occurredAt).toISOString())}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold ${isExpense ? "text-ember" : "text-pine"}`}>
                            {isExpense ? "-" : "+"}{formatCurrency(amount, movCurrency)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

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
