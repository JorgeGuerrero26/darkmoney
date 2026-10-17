import { buildRecurringIncomeEditorInput } from "../../shared/recurring-editor-input";
import { RecurringIncomeEditorDialog as EditorDialog, Field, Input, Textarea, getCurrencyLabel, labelClassName, type RecurringIncomeFormState, type FeedbackState } from "../components/recurring-income-editor-dialog";
import { useResourceLink } from "../../../hooks/use-resource-link";
import {
  Download,
  MoreVertical,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import type {
  FormEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { Pagination } from "../../../components/ui/pagination";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { Modal, ModalHeader } from "../../../components/ui/modal";
import { PageHeader } from "../../../components/ui/page-header";
import { ResourceEditorDestination, ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { BulkActionBar, useSelection } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type {
  AccountSummary,
  RecurringIncomeFrequency,
  RecurringIncomeStatus,
  RecurringIncomeSummary,
} from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  getQueryErrorMessage,
  type ConfirmArrivalInput,
  useConfirmRecurringIncomeArrivalMutation,
  useCreateRecurringIncomeMutation,
  useDeleteRecurringIncomeMutation,
  useSetRecurringIncomeFlagsMutation,
  useUpdateRecurringIncomeMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import { RecurringIncomeList } from "../components/recurring-income-list";
import { useRecurringIncomeFilters } from "../hooks/use-recurring-income-filters";
import {
  frequencyOptions,
  getFrequencyOption,
  getStatusOption,
  statusOptions,
} from "../lib/recurring-income-presenters";
import { advanceNextExpectedDate, summarizeRecurringIncomeMonthly, pendingArrivalDates } from "../lib/recurring-income-parity";
import { canWriteWorkspaceCatalog, useCatalogWriteScope } from "../../shared/use-catalog-write-scope";
import { useFinancialWriteGuard } from "../../shared/use-financial-write-guard";
import { validateArrivalInput } from "../lib/arrival-input";
import { confirmIncomeWrite, isIncomeWriteRejected } from "../lib/income-write-result";
import { IncomeHistoryDialog } from "../components/income-history-dialog";

const RECURRING_INCOME_PAGE_SIZE = 50;

const statusFilterPickerOptions: PickerOption[] = [
  { value: "all", label: "Todos los estados", description: "No filtra por estado.", leadingLabel: "TO", searchText: "todos estados" },
  ...statusOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.leadingLabel,
    searchText: `${option.value} ${option.label}`,
  })),
];

const frequencyFilterPickerOptions: PickerOption[] = [
  { value: "all", label: "Todas las frecuencias", description: "No filtra por frecuencia.", leadingLabel: "TO", searchText: "todas frecuencias" },
  ...frequencyOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.leadingLabel,
    searchText: `${option.value} ${option.label}`,
  })),
];

type EditorMode = "create" | "edit";

function toDateInputValue(value: string) {
  return value ? value.slice(0, 10) : "";
}

function todayDateInputValue() {
  return new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
}

function parseOptionalInteger(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }
  const parsedValue = Number.parseInt(normalizedValue, 10);
  return Number.isInteger(parsedValue) ? parsedValue : Number.NaN;
}

function parseOptionalNumber(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }
  const parsedValue = Number(normalizedValue.replace(",", "."));
  return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
}

function createDefaultFormState(baseCurrencyCode: string): RecurringIncomeFormState {
  return {
    name: "",
    payerPartyId: "",
    accountId: "",
    categoryId: "",
    currencyCode: baseCurrencyCode,
    amount: "",
    grossAmount: "",
    deductions: [],
    frequency: "monthly",
    intervalCount: "1",
    dayOfMonth: "",
    dayOfWeek: "",
    startDate: "",
    nextExpectedDate: "",
    endDate: "",
    status: "active",
    remindDaysBefore: "3",
    description: "",
    notes: "",
  };
}

function buildFormStateFromRecurringIncome(income: RecurringIncomeSummary): RecurringIncomeFormState {
  return {
    name: income.name,
    payerPartyId: income.payerPartyId ? String(income.payerPartyId) : "",
    accountId: income.accountId ? String(income.accountId) : "",
    categoryId: income.categoryId ? String(income.categoryId) : "",
    currencyCode: income.currencyCode,
    amount: String(income.amount),
    grossAmount: income.grossAmount == null ? "" : String(income.grossAmount),
    deductions: (income.deductions ?? []).map((row, index) => ({ key: String(index), name: row.name, amount: String(row.amount) })),
    frequency: income.frequency,
    intervalCount: String(income.intervalCount),
    dayOfMonth:
      income.dayOfMonth === null || income.dayOfMonth === undefined ? "" : String(income.dayOfMonth),
    dayOfWeek:
      income.dayOfWeek === null || income.dayOfWeek === undefined ? "" : String(income.dayOfWeek),
    startDate: toDateInputValue(income.startDate),
    nextExpectedDate: toDateInputValue(income.nextExpectedDate),
    endDate: income.endDate ? toDateInputValue(income.endDate) : "",
    status: income.status,
    remindDaysBefore: String(income.remindDaysBefore),
    description: income.description ?? "",
    notes: income.notes ?? "",
  };
}

function ConfirmArrivalDialog({
  income,
  accounts,
  initialDate,
  onClose,
  onConfirm,
  isSaving,
}: {
  income: RecurringIncomeSummary;
  accounts: AccountSummary[];
  initialDate?: string;
  onClose: () => void;
  onConfirm: (input: Omit<ConfirmArrivalInput, "workspaceId" | "userId">) => Promise<void>;
  isSaving: boolean;
}) {
  const [panel, setPanel] = useState<"main" | "details">("main");
  const [actualDate, setActualDate] = useState(initialDate ?? todayDateInputValue());
  const [actualAmount, setActualAmount] = useState(String(income.amount));
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState(income.accountId ? String(income.accountId) : "");
  const [baseChangeMode, setBaseChangeMode] = useState<"once" | "forever">("once");
  const [error, setError] = useState<string | null>(null);
  const write = useFinancialWriteGuard(`${income.workspaceId}:${income.id}:arrival`);
  const initialIncome = useRef(income), staleLatch = useRef(false);
  if (["id", "workspaceId", "nextExpectedDate", "currencyCode", "amount", "frequency", "intervalCount", "dayOfMonth", "dayOfWeek", "status", "accountId", "categoryId", "payerPartyId", "name", "description"].some(key => initialIncome.current[key as keyof RecurringIncomeSummary] !== income[key as keyof RecurringIncomeSummary])) staleLatch.current = true;
  const stale = staleLatch.current, busy = isSaving || write.pending;
  const accountOptions = accounts.filter(item => item.workspaceId === income.workspaceId && !item.isArchived && item.currencyCode === income.currencyCode).map<PickerOption>((item) => ({
    value: String(item.id), label: item.name, description: item.currencyCode, leadingLabel: item.currencyCode,
  }));
  const nextExpectedDate = advanceNextExpectedDate(income);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || write.blocked || stale) return;
    if (!actualDate) {
      setPanel("main");
      setError("Indica la fecha real de llegada.");
      return;
    }
    const amount = parseOptionalNumber(actualAmount);
    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      setPanel("details");
      setError("Indica un monto recibido mayor que cero.");
      return;
    }
    if (!accountId) {
      setPanel("main");
      setError("Elige la cuenta donde llegó el dinero.");
      return;
    }
    setError(null);
    let attempt: ReturnType<typeof write.begin> = null;
    try {
      const input = validateArrivalInput(income, accounts, {
      recurringIncomeId: income.id,
      expectedDate: income.nextExpectedDate,
      actualDate,
      amount,
      currencyCode: income.currencyCode,
      accountId: Number(accountId),
      currentAccountId: income.accountId ?? null,
      categoryId: income.categoryId ?? null,
      payerPartyId: income.payerPartyId ?? null,
      recurringIncomeName: income.name,
      description: income.description ?? null,
      currentBaseAmount: income.amount,
      newBaseAmount: baseChangeMode === "forever" && Math.abs(amount - income.amount) > 0.000001 ? amount : null,
      notes,
      nextExpectedDate,
      });
      attempt = write.begin(); if (!attempt) return;
      await onConfirm(input);
      write.confirm(attempt);
    } catch (failure) {
      if (attempt && !write.isCurrent(attempt)) return;
      if (attempt) write.fail(attempt);
      setError(`${getQueryErrorMessage(failure)}${attempt ? " No repitas la llegada: cierra y comprueba el historial, Movimientos y la próxima fecha; alguna fase podría haberse guardado." : ""}`);
    }
  }

  return (
    <Modal className={resourceEditorSurfaceClassName} disableOutsideClose={busy} labelledBy="income-arrival-title" onClose={() => { if (!busy) onClose(); }}>
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={handleSubmit}>
        <ResourceEditorHeader disabled={busy} onBack={panel === "details" ? () => setPanel("main") : undefined} onClose={onClose} title={panel === "main" ? "Confirmar llegada" : "Llegó distinto"} titleId="income-arrival-title" />
        <fieldset className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7" disabled={busy || write.blocked || stale}>
          {error ? <FormFeedbackBanner className="mb-5" description={error} title="Revisa la fecha" tone="error" /> : null}
          {stale ? <p className="mb-4 text-sm text-storm" role="alert">El ingreso o la próxima llegada cambiaron. Cierra y revisa antes de confirmar.</p> : null}
          {panel === "main" ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-ink">{income.name}</p>
                <p className="mt-1 text-sm text-storm">Esperado el {formatDate(income.nextExpectedDate)} · {formatCurrency(income.amount, income.currencyCode)}</p>
              </div>
              <Field label="Fecha real de llegada"><DatePickerField appearance="compact" onChange={setActualDate} value={actualDate} /></Field>
              <Field label="Cuenta donde llegó"><SearchablePicker appearance="compact" emptyMessage="No hay cuentas disponibles." onChange={setAccountId} options={accountOptions} placeholderDescription="El ingreso afectará el saldo de esta cuenta." placeholderLabel="Elige una cuenta" queryPlaceholder="Buscar cuenta..." value={accountId} /></Field>
              <p className="border-t border-white/[0.08] pt-4 text-sm text-storm">La siguiente llegada quedará para el <span className="text-ink">{formatDate(nextExpectedDate)}</span>.</p>
              <ResourceEditorDestination label="Llegó distinto" onClick={() => setPanel("details")} summary="Monto y notas" />
            </div>
          ) : (
            <div className="space-y-5">
              <Field label={"Monto recibido (" + getCurrencyLabel(income.currencyCode).symbol + ")"}><Input inputMode="decimal" onChange={(event) => { setError(null); setActualAmount(event.target.value); }} placeholder="0.00" type="number" value={actualAmount} /></Field>
              {parseOptionalNumber(actualAmount) !== income.amount ? <fieldset className="space-y-2"><legend className={labelClassName}>¿Qué cambia?</legend><label className="flex items-center gap-3 text-sm text-ink"><input checked={baseChangeMode === "once"} className="accent-[#e5e0d6]" name="baseChangeMode" onChange={() => setBaseChangeMode("once")} type="radio" />Solo esta llegada</label><label className="flex items-center gap-3 text-sm text-ink"><input checked={baseChangeMode === "forever"} className="accent-[#e5e0d6]" name="baseChangeMode" onChange={() => setBaseChangeMode("forever")} type="radio" />Desde ahora, esperar este monto</label></fieldset> : null}
              <Field label="Notas"><Textarea onChange={(event) => setNotes(event.target.value)} placeholder="Contexto de esta llegada" value={notes} /></Field>
            </div>
          )}
        </fieldset>
        <footer className="shrink-0 border-t border-white/[0.08] px-5 py-4 sm:px-7"><Button className="w-full" disabled={busy || write.blocked || stale} type="submit">{write.status === "uncertain" ? "Comprueba la llegada en el historial" : stale ? "Revisa la próxima llegada" : busy ? "Confirmando..." : "Confirmar llegada"}</Button></footer>
      </form>
    </Modal>
  );
}
function RecurringIncomeLoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="shimmer-surface h-14 rounded-xl" />
      <div className="shimmer-surface h-12 rounded-xl" />
      {Array.from({ length: 5 }).map((_, index) => <div className="shimmer-surface h-[76px] rounded-lg" key={index} />)}
    </div>
  );
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCSV(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function downloadRecurringIncomeCSV(items: RecurringIncomeSummary[], filename: string) {
  const headers = ["Nombre", "Pagador", "Estado", "Monto", "Moneda", "Frecuencia", "Categoría", "Cuenta", "Inicio", "Próxima llegada", "Fin", "Descripción", "Notas"];
  const rows = items.map((r) => [
    escapeCSV(r.name),
    escapeCSV(r.payer),
    escapeCSV(getStatusOption(r.status).label),
    escapeCSV(r.amount),
    escapeCSV(r.currencyCode),
    escapeCSV(getFrequencyOption(r.frequency).label),
    escapeCSV(r.categoryName ?? ""),
    escapeCSV(r.accountName ?? ""),
    escapeCSV(r.startDate),
    escapeCSV(r.nextExpectedDate),
    escapeCSV(r.endDate ?? ""),
    escapeCSV(r.description ?? ""),
    escapeCSV(r.notes ?? ""),
  ]);
  downloadCSV([headers.join(","), ...rows.map((r) => r.join(","))].join("\n"), filename);
}

export function RecurringIncomePage() {
  const auth = useAuth(), workspace = useActiveWorkspace();
  return <ScopedRecurringIncomePage key={`${auth.user?.id}:${workspace.activeWorkspace?.id}`} auth={auth} workspace={workspace} />;
}

function ScopedRecurringIncomePage({ auth, workspace }: { auth: ReturnType<typeof useAuth>; workspace: ReturnType<typeof useActiveWorkspace> }) {
  const navigate = useNavigate();
  const { profile, user } = auth;
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = workspace;
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = user && !snapshotQuery.isPlaceholderData && snapshotQuery.data?.workspace.id === activeWorkspace?.id ? snapshotQuery.data : undefined;
  const ready = Boolean(snapshot && snapshotQuery.isSuccess && !snapshotQuery.error && !snapshotQuery.isFetching && !workspaceError && !isWorkspacesLoading && !workspace.isFetching && !workspace.isPlaceholderData);
  const access = useCatalogWriteScope(activeWorkspace, user?.id, ready);
  const responseScope = useCatalogWriteScope(activeWorkspace, user?.id, true);
  const permitted = canWriteWorkspaceCatalog(activeWorkspace, user?.id, true);
  const latestAccess = useRef(access); latestAccess.current = access;
  const flight = useRef(false), queued = useRef(new Set<string>()), pendingDeletes = useRef(new Set<number>());
  const [isActionPending, setIsActionPending] = useState(false);
  const createMutation = useCreateRecurringIncomeMutation(activeWorkspace?.id, user?.id);
  const updateMutation = useUpdateRecurringIncomeMutation(activeWorkspace?.id, user?.id);
  const deleteMutation = useDeleteRecurringIncomeMutation(activeWorkspace?.id, user?.id);
  const confirmMutation = useConfirmRecurringIncomeArrivalMutation(activeWorkspace?.id, user?.id);
  const flagsMutation = useSetRecurringIncomeFlagsMutation(activeWorkspace?.id, user?.id);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  useSuccessToast(feedback, {
    clear: () => setFeedback(null),
  });
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  function clearFieldError(field: string) {
    setInvalidFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedIncomeId, setSelectedIncomeId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [confirmIncomeId, setConfirmIncomeId] = useState<number | null>(null);
  const [confirmDate, setConfirmDate] = useState<string | undefined>(undefined);
  const [historyIncomeId, setHistoryIncomeId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const { schedule, cancel } = useUndoQueue();
  const {
    filters: incomeFilters,
    currentPage,
    setCurrentPage,
    updateFilter: updateIncomeFilter,
    updateFilters: updateIncomeFilters,
    clearFilters: clearIncomeFilters,
  } = useRecurringIncomeFilters();
  const [formState, setFormState] = useState<RecurringIncomeFormState>(
    createDefaultFormState(activeWorkspace?.baseCurrencyCode ?? "USD"),
  );

  const recurringIncome = useMemo(() => (snapshot?.recurringIncome ?? []).filter(item => item.workspaceId === activeWorkspace?.id), [snapshot?.recurringIncome, activeWorkspace?.id]);
  const rows = useRef(recurringIncome); rows.current = recurringIncome;
  const categories = snapshot?.catalogs.categories ?? [];
  const counterparties = snapshot?.catalogs.counterparties ?? [];
  const accounts = (snapshot?.accounts ?? []).filter(item => item.workspaceId === activeWorkspace?.id);
  const movements = (snapshot?.movements ?? []).filter(item => item.workspaceId === activeWorkspace?.id);
  const baseCurrencyCode = snapshot?.workspace.baseCurrencyCode ?? activeWorkspace?.baseCurrencyCode ?? "USD";
  const selectedIncome =
    selectedIncomeId === null
      ? null
      : recurringIncome.find((r) => r.id === selectedIncomeId) ?? null;
  const deleteTarget =
    deleteTargetId === null
      ? null
      : recurringIncome.find((r) => r.id === deleteTargetId) ?? null;
  const confirmIncome =
    confirmIncomeId === null
      ? null
      : recurringIncome.find((r) => r.id === confirmIncomeId) ?? null;
  const historyIncome =
    historyIncomeId === null
      ? null
      : recurringIncome.find((r) => r.id === historyIncomeId) ?? null;
  const editorWrite = useFinancialWriteGuard(`${user?.id}:${activeWorkspace?.id}:income-editor:${isEditorOpen}:${editorMode}:${selectedIncomeId}`);
  const canAct = access.writable && !isActionPending && !createMutation.isPending && !updateMutation.isPending && !deleteMutation.isPending && !flagsMutation.isPending && !confirmMutation.isPending;
  useEffect(() => () => { queued.current.forEach(id => cancel(id)); queued.current.clear(); }, [cancel]);
  useEffect(() => { if (!access.writable) { queued.current.forEach(id => cancel(id)); queued.current.clear(); } }, [access.writable, cancel]);
  useEffect(() => { if (!permitted) { setIsEditorOpen(false); setShowUnsavedDialog(false); setDeleteTargetId(null); setConfirmIncomeId(null); setShowBulkDeleteConfirm(false); } }, [permitted]);
  function currentIncome(id: number) {
    access.assertCurrent();
    const item = rows.current.find(item => item.id === id);
    if (!item || pendingDeletes.current.has(id)) throw new Error("El ingreso ya no está disponible en este espacio.");
    return item;
  }
  async function runWrite<T>(action: () => Promise<T>) {
    access.assertCurrent();
    if (flight.current) throw new Error("Ya hay una operación de ingresos fijos pendiente.");
    flight.current = true; setIsActionPending(true);
    try { return await action(); } finally { flight.current = false; setIsActionPending(false); }
  }
  function openHistory(id: number) { if (ready && rows.current.some(item => item.id === id)) setHistoryIncomeId(id); }
  function openConfirm(id: number, date?: string) {
    if (!canAct || !access.isCurrent()) return;
    const item = rows.current.find(item => item.id === id);
    if (!item || item.status !== "active" || (date && date !== item.nextExpectedDate)) return;
    setHistoryIncomeId(null); setConfirmDate(date); setConfirmIncomeId(id);
  }
  function openDelete(id: number) { if (canAct && access.isCurrent() && rows.current.some(item => item.id === id)) setDeleteTargetId(id); }
  function exportRows(items: RecurringIncomeSummary[], filename: string) {
    if (!ready) return;
    const ids = new Set(items.map(item => item.id));
    downloadRecurringIncomeCSV(rows.current.filter(item => ids.has(item.id)), filename);
  }

  const hasActiveFilters =
    incomeFilters.name.trim() !== "" ||
    incomeFilters.payer.trim() !== "" ||
    incomeFilters.category.trim() !== "" ||
    incomeFilters.account.trim() !== "" ||
    incomeFilters.amount.trim() !== "" ||
    incomeFilters.nextExpectedDateFrom !== "" ||
    incomeFilters.nextExpectedDateTo !== "" ||
    incomeFilters.frequency !== "all" ||
    incomeFilters.status !== "all" ||
    incomeFilters.selectedStatuses.length > 0 ||
    incomeFilters.pinnedOnly ||
    incomeFilters.upcomingOnly;
  const filteredIncome = useMemo(() => {
    let result = recurringIncome.filter((r) => !hiddenIds.has(r.id));
    const normalizedName = incomeFilters.name.trim().toLowerCase();
    const normalizedPayer = incomeFilters.payer.trim().toLowerCase();
    const normalizedCategory = incomeFilters.category.trim().toLowerCase();
    const normalizedAccount = incomeFilters.account.trim().toLowerCase();
    const normalizedAmount = incomeFilters.amount.trim();
    if (normalizedName) {
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(normalizedName) ||
          (r.payer ?? "").toLowerCase().includes(normalizedName) ||
          (r.categoryName ?? "").toLowerCase().includes(normalizedName) ||
          (r.accountName ?? "").toLowerCase().includes(normalizedName) ||
          (r.description ?? "").toLowerCase().includes(normalizedName) ||
          (r.notes ?? "").toLowerCase().includes(normalizedName),
      );
    }
    if (normalizedPayer) {
      result = result.filter((r) => (r.payer ?? "").toLowerCase().includes(normalizedPayer));
    }
    if (normalizedCategory) {
      result = result.filter((r) => (r.categoryName ?? "").toLowerCase().includes(normalizedCategory));
    }
    if (normalizedAccount) {
      result = result.filter((r) => (r.accountName ?? "").toLowerCase().includes(normalizedAccount));
    }
    if (incomeFilters.frequency !== "all") {
      result = result.filter((r) => r.frequency === incomeFilters.frequency);
    }
    if (incomeFilters.selectedStatuses.length > 0) {
      result = result.filter((r) => incomeFilters.selectedStatuses.includes(r.status));
    } else if (incomeFilters.status !== "all") {
      result = result.filter((r) => r.status === incomeFilters.status);
    }
    if (incomeFilters.pinnedOnly) result = result.filter((r) => r.isPinned);
    if (incomeFilters.upcomingOnly) {
      const today = todayDateInputValue();
      const limit = new Date(`${today}T12:00:00Z`);
      limit.setUTCDate(limit.getUTCDate() + 30);
      const through = limit.toISOString().slice(0, 10);
      result = result.filter((r) => r.nextExpectedDate >= today && r.nextExpectedDate <= through);
    }
    if (normalizedAmount) {
      result = result.filter((r) => String(r.amount).includes(normalizedAmount));
    }
    if (incomeFilters.nextExpectedDateFrom) {
      result = result.filter((r) => r.nextExpectedDate >= incomeFilters.nextExpectedDateFrom);
    }
    if (incomeFilters.nextExpectedDateTo) {
      result = result.filter((r) => r.nextExpectedDate <= incomeFilters.nextExpectedDateTo);
    }
    const today = todayDateInputValue();
    const rank = (item: RecurringIncomeSummary) => item.status === "active" ? (item.nextExpectedDate < today ? 0 : 1) : item.status === "paused" ? 2 : 3;
    return [...result].sort((a, b) => rank(a) - rank(b) || Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) || a.nextExpectedDate.localeCompare(b.nextExpectedDate));
  }, [hiddenIds, incomeFilters, recurringIncome]);
  const totalPages = Math.max(1, Math.ceil(filteredIncome.length / RECURRING_INCOME_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedIncome = useMemo(
    () => filteredIncome.slice((safePage - 1) * RECURRING_INCOME_PAGE_SIZE, safePage * RECURRING_INCOME_PAGE_SIZE),
    [filteredIncome, safePage],
  );
  const { selectedIds, toggle: toggleSelect, selectAll, clearAll, selectedCount, allSelected, someSelected, selectedItems } = useSelection(filteredIncome);

  useEffect(() => {
    if (!isEditorOpen) {
      setFormState(createDefaultFormState(baseCurrencyCode));
    }
  }, [baseCurrencyCode, isEditorOpen]);

  function updateFormState<Field extends keyof RecurringIncomeFormState>(
    field: Field,
    value: RecurringIncomeFormState[Field],
  ) {
    if (!canAct || editorWrite.blocked) return;
    setIsDirty(true);
    setFormState((currentValue) => ({ ...currentValue, [field]: value }));
  }

  function closeEditor() {
    if (isSavingEditor) return;
    setIsEditorOpen(false);
    setSelectedIncomeId(null);
    setIsDirty(false);
  }

  function requestCloseEditor() {
    if (isSavingEditor) return;
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      closeEditor();
    }
  }

  function openCreateEditor() {
    if (!canAct || !access.isCurrent()) return;
    setFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("create");
    setSelectedIncomeId(null);
    const activeAccountIds = new Set(accounts.filter((item) => !item.isArchived).map((item) => item.id));
    const counts = new Map<number, number>();
    for (const movement of movements) {
      if (movement.movementType !== "income" || !movement.destinationAccountId || !activeAccountIds.has(movement.destinationAccountId)) continue;
      counts.set(movement.destinationAccountId, (counts.get(movement.destinationAccountId) ?? 0) + 1);
    }
    const topAccountId = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? (activeAccountIds.size === 1 ? [...activeAccountIds][0] : null);
    setFormState({ ...createDefaultFormState(baseCurrencyCode), accountId: topAccountId ? String(topAccountId) : "" });
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  function openEditEditor(income: RecurringIncomeSummary) {
    if (!canAct || !access.isCurrent()) return;
    income = currentIncome(income.id);
    setFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("edit");
    setSelectedIncomeId(income.id);
    setFormState(buildFormStateFromRecurringIncome(income));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  useResourceLink(ready ? recurringIncome : [], openHistory);

  const isSavingEditor = createMutation.isPending || updateMutation.isPending || editorWrite.pending;
  const isDeleting = deleteMutation.isPending;
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkPausing, setIsBulkPausing] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const todayDate = todayDateInputValue();
  const overdueCount = recurringIncome.filter((item) => item.status === "active" && item.nextExpectedDate < todayDate).length;
  const dueSoonCount = recurringIncome.filter((r) => {
    if (r.status !== "active") return false;
    const differenceInDays = (Date.parse(r.nextExpectedDate) - Date.parse(todayDate)) / 86_400_000;
    return differenceInDays >= 0 && differenceInDays <= 30;
  }).length;
  const nextIncome = [...recurringIncome]
    .filter((item) => item.status === "active" && item.nextExpectedDate >= todayDate)
    .sort((left, right) => left.nextExpectedDate.localeCompare(right.nextExpectedDate))[0] ?? null;
  const activeInFilter = filteredIncome.filter((item) => item.status === "active").length;
  const monthlySummary = summarizeRecurringIncomeMonthly(filteredIncome, baseCurrencyCode);
  const missedArrivals = recurringIncome.reduce((sum, item) => sum + pendingArrivalDates(item, todayDate).length, 0);
  const recurringIncomePayers = useMemo(
    () =>
      Array.from(
        new Set(
          recurringIncome
            .map((income) => income.payer?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [recurringIncome],
  );
  const recurringIncomeCategories = useMemo(
    () =>
      Array.from(
        new Set(
          recurringIncome
            .map((income) => income.categoryName?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [recurringIncome],
  );
  const recurringIncomeAccounts = useMemo(
    () =>
      Array.from(
        new Set(
          recurringIncome
            .map((income) => income.accountName?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [recurringIncome],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAct || !access.isCurrent() || editorWrite.blocked || flight.current) return;

    if (!activeWorkspace || !user?.id) {
      setFeedback({
        tone: "error",
        title: "No encontramos el espacio activo",
        description: "Recarga la página e intenta nuevamente.",
      });
      return;
    }

    const name = formState.name.trim();
    const payerPartyId = parseOptionalInteger(formState.payerPartyId);
    const accountId = parseOptionalInteger(formState.accountId);
    const categoryId = parseOptionalInteger(formState.categoryId);
    const amount = parseOptionalNumber(formState.amount);
    const intervalCount = parseOptionalInteger(formState.intervalCount);
    const dayOfMonth = parseOptionalInteger(formState.dayOfMonth);
    const dayOfWeek = parseOptionalInteger(formState.dayOfWeek);
    const remindDaysBefore = parseOptionalInteger(formState.remindDaysBefore);
    const grossAmount = parseOptionalNumber(formState.grossAmount.replace(",", "."));

    const subErrors: string[] = [];
    if (!name) subErrors.push("name");
    if (amount === null || Number.isNaN(amount) || amount <= 0) subErrors.push("amount");
    if (!formState.accountId) subErrors.push("accountId");
    if (!formState.nextExpectedDate) subErrors.push("nextExpectedDate");
    if (subErrors.length > 0) {
      setInvalidFields(new Set(subErrors));
      setFeedback({
        tone: "error",
        title: "Revisa los campos requeridos",
        description: "Completa los campos indicados antes de guardar.",
      });
      return;
    }

    if (intervalCount === null || Number.isNaN(intervalCount) || intervalCount <= 0) {
      setFeedback({
        tone: "error",
        title: "Intervalo inválido",
        description: "Indica un intervalo mayor que cero.",
      });
      return;
    }

    if (formState.grossAmount.trim() && (grossAmount === null || !Number.isFinite(grossAmount) || grossAmount <= 0)) {
      setFeedback({ tone: "error", title: "Bruto inválido", description: "El monto bruto debe ser mayor que cero, o puedes dejarlo vacío." });
      return;
    }

    const effectiveStartDate = formState.startDate || formState.nextExpectedDate;
    if (formState.nextExpectedDate < effectiveStartDate) {
      setFeedback({
        tone: "error",
        title: "La fecha no cuadra",
        description: "La próxima llegada no puede ser anterior al inicio.",
      });
      return;
    }

    if (formState.endDate && formState.endDate < effectiveStartDate) {
      setFeedback({
        tone: "error",
        title: "La fecha final no cuadra",
        description: "La fecha final no puede ser anterior al inicio.",
      });
      return;
    }

    if (dayOfMonth !== null && (Number.isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)) {
      setFeedback({
        tone: "error",
        title: "Día del mes inválido",
        description: "Si lo completas, debe estar entre 1 y 31.",
      });
      return;
    }

    if (dayOfWeek !== null && (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) {
      setFeedback({
        tone: "error",
        title: "Día de la semana inválido",
        description: "Si lo completas, debe estar entre 0 y 6.",
      });
      return;
    }

    if (remindDaysBefore === null || Number.isNaN(remindDaysBefore) || remindDaysBefore < 0) {
      setFeedback({
        tone: "error",
        title: "Recordatorio inválido",
        description: "Indica cero o un número positivo de días.",
      });
      return;
    }

    if (payerPartyId !== null && Number.isNaN(payerPartyId)) {
      setFeedback({
        tone: "error",
        title: "Pagador inválido",
        description: "Vuelve a seleccionar el pagador si deseas asociarlo.",
      });
      return;
    }

    if (accountId === null || Number.isNaN(accountId)) {
      setFeedback({
        tone: "error",
        title: "Cuenta inválida",
        description: "Vuelve a seleccionar la cuenta sugerida.",
      });
      return;
    }

    if (categoryId !== null && Number.isNaN(categoryId)) {
      setFeedback({
        tone: "error",
        title: "Categoría inválida",
        description: "Vuelve a seleccionar la categoría contable.",
      });
      return;
    }

    let attempt: ReturnType<typeof editorWrite.begin> = null;
    try {
      if (!snapshot) throw new Error("Espera la lectura del espacio actual.");
      const payload = buildRecurringIncomeEditorInput(formState, snapshot, editorMode === "create");
      if (editorMode === "edit") currentIncome(selectedIncomeId ?? 0);
      attempt = editorWrite.begin(); if (!attempt) return;
      if (editorMode === "create") {
        const result = await runWrite(() => createMutation.mutateAsync({
          workspaceId: activeWorkspace.id,
          userId: user.id,
          ...payload,
        }));
        if (!responseScope.isCurrent() || !editorWrite.isCurrent(attempt)) return;
        confirmIncomeWrite(result && { id: result.id, workspace_id: result.workspaceId }, { workspaceId: activeWorkspace.id });
        editorWrite.confirm(attempt);
        setFeedback({
          tone: "success",
          title: "Ingreso fijo registrado",
          description: "Ya aparece en la lista de ingresos fijos.",
        });
      } else if (selectedIncome) {
        const result = await runWrite(() => updateMutation.mutateAsync({
          recurringIncomeId: selectedIncome.id,
          workspaceId: activeWorkspace.id,
          userId: user.id,
          ...payload,
        }));
        if (!responseScope.isCurrent() || !editorWrite.isCurrent(attempt)) return;
        confirmIncomeWrite(result && { id: result.id, workspace_id: result.workspaceId }, { workspaceId: activeWorkspace.id, recurringIncomeId: selectedIncome.id });
        editorWrite.confirm(attempt);
        setFeedback({
          tone: "success",
          title: "Cambios guardados",
          description: "El ingreso fijo se actualizó correctamente.",
        });
      }

      setIsEditorOpen(false);
      setSelectedIncomeId(null);
    } catch (error) {
      if (!responseScope.isCurrent() || (attempt && !editorWrite.isCurrent(attempt))) return;
      const rejected = isIncomeWriteRejected(error);
      if (attempt) { if (rejected) editorWrite.reject(attempt); else editorWrite.fail(attempt); }
      setFeedback({
        tone: "error",
        title: attempt && !rejected ? "Resultado por comprobar" : "No pudimos guardar el ingreso fijo",
        description: `${getQueryErrorMessage(error)}${attempt && !rejected ? " No repitas el envío: cierra y comprueba Ingresos fijos; podría haberse guardado." : ""}`,
      });
    }
  }

  function handleDelete() {
    if (!activeWorkspace || !deleteTarget || !canAct || !access.isCurrent() || pendingDeletes.current.has(deleteTarget.id)) return;
    const targetId = deleteTarget.id;
    currentIncome(targetId);
    pendingDeletes.current.add(targetId);
    setDeleteTargetId(null);
    setHiddenIds((prev) => new Set([...prev, targetId]));
    let resolved = false;
    const restore = () => setHiddenIds(prev => { const next = new Set(prev); next.delete(targetId); return next; });
    const queueId = schedule({
      label: "Ingreso fijo pendiente de eliminar",
      onCommit: async () => {
        if (resolved) return;
        resolved = true; queued.current.delete(queueId); pendingDeletes.current.delete(targetId);
        if (!access.isCurrent()) { restore(); return; }
        try {
          currentIncome(targetId);
          await runWrite(() => deleteMutation.mutateAsync({ recurringIncomeId: targetId, workspaceId: activeWorkspace.id, userId: user!.id, isCurrent: responseScope.isCurrent }));
        } catch (error) {
          restore();
          if (responseScope.isCurrent()) setFeedback({ tone: "error", title: "Eliminación por comprobar", description: `${getQueryErrorMessage(error)} Actualiza antes de repetir.` });
        }
      },
      onUndo: () => { if (resolved) return; resolved = true; queued.current.delete(queueId); pendingDeletes.current.delete(targetId); restore(); },
    });
    queued.current.add(queueId);
  }

  async function handleBulkDelete() {
    if (selectedCount === 0 || !canAct || !access.isCurrent()) return;
    setShowBulkDeleteConfirm(true);
  }

  async function confirmBulkDelete() {
    if (!activeWorkspace || !canAct || !access.isCurrent() || flight.current) return;
    setIsBulkDeleting(true);
    try {
      await runWrite(async () => { for (const id of Array.from(selectedIds)) {
        responseScope.assertCurrent(); latestAccess.current.assertCurrent(); currentIncome(id);
        await deleteMutation.mutateAsync({ recurringIncomeId: id, workspaceId: activeWorkspace.id, userId: user!.id, isCurrent: responseScope.isCurrent });
      } });
      if (!responseScope.isCurrent()) return;
      clearAll();
    } catch (err) {
      if (responseScope.isCurrent()) setFeedback({ tone: "error", title: "Eliminación parcial o por comprobar", description: `${getQueryErrorMessage(err)} Las anteriores pueden haberse eliminado; actualiza antes de repetir.` });
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  }

  async function handleConfirmArrival(input: Omit<ConfirmArrivalInput, "workspaceId" | "userId">) {
    if (!activeWorkspace || !user?.id || !canAct || !access.isCurrent()) throw new Error("Los datos o permisos cambiaron antes de confirmar.");
    const current = currentIncome(input.recurringIncomeId);
    validateArrivalInput(current, accounts, input);
    try {
      const result = await runWrite(() => confirmMutation.mutateAsync({
        ...input,
        workspaceId: activeWorkspace.id,
        userId: user.id,
        isCurrent: responseScope.isCurrent,
      }));
      if (!responseScope.isCurrent()) return;
      if (!result || !Number.isSafeInteger(result.movementId) || result.movementId <= 0 || !Number.isSafeInteger(result.occurrenceId) || result.occurrenceId <= 0 || result.nextExpectedDate !== input.nextExpectedDate || result.updatedBaseAmount !== (input.newBaseAmount !== input.currentBaseAmount ? input.newBaseAmount : null)) throw new Error("El servidor no confirmó la llegada y su calendario. Comprueba el resultado antes de repetir.");
      setConfirmIncomeId(null);
      setFeedback({
        tone: "success",
        title: "Llegada confirmada",
        description: `La próxima llegada se actualizó automáticamente a ${formatDate(input.nextExpectedDate)}.`,
      });
    } catch (err) {
      if (responseScope.isCurrent()) setFeedback({
        tone: "error",
        title: "Llegada por comprobar",
        description: `${getQueryErrorMessage(err)} No repitas la llegada sin comprobar el historial y Movimientos.`,
      });
      throw err;
    }
  }

  async function handleBulkPause() {
    if (!canAct || !access.isCurrent() || flight.current) return;
    const active = selectedItems.filter((item) => item.status === "active");
    if (!active.length) return;
    setIsBulkPausing(true);
    try {
      await runWrite(async () => { for (const item of active) {
        responseScope.assertCurrent(); latestAccess.current.assertCurrent();
        const current = currentIncome(item.id); if (current.status !== "active") continue;
        await flagsMutation.mutateAsync({ recurringIncomeId: item.id, workspaceId: activeWorkspace!.id, userId: user!.id, expectedStatus: current.status, expectedIsPinned: Boolean(current.isPinned), patch: { status: "paused" } });
      } });
      if (!responseScope.isCurrent()) return;
      clearAll();
      setFeedback({ tone: "success", title: "Ingresos pausados", description: `${active.length} ${active.length === 1 ? "ingreso quedó" : "ingresos quedaron"} en pausa.` });
    } catch (error) {
      if (responseScope.isCurrent()) setFeedback({ tone: "error", title: "Lote parcial o por comprobar", description: `${getQueryErrorMessage(error)} Comprueba el último estado antes de repetir.` });
    } finally {
      setIsBulkPausing(false);
    }
  }

  async function setIncomeFlag(income: RecurringIncomeSummary, patch: { is_pinned?: boolean; status?: RecurringIncomeStatus }) {
    if (!canAct || !access.isCurrent() || flight.current) return;
    try {
      const current = currentIncome(income.id);
      if (patch.status && (!["active", "paused"].includes(patch.status) || current.status === "cancelled")) throw new Error("Revisa el estado actual antes de cambiarlo.");
      if (patch.status === current.status || (patch.is_pinned !== undefined && patch.is_pinned === current.isPinned)) return;
      await runWrite(() => flagsMutation.mutateAsync({ recurringIncomeId: current.id, workspaceId: activeWorkspace!.id, userId: user!.id, expectedStatus: current.status, expectedIsPinned: Boolean(current.isPinned), patch }));
    } catch (error) {
      if (responseScope.isCurrent()) setFeedback({ tone: "error", title: "No se pudo actualizar el ingreso", description: getQueryErrorMessage(error) });
    }
  }

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Estamos preparando los ingresos fijos del espacio activo." eyebrow="ingresos fijos" title="Cargando ingresos fijos" />
        <RecurringIncomeLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Necesitamos acceder al espacio activo." eyebrow="ingresos fijos" title="Ingresos fijos no disponibles" />
        <DataState description={getQueryErrorMessage(workspaceError, "No pudimos abrir tu espacio actual.")} title="No hay acceso al espacio" tone="error" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Cuando tengas un espacio activo, aquí verás tus ingresos fijos." eyebrow="ingresos fijos" title="Aún no hay un espacio activo" />
        <DataState description="Activa o crea un espacio para comenzar a registrar ingresos fijos." title="Sin ingresos fijos para mostrar" />
      </div>
    );
  }

  if (snapshotQuery.isLoading || (!snapshot && !snapshotQuery.error)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Estamos cargando tus ingresos fijos y sus próximas llegadas." eyebrow="ingresos fijos" title="Cargando ingresos fijos" />
        <RecurringIncomeLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Intentamos recuperar el estado actual de tus ingresos fijos." eyebrow="ingresos fijos" title="No fue posible cargar la información" />
        <DataState description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer tus ingresos fijos actuales.")} title="Error al cargar ingresos fijos" tone="error" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <section className="module-header">
        <div className="min-w-0 flex-1 basis-[15rem]">
          <h1 className="module-heading">Ingresos fijos</h1>
          <p className="mt-1.5 text-sm leading-6 text-storm">
            {recurringIncome.length} {recurringIncome.length === 1 ? "registrado" : "registrados"} · {missedArrivals > 0 ? `${missedArrivals} ${missedArrivals === 1 ? "llegada sin confirmar" : "llegadas sin confirmar"} en ${overdueCount} ${overdueCount === 1 ? "ingreso" : "ingresos"}` : dueSoonCount > 0 ? `${dueSoonCount} ${dueSoonCount === 1 ? "llega" : "llegan"} en los próximos 30 días` : nextIncome ? `siguiente llegada el ${formatDate(nextIncome.nextExpectedDate)}` : "sin llegadas próximas"}.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button disabled={!canAct} data-tour="create-recurring-income" onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" /><span className="sm:hidden">Nuevo</span><span className="hidden sm:inline">Nuevo ingreso</span></Button>
          <div className="relative">
            <button aria-expanded={isActionsMenuOpen} aria-label="Más acciones" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] text-storm transition hover:bg-white/[0.04] hover:text-ink" onClick={() => setIsActionsMenuOpen((value) => !value)} type="button"><MoreVertical className="h-4 w-4" /></button>
            {isActionsMenuOpen ? (
              <>
                <button aria-label="Cerrar acciones" className="fixed inset-0 z-30 cursor-default" onClick={() => setIsActionsMenuOpen(false)} type="button" />
                <div className="absolute right-0 top-12 z-40 min-w-52 overflow-hidden rounded-xl border border-white/[0.1] bg-[#1b1a18] py-1">
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-white/[0.04] disabled:opacity-40" disabled={snapshotQuery.isFetching} onClick={() => { setIsActionsMenuOpen(false); snapshotQuery.refetch(); }} type="button"><RefreshCw className={snapshotQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Actualizar</button>
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-white/[0.04] disabled:opacity-40" disabled={!ready || !filteredIncome.length} onClick={() => { setIsActionsMenuOpen(false); exportRows(filteredIncome, "ingresos-fijos-" + new Date().toISOString().slice(0, 10) + ".csv"); }} type="button"><Download className="h-4 w-4" />Exportar los {filteredIncome.length}</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-label="Filtros de ingresos fijos">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_auto]">
          <input aria-label="Buscar ingresos fijos" className="field-dark !h-14" onChange={(event) => updateIncomeFilter("name", event.target.value)} placeholder="Buscar por nombre, pagador o categoría..." type="search" value={incomeFilters.name} />
          <SearchablePicker appearance="toolbar" emptyMessage="No hay estados." onChange={(value) => { if (value !== "multiple") updateIncomeFilters({ status: value as "all" | RecurringIncomeStatus, selectedStatuses: [] }); }} options={incomeFilters.selectedStatuses.length > 1 ? [{ value: "multiple", label: "Varios estados", description: "Filtra por los estados marcados abajo.", leadingLabel: "VA" }, ...statusFilterPickerOptions] : statusFilterPickerOptions} placeholderDescription="Estado" placeholderLabel="Todos los estados" queryPlaceholder="Buscar estado..." showSearch={false} value={incomeFilters.selectedStatuses.length > 1 ? "multiple" : incomeFilters.selectedStatuses[0] ?? incomeFilters.status} />
          <SearchablePicker appearance="toolbar" emptyMessage="No hay frecuencias." onChange={(value) => updateIncomeFilter("frequency", value as "all" | RecurringIncomeFrequency)} options={frequencyFilterPickerOptions} placeholderDescription="Frecuencia" placeholderLabel="Todas las frecuencias" queryPlaceholder="Buscar frecuencia..." showSearch={false} value={incomeFilters.frequency} />
          <button aria-expanded={showMoreFilters} className="flex h-14 items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 text-sm text-storm transition hover:text-ink" onClick={() => setShowMoreFilters((value) => !value)} type="button"><SlidersHorizontal className="h-4 w-4" />Más filtros</button>
        </div>
        {showMoreFilters ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <fieldset className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.1] px-4 py-3 sm:col-span-2 xl:col-span-3"><legend className="px-1 text-xs text-storm">Estados combinados</legend>{statusOptions.map((option) => { const checked = incomeFilters.selectedStatuses.length ? incomeFilters.selectedStatuses.includes(option.value) : incomeFilters.status === option.value; return <label className="flex items-center gap-2 text-sm text-ink" key={option.value}><input checked={checked} className="accent-[#e5e0d6]" onChange={() => { const current = incomeFilters.selectedStatuses.length ? incomeFilters.selectedStatuses : incomeFilters.status === "all" ? [] : [incomeFilters.status]; const next = checked ? current.filter((value) => value !== option.value) : [...current, option.value]; updateIncomeFilters({ status: "all", selectedStatuses: next }); }} type="checkbox" />{option.label}</label>; })}</fieldset>
            <label className="flex h-14 items-center gap-3 rounded-xl border border-white/[0.1] px-4 text-sm text-ink"><input checked={incomeFilters.pinnedOnly} className="accent-[#e5e0d6]" onChange={(event) => updateIncomeFilter("pinnedOnly", event.target.checked)} type="checkbox" />Solo fijados</label>
            <label className="flex h-14 items-center gap-3 rounded-xl border border-white/[0.1] px-4 text-sm text-ink"><input checked={incomeFilters.upcomingOnly} className="accent-[#e5e0d6]" onChange={(event) => updateIncomeFilter("upcomingOnly", event.target.checked)} type="checkbox" />Próximos 30 días</label>
            <SearchablePicker appearance="toolbar" emptyMessage="No hay pagadores." onChange={(value) => updateIncomeFilter("payer", value)} options={[{ value: "", label: "Todos los pagadores", description: "", leadingLabel: "—" }, ...recurringIncomePayers.map((value) => ({ value, label: value, description: "", leadingLabel: value.slice(0, 2).toUpperCase() }))]} placeholderDescription="Pagador" placeholderLabel="Todos los pagadores" queryPlaceholder="Buscar pagador..." value={incomeFilters.payer} />
            <SearchablePicker appearance="toolbar" emptyMessage="No hay categorías." onChange={(value) => updateIncomeFilter("category", value)} options={[{ value: "", label: "Todas las categorías", description: "", leadingLabel: "—" }, ...recurringIncomeCategories.map((value) => ({ value, label: value, description: "", leadingLabel: value.slice(0, 2).toUpperCase() }))]} placeholderDescription="Categoría" placeholderLabel="Todas las categorías" queryPlaceholder="Buscar categoría..." value={incomeFilters.category} />
            <SearchablePicker appearance="toolbar" emptyMessage="No hay cuentas." onChange={(value) => updateIncomeFilter("account", value)} options={[{ value: "", label: "Todas las cuentas", description: "", leadingLabel: "—" }, ...recurringIncomeAccounts.map((value) => ({ value, label: value, description: "", leadingLabel: value.slice(0, 2).toUpperCase() }))]} placeholderDescription="Cuenta" placeholderLabel="Todas las cuentas" queryPlaceholder="Buscar cuenta..." value={incomeFilters.account} />
            <input aria-label="Filtrar por monto" className="field-dark !h-14" onChange={(event) => updateIncomeFilter("amount", event.target.value)} placeholder="Monto" type="search" value={incomeFilters.amount} />
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
              <div><p className="mb-1.5 text-[13px] font-medium text-storm">Llegada desde</p><DatePickerField appearance="compact" onChange={(value) => updateIncomeFilter("nextExpectedDateFrom", value)} value={incomeFilters.nextExpectedDateFrom} /></div>
              <div><p className="mb-1.5 text-[13px] font-medium text-storm">Llegada hasta</p><DatePickerField appearance="compact" onChange={(value) => updateIncomeFilter("nextExpectedDateTo", value)} value={incomeFilters.nextExpectedDateTo} /></div>
            </div>
          </div>
        ) : null}
        {hasActiveFilters ? <button className="mt-2 text-xs text-storm underline-offset-4 hover:text-ink hover:underline" onClick={clearIncomeFilters} type="button">Limpiar filtros</button> : null}
      </section>

      <section aria-label="Resumen de ingresos filtrados" className="module-summary">
        <span><span className="font-semibold text-ink">{filteredIncome.length}</span> {filteredIncome.length === 1 ? "ingreso" : "ingresos"} en esta vista{activeInFilter !== filteredIncome.length ? ` · ${activeInFilter} activos` : ""}</span>
        <span>{monthlySummary.comparableActiveCount ? <>Esperado al mes <strong className="text-ink">{formatCurrency(monthlySummary.monthlyTotal, baseCurrencyCode)}</strong></> : monthlySummary.activeCount ? "Esperado al mes: sin importes comparables" : "Sin ingresos activos"}{monthlySummary.excludedActiveCount ? <span className="ml-2 text-xs">· {monthlySummary.excludedActiveCount} sin datos comparables no {monthlySummary.excludedActiveCount === 1 ? "suma" : "suman"}</span> : null}</span>
      </section>

      {!permitted ? <p className="text-sm text-storm" role="status">{activeWorkspace.isArchived ? "Este espacio está archivado." : "Tu acceso es de solo lectura."} Puedes consultar y exportar, pero no modificar ingresos fijos.</p> : null}
      {feedback && !isEditorOpen && !confirmIncome ? <DataState description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}

      {recurringIncome.length === 0 ? (
        <DataState action={<Button disabled={!canAct} onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Crear primer ingreso</Button>} description="Aún no hay ingresos fijos registrados en este espacio." title="Sin ingresos fijos" />
      ) : filteredIncome.length === 0 ? (
        <DataState action={hasActiveFilters ? <Button onClick={clearIncomeFilters} variant="secondary">Quitar filtros</Button> : undefined} description="No hay ingresos que coincidan con los filtros." title="Sin resultados" />
      ) : (
        <RecurringIncomeList canWrite={canAct} isPending={isActionPending || !ready} allSelected={allSelected} income={paginatedIncome} onClearAll={clearAll} onConfirm={openConfirm} onDelete={openDelete} onEdit={openEditEditor} onHistory={openHistory} onPause={(income) => void setIncomeFlag(income, { status: income.status === "active" ? "paused" : "active" })} onPin={(income) => void setIncomeFlag(income, { is_pinned: !income.isPinned })} onSelectAll={selectAll} onToggleSelect={toggleSelect} selectedIds={selectedIds} someSelected={someSelected} />
      )}
      {filteredIncome.length > 0 ? (
        <Pagination
          onPageChange={setCurrentPage}
          page={safePage}
          pageSize={RECURRING_INCOME_PAGE_SIZE}
          totalItems={filteredIncome.length}
        />
      ) : null}

      {isEditorOpen ? (
        <EditorDialog
          accounts={accounts}
          baseCurrencyCode={baseCurrencyCode}
          categories={categories}
          clearFieldError={clearFieldError}
          closeEditor={requestCloseEditor}
          counterparties={counterparties}
          movements={movements}
          feedback={feedback}
          formState={formState}
          invalidFields={invalidFields}
          isCreateMode={editorMode === "create"}
          isSaving={isSavingEditor}
          saveBlocked={editorWrite.blocked && !editorWrite.pending}
          onSubmit={handleSubmit}
          updateFormState={updateFormState}
        />
      ) : null}

      {showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => { setShowUnsavedDialog(false); closeEditor(); }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}

      {deleteTarget ? (
        <Modal className="!max-w-md !bg-[#1a1917]" disableOutsideClose={isDeleting} labelledBy="income-delete-title" onClose={() => { if (!isDeleting) setDeleteTargetId(null); }}>
          <ModalHeader description="Se elimina la programación y su historial de llegadas; los movimientos registrados se conservan. Puedes deshacer antes del envío." onClose={() => setDeleteTargetId(null)} title="¿Eliminar ingreso fijo?" titleId="income-delete-title" />
          <div className="px-6 py-5"><p className="font-semibold text-ink">{deleteTarget.name}</p><p className="mt-1 text-sm text-storm">{formatCurrency(deleteTarget.amount, deleteTarget.currencyCode)} · {getFrequencyOption(deleteTarget.frequency).label}</p></div>
          <div className="flex justify-end gap-2 border-t border-white/[0.08] px-6 py-4"><Button disabled={isDeleting} onClick={() => setDeleteTargetId(null)} variant="ghost">Cancelar</Button><Button className="!bg-[#3a2423] !text-[#f0b0ab] hover:!bg-[#4a2d2b]" disabled={isDeleting} onClick={handleDelete}>Eliminar</Button></div>
        </Modal>
      ) : null}

      {!deleteTarget && !showBulkDeleteConfirm ? <BulkActionBar
        archiveLabel="Pausar activos"
        isArchiving={isBulkPausing}
        isDeleting={isBulkDeleting}
        onArchive={canAct && selectedItems.some((item) => item.status === "active") ? () => void handleBulkPause() : undefined}
        onClearAll={clearAll}
        onDelete={canAct ? handleBulkDelete : undefined}
        onExport={() => exportRows(selectedItems, `ingresos-fijos-seleccionados-${new Date().toISOString().slice(0, 10)}.csv`)}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredIncome.length}
      /> : null}
      {confirmIncome && activeWorkspace && permitted ? (
        <ConfirmArrivalDialog
          accounts={accounts}
          income={confirmIncome}
          initialDate={confirmDate}
          isSaving={isActionPending || !ready}
          onClose={() => { if (!flight.current) setConfirmIncomeId(null); }}
          onConfirm={handleConfirmArrival}
        />
      ) : null}

      {historyIncome && activeWorkspace ? (
        <IncomeHistoryDialog
          sourceReady={ready}
          baseCurrencyCode={baseCurrencyCode}
          exchangeRates={snapshot?.exchangeRates ?? []}
          canWrite={canAct}
          isPending={isActionPending || !ready}
          userId={user?.id}
          income={historyIncome}
          onConfirm={(date) => openConfirm(historyIncome.id, date)}
          onOpenMovement={(movementId) => navigate(`/app/movements?period=all&movement=${movementId}`)}
          onClose={() => setHistoryIncomeId(null)}
          workspaceId={activeWorkspace.id}
        />
      ) : null}

      {showBulkDeleteConfirm ? (
        <Modal className="!max-w-md !bg-[#1a1917]" disableOutsideClose={isBulkDeleting} labelledBy="income-bulk-delete-title" onClose={() => { if (!isBulkDeleting) setShowBulkDeleteConfirm(false); }}>
          <ModalHeader description="Se eliminan las programaciones y sus historiales de llegadas. Los movimientos registrados se conservan." onClose={() => setShowBulkDeleteConfirm(false)} title={`¿Eliminar ${selectedCount} ingreso${selectedCount === 1 ? "" : "s"}?`} titleId="income-bulk-delete-title" />
          <div className="flex justify-end gap-2 border-t border-white/[0.08] px-6 py-4"><Button disabled={isBulkDeleting} onClick={() => setShowBulkDeleteConfirm(false)} variant="ghost">Cancelar</Button><Button className="!bg-[#3a2423] !text-[#f0b0ab] hover:!bg-[#4a2d2b]" disabled={isBulkDeleting} onClick={() => void confirmBulkDelete()}>{isBulkDeleting ? "Eliminando..." : `Eliminar ${selectedCount}`}</Button></div>
        </Modal>
      ) : null}
    </div>
  );
}
