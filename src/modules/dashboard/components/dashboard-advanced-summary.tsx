import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Modal } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { formatCurrency } from "../../../lib/formatting/money";
import type { buildDashboardCashflow } from "../lib/projection/build-dashboard-cashflow";
import { CashflowMonthPanel } from "./cashflow-month-panel";

export function DashboardAdvancedSummary({ cashflow, currency, ready, failed, score, issues, uncategorized, detections, ai, onRetry }: {
  cashflow: ReturnType<typeof buildDashboardCashflow>; currency: string; ready: boolean; failed: boolean;
  score: number; issues: number; uncategorized: number; detections: ReactNode; ai: ReactNode; onRetry: () => void;
}) {
  const [detail, setDetail] = useState<"system" | "week" | "month" | null>(null);
  const window = cashflow.windows[0], month = cashflow.projection.months[0];
  const missing = cashflow.liquid.unconvertedCount + cashflow.projection.unconvertedCount + cashflow.typicalSpend.unconvertedCount;
  const canEstimate = ready && missing === 0;
  const money = (amount: number) => formatCurrency(amount, currency);
  const net = window.expectedInflow - window.expectedOutflow;
  const cards = [
    { id: "system" as const, label: "Estado del sistema", value: `${score}%`, note: issues ? `${issues} puntos por revisar` : "Sin puntos por revisar" },
    { id: "week" as const, label: "Próximos 7 días", value: canEstimate ? `${net > 0 ? "+" : ""}${money(net)}` : "Sin estimación", note: canEstimate ? `Entran ${money(window.expectedInflow)} · salen ${money(window.expectedOutflow)}` : "Comprueba los datos y conversiones" },
    { id: "month" as const, label: "Fin de mes", value: canEstimate ? money(month.closingBalance) : "Sin estimación", note: canEstimate ? `${money(month.closingBalance - cashflow.liquid.total)} sobre hoy` : "Comprueba los datos y conversiones" },
  ];
  return <>
    <div className="grid border-b border-white/[0.07] lg:grid-cols-3">
      {cards.map((item, index) => <button type="button" key={item.id} onClick={() => setDetail(item.id)} className={`min-w-0 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${index ? "border-t border-white/[0.07] lg:border-l lg:border-t-0 lg:pl-6" : ""}`}>
        <span className="block text-sm text-storm">{item.label}</span><span className="mt-3 block font-display text-3xl font-semibold tabular-nums text-ink">{item.value}</span><span className="mt-2 block text-xs text-storm">{item.note} ›</span>
      </button>)}
    </div>
    <div className="grid items-start gap-5 lg:grid-cols-[1.35fr_1fr]">
      <div>{detections}</div><div className="space-y-4">
        {uncategorized > 0 ? <Link to="/app/movements" className="block rounded-[14px] border border-white/[0.08] bg-[#1a1917] p-5"><span className="text-xs uppercase tracking-wider text-storm">Siguiente paso</span><span className="mt-2 block font-semibold text-ink">Ordenar categorías</span><span className="mt-1 block text-sm text-storm">{uncategorized} movimientos sin categoría.</span></Link> : null}
        {ai ? <details className="rounded-[14px] border border-white/[0.08] bg-[#1a1917] p-5"><summary className="cursor-pointer font-semibold text-ink">Informe con IA</summary><div className="mt-4">{ai}</div></details> : null}
      </div>
    </div>
    {detail ? <Modal presentation="side" labelledBy="advanced-summary-detail" onClose={() => setDetail(null)}>
      <ResourceEditorHeader titleId="advanced-summary-detail" title={cards.find(card => card.id === detail)!.label} onClose={() => setDetail(null)} />
      <ModalBody>{detail === "system" ? <><p className="text-3xl font-semibold text-ink">{score}%</p><p className="mt-3 text-sm text-storm">{issues ? `${issues} puntos por revisar.` : "Sin puntos por revisar."}</p></> : detail === "week" ? canEstimate ? <dl className="divide-y divide-white/[0.07] text-sm">{[["Entra", window.expectedInflow], ["Sale", -window.expectedOutflow], ["Cambio previsto", net]].map(([label, value]) => <div className="flex justify-between gap-4 py-4" key={label}><dt className="text-storm">{label}</dt><dd className="tabular-nums text-ink">{money(Number(value))}</dd></div>)}</dl> : <p role="status" className="text-sm text-storm">No hay datos suficientes o faltan conversiones para calcular el plazo.</p> : <CashflowMonthPanel model={cashflow} currency={currency} ready={ready} failed={failed} onRetry={onRetry} />}</ModalBody>
    </Modal> : null}
  </>;
}
