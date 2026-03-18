import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  X,
} from "lucide-react";
import { useMemo, useRef } from "react";

import { Button } from "../../../components/ui/button";
import { useFocusTrap } from "../../../components/ui/use-focus-trap";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDate } from "../../../lib/formatting/dates";
import type { CounterpartyOverview, MovementRecord } from "../../../types/domain";

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

// ─── mini charts ─────────────────────────────────────────────────────────────

function MonthlyFlowChart({
  months,
  currencyCode,
}: {
  months: Array<{ label: string; inflow: number; outflow: number }>;
  currencyCode: string;
}) {
  const maxVal = Math.max(...months.flatMap((m) => [m.inflow, m.outflow]), 1);
  const BAR_H = 80;

  return (
    <div className="mt-4 flex items-end gap-1.5" style={{ height: BAR_H + 24 }}>
      {months.map((m) => (
        <div className="flex flex-1 flex-col items-center gap-0.5" key={m.label}>
          <div className="flex w-full items-end gap-0.5" style={{ height: BAR_H }}>
            <div
              className="flex-1 rounded-t-[4px] bg-[#6be4c5]/70 transition-all"
              style={{ height: `${(m.inflow / maxVal) * 100}%` }}
              title={`Entradas: ${formatCurrency(m.inflow, currencyCode)}`}
            />
            <div
              className="flex-1 rounded-t-[4px] bg-[#f27a86]/70 transition-all"
              style={{ height: `${(m.outflow / maxVal) * 100}%` }}
              title={`Salidas: ${formatCurrency(m.outflow, currencyCode)}`}
            />
          </div>
          <span className="text-[0.55rem] text-storm/70">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

function HorizontalBars({
  items,
  currencyCode,
  color,
}: {
  items: Array<{ label: string; amount: number }>;
  currencyCode: string;
  color: string;
}) {
  const max = Math.max(...items.map((i) => i.amount), 1);
  return (
    <div className="mt-3 space-y-2">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between text-xs">
            <span className="truncate text-storm" style={{ maxWidth: "55%" }}>{item.label}</span>
            <span className="font-medium text-ink">{formatCurrency(item.amount, currencyCode)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(item.amount / max) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

type ContactAnalyticsModalProps = {
  contact: CounterpartyOverview & { receivablePendingInBase: number; payablePendingInBase: number };
  movements: MovementRecord[];
  baseCurrencyCode: string;
  onClose: () => void;
};

export function ContactAnalyticsModal({
  contact,
  movements,
  baseCurrencyCode,
  onClose,
}: ContactAnalyticsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  // ── filter movements for this contact ─────────────────────────────────────
  const contactMovements = useMemo(
    () => movements.filter((m) => m.counterpartyId === contact.id && m.status === "posted"),
    [movements, contact.id],
  );

  // ── monthly inflow / outflow last 6 months ─────────────────────────────────
  const monthlyFlow = useMemo(() => {
    const keys = getLast6MonthKeys();
    const map = new Map<string, { inflow: number; outflow: number }>(
      keys.map((k) => [k, { inflow: 0, outflow: 0 }]),
    );

    for (const m of contactMovements) {
      const key = getMonthKey(new Date(m.occurredAt));
      if (!map.has(key)) continue;
      const entry = map.get(key)!;
      const amount =
        m.sourceAmountInBaseCurrency ??
        m.destinationAmountInBaseCurrency ??
        m.sourceAmount ??
        m.destinationAmount ??
        0;

      if (["income", "transfer_in"].includes(m.movementType)) {
        entry.inflow += amount;
      } else {
        entry.outflow += amount;
      }
    }

    return keys.map((k) => ({ label: getMonthLabel(k), ...map.get(k)! }));
  }, [contactMovements]);

  // ── top categories used with this contact ──────────────────────────────────
  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of contactMovements) {
      if (!m.category) continue;
      const amount =
        m.sourceAmountInBaseCurrency ??
        m.destinationAmountInBaseCurrency ??
        m.sourceAmount ??
        m.destinationAmount ??
        0;
      map.set(m.category, (map.get(m.category) ?? 0) + amount);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, amount]) => ({ label, amount }));
  }, [contactMovements]);

  // ── top accounts used with this contact ────────────────────────────────────
  const topAccounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of contactMovements) {
      const name = m.sourceAccountName ?? m.destinationAccountName;
      if (!name) continue;
      const amount =
        m.sourceAmountInBaseCurrency ??
        m.destinationAmountInBaseCurrency ??
        m.sourceAmount ??
        m.destinationAmount ??
        0;
      map.set(name, (map.get(name) ?? 0) + amount);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, amount]) => ({ label, amount }));
  }, [contactMovements]);

  // ── recent movements ───────────────────────────────────────────────────────
  const recentMovements = useMemo(
    () =>
      [...contactMovements]
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, 5),
    [contactMovements],
  );

  const totalInflow = contactMovements.reduce((s, m) => {
    const amount = m.sourceAmountInBaseCurrency ?? m.destinationAmountInBaseCurrency ?? m.sourceAmount ?? m.destinationAmount ?? 0;
    return ["income", "transfer_in"].includes(m.movementType) ? s + amount : s;
  }, 0);

  const totalOutflow = contactMovements.reduce((s, m) => {
    const amount = m.sourceAmountInBaseCurrency ?? m.destinationAmountInBaseCurrency ?? m.sourceAmount ?? m.destinationAmount ?? 0;
    return ["income", "transfer_in"].includes(m.movementType) ? s : s + amount;
  }, 0);

  const netFlow = totalInflow - totalOutflow;

  const metrics = [
    { label: "Movimientos", value: contactMovements.length.toString(), sub: "en historial" },
    { label: "Total entradas", value: formatCurrency(totalInflow, baseCurrencyCode), sub: "con este contacto", color: "#6be4c5" },
    { label: "Total salidas", value: formatCurrency(totalOutflow, baseCurrencyCode), sub: "con este contacto", color: "#f27a86" },
    { label: "Flujo neto", value: formatCurrency(Math.abs(netFlow), baseCurrencyCode), sub: netFlow >= 0 ? "a tu favor" : "en tu contra", color: netFlow >= 0 ? "#6be4c5" : "#f27a86" },
  ];

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-analytics-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0a1220] shadow-2xl"
        ref={dialogRef}
      >
        {/* header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] text-[#6f86ff]">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink" id="contact-analytics-title">
                {contact.name}
              </h2>
              <p className="text-xs text-storm">Análisis de actividad</p>
            </div>
          </div>
          <Button className="p-2" onClick={onClose} variant="ghost">
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

          {/* obligations summary */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="h-4 w-4 text-[#6be4c5]" />
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Por cobrar</p>
              </div>
              <p className="mt-3 font-display text-2xl font-semibold text-ink">
                {formatCurrency(contact.receivablePendingInBase, baseCurrencyCode)}
              </p>
              <p className="mt-1 text-xs text-storm">{contact.receivableCount} {contact.receivableCount === 1 ? "obligación" : "obligaciones"}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4 text-[#f27a86]" />
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Por pagar</p>
              </div>
              <p className="mt-3 font-display text-2xl font-semibold text-ink">
                {formatCurrency(contact.payablePendingInBase, baseCurrencyCode)}
              </p>
              <p className="mt-1 text-xs text-storm">{contact.payableCount} {contact.payableCount === 1 ? "obligación" : "obligaciones"}</p>
            </div>
          </div>

          {/* monthly flow chart */}
          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Flujo mensual (6 meses)</p>
              <div className="flex items-center gap-3 text-[0.6rem] text-storm/70">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-[#6be4c5]/70" />Entradas</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-[#f27a86]/70" />Salidas</span>
              </div>
            </div>
            <MonthlyFlowChart months={monthlyFlow} currencyCode={baseCurrencyCode} />
          </div>

          {/* top categories + top accounts */}
          <div className="grid gap-4 sm:grid-cols-2">
            {topCategories.length > 0 && (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Top categorías</p>
                <HorizontalBars items={topCategories} currencyCode={baseCurrencyCode} color="#6f86ff" />
              </div>
            )}
            {topAccounts.length > 0 && (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Top cuentas</p>
                <HorizontalBars items={topAccounts} currencyCode={baseCurrencyCode} color="#6be4c5" />
              </div>
            )}
          </div>

          {/* recent movements */}
          {recentMovements.length > 0 && (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Movimientos recientes</p>
              <div className="mt-3 space-y-2">
                {recentMovements.map((m) => {
                  const amount =
                    m.sourceAmountInBaseCurrency ??
                    m.destinationAmountInBaseCurrency ??
                    m.sourceAmount ??
                    m.destinationAmount ??
                    0;
                  const isIn = ["income", "transfer_in"].includes(m.movementType);
                  return (
                    <div
                      className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                      key={m.id}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{m.description}</p>
                        <p className="text-[0.65rem] text-storm">
                          {formatDate(m.occurredAt)}{m.category ? ` · ${m.category}` : ""}
                        </p>
                      </div>
                      <p className={`shrink-0 font-semibold ${isIn ? "text-[#6be4c5]" : "text-[#f27a86]"}`}>
                        {isIn ? "+" : "-"}{formatCurrency(amount, baseCurrencyCode)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {contactMovements.length === 0 && (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-storm">
              No hay movimientos registrados con este contacto.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
