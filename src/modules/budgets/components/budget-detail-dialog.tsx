import { ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { Modal, ModalFooter } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { BudgetOverview } from "../../../types/domain";
import { budgetLimaDate, budgetTodayLima } from "../lib/budget-date";
import { budgetHeadState, budgetMovementDays, budgetSeriesReading } from "../lib/budget-detail";
import type { BudgetComputedMetrics } from "../lib/budget-metrics";
import { budgetRuleKey } from "../lib/budget-periods";
import { useFinancialWriteGuard } from "../../shared/use-financial-write-guard";
import { isBudgetWriteRejected, validBudgetMoney } from "../lib/budget-write-result";

type Props = {
  budget: BudgetOverview;
  allBudgets: BudgetOverview[];
  metrics: BudgetComputedMetrics | null;
  onClose: () => void;
  onEdit: () => void;
  onQuickSave: (amount: number, alertPercent: number) => Promise<void>;
  canWrite?: boolean;
  isCurrent?: () => boolean;
  sourceReady?: boolean;
};

function monthName(ymd: string) {
  const [year, month] = ymd.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-PE", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function BudgetDetailDialog({ budget, allBudgets, metrics, onClose, onEdit, onQuickSave, canWrite = false, isCurrent = () => false, sourceReady = false }: Props) {
  const navigate = useNavigate();
  const [panel, setPanel] = useState<"detail" | "quick" | "movements">("detail");
  const [visibleCount, setVisibleCount] = useState(50);
  const [amount, setAmount] = useState(String(budget.limitAmount));
  const [alert, setAlert] = useState(budget.alertPercent);
  const [error, setError] = useState<string | null>(null);
  const write = useFinancialWriteGuard(`${budget.workspaceId}:${budget.id}:${panel}`);
  const initial = useRef({ limitAmount: budget.limitAmount, alertPercent: budget.alertPercent });
  const stale = useRef(false);
  if (panel === "quick" && (budget.limitAmount !== initial.current.limitAmount || budget.alertPercent !== initial.current.alertPercent)) stale.current = true;
  const blocked = !canWrite || write.blocked || stale.current;
  const close = () => { if (!write.pending) onClose(); };
  function openQuick() {
    if (!canWrite || !isCurrent()) return;
    initial.current = { limitAmount: budget.limitAmount, alertPercent: budget.alertPercent }; stale.current = false;
    setAmount(String(budget.limitAmount)); setAlert(budget.alertPercent); setError(null); setPanel("quick");
  }
  async function saveQuick() {
    if (blocked || !isCurrent()) return;
    const parsed = Number(amount);
    if (!validBudgetMoney(parsed)) { setError("Ingresa un monto mayor a cero, con máximo dos decimales."); return; }
    const attempt = write.begin(); if (!attempt) return;
    const stillCurrent = isCurrent;
    try { await onQuickSave(parsed, alert); if (write.isCurrent(attempt) && stillCurrent()) { write.confirm(attempt); setPanel("detail"); } }
    catch (cause) {
      if (!write.isCurrent(attempt)) return;
      if (isBudgetWriteRejected(cause)) write.reject(attempt); else write.fail(attempt);
      if (stillCurrent()) setError(cause instanceof Error ? cause.message : "No se confirmó el ajuste. Comprueba Presupuestos antes de repetir.");
    }
  }

  const today = useMemo(() => budgetTodayLima(), []);
  const money = (value: number) => formatCurrency(value, budget.currencyCode);
  const periodLabel = monthName(budget.periodStart);
  const head = budgetHeadState(budget, today, periodLabel, money);
  const history = allBudgets.filter((item) => item.id !== budget.id && budgetRuleKey(item) === budgetRuleKey(budget) && item.periodEnd < budget.periodStart).sort((a, b) => b.periodStart.localeCompare(a.periodStart)).slice(0, 6);
  const contributions = metrics?.contributions ?? [];
  const grouped = budgetMovementDays(contributions, visibleCount);

  const movementRow = (item: typeof contributions[number]) => <button className="flex min-h-[56px] w-full items-center justify-between gap-4 border-b border-white/[0.08] py-2 text-left transition-colors hover:bg-white/[0.03]" key={item.movementId} onClick={() => { onClose(); navigate(`/app/movements?movement=${item.movementId}`); }} type="button">
    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{item.description || "Sin descripción"}</span><span className="block text-xs text-storm">{formatDate(budgetLimaDate(item.occurredAt))}{item.accountName ? ` · ${item.accountName}` : ""}</span></span>
    <span className="shrink-0 text-sm font-semibold text-ink">{money(item.amountInBudgetCurrency)}</span>
  </button>;

  return <Modal className={resourceEditorSurfaceClassName} disableOutsideClose={write.pending} labelledBy="budget-detail-title" onClose={close}>
    <ResourceEditorHeader disabled={write.pending} onBack={panel !== "detail" ? () => setPanel("detail") : undefined} onClose={close} title={panel === "quick" ? "Ajustar límite" : panel === "movements" ? `Movimientos de ${periodLabel.toLowerCase()}` : budget.name} titleId="budget-detail-title" />
    <ModalBody className="!px-5 !py-5 sm:!px-6">
      {panel === "quick" ? <div className="space-y-5">
        {!sourceReady ? <p className="text-sm text-storm" role="status">Esperando una lectura actual. Tu ajuste se conserva, sin enviarlo.</p> : null}
        {stale.current ? <p className="text-sm text-storm" role="alert">El presupuesto cambió. Vuelve al detalle y abre el ajuste otra vez.</p> : null}
        <fieldset className="min-w-0 space-y-5 border-0 p-0" disabled={blocked}>
        <p className="text-sm text-storm">{budget.name} · {budget.scopeLabel}</p>
        <label className="block text-sm text-storm">Monto límite ({budget.currencyCode})<input autoFocus className="mt-2 h-16 w-full rounded-xl border border-white/10 bg-[#141311] px-4 font-display text-3xl font-semibold text-ink outline-none focus:border-white/40" inputMode="decimal" min="0" onChange={(event) => { setAmount(event.target.value); setError(null); }} step="0.01" type="number" value={amount} /></label>
        <div><p className="mb-2 text-sm text-storm">Avisarme al</p><div className="flex gap-2">{[70, 80, 90, 100].map((value) => <button aria-pressed={alert === value} className={`min-h-10 flex-1 rounded-lg border text-sm ${alert === value ? "border-white/40 bg-white/10 text-ink" : "border-white/10 text-storm"}`} key={value} onClick={() => setAlert(value)} type="button">{value}%</button>)}</div></div>
        </fieldset>
        {error ? <p className="text-sm text-[#e6b7aa]" role="alert">{error}</p> : null}
      </div> : !sourceReady ? <DataState title="Comprobando el consumo" description="No se muestran totales ni movimientos sin una lectura actual." /> : panel === "movements" ? <>
        <p className="text-sm text-storm">{contributions.length} movimientos · {money(budget.spentAmount)} de {money(budget.limitAmount)}</p>
        <div className="mt-5">{grouped.days.map((group) => <section key={group.date}>
          <div className="flex items-center justify-between border-b border-white/10 py-2 font-public-mono text-xs uppercase tracking-[0.12em] text-storm"><span>{formatDate(group.date)}</span><span>{money(group.subtotal)}</span></div>
          {group.movements.map(movementRow)}
        </section>)}</div>
        {grouped.rest.count ? <button className="mt-4 w-full py-3 text-left text-sm text-storm hover:text-ink" onClick={() => setVisibleCount((count) => count + 50)} type="button">{grouped.rest.count} movimientos más, {money(grouped.rest.amount)}. Mostrar más</button> : null}
      </> : <>
        <p className="text-sm text-storm">{budget.scopeLabel} · {formatDate(budget.periodStart)}–{formatDate(budget.periodEnd)}</p>
        {head.kind === "no-data" ? <p className="mt-6 text-lg font-semibold leading-7 text-ink">{head.sentence}</p> : <>
          <div className="mt-6 flex items-baseline justify-between gap-4 border-b border-white/10 pb-4"><p className="font-display text-3xl font-semibold text-ink">{money(budget.spentAmount)}</p><p className="text-sm text-storm">de {money(budget.limitAmount)}</p></div>
          {head.kind === "progress" ? <div className="relative mt-4 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-[#e9e3d9]" style={{ width: `${Math.min(100, Math.max(0, budget.usedPercent))}%` }} /><span aria-label="Ritmo esperado" className="absolute top-[-3px] h-3 w-px bg-white" style={{ left: `${head.pacePercent}%` }} /></div> : null}
          <p className="mt-4 text-sm leading-6 text-storm">{head.sentence}</p>
        </>}
        {history.length ? <section className="mt-8"><h3 className="mb-3 font-public-mono text-xs uppercase tracking-[0.12em] text-storm">Meses anteriores</h3>{history.map((item) => <div className="flex min-h-9 items-center gap-3" key={item.id}><span className="w-20 text-sm text-storm">{monthName(item.periodStart)}</span>{item.movementCount ? <><div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#e9e3d9]" style={{ width: `${Math.min(100, item.usedPercent)}%` }} /></div><span className="w-12 text-right text-sm text-ink">{Math.round(item.usedPercent)}%</span></> : <span className="text-xs text-storm">sin movimientos</span>}</div>)}{budgetSeriesReading(history, money) ? <p className="mt-3 text-sm leading-6 text-storm">{budgetSeriesReading(history, money)}</p> : null}</section> : null}
        <section className="mt-8"><div className="mb-2 flex items-center justify-between"><h3 className="font-public-mono text-xs uppercase tracking-[0.12em] text-storm">Movimientos de {periodLabel.toLowerCase()}</h3><span className="text-xs text-storm">{contributions.length}</span></div>{contributions.length ? contributions.slice(0, 3).map(movementRow) : <p className="py-3 text-sm leading-6 text-storm">Todavía no has anotado ningún gasto de este alcance en el período. Los que registres irán descontando del límite.</p>}{contributions.length > 3 ? <button className="flex min-h-[54px] w-full items-center justify-between border-b border-white/[0.08] text-sm text-storm hover:text-ink" onClick={() => setPanel("movements")} type="button"><span>Ver los {contributions.length}</span><ChevronRight className="h-4 w-4" /></button> : null}</section>
        {budget.notes ? <section className="mt-8"><h3 className="mb-2 font-public-mono text-xs uppercase tracking-[0.12em] text-storm">Notas</h3><p className="whitespace-pre-wrap text-sm text-storm">{budget.notes}</p></section> : null}
      </>}
    </ModalBody>
    <ModalFooter>{panel === "detail" ? <div className="flex w-full gap-2"><Button className="flex-1" disabled={!canWrite} onClick={openQuick} variant="secondary">Ajustar límite</Button><Button className="flex-1" disabled={!canWrite} onClick={() => { if (canWrite && isCurrent()) onEdit(); }}>Editar</Button></div> : panel === "quick" ? <Button className="w-full" disabled={blocked} onClick={() => void saveQuick()}>{write.pending ? "Guardando..." : "Guardar"}</Button> : <Button className="w-full" onClick={() => setPanel("detail")} variant="secondary">Volver al presupuesto</Button>}</ModalFooter>
  </Modal>;
}
