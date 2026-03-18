import { BarChart3, X } from "lucide-react";
import { useMemo, useRef } from "react";

import { Button } from "../../../components/ui/button";
import { useFocusTrap } from "../../../components/ui/use-focus-trap";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDate } from "../../../lib/formatting/dates";
import type { MovementRecord, SubscriptionSummary } from "../../../types/domain";

// ─── helpers ─────────────────────────────────────────────────────────────────

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key: string) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es", { month: "short", year: "2-digit" });
}

function getLast12MonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(getMonthKey(d));
  }
  return keys;
}

function getAnnualCost(subscription: SubscriptionSummary): number {
  const { amount, frequency, intervalCount } = subscription;
  const count = intervalCount || 1;
  switch (frequency) {
    case "daily":   return (amount / count) * 365;
    case "weekly":  return (amount / count) * 52;
    case "monthly": return (amount / count) * 12;
    case "yearly":  return amount / count;
    default:        return amount * 12;
  }
}

// ─── mini charts ─────────────────────────────────────────────────────────────

function PaymentsBarChart({
  months,
  currencyCode,
}: {
  months: Array<{ label: string; amount: number }>;
  currencyCode: string;
}) {
  const maxVal = Math.max(...months.map((m) => m.amount), 1);
  const BAR_H = 80;

  return (
    <div className="mt-4 flex items-end gap-1" style={{ height: BAR_H + 24 }}>
      {months.map((m) => (
        <div className="flex flex-1 flex-col items-center gap-0.5" key={m.label}>
          <div className="flex w-full items-end" style={{ height: BAR_H }}>
            <div
              className="w-full rounded-t-[3px] transition-all"
              style={{
                height: `${(m.amount / maxVal) * 100}%`,
                background: "#f27a86",
                opacity: m.amount > 0 ? 0.75 : 0.12,
                minHeight: 3,
              }}
              title={`${m.label}: ${formatCurrency(m.amount, currencyCode)}`}
            />
          </div>
          <span className="text-[0.5rem] text-storm/60">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

type SubscriptionAnalyticsModalProps = {
  subscription: SubscriptionSummary;
  movements: MovementRecord[];
  baseCurrencyCode: string;
  onClose: () => void;
};

export function SubscriptionAnalyticsModal({
  subscription,
  movements,
  baseCurrencyCode,
  onClose,
}: SubscriptionAnalyticsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  const currencyCode = subscription.currencyCode;

  // ── filter movements linked to this subscription ───────────────────────────
  const subMovements = useMemo(
    () =>
      movements.filter(
        (m) => m.subscriptionId === subscription.id && m.status === "posted",
      ),
    [movements, subscription.id],
  );

  // ── monthly spend last 12 months ───────────────────────────────────────────
  const monthlySpend = useMemo(() => {
    const keys = getLast12MonthKeys();
    const map = new Map<string, number>(keys.map((k) => [k, 0]));

    for (const m of subMovements) {
      const key = getMonthKey(new Date(m.occurredAt));
      if (!map.has(key)) continue;
      const amount =
        m.sourceAmountInBaseCurrency ??
        m.sourceAmount ??
        m.destinationAmount ??
        0;
      map.set(key, (map.get(key) ?? 0) + amount);
    }

    return keys.map((k) => ({ label: getMonthLabel(k), amount: map.get(k) ?? 0 }));
  }, [subMovements]);

  const totalSpent = useMemo(
    () => subMovements.reduce((s, m) => {
      const amount = m.sourceAmountInBaseCurrency ?? m.sourceAmount ?? m.destinationAmount ?? 0;
      return s + amount;
    }, 0),
    [subMovements],
  );

  const annualCost = getAnnualCost(subscription);
  const monthlyCost = annualCost / 12;

  const recentMovements = useMemo(
    () =>
      [...subMovements]
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, 6),
    [subMovements],
  );

  // days until next due
  const daysUntilNext = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(subscription.nextDueDate);
    next.setHours(0, 0, 0, 0);
    return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [subscription.nextDueDate]);

  const metrics = [
    {
      label: "Pagos registrados",
      value: subMovements.length.toString(),
      sub: "en historial",
    },
    {
      label: "Total gastado",
      value: formatCurrency(totalSpent, baseCurrencyCode),
      sub: "acumulado",
      color: "#f27a86",
    },
    {
      label: "Costo mensual",
      value: formatCurrency(monthlyCost, currencyCode),
      sub: "estimado",
    },
    {
      label: "Costo anual",
      value: formatCurrency(annualCost, currencyCode),
      sub: "estimado",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-analytics-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0a1220] shadow-2xl"
        ref={dialogRef}
      >
        {/* header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] text-[#f27a86]">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink" id="subscription-analytics-title">
                {subscription.name}
              </h2>
              <p className="text-xs text-storm">
                {subscription.vendor} · {subscription.frequencyLabel}
              </p>
            </div>
          </div>
          <Button onClick={onClose} size="sm" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map((m) => (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" key={m.label}>
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">{m.label}</p>
                <p className="mt-2 font-display text-xl font-semibold" style={{ color: m.color ?? "#e8eaf6" }}>
                  {m.value}
                </p>
                <p className="mt-0.5 text-[0.65rem] text-storm/70">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* next due + config */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Próximo cobro</p>
              <p className="mt-3 font-display text-2xl font-semibold text-ink">{formatDate(subscription.nextDueDate)}</p>
              <p className="mt-1 text-xs text-storm">
                {daysUntilNext === 0
                  ? "Vence hoy"
                  : daysUntilNext < 0
                  ? `Venció hace ${Math.abs(daysUntilNext)} días`
                  : `En ${daysUntilNext} día${daysUntilNext !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Configuración</p>
              <div className="mt-3 space-y-1.5 text-sm">
                {subscription.accountName && (
                  <p className="text-storm">Cuenta: <span className="text-ink">{subscription.accountName}</span></p>
                )}
                {subscription.categoryName && (
                  <p className="text-storm">Categoría: <span className="text-ink">{subscription.categoryName}</span></p>
                )}
                <p className="text-storm">Recordatorio: <span className="text-ink">{subscription.remindDaysBefore} días antes</span></p>
                <p className="text-storm">Auto movimiento: <span className="text-ink">{subscription.autoCreateMovement ? "Activado" : "Desactivado"}</span></p>
              </div>
            </div>
          </div>

          {/* payments chart */}
          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Pagos por mes (12 meses)</p>
            <PaymentsBarChart months={monthlySpend} currencyCode={baseCurrencyCode} />
          </div>

          {/* recent movements */}
          {recentMovements.length > 0 && (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Pagos recientes</p>
              <div className="mt-3 space-y-2">
                {recentMovements.map((m) => {
                  const amount =
                    m.sourceAmountInBaseCurrency ??
                    m.sourceAmount ??
                    m.destinationAmount ??
                    0;
                  return (
                    <div
                      className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                      key={m.id}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{m.description}</p>
                        <p className="text-[0.65rem] text-storm">
                          {formatDate(m.occurredAt)}
                          {m.sourceAccountName ? ` · ${m.sourceAccountName}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold text-[#f27a86]">
                        -{formatCurrency(amount, baseCurrencyCode)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {subMovements.length === 0 && (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-storm">
              No hay pagos registrados para esta suscripción aún.
            </div>
          )}

          {/* notes */}
          {subscription.notes && (
            <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.2em] text-storm/75">Notas</p>
              <p className="mt-2 text-sm leading-7 text-storm">{subscription.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
