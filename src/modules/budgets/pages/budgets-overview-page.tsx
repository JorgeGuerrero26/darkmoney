import { ChevronDown, ChevronRight, Download, MoreHorizontal, Pin, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useResourceLink } from "../../../hooks/use-resource-link";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import {
  getQueryErrorMessage,
  useAdjustBudgetLimitMutation,
  useBudgetSpendTypesQuery,
  useCreateBudgetMutation,
  useDeleteBudgetMutation,
  useDuplicateBudgetMutation,
  usePinBudgetMutation,
  useUpdateBudgetMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import type { BudgetOverview, ExchangeRateSummary } from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { BudgetDetailDialog } from "../components/budget-detail-dialog";
import { BudgetEditorDialog, initialBudgetEditorValue, type BudgetEditorValue } from "../components/budget-editor-dialog";
import { useBudgetScopeMovements } from "../hooks/use-budget-scope-movements";
import { applyBudgetComputedMetrics, buildBudgetMetricsMap } from "../lib/budget-metrics";
import { buildBudgetCSV } from "../lib/budget-csv";
import { buildBudgetEditorInput, budgetEditorCurrencies } from "../lib/budget-editor-input";
import { budgetRowNote, duplicateBudgetPeriod, groupBudgetRules, nextBudgetPeriod } from "../lib/budget-periods";
import { useCatalogWriteScope } from "../../shared/use-catalog-write-scope";
import { confirmBudgetWrite, isBudgetWriteRejected } from "../lib/budget-write-result";

function todayPeru() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function rateToBase(from: string, base: string, rates: ExchangeRateSummary[]): number | null {
  if (from === base) return 1;
  const direct = rates.find((rate) => rate.fromCurrencyCode === from && rate.toCurrencyCode === base && Number.isFinite(rate.rate) && rate.rate > 0);
  if (direct) return direct.rate;
  const inverse = rates.find((rate) => rate.fromCurrencyCode === base && rate.toCurrencyCode === from && Number.isFinite(rate.rate) && rate.rate > 0);
  return inverse ? 1 / inverse.rate : null;
}

function saveCSV(budgets: BudgetOverview[]) {
  const blob = new Blob([buildBudgetCSV(budgets)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `presupuestos-${todayPeru()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ruleSummary(closed: BudgetOverview[]) {
  const withData = closed.filter((budget) => budget.movementCount > 0);
  if (!withData.length) return closed.length === 1 ? "Último período sin movimientos" : `${closed.length} períodos sin movimientos`;
  const exceeded = withData.filter((budget) => budget.spentAmount > budget.limitAmount).length;
  if (withData.length === 1) return exceeded ? "Te pasaste el último período con datos" : "Dentro del límite el último período con datos";
  return exceeded ? `Te pasaste en ${exceeded} de ${withData.length} períodos con datos` : `Dentro del límite los ${withData.length} períodos con datos`;
}

function sameBudget(left: BudgetOverview, right: BudgetOverview) {
  const fields = ["id", "workspaceId", "name", "categoryId", "accountId", "spendTypeId", "limitAmount", "alertPercent", "periodStart", "periodEnd", "currencyCode", "recurrence", "rolloverEnabled", "notes", "isActive", "isPinned"] as const;
  return fields.every(key => left[key] === right[key]);
}

export function BudgetsPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useActiveWorkspace();
  return <BudgetWorkspacePage key={`${user?.id ?? "none"}:${activeWorkspace?.id ?? "none"}`} />;
}

function BudgetWorkspacePage() {
  const { user } = useAuth();
  const workspaceQuery = useActiveWorkspace();
  const { activeWorkspace, error: workspaceError, isLoading: workspaceLoading } = workspaceQuery;
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id);
  const spendTypesQuery = useBudgetSpendTypesQuery(activeWorkspace?.id, user?.id);
  const createMutation = useCreateBudgetMutation(activeWorkspace?.id, user?.id);
  const updateMutation = useUpdateBudgetMutation(activeWorkspace?.id, user?.id);
  const adjustMutation = useAdjustBudgetLimitMutation(activeWorkspace?.id, user?.id);
  const deleteMutation = useDeleteBudgetMutation(activeWorkspace?.id, user?.id);
  const pinMutation = usePinBudgetMutation(activeWorkspace?.id, user?.id);
  const duplicateMutation = useDuplicateBudgetMutation(activeWorkspace?.id, user?.id);
  const { schedule, cancel } = useUndoQueue();

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
  const queued = useRef(new Set<string>());
  const lane = useRef<"idle" | "pending" | "uncertain">("idle");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);

  const snapshot = user && !snapshotQuery.isPlaceholderData && snapshotQuery.data?.workspace.id === activeWorkspace?.id ? snapshotQuery.data : undefined;
  const scopedBudgets = useMemo(() => (snapshot?.budgets ?? []).filter(item => item.workspaceId === activeWorkspace?.id), [snapshot?.budgets, activeWorkspace?.id]);
  const scopedAccounts = useMemo(() => (snapshot?.accounts ?? []).filter(item => item.workspaceId === activeWorkspace?.id), [snapshot?.accounts, activeWorkspace?.id]);
  const today = todayPeru();
  const scopeMovementsQuery = useBudgetScopeMovements({ workspaceId: activeWorkspace?.id, userId: user?.id, budgets: scopedBudgets, accounts: scopedAccounts, categories: snapshot?.catalogs.categories ?? [], refreshKey: snapshotQuery.dataUpdatedAt });
  const consumptionReady = Boolean(snapshot && snapshotQuery.isSuccess && !snapshotQuery.isFetching && !snapshotQuery.error && !workspaceLoading && !workspaceError && !workspaceQuery.isFetching && !workspaceQuery.isPlaceholderData && (!scopedBudgets.length || (scopeMovementsQuery.isSuccess && !scopeMovementsQuery.isFetching && !scopeMovementsQuery.isPlaceholderData && !scopeMovementsQuery.error)));
  const ready = consumptionReady && spendTypesQuery.isSuccess && !spendTypesQuery.isFetching && !spendTypesQuery.isPlaceholderData && !spendTypesQuery.error;
  const readState = useRef({ ready: consumptionReady, token: {} });
  if (readState.current.ready !== consumptionReady) readState.current = { ready: consumptionReady, token: {} };
  const readToken = readState.current.token, readMounted = useRef(true);
  useEffect(() => { readMounted.current = true; return () => { readMounted.current = false; }; }, []);
  const isCurrentConsumption = () => readMounted.current && consumptionReady && readState.current.token === readToken;
  const writeScope = useCatalogWriteScope(activeWorkspace, user?.id, ready);
  const responseScope = useCatalogWriteScope(activeWorkspace, user?.id, !workspaceLoading && !workspaceError && !workspaceQuery.isFetching && !workspaceQuery.isPlaceholderData);
  const live = useRef({ ready, budgets: scopedBudgets }); live.current = { ready, budgets: scopedBudgets };
  const canWrite = writeScope.writable && !busy && !uncertain;
  useEffect(() => {
    if (!responseScope.writable) { queued.current.forEach(cancel); queued.current.clear(); }
  }, [responseScope.writable, cancel]);
  useEffect(() => () => { queued.current.forEach(cancel); queued.current.clear(); }, [cancel]);

  function currentBudget(id: number, expected?: BudgetOverview) {
    writeScope.assertCurrent();
    const current = live.current.budgets.find(item => item.id === id);
    if (!current || (expected && !sameBudget(current, expected))) throw new Error("El presupuesto cambió. Cierra y vuelve a abrir el formulario antes de guardar.");
    return current;
  }

  async function runWrite(send: () => Promise<{ id: number; workspaceId: number }>, targetId?: number) {
    responseScope.assertCurrent();
    if (!live.current.ready) throw new Error("Espera la lectura actual antes de guardar.");
    if (lane.current !== "idle") throw new Error("Hay una operación pendiente o sin confirmar. Comprueba Presupuestos antes de repetir.");
    lane.current = "pending"; setBusy(true);
    try {
      const result = await send();
      confirmBudgetWrite(result && { id: result.id, workspace_id: result.workspaceId }, { workspaceId: activeWorkspace!.id, budgetId: targetId });
      if (!responseScope.isCurrent()) throw new Error("El contexto cambió durante el guardado. Comprueba Presupuestos antes de repetir.");
      lane.current = "idle";
      return result;
    } catch (error) {
      lane.current = isBudgetWriteRejected(error) ? "idle" : "uncertain";
      setUncertain(lane.current === "uncertain");
      if (responseScope.isCurrent()) setPageError(getQueryErrorMessage(error, "No se confirmó la operación. Comprueba Presupuestos antes de repetir."));
      throw error;
    } finally { setBusy(false); }
  }
  const metricMap = useMemo(() => consumptionReady && snapshot && activeWorkspace ? buildBudgetMetricsMap(scopedBudgets, scopeMovementsQuery.data ?? [], { workspaceBaseCurrencyCode: activeWorkspace.baseCurrencyCode, exchangeRates: snapshot.exchangeRates }) : new Map(), [consumptionReady, snapshot, scopedBudgets, activeWorkspace, scopeMovementsQuery.data]);
  const budgets = useMemo(() => scopedBudgets.map(budget => { const metrics = metricMap.get(budget.id); return metrics ? applyBudgetComputedMetrics(budget, metrics) : budget; }), [scopedBudgets, metricMap]);
  const computedRows = useRef(budgets); computedRows.current = budgets;
  function exportConsumption(ids: number[]) { if (isCurrentConsumption()) saveCSV(computedRows.current.filter(budget => ids.includes(budget.id))); }
  useResourceLink(budgets, setAnalyticsId);
  useResourceLink(budgets, (id) => {
    if (!canWrite) return;
    const source = budgets.find((budget) => budget.id === id);
    if (!source) return;
    const period = duplicateBudgetPeriod(source);
    setEditing(null);
    setEditorValue({ ...initialBudgetEditorValue(today, baseCurrency, source), ...period });
    setEditorDirty(false);
    setEditorError(null);
  }, "duplicateFrom");
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

  // Only writers may renew; one attempt per rule and period in this mounted scope.
  // This is not a cross-device idempotency guarantee.
  useEffect(() => {
    if (!canWrite || !snapshot || !activeWorkspace || !user?.id || lane.current !== "idle") return;
    for (const rule of groupBudgetRules(scopedBudgets, today)) {
      if (rule.current || rule.closed.length === 0) continue;
      const last = rule.closed[0];
      if (!last.recurrence || last.recurrence === "none") continue;
      let period = nextBudgetPeriod(last, last.recurrence);
      let loops = 0;
      while (period && period.periodEnd < today && loops++ < 400) period = nextBudgetPeriod(period, last.recurrence);
      if (!period || period.periodStart > today || period.periodEnd < today) continue;
      const key = `${activeWorkspace.id}:${rule.key}:${period.periodStart}`;
      if (ensureStarted.current.has(key)) continue;
      ensureStarted.current.add(key);
      const source = currentBudget(last.id);
      void runWrite(() => duplicateMutation.mutateAsync({ budget: source, ...period })).catch(() => {});
      break; // Read the refreshed snapshot before starting another rule.
    }
  }, [snapshot, scopedBudgets, activeWorkspace, user?.id, today, canWrite, duplicateMutation]);

  function openCreate() {
    if (!canWrite || !writeScope.isCurrent()) return;
    setEditing(null);
    setEditorValue(initialBudgetEditorValue(today, baseCurrency));
    setEditorDirty(false);
    setEditorError(null);
  }

  function openEdit(budget: BudgetOverview) {
    if (!canWrite || !writeScope.isCurrent()) return;
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
    if (lane.current === "pending") return;
    if (editorDirty) setUnsavedOpen(true);
    else closeEditor();
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || !writeScope.isCurrent() || lane.current !== "idle" || !editorValue || !activeWorkspace || !user?.id || !snapshot) return;
    setEditorError(null);
    try {
      const payload = buildBudgetEditorInput(editorValue, snapshot, spendTypesQuery.data ?? [], todayPeru(), !editing);
      if (editing) { currentBudget(editing.id, editing); await runWrite(() => updateMutation.mutateAsync({ ...payload, budgetId: editing.id, workspaceId: activeWorkspace.id, userId: user.id }), editing.id); }
      else await runWrite(() => createMutation.mutateAsync({ ...payload, workspaceId: activeWorkspace.id, userId: user.id }));
      if (responseScope.isCurrent()) closeEditor();
    } catch (error) { if (responseScope.isCurrent()) setEditorError(getQueryErrorMessage(error, "No se pudo guardar el presupuesto.")); }
  }

  function deleteWithUndo(targets: BudgetOverview[]) {
    if (!canWrite || !writeScope.isCurrent() || !activeWorkspace || lane.current !== "idle") return;
    const ids = targets.map(item => item.id);
    if (!ids.length) return;
    try { for (const item of targets) currentBudget(item.id, item); }
    catch (error) { setPageError(getQueryErrorMessage(error)); return; }
    setHiddenIds((previous) => new Set([...previous, ...ids]));
    setDeleteTarget(null);
    setRowMenuId(null);
    let consumed = false;
    const confirmed = new Set<number>();
    const restore = () => setHiddenIds(previous => new Set([...previous].filter(id => !ids.includes(id) || confirmed.has(id))));
    const token = responseScope.isCurrent;
    const queueId = schedule({
      label: `${ids.length} ${ids.length === 1 ? "presupuesto pendiente de eliminar" : "presupuestos pendientes de eliminar"}`,
      onCommit: async () => {
        if (consumed) return; consumed = true; queued.current.delete(queueId);
        try {
          for (const item of targets) {
            if (!token() || !live.current.ready || lane.current !== "idle") throw new Error("Los datos o permisos cambiaron. Revisa los presupuestos antes de eliminar.");
            const row = live.current.budgets.find(budget => budget.id === item.id);
            if (!row || !sameBudget(row, item)) throw new Error("El presupuesto cambió. Revisa el período antes de eliminar.");
            // Capture the original permission token but use the refreshed read gate for each item.
            await runWrite(() => deleteMutation.mutateAsync({ budgetId: item.id, workspaceId: activeWorkspace.id }), item.id);
            confirmed.add(item.id);
          }
        } catch (error) { restore(); if (token()) setPageError(getQueryErrorMessage(error)); }
      },
      onUndo: () => { if (consumed) return; consumed = true; queued.current.delete(queueId); restore(); },
    });
    queued.current.add(queueId);
  }

  async function duplicate(budget: BudgetOverview) {
    if (!canWrite || !writeScope.isCurrent() || lane.current !== "idle") return;
    try { const current = currentBudget(budget.id, budget); await runWrite(() => duplicateMutation.mutateAsync({ budget: current, ...duplicateBudgetPeriod(current) })); }
    catch (error) { if (responseScope.isCurrent()) setPageError(getQueryErrorMessage(error, "No se pudo duplicar el presupuesto.")); }
    if (responseScope.isCurrent()) setRowMenuId(null);
  }

  async function pin(budget: BudgetOverview) {
    if (!canWrite || lane.current !== "idle") return;
    try { const current = currentBudget(budget.id, budget); await runWrite(() => pinMutation.mutateAsync({ budgetId: current.id, isPinned: !current.isPinned }), current.id); }
    catch (error) { if (responseScope.isCurrent()) setPageError(getQueryErrorMessage(error)); }
    if (responseScope.isCurrent()) setRowMenuId(null);
  }

  async function duplicateSelected(targets: BudgetOverview[]) {
    if (!canWrite || !writeScope.isCurrent() || lane.current !== "idle") return;
    try {
      for (const target of targets) {
        responseScope.assertCurrent();
        if (!live.current.ready) throw new Error("La lectura cambió. Revisa qué períodos se duplicaron antes de continuar.");
        const current = live.current.budgets.find(item => item.id === target.id);
        if (!current || !sameBudget(current, target)) throw new Error("Un presupuesto cambió. Revisa los períodos antes de continuar.");
        await runWrite(() => duplicateMutation.mutateAsync({ budget: current, ...duplicateBudgetPeriod(current) }));
      }
    } catch (error) { if (responseScope.isCurrent()) setPageError(getQueryErrorMessage(error)); }
  }

  function budgetRow(budget: BudgetOverview) {
    const note = consumptionReady ? budgetRowNote(budget, today, (amount) => formatCurrency(amount, budget.currencyCode)) : "Consumo por comprobar";
    return <div className="relative border-b border-white/[0.08] last:border-0" key={budget.id}>
      <div className="flex min-h-[76px] items-center gap-3 py-3">
        {selectionMode ? <input aria-label={`Seleccionar ${budget.name}`} checked={selected.has(budget.id)} className="h-4 w-4 shrink-0 accent-[#ede8df]" onChange={() => setSelected((previous) => { const next = new Set(previous); if (next.has(budget.id)) next.delete(budget.id); else next.add(budget.id); return next; })} type="checkbox" /> : null}
        <button className="min-w-0 flex-1 text-left" onClick={() => selectionMode ? setSelected((previous) => { const next = new Set(previous); if (next.has(budget.id)) next.delete(budget.id); else next.add(budget.id); return next; }) : setAnalyticsId(budget.id)} type="button">
          <span className="flex items-center gap-2 font-semibold text-ink">{budget.name}{budget.isPinned ? <Pin className="h-3.5 w-3.5 text-storm" /> : null}</span>
          <span className="mt-0.5 block text-xs text-storm">{budget.scopeLabel} · {formatDate(budget.periodStart)}–{formatDate(budget.periodEnd)}</span>
          {note ? <span className="mt-1 block text-xs text-storm">{note}</span> : null}
        </button>
        <div className="w-40 shrink-0 text-right sm:w-52"><p className="text-sm font-semibold text-ink">{consumptionReady ? formatCurrency(budget.spentAmount, budget.currencyCode) : "Sin total"} <span className="font-normal text-storm">de {formatCurrency(budget.limitAmount, budget.currencyCode)}</span></p>{consumptionReady ? <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#e9e3d9]" style={{ width: `${Math.min(100, Math.max(0, budget.usedPercent))}%` }} /></div> : null}</div>
        {!selectionMode ? <div className="relative"><button aria-label={`Acciones de ${budget.name}`} aria-expanded={rowMenuId === budget.id} className="grid h-9 w-9 place-items-center rounded-lg text-storm hover:bg-white/[0.06] hover:text-ink" onClick={() => setRowMenuId(rowMenuId === budget.id ? null : budget.id)} type="button"><MoreHorizontal className="h-4 w-4" /></button>{rowMenuId === budget.id ? <div className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#211f1c] p-1 shadow-none">{[["Ver detalle", () => { setAnalyticsId(budget.id); setRowMenuId(null); }], ["Editar", () => openEdit(budget)], [budget.isPinned ? "Desfijar" : "Fijar", () => void pin(budget)], ["Duplicar período", () => void duplicate(budget)], ["Eliminar", () => { setDeleteTarget(budget); setRowMenuId(null); }]].filter(([label]) => label === "Ver detalle" || canWrite).map(([label, action]) => <button className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-storm hover:bg-white/[0.06] hover:text-ink" key={label as string} onClick={action as () => void} type="button">{label as string}</button>)}</div> : null}</div> : null}
      </div>
    </div>;
  }

  if (workspaceLoading || snapshotQuery.isLoading) return <DataState description="Cargando límites y movimientos..." title="Presupuestos" />;
  if ((workspaceError || snapshotQuery.error) && !editorValue && analyticsId === null) return <DataState description={getQueryErrorMessage(workspaceError ?? snapshotQuery.error)} title="No se pudieron cargar los presupuestos" tone="error" />;
  if (!activeWorkspace || !snapshot) return <DataState description="Activa un espacio para crear presupuestos." title="Sin espacio activo" />;
  if (scopeMovementsQuery.isLoading && scopedBudgets.length && !editorValue && analyticsId === null) return <DataState description="Calculando el gasto de todos los períodos..." title="Presupuestos" />;
  if (scopeMovementsQuery.error && !editorValue && analyticsId === null) return <DataState action={<Button onClick={() => void snapshotQuery.refetch()}>Reintentar consumo</Button>} description={getQueryErrorMessage(scopeMovementsQuery.error, "No se pudieron calcular los límites con todos los movimientos.")} title="No se pudo calcular el consumo" tone="error" />;
  if (spendTypesQuery.error && !editorValue && analyticsId === null) return <DataState description={getQueryErrorMessage(spendTypesQuery.error)} title="No se pudieron leer los tipos de gasto" tone="error" />;
  if ((!snapshotQuery.isSuccess || (scopedBudgets.length > 0 && !scopeMovementsQuery.isSuccess)) && !editorValue && analyticsId === null) return <DataState description="Esperando una lectura válida del espacio y sus movimientos." title="Comprobando presupuestos" />;

  return <div className="pb-10">
    <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-6">
      <div><h1 className="font-display text-[1.75rem] font-semibold tracking-[-0.03em] text-ink">Presupuestos</h1><p className="mt-1 text-sm text-storm">{budgets.length} períodos registrados · {active.length} vigentes en {monthLabel}</p></div>
      <div className="flex items-center gap-2"><Button className="whitespace-nowrap" disabled={!canWrite} onClick={openCreate}><Plus className="h-4 w-4" /><span className="sm:hidden">Nuevo</span><span className="hidden sm:inline">Nuevo presupuesto</span></Button><div className="relative"><button aria-label="Más acciones" aria-expanded={pageMenuOpen} className="grid h-11 w-11 place-items-center rounded-[10px] border border-white/10 text-storm hover:text-ink" onClick={() => setPageMenuOpen(!pageMenuOpen)} type="button"><MoreHorizontal className="h-4 w-4" /></button>{pageMenuOpen ? <div className="absolute right-0 top-12 z-20 w-52 rounded-xl border border-white/10 bg-[#211f1c] p-1"><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-storm hover:bg-white/[0.06] hover:text-ink" disabled={!consumptionReady} onClick={() => { exportConsumption(visibleBudgets.map(budget => budget.id)); setPageMenuOpen(false); }} type="button"><Download className="h-4 w-4" />Exportar CSV</button><button className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-storm hover:bg-white/[0.06] hover:text-ink" onClick={() => { setSelectionMode(true); setPageMenuOpen(false); }} type="button">Seleccionar varios</button></div> : null}</div></div>
    </header>

    {!writeScope.writable ? <p className="mt-4 text-sm text-storm">Solo lectura mientras se comprueban los datos o si no tienes permisos de edición.</p> : null}
    {uncertain ? <p className="mt-4 text-sm text-storm" role="alert">Hay una operación sin confirmar. Comprueba el resultado en Presupuestos antes de iniciar otra.</p> : null}
    {pageError ? <p className="mt-4 rounded-xl border border-white/10 bg-[#211b19] p-3 text-sm text-[#e6b7aa]" role="alert">{pageError} <button className="ml-2 underline" onClick={() => setPageError(null)} type="button">Cerrar</button></p> : null}

    {budgets.length >= 8 ? <label className="mt-6 flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-[#1a1917] px-4 text-storm"><Search className="h-4 w-4" /><input className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-storm/70" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar presupuestos..." value={search} /></label> : null}

    {active.length > 0 && consumptionReady ? <section className="mt-6 flex flex-wrap items-baseline justify-between gap-3 border-y border-white/[0.08] py-4" aria-label="Resumen de presupuestos vigentes"><p className="text-sm text-storm">{hasMissingRate ? "No se suman monedas sin tipo de cambio. Revisa cada presupuesto abajo." : <><strong className="font-display text-2xl font-semibold text-ink">{formatCurrency(totalSpent, baseCurrency)}</strong> de {formatCurrency(totalLimit, baseCurrency)}</>}</p><p className="text-xs text-storm">{over.length ? `Te pasaste en ${over.map((budget) => budget.name).join(", ")}.` : "Ninguno ha superado su límite."}</p></section> : null}

    {selectionMode ? <div className="mt-5 flex flex-wrap items-center gap-3 border-y border-white/10 py-3 text-sm"><button className="text-storm hover:text-ink" onClick={() => { setSelectionMode(false); setSelected(new Set()); }} type="button">Cancelar</button><span className="text-ink">{selected.size} seleccionados</span><button className="text-storm hover:text-ink" onClick={() => setSelected(new Set(visibleBudgets.map((budget) => budget.id)))} type="button">Seleccionar todos</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!consumptionReady || !selected.size} onClick={() => exportConsumption(visibleBudgets.filter((budget) => selected.has(budget.id)).map(budget => budget.id))} type="button">CSV</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!canWrite || !selected.size} onClick={() => { void duplicateSelected(visibleBudgets.filter(budget => selected.has(budget.id))); setSelectionMode(false); setSelected(new Set()); }} type="button">Duplicar</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!canWrite || !selected.size} onClick={() => setBulkDelete(true)} type="button">Eliminar</button></div> : null}

    {active.length ? <section className="mt-6"><h2 className="mb-2 font-public-mono text-xs uppercase tracking-[0.16em] text-storm">Este período</h2>{active.map(budgetRow)}</section> : null}
    {upcoming.length ? <section className="mt-8"><h2 className="mb-2 font-public-mono text-xs uppercase tracking-[0.16em] text-storm">Próximos períodos</h2>{upcoming.map(budgetRow)}</section> : null}
    {inactive.length ? <section className="mt-8"><h2 className="mb-2 font-public-mono text-xs uppercase tracking-[0.16em] text-storm">Inactivos</h2>{inactive.map(budgetRow)}</section> : null}
    {closed.length ? <section className="mt-8"><button aria-expanded={showClosed || selectionMode} className="flex w-full items-center justify-between border-b border-white/10 py-3 text-left font-public-mono text-xs uppercase tracking-[0.16em] text-storm hover:text-ink" onClick={() => setShowClosed(!showClosed)} type="button"><span>Períodos cerrados · {closed.length} {closed.length === 1 ? "regla" : "reglas"}</span>{showClosed || selectionMode ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>{selectionMode ? closed.flatMap((rule) => rule.closed).map(budgetRow) : showClosed ? closed.map((rule) => <button className="flex min-h-[60px] w-full items-center justify-between border-b border-white/[0.08] py-3 text-left hover:bg-white/[0.02]" key={rule.key} onClick={() => setAnalyticsId(rule.closed[0].id)} type="button"><span><span className="block text-sm font-semibold text-ink">{rule.closed[0].name}</span><span className="mt-1 block text-xs text-storm">{consumptionReady ? ruleSummary(rule.closed) : "Consumo por comprobar"}</span></span><ChevronRight className="h-4 w-4 text-storm" /></button>) : null}</section> : null}
    {!visibleBudgets.length ? <div className="mt-8"><DataState action={<Button disabled={!search && !canWrite} onClick={search ? () => setSearch("") : openCreate}>{search ? "Limpiar búsqueda" : "Crear presupuesto"}</Button>} description={search ? "Prueba con otro nombre, categoría o cuenta." : "Pon un límite a una categoría, un tipo de gasto, una cuenta o a todo tu gasto."} title={search ? "No hay coincidencias" : "Aún no tienes presupuestos"} /></div> : null}

    {editorValue ? <BudgetEditorDialog accounts={scopedAccounts.filter((account) => !account.isArchived).map((account) => ({ id: account.id, name: account.name }))} categories={snapshot.catalogs.categories} currencies={budgetEditorCurrencies(snapshot)} error={editorError} isCreate={!editing} isSaving={busy} saveBlocked={!canWrite} onChange={(value) => { if (!canWrite) return; setEditorValue(value); setEditorDirty(true); setEditorError(null); }} onClose={requestCloseEditor} onSubmit={(event) => void submitEditor(event)} spendTypes={spendTypesQuery.data ?? []} value={editorValue} /> : null}
    {unsavedOpen ? <UnsavedChangesDialog onDiscard={closeEditor} onKeepEditing={() => setUnsavedOpen(false)} /> : null}
    {analyticsId !== null ? (() => { const budget = budgets.find((item) => item.id === analyticsId); return budget ? <BudgetDetailDialog key={budget.id} sourceReady={consumptionReady} canWrite={canWrite} isCurrent={responseScope.isCurrent} allBudgets={budgets} budget={budget} metrics={metricMap.get(budget.id) ?? null} onClose={() => setAnalyticsId(null)} onEdit={() => { setAnalyticsId(null); openEdit(budget); }} onQuickSave={async (limitAmount, alertPercent) => { currentBudget(budget.id, budget); await runWrite(() => adjustMutation.mutateAsync({ budgetId: budget.id, limitAmount, alertPercent }), budget.id); }} /> : null; })() : null}
    {deleteTarget && canWrite ? <DeleteConfirmDialog badge="Eliminar presupuesto" description="Se elimina este período, no sus movimientos. Puedes deshacer la acción durante unos segundos." isDeleting={deleteMutation.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteWithUndo([deleteTarget])}><p className="text-lg font-semibold text-ink">{deleteTarget.name}</p></DeleteConfirmDialog> : null}
    {bulkDelete && canWrite ? <DeleteConfirmDialog badge="Eliminar presupuestos" description={`Se eliminarán ${selected.size} períodos. Tus movimientos no se borrarán.`} isDeleting={false} onCancel={() => setBulkDelete(false)} onConfirm={() => { deleteWithUndo(visibleBudgets.filter((budget) => selected.has(budget.id))); setBulkDelete(false); setSelectionMode(false); setSelected(new Set()); }}><p className="text-lg font-semibold text-ink">{selected.size} seleccionados</p></DeleteConfirmDialog> : null}
  </div>;
}
