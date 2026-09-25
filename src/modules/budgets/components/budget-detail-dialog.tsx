import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Modal, ModalFooter } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { BudgetOverview } from "../../../types/domain";
import type { BudgetComputedMetrics } from "../lib/budget-metrics";
import { budgetRuleKey } from "../lib/budget-periods";

export function BudgetDetailDialog({ budget, allBudgets, metrics, onClose, onEdit, onQuickSave }: {
  budget: BudgetOverview;
  allBudgets: BudgetOverview[];
  metrics: BudgetComputedMetrics | null;
  onClose: () => void;
  onEdit: () => void;
  onQuickSave: (amount: number, alertPercent: number) => Promise<void>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [panel, setPanel] = useState<"detail" | "quick">("detail");
  const [amount, setAmount] = useState(String(budget.limitAmount));
  const [alert, setAlert] = useState(budget.alertPercent);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setAmount(String(budget.limitAmount)); setAlert(budget.alertPercent); }, [budget.limitAmount, budget.alertPercent]);
  const history = allBudgets.filter((item) => item.id !== budget.id && budgetRuleKey(item) === budgetRuleKey(budget)).sort((left, right) => right.periodStart.localeCompare(left.periodStart));
  const contributions = metrics?.contributions ?? [];
  const shown = showAll ? contributions : contributions.slice(0, 6);
  return <Modal className={resourceEditorSurfaceClassName} labelledBy="budget-detail-title" onClose={onClose}>
    <ResourceEditorHeader onBack={panel === "quick" ? () => setPanel("detail") : undefined} onClose={onClose} title={panel === "quick" ? "Ajustar límite" : budget.name} titleId="budget-detail-title" />
    <ModalBody className="!px-5 !py-5 sm:!px-6">
      {panel === "quick" ? <div className="space-y-5"><p className="text-sm text-storm">{budget.name} · {budget.scopeLabel}</p><label className="block text-sm text-storm">Monto límite ({budget.currencyCode})<input autoFocus className="mt-2 h-16 w-full rounded-xl border border-white/10 bg-[#141311] px-4 font-display text-3xl font-semibold text-ink outline-none focus:border-white/40" inputMode="decimal" min="0" onChange={(event) => { setAmount(event.target.value); setError(null); }} step="0.01" type="number" value={amount} /></label><div><p className="mb-2 text-sm text-storm">Avisarme al</p><div className="flex gap-2">{[70, 80, 90, 100].map((value) => <button aria-pressed={alert === value} className={`min-h-10 flex-1 rounded-lg border text-sm ${alert === value ? "border-white/40 bg-white/10 text-ink" : "border-white/10 text-storm"}`} key={value} onClick={() => setAlert(value)} type="button">{value}%</button>)}</div></div>{error ? <p className="text-sm text-[#e6b7aa]" role="alert">{error}</p> : null}</div> : <>
      <p className="text-sm text-storm">{budget.scopeLabel} · {formatDate(budget.periodStart)}–{formatDate(budget.periodEnd)}</p>
      <div className="mt-6 flex items-baseline justify-between gap-4 border-b border-white/10 pb-4"><p className="font-display text-3xl font-semibold text-ink">{formatCurrency(budget.spentAmount, budget.currencyCode)}</p><p className="text-sm text-storm">de {formatCurrency(budget.limitAmount, budget.currencyCode)}</p></div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#e9e3d9]" style={{ width: `${Math.min(100, Math.max(0, budget.usedPercent))}%` }} /></div>
      <div className="mt-4 flex justify-between text-sm"><span className="text-storm">Disponible</span><strong className="font-semibold text-ink">{formatCurrency(Math.max(0, budget.remainingAmount), budget.currencyCode)}</strong></div>
      <div className="mt-7"><h3 className="mb-2 text-sm font-semibold text-ink">Movimientos que cuentan</h3>{shown.length ? shown.map((item) => <div className="flex min-h-[54px] items-center justify-between gap-4 border-b border-white/[0.08] py-2" key={item.movementId}><span className="min-w-0"><span className="block truncate text-sm font-medium text-ink">{item.description}</span><span className="block text-xs text-storm">{formatDate(item.occurredAt)} · {item.categoryName ?? "Sin categoría"}</span></span><span className="shrink-0 text-sm font-semibold text-ink">{formatCurrency(item.amountInBudgetCurrency, budget.currencyCode)}</span></div>) : <p className="py-4 text-sm text-storm">Aún no hay gasto aplicado a este período.</p>}{contributions.length > 6 ? <button className="mt-3 text-sm text-storm underline underline-offset-4 hover:text-ink" onClick={() => setShowAll(!showAll)} type="button">{showAll ? "Ver menos" : `Ver los ${contributions.length} movimientos`}</button> : null}</div>
      {history.length ? <div className="mt-8"><h3 className="mb-2 text-sm font-semibold text-ink">Historial de esta regla</h3>{history.map((item) => <div className="flex justify-between gap-4 border-b border-white/[0.08] py-3 text-sm" key={item.id}><span className="text-storm">{formatDate(item.periodStart)}–{formatDate(item.periodEnd)}</span><span className="text-ink">{formatCurrency(item.spentAmount, item.currencyCode)} de {formatCurrency(item.limitAmount, item.currencyCode)}</span></div>)}</div> : null}
      {budget.notes ? <div className="mt-8"><h3 className="mb-2 text-sm font-semibold text-ink">Notas</h3><p className="whitespace-pre-wrap text-sm text-storm">{budget.notes}</p></div> : null}
      </>}
    </ModalBody>
    <ModalFooter>{panel === "detail" ? <div className="flex w-full gap-2"><Button className="flex-1" onClick={() => setPanel("quick")} variant="secondary">Ajustar límite</Button><Button className="flex-1" onClick={onEdit}>Editar</Button></div> : <Button className="w-full" disabled={saving} onClick={() => { const parsed = Number(amount); if (!Number.isFinite(parsed) || parsed <= 0) { setError("Ingresa un monto mayor a cero."); return; } setSaving(true); void onQuickSave(parsed, alert).then(() => setPanel("detail")).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No se pudo guardar.")).finally(() => setSaving(false)); }}>{saving ? "Guardando..." : "Guardar"}</Button>}</ModalFooter>
  </Modal>;
}
