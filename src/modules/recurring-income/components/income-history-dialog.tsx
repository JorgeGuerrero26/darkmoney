import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { Modal, ModalHeader } from "../../../components/ui/modal";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import { useRecurringIncomeOccurrencesQuery } from "../../../services/queries/workspace-data";
import type { ExchangeRateSummary, RecurringIncomeSummary } from "../../../types/domain";
import { buildIncomeHistoryAnalytics, incomeArrivalDelay } from "../lib/income-history-analytics";
import { advanceNextExpectedDate, pendingArrivalDates } from "../lib/recurring-income-parity";
import { getFrequencyOption } from "../lib/recurring-income-presenters";

export function IncomeHistoryDialog({ income, workspaceId, userId, baseCurrencyCode, exchangeRates, sourceReady, canWrite, isPending, onClose, onConfirm, onOpenMovement }: {
  income: RecurringIncomeSummary; workspaceId: number; userId?: string; baseCurrencyCode: string; exchangeRates: ExchangeRateSummary[];
  sourceReady: boolean; canWrite: boolean; isPending: boolean; onClose: () => void; onConfirm: (date: string) => void; onOpenMovement: (movementId: number) => void;
}) {
  const [view, setView] = useState<"history" | "analytics">("history"), [expanded, setExpanded] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null), [filter, setFilter] = useState<"all" | "on_time" | "late">("all");
  const query = useRecurringIncomeOccurrencesQuery(workspaceId, income.id, userId);
  const dataMatches = Array.isArray(query.data) && query.data.every(row => row.workspaceId === workspaceId && row.recurringIncomeId === income.id);
  const dataProblem = Boolean(query.error || (query.isSuccess && !query.isFetching && !query.isPlaceholderData && !dataMatches));
  const ready = userId && income.workspaceId === workspaceId && sourceReady && query.isSuccess && !query.error && !query.isFetching && !query.isPlaceholderData && dataMatches;
  const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  const occurrences = ready ? query.data ?? [] : [];
  const analytics = buildIncomeHistoryAnalytics(occurrences, baseCurrencyCode, exchangeRates, today);
  const scheduled = pendingArrivalDates(income, today);
  const incompletePending = scheduled.length === 400 && advanceNextExpectedDate({ ...income, nextExpectedDate: scheduled[399] }) < today;
  const confirmedDates = new Set(analytics.rows.map(row => row.expectedDate));
  const pending = scheduled.filter(date => !confirmedDates.has(date));
  const calendarConflict = confirmedDates.has(income.nextExpectedDate);
  const history = [...occurrences].sort((a, b) => (b.actualDate ?? "").localeCompare(a.actualDate ?? "") || b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  const entries = [...pending.map(date => ({ kind: "pending" as const, date })), ...history.map(row => ({ kind: "recorded" as const, row }))];
  const visibleEntries = expanded ? entries : entries.slice(0, 5);
  const selectedMonth = analytics.months.find(month => month.key === selectedMonthKey) ?? [...analytics.months].reverse().find(month => month.count || month.excludedCount) ?? analytics.months[11];
  const maximumMonth = Math.max(1, ...analytics.months.map(month => month.amount));
  const timeline = analytics.rows.filter(row => filter === "all" || row.status === filter);
  const amountLabel = (amount: number) => formatCurrency(amount, baseCurrencyCode);
  const monthLabel = (month: typeof selectedMonth) => month.excludedCount && !month.count ? "Sin conversión" : amountLabel(month.amount);

  return <Modal className="!max-w-2xl !bg-[#1a1917]" labelledBy="income-history-title" onClose={onClose}>
    <ModalHeader description={getFrequencyOption(income.frequency).label} onClose={onClose} title={income.name} titleId="income-history-title" />
    <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
      <div><p className="text-2xl font-semibold tabular-nums text-ink">{formatCurrency(income.amount, income.currencyCode)}</p><p className="mt-1 text-sm text-storm">Próxima llegada: {formatDate(income.nextExpectedDate)}{income.accountName ? ` · ${income.accountName}` : ""}</p></div>
      {income.grossAmount != null ? <p className="border-t border-white/[0.08] pt-4 text-sm text-storm">Bruto {formatCurrency(income.grossAmount, income.currencyCode)}{income.deductions?.length ? ` · ${income.deductions.map(row => `${row.name} ${formatCurrency(row.amount, income.currencyCode)}`).join(" · ")}` : ""}</p> : null}
      {income.description || income.notes ? <p className="text-sm leading-6 text-storm">{[income.description, income.notes].filter(Boolean).join(" · ")}</p> : null}
      {!ready ? <DataState title={dataProblem ? "Historial por comprobar" : "Comprobando historial"} description={dataProblem ? "No se pudo leer un historial completo y válido. No se muestran totales ni se habilita una llegada con datos anteriores." : "Esperamos una lectura actual del espacio y sus llegadas antes de mostrar resultados."} action={dataProblem ? <Button onClick={() => void query.refetch()} variant="secondary">Reintentar historial</Button> : undefined} /> : <>
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-y border-white/[0.08] py-4 text-sm text-storm"><span>{analytics.rows.length} llegadas confirmadas · {incompletePending ? "al menos " : ""}{pending.length} pendientes</span><span>Recibido en este historial: <strong className="text-ink">{analytics.comparableCount || !analytics.rows.length ? amountLabel(analytics.comparableTotal) : "Sin importes comparables"}</strong></span>{analytics.excludedCount ? <span role="status">{analytics.excludedCount} sin conversión no {analytics.excludedCount === 1 ? "suma" : "suman"}. {analytics.currencies.map(item => formatCurrency(item.amount, item.currencyCode)).join(" · ")} en moneda original.</span> : null}</div>
        {calendarConflict ? <p className="text-sm text-storm" role="alert">La fecha actual ya tiene una llegada anotada, pero el calendario no avanzó. Comprueba el ingreso y Movimientos; no registres otra llegada para corregirlo.</p> : null}
        {incompletePending ? <p className="text-sm text-storm">Se muestran las primeras 400 fechas pendientes del calendario; hay más fechas posteriores sin confirmar.</p> : null}
        <div className="flex gap-5 border-b border-white/[0.08] text-sm">{(["history", "analytics"] as const).map(value => <button aria-current={view === value ? "page" : undefined} className={`pb-3 ${view === value ? "border-b border-ink text-ink" : "text-storm"}`} key={value} onClick={() => setView(value)} type="button">{value === "history" ? "Llegadas" : "Análisis"}</button>)}</div>
        {view === "history" ? <div>
          {visibleEntries.map(entry => entry.kind === "pending" ? <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] py-3" key={`pending-${entry.date}`}><div><p className="text-sm font-medium text-ink">{formatDate(entry.date)}</p><p className="text-xs text-storm">{entry.date === income.nextExpectedDate ? "Sin confirmar · la más antigua" : "Sin confirmar · después de la llegada anterior"}</p></div>{canWrite && !calendarConflict && entry.date === income.nextExpectedDate ? <Button disabled={isPending} onClick={() => onConfirm(entry.date)} variant="secondary">Anotar llegada</Button> : null}</div> : <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] py-4" key={`recorded-${entry.row.id}`}><div className="min-w-0"><p className="text-sm font-medium text-ink">{formatDate(entry.row.actualDate ?? entry.row.expectedDate)}</p><p className="mt-1 text-xs text-storm">{entry.row.status === "missed" ? "No llegó" : incomeArrivalDelay(entry.row.expectedDate, entry.row.actualDate)} · Esperado el {formatDate(entry.row.expectedDate)}</p>{entry.row.notes ? <p className="mt-1 text-xs text-storm">{entry.row.notes}</p> : null}{entry.row.movementId ? <button aria-label={`Ver movimiento de llegada ${entry.row.id}`} className="mt-1 text-xs text-ink underline underline-offset-4" onClick={() => onOpenMovement(entry.row.movementId!)} type="button">Ver movimiento</button> : null}</div><p className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatCurrency(entry.row.amount, entry.row.currencyCode)}</p></div>)}
          {!entries.length ? <p className="py-6 text-sm text-storm">Aún no hay llegadas para mostrar.</p> : null}
          {entries.length > 5 ? <button className="mt-3 text-sm text-ink underline underline-offset-4" onClick={() => setExpanded(value => !value)} type="button">{expanded ? "Mostrar menos" : `Ver los ${entries.length - 5} restantes`}</button> : null}
        </div> : <div className="space-y-5">
          <p className="text-sm text-storm">Últimos 12 meses en {baseCurrencyCode}. Solo llegadas confirmadas; se usan los tipos de cambio actuales del espacio.</p>
          <div className="flex h-40 items-end gap-2 border-b border-white/[0.08] pb-2">{analytics.months.map(month => <button aria-label={`${month.label}: ${monthLabel(month)}`} aria-pressed={selectedMonth.key === month.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white" key={month.key} onClick={() => setSelectedMonthKey(month.key)} type="button"><span className={`w-full max-w-8 rounded-t ${selectedMonth.key === month.key ? "bg-[#f9f7f3]" : "bg-[#b2aca1]"}`} style={{ height: month.amount ? Math.max(4, month.amount / maximumMonth * 110) : 0 }} /><span className="truncate text-[10px] text-storm">{month.label}</span></button>)}</div>
          <p className="text-sm text-storm">{selectedMonth.label} · <strong className="text-ink">{monthLabel(selectedMonth)}</strong> en {selectedMonth.count} llegadas comparables{selectedMonth.excludedCount ? ` · ${selectedMonth.excludedCount} sin conversión no suman` : ""}.</p>
          <div className="grid gap-3 border-y border-white/[0.08] py-4 text-sm text-storm sm:grid-cols-2"><p>Promedio comparable: <strong className="text-ink">{analytics.comparableCount ? amountLabel(analytics.averageBase) : "Sin datos comparables"}</strong></p><p>Llegada mayor comparable: <strong className="text-ink">{analytics.comparableCount ? amountLabel(analytics.maximumBase) : "Sin datos comparables"}</strong></p><p>A tiempo: <strong className="text-ink">{Math.round(analytics.punctualityPct)} %</strong></p><p>Demora media: <strong className="text-ink">{analytics.averageLateDays.toFixed(1)} días</strong></p></div>
          <div className="flex gap-2 text-xs">{(["all", "on_time", "late"] as const).map(value => <button aria-pressed={filter === value} className={`rounded-lg border px-3 py-1.5 ${filter === value ? "border-white/50 text-ink" : "border-white/[0.08] text-storm"}`} key={value} onClick={() => setFilter(value)} type="button">{value === "all" ? "Todas" : value === "on_time" ? "A tiempo" : "Con demora"}</button>)}</div>
          <div className="divide-y divide-white/[0.08]">{timeline.slice(0, 20).map(row => <div className="flex justify-between gap-4 py-3 text-sm" key={row.id}><span className="text-storm">{formatDate(row.actualDate)} · {incomeArrivalDelay(row.expectedDate, row.actualDate)}</span><span className="tabular-nums text-ink">{formatCurrency(row.amount, row.currencyCode)}</span></div>)}{!timeline.length ? <p className="py-3 text-sm text-storm">No hay llegadas en este grupo.</p> : null}</div>
          {timeline.length > 20 ? <button className="text-sm text-ink underline underline-offset-4" onClick={() => { setView("history"); setExpanded(true); }} type="button">Ver todo el historial ({history.length})</button> : null}
        </div>}
      </>}
    </div>
  </Modal>;
}
