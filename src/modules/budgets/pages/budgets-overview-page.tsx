import { ChevronDown, ChevronRight, Download, MoreHorizontal, Pin, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import {
  getQueryErrorMessage,
  useBudgetSpendTypesQuery,
  useCreateBudgetMutation,
  useDeleteBudgetMutation,
  useDuplicateBudgetMutation,
  usePinBudgetMutation,
  useUpdateBudgetMutation,
  useWorkspaceSnapshotQuery,
  type BudgetFormInput,
} from "../../../services/queries/workspace-data";
import type { BudgetOverview, ExchangeRateSummary } from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { BudgetDetailDialog } from "../components/budget-detail-dialog";
import { BudgetEditorDialog, initialBudgetEditorValue, type BudgetEditorValue } from "../components/budget-editor-dialog";
import { useBudgetScopeMovements } from "../hooks/use-budget-scope-movements";
import { applyBudgetComputedMetrics, buildBudgetMetricsMap } from "../lib/budget-metrics";
import { budgetRowNote, duplicateBudgetPeriod, firstBudgetPeriod, groupBudgetRules, nextBudgetPeriod } from "../lib/budget-periods";

function todayPeru() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function rateToBase(from: string, base: string, rates: ExchangeRateSummary[]): number | null {
  if (from === base) return 1;
  const direct = rates.find((rate) => rate.fromCurrencyCode === from && rate.toCurrencyCode === base && rate.rate > 0);
  if (direct) return direct.rate;
  const inverse = rates.find((rate) => rate.fromCurrencyCode === base && rate.toCurrencyCode === from && rate.rate > 0);
  return inverse ? 1 / inverse.rate : null;
}

function saveCSV(budgets: BudgetOverview[]) {
  const fields = ["Nombre", "Alcance", "Inicio", "Fin", "Moneda", "Límite", "Gastado", "Restante", "Estado"];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = budgets.map((budget) => [budget.name, budget.scopeLabel, budget.periodStart, budget.periodEnd, budget.currencyCode, budget.limitAmount, budget.spentAmount, budget.remainingAmount, budget.isActive ? "Activo" : "Inactivo"].map(escape).join(","));
  const blob = new Blob(["\ufeff", fields.join(","), "\n", lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `presupuestos-${todayPeru()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ruleSummary(closed: BudgetOverview[]) {
  const exceeded = closed.filter((budget) => budget.spentAmount > budget.limitAmount).length;
  if (closed.length === 1) return exceeded ? "Te pasaste el último período" : "Dentro del límite el último período";
  return exceeded ? `Te pasaste en ${exceeded} de ${closed.length} períodos` : `Dentro del límite los ${closed.length} períodos`;
}

export function BudgetsPage() {
  const { user } = useAuth();
  const { activeWorkspace, error: workspaceError, isLoading: workspaceLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id);
  const spendTypesQuery = useBudgetSpendTypesQuery(activeWorkspace?.id);
  const createMutation = useCreateBudgetMutation(activeWorkspace?.id, user?.id);
  const updateMutation = useUpdateBudgetMutation(activeWorkspace?.id, user?.id);
  const deleteMutation = useDeleteBudgetMutation(activeWorkspace?.id, user?.id);
  const pinMutation = usePinBudgetMutation(activeWorkspace?.id, user?.id);
  const duplicateMutation = useDuplicateBudgetMutation(activeWorkspace?.id, user?.id);
  const { schedule } = useUndoQueue();

  const [search, setSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<number | null>(null);
  const [editing, setEditing] = useState<BudgetOverview | null>(null);
  const [editorValue, setEditorValue] = useState<BudgetEditorValue | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [analyticsId, setAnalyticsId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetOverview | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [bulkDelete, setBulkDelete] = useState(false);
  const ensureStarted = useRef(new Set<string>());

  const snapshot = snapshotQuery.data;
  const today = todayPeru();
  const scopeMovementsQuery = useBudgetScopeMovements({ workspaceId: activeWorkspace?.id, budgets: snapshot?.budgets ?? [], accounts: snapshot?.accounts ?? [], categories: snapshot?.catalogs.categories ?? [], refreshKey: snapshotQuery.dataUpdatedAt });
  const budgets = useMemo(() => {
    if (!snapshot || !activeWorkspace) return [];
    const map = buildBudgetMetricsMap(snapshot.budgets, scopeMovementsQuery.data ?? [], {
      workspaceBaseCurrencyCode: activeWorkspace.baseCurrencyCode,
      exchangeRates: snapshot.exchangeRates,
    });
    return snapshot.budgets.map((budget) => {
      const metrics = map.get(budget.id);
      return metrics ? applyBudgetComputedMetrics(budget, metrics) : budget;
    });
  }, [snapshot, activeWorkspace, scopeMovementsQuery.data]);
  const metricMap = useMemo(() => snapshot && activeWorkspace && scopeMovementsQuery.data ? buildBudgetMetricsMap(snapshot.budgets, scopeMovementsQuery.data, { workspaceBaseCurrencyCode: activeWorkspace.baseCurrencyCode, exchangeRates: snapshot.exchangeRates }) : new Map(), [snapshot, activeWorkspace, scopeMovementsQuery.data]);
  const visibleBudgets = useMemo(() => budgets.filter((budget) => !hiddenIds.has(budget.id) && [budget.name, budget.scopeLabel, budget.categoryName, budget.accountName, budget.spendTypeName].some((part) => part?.toLocaleLowerCase("es-PE").includes(search.trim().toLocaleLowerCase("es-PE")))), [budgets, hiddenIds, search]);
  const rules = useMemo(() => groupBudgetRules(visibleBudgets, today), [visibleBudgets, today]);
  const active = useMemo(() => rules.flatMap((rule) => rule.current?.isActive ? [rule.current] : []).sort((left, right) => Number(right.isPinned) - Number(left.isPinned) || left.name.localeCompare(right.name, "es")), [rules]);
  const closed = useMemo(() => rules.filter((rule) => rule.closed.length > 0).sort((left, right) => left.closed[0].name.localeCompare(right.closed[0].name, "es")), [rules]);
  const upcoming = useMemo(() => visibleBudgets.filter((budget) => budget.periodStart > today).sort((left, right) => left.periodStart.localeCompare(right.periodStart)), [visibleBudgets, today]);
  const inactive = useMemo(() => rules.flatMap((rule) => rule.current && !rule.current.isActive ? [rule.current] : []), [rules]);
  const baseCurrency = activeWorkspace?.baseCurrencyCode ?? "PEN";
  const convertedTotals = active.map((budget) => ({ budget, rate: rateToBase(budget.currencyCode, baseCurrency, snapshot?.exchangeRates ?? []) }));
  const hasMissingRate = convertedTotals.some((item) => item.rate === null);
  const totalSpent = convertedTotals.reduce((sum, item) => sum + item.budget.spentAmount * (item.rate ?? 0), 0);
  const totalLimit = convertedTotals.reduce((sum, item) => sum + item.budget.limitAmount * (item.rate ?? 0), 0);
  const over = active.filter((budget) => budget.spentAmount > budget.limitAmount);
  const monthLabel = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "America/Lima" }).format(new Date());

  // Solo se abre el período que corre hoy. El índice único del servidor evita duplicados entre dispositivos.
  useEffect(() => {
    if (!snapshot || !activeWorkspace || !user?.id) return;
    for (const rule of groupBudgetRules(snapshot.budgets, today)) {
      if (rule.current || rule.closed.length === 0) continue;
      const last = rule.closed[0];
      if (!last.isActive || !last.recurrence || last.recurrence === "none") continue;
      let period = nextBudgetPeriod(last, last.recurrence);
      let loops = 0;
      while (period && period.periodEnd < today && loops++ < 400) period = nextBudgetPeriod(period, last.recurrence);
      if (!period || period.periodStart > today) continue;
      const key = `${activeWorkspace.id}:${rule.key}:${period.periodStart}`;
      if (ensureStarted.current.has(key)) continue;
      ensureStarted.current.add(key);
      void duplicateMutation.mutateAsync({ budget: last, ...period }).catch((error: unknown) => {
        if ((error as { code?: string }).code !== "23505") setPageError(getQueryErrorMessage(error, "No se pudo abrir el siguiente período."));
      });
    }
  }, [snapshot, activeWorkspace, user?.id, today, duplicateMutation]);

  function openCreate() {
    setEditing(null);
    setEditorValue(initialBudgetEditorValue(today, baseCurrency));
    setEditorDirty(false);
    setEditorError(null);
  }

  function openEdit(budget: BudgetOverview) {
    setEditing(budget);
    setEditorValue(initialBudgetEditorValue(today, baseCurrency, budget));
    setEditorDirty(false);
    setEditorError(null);
    setRowMenuId(null);
  }

  function closeEditor() {
    setEditorValue(null);
    setEditing(null);
    setEditorDirty(false);
    setUnsavedOpen(false);
  }

  function requestCloseEditor() {
    if (editorDirty) setUnsavedOpen(true);
    else closeEditor();
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editorValue || !activeWorkspace || !user?.id) return;
    const amount = Number(editorValue.limitAmount);
    if (!editorValue.scopeChosen) { setEditorError("Elige qué gasto limita este presupuesto. También puedes elegir todo el gasto."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setEditorError("Ingresa un límite mayor a cero."); return; }
    if (editorValue.periodEnd < editorValue.periodStart) { setEditorError("La fecha final debe ser posterior al inicio."); return; }
    const period = !editing && editorValue.recurrence !== "none" ? firstPeriod(today, editorValue.recurrence) : { periodStart: editorValue.periodStart, periodEnd: editorValue.periodEnd };
    const categoryName = snapshot?.catalogs.categories.find((item) => item.id === editorValue.categoryId)?.name;
    const spendName = spendTypesQuery.data?.find((item) => item.id === editorValue.spendTypeId)?.name;
    const name = editorValue.name.trim() || `${categoryName ?? spendName ?? "Presupuesto"} · ${recurrenceText(editorValue.recurrence)}`;
    const payload: BudgetFormInput = {
      name, ...period, currencyCode: editorValue.currencyCode, categoryId: editorValue.categoryId,
      accountId: editorValue.accountId, spendTypeId: editorValue.spendTypeId, recurrence: editorValue.recurrence,
      limitAmount: amount, alertPercent: editorValue.alertPercent, rolloverEnabled: editorValue.rolloverEnabled,
      notes: editorValue.notes.trim() || null, isActive: editorValue.isActive,
    };
    setEditorError(null);
    try {
      if (editing) await updateMutation.mutateAsync({ ...payload, budgetId: editing.id, workspaceId: activeWorkspace.id, userId: user.id });
      else await createMutation.mutateAsync({ ...payload, workspaceId: activeWorkspace.id, userId: user.id });
      closeEditor();
    } catch (error) { setEditorError(getQueryErrorMessage(error, "No se pudo guardar el presupuesto.")); }
  }

  function deleteWithUndo(budget: BudgetOverview) {
    if (!activeWorkspace) return;
    setHiddenIds((previous) => new Set(previous).add(budget.id));
    setDeleteTarget(null);
    setRowMenuId(null);
    schedule({
      label: `${budget.name} eliminado`,
      onCommit: () => deleteMutation.mutateAsync({ budgetId: budget.id, workspaceId: activeWorkspace.id }).catch((error: unknown) => setPageError(getQueryErrorMessage(error))),
      onUndo: () => setHiddenIds((previous) => { const next = new Set(previous); next.delete(budget.id); return next; }),
    });
  }

  async function duplicate(budget: BudgetOverview) {
    const period = budget.recurrence && budget.recurrence !== "none" ? nextBudgetPeriod(budget, budget.recurrence) : duplicateBudgetPeriod(budget);
    if (!period) return;
    try { await duplicateMutation.mutateAsync({ budget, ...period }); }
    catch (error) { setPageError(getQueryErrorMessage(error, "No se pudo duplicar el presupuesto.")); }
    setRowMenuId(null);
  }

  function budgetRow(budget: BudgetOverview) {
    const note = budgetRowNote(budget, today, (amount) => formatCurrency(amount, budget.currencyCode));
    return <div className="relative border-b border-white/[0.08] last:border-0" key={budget.id}>
      <div className="flex min-h-[76px] items-center gap-3 py-3">
        {selectionMode ? <input aria-label={`Seleccionar ${budget.name}`} checked={selected.has(budget.id)} className="h-4 w-4 shrink-0 accent-[#ede8df]" onChange={() => setSelected((previous) => { const next = new Set(previous); if (next.has(budget.id)) next.delete(budget.id); else next.add(budget.id); return next; })} type="checkbox" /> : null}
        <button className="min-w-0 flex-1 text-left" onClick={() => selectionMode ? setSelected((previous) => { const next = new Set(previous); if (next.has(budget.id)) next.delete(budget.id); else next.add(budget.id); return next; }) : setAnalyticsId(budget.id)} type="button">
          <span className="flex items-center gap-2 font-semibold text-ink">{budget.name}{budget.isPinned ? <Pin className="h-3.5 w-3.5 text-storm" /> : null}</span>
          <span className="mt-0.5 block text-xs text-storm">{budget.scopeLabel} · {formatDate(budget.periodStart)}–{formatDate(budget.periodEnd)}</span>
          {note ? <span className="mt-1 block text-xs text-storm">{note}</span> : null}
        </button>
        <div className="w-40 shrink-0 text-right sm:w-52"><p className="text-sm font-semibold text-ink">{formatCurrency(budget.spentAmount, budget.currencyCode)} <span className="font-normal text-storm">de {formatCurrency(budget.limitAmount, budget.currencyCode)}</span></p><div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#e9e3d9]" style={{ width: `${Math.min(100, Math.max(0, budget.usedPercent))}%` }} /></div></div>
        {!selectionMode ? <div className="relative"><button aria-label={`Acciones de ${budget.name}`} aria-expanded={rowMenuId === budget.id} className="grid h-9 w-9 place-items-center rounded-lg text-storm hover:bg-white/[0.06] hover:text-ink" onClick={() => setRowMenuId(rowMenuId === budget.id ? null : budget.id)} type="button"><MoreHorizontal className="h-4 w-4" /></button>{rowMenuId === budget.id ? <div className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#211f1c] p-1 shadow-none">{[["Ver detalle", () => { setAnalyticsId(budget.id); setRowMenuId(null); }], ["Editar", () => openEdit(budget)], [budget.isPinned ? "Desfijar" : "Fijar", () => { void pinMutation.mutateAsync({ budgetId: budget.id, isPinned: !budget.isPinned }).catch((error: unknown) => setPageError(getQueryErrorMessage(error))); setRowMenuId(null); }], ["Duplicar período", () => void duplicate(budget)], ["Eliminar", () => { setDeleteTarget(budget); setRowMenuId(null); }]].map(([label, action]) => <button className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-storm hover:bg-white/[0.06] hover:text-ink" key={label as string} onClick={action as () => void} type="button">{label as string}</button>)}</div> : null}</div> : null}
      </div>
    </div>;
  }

  if (workspaceLoading || snapshotQuery.isLoading) return <DataState description="Cargando límites y movimientos..." title="Presupuestos" />;
  if (workspaceError || snapshotQuery.error) return <DataState description={getQueryErrorMessage(workspaceError ?? snapshotQuery.error)} title="No se pudieron cargar los presupuestos" tone="error" />;
  if (!activeWorkspace || !snapshot) return <DataState description="Activa un espacio para crear presupuestos." title="Sin espacio activo" />;
  if (scopeMovementsQuery.isLoading && snapshot.budgets.length) return <DataState description="Calculando el gasto de todos los períodos..." title="Presupuestos" />;
  if (scopeMovementsQuery.error) return <DataState description={getQueryErrorMessage(scopeMovementsQuery.error, "No se pudieron calcular los límites con todos los movimientos.")} title="No se pudo calcular el consumo" tone="error" />;

  return <div className="pb-10">
    <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-6">
      <div><h1 className="font-display text-[1.75rem] font-semibold tracking-[-0.03em] text-ink">Presupuestos</h1><p className="mt-1 text-sm text-storm">{budgets.length} períodos registrados · {active.length} vigentes en {monthLabel}</p></div>
      <div className="flex items-center gap-2"><Button className="whitespace-nowrap" onClick={openCreate}><Plus className="h-4 w-4" /><span className="sm:hidden">Nuevo</span><span className="hidden sm:inline">Nuevo presupuesto</span></Button><div className="relative"><button aria-label="Más acciones" aria-expanded={pageMenuOpen} className="grid h-11 w-11 place-items-center rounded-[10px] border border-white/10 text-storm hover:text-ink" onClick={() => setPageMenuOpen(!pageMenuOpen)} type="button"><MoreHorizontal className="h-4 w-4" /></button>{pageMenuOpen ? <div className="absolute right-0 top-12 z-20 w-52 rounded-xl border border-white/10 bg-[#211f1c] p-1"><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-storm hover:bg-white/[0.06] hover:text-ink" onClick={() => { saveCSV(visibleBudgets); setPageMenuOpen(false); }} type="button"><Download className="h-4 w-4" />Exportar CSV</button><button className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-storm hover:bg-white/[0.06] hover:text-ink" onClick={() => { setSelectionMode(true); setPageMenuOpen(false); }} type="button">Seleccionar varios</button></div> : null}</div></div>
    </header>

    {pageError ? <p className="mt-4 rounded-xl border border-white/10 bg-[#211b19] p-3 text-sm text-[#e6b7aa]" role="alert">{pageError} <button className="ml-2 underline" onClick={() => setPageError(null)} type="button">Cerrar</button></p> : null}

    {budgets.length >= 8 ? <label className="mt-6 flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-[#1a1917] px-4 text-storm"><Search className="h-4 w-4" /><input className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-storm/70" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar presupuestos..." value={search} /></label> : null}

    {active.length > 0 ? <section className="mt-6 flex flex-wrap items-baseline justify-between gap-3 border-y border-white/[0.08] py-4" aria-label="Resumen de presupuestos vigentes"><p className="text-sm text-storm">{hasMissingRate ? "No se suman monedas sin tipo de cambio. Revisa cada presupuesto abajo." : <><strong className="font-display text-2xl font-semibold text-ink">{formatCurrency(totalSpent, baseCurrency)}</strong> de {formatCurrency(totalLimit, baseCurrency)}</>}</p><p className="text-xs text-storm">{over.length ? `Te pasaste en ${over.map((budget) => budget.name).join(", ")}.` : "Ninguno ha superado su límite."}</p></section> : null}

    {selectionMode ? <div className="mt-5 flex flex-wrap items-center gap-3 border-y border-white/10 py-3 text-sm"><button className="text-storm hover:text-ink" onClick={() => { setSelectionMode(false); setSelected(new Set()); }} type="button">Cancelar</button><span className="text-ink">{selected.size} seleccionados</span><button className="text-storm hover:text-ink" onClick={() => setSelected(new Set(visibleBudgets.map((budget) => budget.id)))} type="button">Seleccionar todos</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!selected.size} onClick={() => saveCSV(visibleBudgets.filter((budget) => selected.has(budget.id)))} type="button">CSV</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!selected.size} onClick={() => { void Promise.all(visibleBudgets.filter((budget) => selected.has(budget.id)).map(duplicate)); setSelectionMode(false); setSelected(new Set()); }} type="button">Duplicar</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!selected.size} onClick={() => setBulkDelete(true)} type="button">Eliminar</button></div> : null}

    {active.length ? <section className="mt-6"><h2 className="mb-2 font-public-mono text-xs uppercase tracking-[0.16em] text-storm">Este período</h2>{active.map(budgetRow)}</section> : null}
    {upcoming.length ? <section className="mt-8"><h2 className="mb-2 font-public-mono text-xs uppercase tracking-[0.16em] text-storm">Próximos períodos</h2>{upcoming.map(budgetRow)}</section> : null}
    {inactive.length ? <section className="mt-8"><h2 className="mb-2 font-public-mono text-xs uppercase tracking-[0.16em] text-storm">Inactivos</h2>{inactive.map(budgetRow)}</section> : null}
    {closed.length ? <section className="mt-8"><button aria-expanded={showClosed} className="flex w-full items-center justify-between border-b border-white/10 py-3 text-left font-public-mono text-xs uppercase tracking-[0.16em] text-storm hover:text-ink" onClick={() => setShowClosed(!showClosed)} type="button"><span>Períodos cerrados · {closed.length} {closed.length === 1 ? "regla" : "reglas"}</span>{showClosed ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>{showClosed ? closed.map((rule) => <button className="flex min-h-[60px] w-full items-center justify-between border-b border-white/[0.08] py-3 text-left hover:bg-white/[0.02]" key={rule.key} onClick={() => setAnalyticsId(rule.closed[0].id)} type="button"><span><span className="block text-sm font-semibold text-ink">{rule.closed[0].name}</span><span className="mt-1 block text-xs text-storm">{ruleSummary(rule.closed)}</span></span><ChevronRight className="h-4 w-4 text-storm" /></button>) : null}</section> : null}
    {!visibleBudgets.length ? <div className="mt-8"><DataState action={<Button onClick={search ? () => setSearch("") : openCreate}>{search ? "Limpiar búsqueda" : "Crear presupuesto"}</Button>} description={search ? "Prueba con otro nombre, categoría o cuenta." : "Pon un límite a una categoría, un tipo de gasto, una cuenta o a todo tu gasto."} title={search ? "No hay coincidencias" : "Aún no tienes presupuestos"} /></div> : null}

    {editorValue ? <BudgetEditorDialog accounts={snapshot.accounts.filter((account) => !account.isArchived).map((account) => ({ id: account.id, name: account.name }))} categories={snapshot.catalogs.categories} currencies={[...new Set([baseCurrency, "PEN", "USD", "EUR", ...snapshot.accounts.map((account) => account.currencyCode)])]} error={editorError} isCreate={!editing} isSaving={createMutation.isPending || updateMutation.isPending} onChange={(value) => { setEditorValue(value); setEditorDirty(true); setEditorError(null); }} onClose={requestCloseEditor} onSubmit={(event) => void submitEditor(event)} spendTypes={spendTypesQuery.data ?? []} value={editorValue} /> : null}
    {unsavedOpen ? <UnsavedChangesDialog onDiscard={closeEditor} onKeepEditing={() => setUnsavedOpen(false)} /> : null}
    {analyticsId !== null ? (() => { const budget = budgets.find((item) => item.id === analyticsId); return budget ? <BudgetDetailDialog allBudgets={budgets} budget={budget} metrics={metricMap.get(budget.id) ?? null} onClose={() => setAnalyticsId(null)} onEdit={() => { setAnalyticsId(null); openEdit(budget); }} onQuickSave={async (limitAmount, alertPercent) => { if (!user?.id) throw new Error("No hay sesión activa."); await updateMutation.mutateAsync({ budgetId: budget.id, workspaceId: activeWorkspace.id, userId: user.id, name: budget.name, periodStart: budget.periodStart, periodEnd: budget.periodEnd, currencyCode: budget.currencyCode, categoryId: budget.categoryId, accountId: budget.accountId, spendTypeId: budget.spendTypeId, recurrence: budget.recurrence, limitAmount, alertPercent, rolloverEnabled: budget.rolloverEnabled, notes: budget.notes, isActive: budget.isActive }); }} /> : null; })() : null}
    {deleteTarget ? <DeleteConfirmDialog badge="Eliminar presupuesto" description="Se elimina este período, no sus movimientos. Puedes deshacer la acción durante unos segundos." isDeleting={deleteMutation.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteWithUndo(deleteTarget)}><p className="text-lg font-semibold text-ink">{deleteTarget.name}</p></DeleteConfirmDialog> : null}
    {bulkDelete ? <DeleteConfirmDialog badge="Eliminar presupuestos" description={`Se eliminarán ${selected.size} períodos. Tus movimientos no se borrarán.`} isDeleting={false} onCancel={() => setBulkDelete(false)} onConfirm={() => { visibleBudgets.filter((budget) => selected.has(budget.id)).forEach(deleteWithUndo); setBulkDelete(false); setSelectionMode(false); setSelected(new Set()); }}><p className="text-lg font-semibold text-ink">{selected.size} seleccionados</p></DeleteConfirmDialog> : null}
  </div>;
}

function firstPeriod(today: string, recurrence: BudgetEditorValue["recurrence"]) {
  // Se calcula en el momento de guardar: un diálogo abierto antes de medianoche no crea un período viejo.
  return recurrence === "none" ? { periodStart: today, periodEnd: today } : firstBudgetPeriod(today, recurrence);
}

function recurrenceText(recurrence: BudgetEditorValue["recurrence"]) {
  return recurrence === "none" ? "entre fechas" : recurrence === "monthly" ? "mensual" : recurrence === "weekly" ? "semanal" : recurrence === "biweekly" ? "quincenal" : recurrence === "quarterly" ? "trimestral" : "anual";
}
