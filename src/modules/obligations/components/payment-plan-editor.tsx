import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { formatCurrency } from "../../../lib/formatting/money";
import { validateObligationPlan } from "../lib/obligation-editor-input";
import {
  addMonthsIso,
  defaultFirstDueDate,
  expandPaymentPlan,
  planDifference,
  type PaymentPlan,
} from "../lib/payment-plan";

type DraftPayment = { key: number; amount: string; dueDate: string };
let nextKey = 0;
const monthLabel = (isoDate: string) => {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? isoDate : new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
};

export function PaymentPlanEditor({
  plan,
  principal,
  currencyCode,
  startDate,
  onSave,
}: {
  plan: PaymentPlan | null;
  principal: number;
  currencyCode: string;
  startDate: string;
  onSave: (plan: PaymentPlan | null) => void;
}) {
  const [mode, setMode] = useState<PaymentPlan["mode"]>(plan?.mode ?? "equal");
  const [count, setCount] = useState(String(plan?.mode === "equal" ? plan.count : 6));
  const [firstDueDate, setFirstDueDate] = useState(plan?.firstDueDate ?? defaultFirstDueDate(startDate));
  const [agreed, setAgreed] = useState<DraftPayment[]>(
    plan?.mode === "custom"
      ? plan.agreed.map((item, index) => ({ key: ++nextKey, amount: String(item.amount), dueDate: item.dueDate ?? addMonthsIso(plan.firstDueDate ?? defaultFirstDueDate(startDate), index) }))
      : [],
  );
  const [tail, setTail] = useState(plan?.mode === "custom" && plan.tail ? String(plan.tail) : "");
  const formatAmount = (amount: number) => formatCurrency(amount, currencyCode);

  const draft = useMemo<PaymentPlan | null>(() => {
    if (mode === "equal") {
      const value = Number(count);
      return Number.isInteger(value) && value >= 1 && value <= 600
        ? { mode, count: value, firstDueDate }
        : null;
    }
    const payments = agreed.map((item) => ({ amount: Number(item.amount), dueDate: item.dueDate }));
    if (payments.some((item) => !Number.isFinite(item.amount) || item.amount <= 0)) return null;
    const tailAmount = tail.trim() ? Number(tail) : null;
    if (tailAmount !== null && (!Number.isFinite(tailAmount) || tailAmount <= 0)) return null;
    return payments.length || tailAmount !== null
      ? { mode, agreed: payments, tail: tailAmount, firstDueDate }
      : null;
  }, [agreed, count, firstDueDate, mode, tail]);
  const rows = useMemo(() => draft ? expandPaymentPlan(draft, principal, startDate) : [], [draft, principal, startDate]);
  const difference = planDifference(principal, rows);
  const complete = principal > 0 && rows.length > 0 && rows.length <= 600 && difference === 0;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const isBeforeStart = firstDueDate < startDate;
  const agreedBeforeFirst = mode === "custom" && agreed.some((item) => item.dueDate < firstDueDate);
  const planError = useMemo(() => {
    if (!draft) return null;
    try { validateObligationPlan(draft, principal, startDate); return null; }
    catch (error) { return error instanceof Error ? error.message : "Revisa el plan."; }
  }, [draft, principal, startDate]);
  const canSave = complete && !isBeforeStart && !agreedBeforeFirst && !planError;
  const adjustedDates = draft?.mode === "custom" && draft.agreed.some((row, i) => row.dueDate && row.dueDate !== rows[i]?.dueDate);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-[#141311] p-1" role="group" aria-label="Modalidad del plan">
        {(["equal", "custom"] as const).map((option) => (
          <button
            aria-pressed={mode === option}
            className={`min-h-12 rounded-lg px-3 text-sm font-semibold transition ${mode === option ? "bg-ink text-void" : "text-storm hover:text-ink"}`}
            key={option}
            onClick={() => setMode(option)}
            type="button"
          >{option === "equal" ? "Cuotas iguales" : "A medida"}</button>
        ))}
      </div>

      {mode === "equal" ? (
        <div className="divide-y divide-white/[0.08] rounded-xl border border-white/10 bg-[#141311] px-4">
          <label className="flex min-h-14 items-center justify-between gap-4 py-2 text-sm text-ink">
            Número de cuotas
            <input aria-label="Número de cuotas" className="w-24 rounded-lg border border-white/10 bg-[#1a1917] px-3 py-2 text-right tabular-nums text-ink outline-none focus:border-white/40" inputMode="numeric" max="600" min="1" onChange={(event) => setCount(event.target.value)} type="number" value={count} />
          </label>
          <div className="flex min-h-14 items-center justify-between gap-4 py-2 text-sm"><span className="text-ink">Primer pago</span><div className="w-48"><DatePickerField appearance="compact" onChange={setFirstDueDate} value={firstDueDate} /></div></div>
          <p className="py-3 text-sm leading-5 text-storm">{first ? `${formatAmount(principal)} ÷ ${rows.length} = ${formatAmount(first.amount)} por cuota. Se recalcula si cambias el monto.` : "Indica el número de cuotas para calcular el importe."}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-ink">Lo que acordaron</h3><span className="text-xs text-storm">Monto y fecha de cada pago distinto</span></div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#141311] px-4 py-2 text-sm"><span className="text-ink">Primer pago</span><div className="w-48"><DatePickerField appearance="compact" onChange={setFirstDueDate} value={firstDueDate} /></div></div>
            {agreed.map((item, index) => (
              <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] py-2" key={item.key}>
                <span className="w-5 text-xs tabular-nums text-storm">{index + 1}</span>
                <div className="min-w-[150px] flex-1"><DatePickerField appearance="compact" onChange={(date) => setAgreed((current) => current.map((row) => row.key === item.key ? { ...row, dueDate: date } : row))} value={item.dueDate} /></div>
                <input aria-label={`Monto del pago ${index + 1}`} className="h-11 w-28 rounded-lg border border-white/10 bg-[#141311] px-3 text-right tabular-nums text-ink outline-none focus:border-white/40" inputMode="decimal" min="0" onChange={(event) => setAgreed((current) => current.map((row) => row.key === item.key ? { ...row, amount: event.target.value } : row))} placeholder="0.00" step="0.01" type="number" value={item.amount} />
                <button aria-label={`Quitar el pago ${index + 1}`} className="flex h-10 w-10 items-center justify-center text-storm hover:text-ink" onClick={() => setAgreed((current) => current.filter((row) => row.key !== item.key))} type="button"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button className="flex min-h-10 items-center gap-2 text-sm text-storm hover:text-ink" onClick={() => setAgreed((current) => [...current, { key: ++nextKey, amount: "", dueDate: current.length ? addMonthsIso(current[current.length - 1].dueDate, 1) : firstDueDate }])} type="button"><Plus className="h-4 w-4" />Agregar un pago distinto</button>
          </div>
          <label className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#141311] px-4 py-2 text-sm"><span><span className="block font-medium text-ink">De ahí en adelante</span><span className="text-xs text-storm">Se repite hasta terminar el saldo</span></span><input aria-label="Monto que se repite hasta terminar el saldo" className="h-10 w-28 rounded-lg border border-white/10 bg-[#1a1917] px-3 text-right tabular-nums text-ink outline-none focus:border-white/40" inputMode="decimal" min="0" onChange={(event) => setTail(event.target.value)} placeholder="0.00" step="0.01" type="number" value={tail} /></label>
          {rows.some((row) => row.source === "calculated") ? <div className="divide-y divide-white/[0.07] border-y border-white/[0.08]">{rows.filter((row) => row.source === "calculated").slice(0, 6).map((row) => <div className="flex min-h-10 items-center justify-between text-sm text-storm" key={row.seq}><span>{row.seq}. {monthLabel(row.dueDate)}</span><span>{formatAmount(row.amount)}</span></div>)}{rows.filter((row) => row.source === "calculated").length > 6 ? <p className="py-2 text-xs text-storm">Y {rows.filter((row) => row.source === "calculated").length - 6} pagos calculados más</p> : null}<p className="py-2 text-xs text-storm">Calculadas. La última se ajusta al saldo que queda.</p></div> : null}
        </>
      )}

      <div className="border-t border-white/[0.08] pt-4">
        {adjustedDates ? <div className="mb-4 text-xs leading-5 text-storm"><p>Las fechas que se cruzan pasan al mes siguiente, como en la app. El calendario que se usará es:</p>{rows.slice(0, 6).map(row => <p className="mt-1 flex justify-between gap-3" key={row.seq}><span>{row.seq}. {row.dueDate}</span><span>{formatAmount(row.amount)}</span></p>)}{rows.length > 6 ? <p>Y {rows.length - 6} pagos más.</p> : null}</div> : null}
        <p className="text-sm text-ink">{rows.length ? `${rows.length} ${rows.length === 1 ? "pago" : "pagos"} · ${monthLabel(first!.dueDate)} a ${monthLabel(last!.dueDate)}` : "Sin pagos programados"}</p>
        <p className="mt-1 text-sm text-storm">{formatAmount(principal - difference)} de {formatAmount(principal)}</p>
        {principal <= 0 ? <p className="mt-2 text-xs text-storm">Primero indica el monto del crédito o deuda.</p> : isBeforeStart ? <p className="mt-2 text-xs text-rose-300">El primer pago no puede ser anterior al inicio.</p> : agreedBeforeFirst ? <p className="mt-2 text-xs text-rose-300">Un pago acordado no puede caer antes del primer pago.</p> : !complete ? <p className="mt-2 text-xs text-rose-300">{difference > 0 ? `Faltan ${formatAmount(difference)} por programar` : `Sobran ${formatAmount(Math.abs(difference))}`}</p> : null}
        {complete && !isBeforeStart && !agreedBeforeFirst && planError ? <p className="mt-2 text-xs text-rose-300">{planError}</p> : null}
        <Button className="mt-4 w-full" disabled={!canSave} onClick={() => onSave(draft)} type="button">Guardar plan</Button>
        {plan ? <button className="mt-3 w-full text-sm text-storm hover:text-ink" onClick={() => onSave(null)} type="button">Quitar plan</button> : null}
      </div>
    </div>
  );
}
