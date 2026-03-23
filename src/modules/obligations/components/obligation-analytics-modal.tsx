import {
  BarChart3,
  CheckCircle2,
  Circle,
  X,
} from "lucide-react";
import { useMemo, useRef } from "react";

import { Button } from "../../../components/ui/button";
import { useFocusTrap } from "../../../components/ui/use-focus-trap";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDate } from "../../../lib/formatting/dates";
import type { ObligationSummary } from "../../../types/domain";

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

function getEventLabel(eventType: ObligationSummary["events"][number]["eventType"]) {
  switch (eventType) {
    case "payment": return "Pago";
    case "opening": return "Apertura";
    case "principal_increase": return "Aumento de principal";
    case "principal_decrease": return "Reducción de principal";
    case "adjustment": return "Ajuste";
    case "interest": return "Interés";
    case "fee": return "Cargo";
    case "discount": return "Descuento";
    case "writeoff": return "Cancelación";
    default: return "Evento";
  }
}

// ─── mini charts ─────────────────────────────────────────────────────────────

function PaymentsBarChart({
  months,
  currencyCode,
  color,
}: {
  months: Array<{ label: string; amount: number }>;
  currencyCode: string;
  color: string;
}) {
  const maxVal = Math.max(...months.map((m) => m.amount), 1);
  const BAR_H = 80;

  return (
    <div className="mt-4 flex items-end gap-2" style={{ height: BAR_H + 24 }}>
      {months.map((m) => (
        <div className="flex flex-1 flex-col items-center gap-0.5" key={m.label}>
          <div className="flex w-full items-end" style={{ height: BAR_H }}>
            <div
              className="w-full rounded-t-[4px] transition-all"
              style={{
                height: `${(m.amount / maxVal) * 100}%`,
                background: color,
                opacity: m.amount > 0 ? 0.8 : 0.15,
                minHeight: 3,
              }}
              title={`${m.label}: ${formatCurrency(m.amount, currencyCode)}`}
            />
          </div>
          <span className="text-[0.55rem] text-storm/70">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressGauge({
  percent,
  color,
}: {
  percent: number;
  color: string;
}) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-storm mb-2">
        <span>Progreso del pago</span>
        <span className="font-semibold" style={{ color }}>{Math.round(clamped)}%</span>
      </div>
      <div className="h-3 rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

type ObligationAnalyticsModalProps = {
  obligation: ObligationSummary;
  baseCurrencyCode: string;
  onClose: () => void;
};

export function ObligationAnalyticsModal({
  obligation,
  baseCurrencyCode,
  onClose,
}: ObligationAnalyticsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  const isReceivable = obligation.direction === "receivable";
  const color = isReceivable ? "#6be4c5" : "#f27a86";
  const currencyCode = obligation.currencyCode;

  // ── payment events ─────────────────────────────────────────────────────────
  const paymentEvents = useMemo(
    () => obligation.events.filter((e) => e.eventType === "payment"),
    [obligation.events],
  );

  const totalPaid = useMemo(
    () => paymentEvents.reduce((s, e) => s + e.amount, 0),
    [paymentEvents],
  );

  // ── monthly payments last 6 months ────────────────────────────────────────
  const monthlyPayments = useMemo(() => {
    const keys = getLast6MonthKeys();
    const map = new Map<string, number>(keys.map((k) => [k, 0]));

    for (const e of paymentEvents) {
      const key = getMonthKey(new Date(e.eventDate));
      if (map.has(key)) {
        map.set(key, (map.get(key) ?? 0) + e.amount);
      }
    }

    return keys.map((k) => ({ label: getMonthLabel(k), amount: map.get(k) ?? 0 }));
  }, [paymentEvents]);

  const principal = obligation.currentPrincipalAmount ?? obligation.principalAmount;
  const principalInBase = obligation.currentPrincipalAmountInBaseCurrency ?? obligation.principalAmountInBaseCurrency ?? principal;
  const pendingInBase = obligation.pendingAmountInBaseCurrency ?? obligation.pendingAmount;

  const metrics = [
    {
      label: "Principal",
      value: formatCurrency(principal, currencyCode),
      sub: currencyCode !== baseCurrencyCode ? formatCurrency(principalInBase, baseCurrencyCode) : "monto total",
    },
    {
      label: "Pendiente",
      value: formatCurrency(obligation.pendingAmount, currencyCode),
      sub: currencyCode !== baseCurrencyCode ? formatCurrency(pendingInBase, baseCurrencyCode) : "por saldar",
      color,
    },
    {
      label: "Total pagado",
      value: formatCurrency(totalPaid, currencyCode),
      sub: `${paymentEvents.length} ${paymentEvents.length === 1 ? "pago" : "pagos"}`,
      color: "#6be4c5",
    },
    {
      label: "Progreso",
      value: `${Math.round(obligation.progressPercent)}%`,
      sub: obligation.status === "paid" ? "completado" : "avanzado",
      color,
    },
  ];

  // ── recent events ──────────────────────────────────────────────────────────
  const recentEvents = useMemo(
    () => [...obligation.events].sort((a, b) => b.eventDate.localeCompare(a.eventDate)).slice(0, 6),
    [obligation.events],
  );

  // ── installment grid ───────────────────────────────────────────────────────
  const paidInstallmentNos = useMemo(
    () => new Set(paymentEvents.map((e) => e.installmentNo).filter((n): n is number => n != null)),
    [paymentEvents],
  );

  const paymentByInstallmentNo = useMemo(() => {
    const map = new Map<number, typeof paymentEvents[number]>();
    for (const e of paymentEvents) {
      if (e.installmentNo != null) map.set(e.installmentNo, e);
    }
    return map;
  }, [paymentEvents]);

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="obligation-analytics-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0a1220] shadow-2xl"
        ref={dialogRef}
      >
        {/* header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10"
              style={{ background: `linear-gradient(160deg, ${isReceivable ? "#1b6a58" : "#8f3e3e"}, rgba(8,13,20,0.72))` }}
            >
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink" id="obligation-analytics-title">
                {obligation.title}
              </h2>
              <p className="text-xs text-storm">
                {isReceivable ? "Me deben" : "Yo debo"} · {obligation.counterparty}
              </p>
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

          {/* progress + dates */}
          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
            <ProgressGauge percent={obligation.progressPercent} color={color} />
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <p className="text-storm/70 uppercase tracking-[0.15em]">Inicio</p>
                <p className="mt-1 font-medium text-ink">{formatDate(obligation.startDate)}</p>
              </div>
              {obligation.dueDate && (
                <div>
                  <p className="text-storm/70 uppercase tracking-[0.15em]">Vencimiento</p>
                  <p className="mt-1 font-medium text-ink">{formatDate(obligation.dueDate)}</p>
                </div>
              )}
              {obligation.lastPaymentDate && (
                <div>
                  <p className="text-storm/70 uppercase tracking-[0.15em]">Último pago</p>
                  <p className="mt-1 font-medium text-ink">{formatDate(obligation.lastPaymentDate)}</p>
                </div>
              )}
              {obligation.installmentAmount && (
                <div>
                  <p className="text-storm/70 uppercase tracking-[0.15em]">Cuota</p>
                  <p className="mt-1 font-medium text-ink">{formatCurrency(obligation.installmentAmount, currencyCode)}</p>
                </div>
              )}
            </div>
          </div>

          {/* monthly payments chart */}
          {paymentEvents.length > 0 && (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Pagos por mes (6 meses)</p>
              <PaymentsBarChart months={monthlyPayments} currencyCode={currencyCode} color={color} />
            </div>
          )}

          {/* event history */}
          {recentEvents.length > 0 && (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Historial de eventos</p>
              <div className="mt-3 space-y-2">
                {recentEvents.map((e) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                    key={e.id}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {getEventLabel(e.eventType)}{e.description ? ` · ${e.description}` : ""}
                      </p>
                      <p className="text-[0.65rem] text-storm">
                        {formatDate(e.eventDate)}
                        {e.installmentNo ? ` · Cuota ${e.installmentNo}` : ""}
                      </p>
                    </div>
                    {e.amount > 0 && (
                      <p className="shrink-0 font-semibold" style={{ color }}>
                        {formatCurrency(e.amount, currencyCode)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {obligation.events.length === 0 && (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-storm">
              No hay eventos registrados para este crédito/deuda.
            </div>
          )}

          {/* installment detail */}
          {(obligation.installmentCount != null && obligation.installmentCount > 1) || paymentEvents.length > 0 ? (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Detalle de cuotas</p>

              {obligation.installmentCount != null && obligation.installmentCount > 1 ? (
                <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {Array.from({ length: obligation.installmentCount }, (_, i) => i + 1).map((n) => {
                    const paid = paidInstallmentNos.has(n);
                    const ev = paymentByInstallmentNo.get(n);
                    return (
                      <div
                        className="group relative flex flex-col items-center gap-1.5 rounded-[14px] border p-2.5 transition"
                        key={n}
                        style={{
                          borderColor: paid ? `${color}33` : "rgba(255,255,255,0.06)",
                          background: paid ? `${color}0d` : "rgba(255,255,255,0.015)",
                        }}
                        title={ev ? `${formatDate(ev.eventDate)} · ${formatCurrency(ev.amount, currencyCode)}` : `Cuota ${n} pendiente`}
                      >
                        {paid ? (
                          <CheckCircle2 className="h-4 w-4" style={{ color }} />
                        ) : (
                          <Circle className="h-4 w-4 text-storm/30" />
                        )}
                        <span
                          className="text-[0.6rem] font-semibold"
                          style={{ color: paid ? color : "rgba(255,255,255,0.3)" }}
                        >
                          #{n}
                        </span>
                        {ev ? (
                          <span className="text-[0.55rem] text-storm/60">{formatDate(ev.eventDate)}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {paymentEvents.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-[0.65rem] uppercase tracking-[0.15em] text-storm/60">
                    Pagos registrados ({paymentEvents.length})
                  </p>
                  {[...paymentEvents]
                    .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
                    .map((e) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                        key={e.id}
                      >
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">
                              {e.installmentNo != null ? `Cuota #${e.installmentNo}` : "Pago"}
                            </p>
                            <p className="text-[0.65rem] text-storm">
                              {formatDate(e.eventDate)}
                              {e.reason ? ` · ${e.reason}` : ""}
                              {e.description && !e.reason ? ` · ${e.description}` : ""}
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 font-semibold text-sm" style={{ color }}>
                          {formatCurrency(e.amount, currencyCode)}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-storm/60">Aún no hay pagos registrados.</p>
              )}
            </div>
          ) : null}

          {/* notes */}
          {obligation.notes && (
            <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.2em] text-storm/75">Notas</p>
              <p className="mt-2 text-sm leading-7 text-storm">{obligation.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
