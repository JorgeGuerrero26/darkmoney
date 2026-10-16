import { buildSubscriptionEditorInput } from "../../shared/recurring-editor-input";
import { SubscriptionEditorDialog as EditorDialog, type SubscriptionFormState, type FeedbackState } from "../components/subscription-editor-dialog";
import { summarizeSubscriptionsMonthly } from "../lib/subscription-monthly";
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
import { useQueryClient } from "@tanstack/react-query";
import { useResourceLink } from "../../../hooks/use-resource-link";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { PageHeader } from "../../../components/ui/page-header";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { BulkActionBar, useSelection } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type {
  SubscriptionFrequency,
  SubscriptionStatus,
  SubscriptionSummary,
} from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { canWriteWorkspaceCatalog, useCatalogWriteScope } from "../../shared/use-catalog-write-scope";
import { useFinancialWriteGuard } from "../../shared/use-financial-write-guard";
import { validateSubscriptionPayment } from "../lib/subscription-payment-input";
import { SubscriptionAnalyticsModal } from "../components/subscription-analytics-modal";
import { SubscriptionDetailDialog } from "../components/subscription-detail-dialog";
import { assignSubscriptionField, changeSubscriptionStatus, markSubscriptionPaid, setSubscriptionPinned, todayPeru } from "../lib/subscription-actions";
import { confirmSubscriptionWrite, isSubscriptionWriteRejected } from "../lib/subscription-write-result";
import {
  getQueryErrorMessage,
  useCreateSubscriptionMutation,
  useDeleteSubscriptionMutation,
  useUpdateSubscriptionMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import { Pagination } from "../../../components/ui/pagination";
import { SubscriptionTable } from "../components/subscription-table";
import { useSubscriptionsFilters } from "../hooks/use-subscriptions-filters";
import {
  frequencyOptions,
  getFrequencyOption,
  getStatusOption,
  statusOptions,
} from "../lib/subscriptions-presenters";

const SUBSCRIPTIONS_PAGE_SIZE = 50;

const statusFilterPickerOptions: PickerOption[] = [
  { value: "all", label: "Todos los estados", description: "No filtra por estado.", leadingLabel: "TO", searchText: "todos estados" },
  ...statusOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.leadingLabel,
    leadingColor: option.leadingColor,
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
    leadingColor: option.leadingColor,
    searchText: `${option.value} ${option.label}`,
  })),
];

type EditorMode = "create" | "edit";

function toDateInputValue(value: string) {
  return value ? value.slice(0, 10) : "";
}

function parseOptionalInteger(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }
  const parsedValue = Number(normalizedValue);
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

function createDefaultFormState(baseCurrencyCode: string): SubscriptionFormState {
  const today = todayPeru();
  return {
    name: "",
    vendorPartyId: "",
    accountId: "",
    categoryId: "",
    currencyCode: baseCurrencyCode,
    amount: "",
    frequency: "monthly",
    intervalCount: "1",
    dayOfMonth: "",
    dayOfWeek: "",
    startDate: today,
    nextDueDate: today,
    endDate: "",
    status: "active",
    autoCreateMovement: false,
    remindDaysBefore: "3",
    description: "",
    notes: "",
  };
}

function buildFormStateFromSubscription(subscription: SubscriptionSummary): SubscriptionFormState {
  return {
    name: subscription.name,
    vendorPartyId: subscription.vendorPartyId ? String(subscription.vendorPartyId) : "",
    accountId: subscription.accountId ? String(subscription.accountId) : "",
    categoryId: subscription.categoryId ? String(subscription.categoryId) : "",
    currencyCode: subscription.currencyCode,
    amount: String(subscription.amount),
    frequency: subscription.frequency,
    intervalCount: String(subscription.intervalCount),
    dayOfMonth:
      subscription.dayOfMonth === null || subscription.dayOfMonth === undefined
        ? ""
        : String(subscription.dayOfMonth),
    dayOfWeek:
      subscription.dayOfWeek === null || subscription.dayOfWeek === undefined
        ? ""
        : String(subscription.dayOfWeek),
    startDate: toDateInputValue(subscription.startDate),
    nextDueDate: toDateInputValue(subscription.nextDueDate),
    endDate: subscription.endDate ? toDateInputValue(subscription.endDate) : "",
    status: subscription.status,
    autoCreateMovement: subscription.autoCreateMovement,
    remindDaysBefore: String(subscription.remindDaysBefore),
    description: subscription.description ?? "",
    notes: subscription.notes ?? "",
  };
}

function SubscriptionsLoadingSkeleton() {
  return (
    <>
      <div className="shimmer-surface h-[248px] rounded-[32px]" />
      <div className="shimmer-surface h-[520px] rounded-[32px]" />
    </>
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

function downloadSubscriptionsCSV(subscriptions: SubscriptionSummary[], filename: string) {
  const headers = ["Nombre", "Proveedor", "Estado", "Monto", "Moneda", "Monto moneda base", "Frecuencia", "Etiqueta frecuencia", "Categoría", "Cuenta", "Inicio", "Próximo vencimiento", "Fin", "Auto movimiento", "Descripción", "Notas"];
  const rows = subscriptions.map((s) => [
    escapeCSV(s.name),
    escapeCSV(s.vendor),
    escapeCSV(getStatusOption(s.status).label),
    escapeCSV(s.amount),
    escapeCSV(s.currencyCode),
    escapeCSV(s.amountInBaseCurrency ?? ""),
    escapeCSV(s.frequency),
    escapeCSV(getFrequencyOption(s.frequency).label),
    escapeCSV(s.categoryName ?? ""),
    escapeCSV(s.accountName ?? ""),
    escapeCSV(s.startDate),
    escapeCSV(s.nextDueDate),
    escapeCSV(s.endDate ?? ""),
    escapeCSV(s.autoCreateMovement ? "Sí" : "No"),
    escapeCSV(s.description ?? ""),
    escapeCSV(s.notes ?? ""),
  ]);
  downloadCSV([headers.join(","), ...rows.map((r) => r.join(","))].join("\n"), filename);
}

export function SubscriptionsPage() {
  const auth = useAuth(), workspace = useActiveWorkspace();
  return <ScopedSubscriptionsPage key={`${auth.user?.id}:${workspace.activeWorkspace?.id}`} auth={auth} workspace={workspace} />;
}

function ScopedSubscriptionsPage({ auth, workspace }: { auth: ReturnType<typeof useAuth>; workspace: ReturnType<typeof useActiveWorkspace> }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, user } = auth;
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = workspace;
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = user && !snapshotQuery.isPlaceholderData && snapshotQuery.data?.workspace.id === activeWorkspace?.id ? snapshotQuery.data : undefined;
  const ready = Boolean(snapshot && snapshotQuery.isSuccess && !snapshotQuery.error && !snapshotQuery.isFetching && !isWorkspacesLoading && !workspaceError && !workspace.isFetching && !workspace.isPlaceholderData);
  const access = useCatalogWriteScope(activeWorkspace, user?.id, ready);
  const responseScope = useCatalogWriteScope(activeWorkspace, user?.id, true);
  const permitted = canWriteWorkspaceCatalog(activeWorkspace, user?.id, true);
  const latestAccess = useRef(access); latestAccess.current = access;
  const flight = useRef(false), queued = useRef(new Set<string>()), pendingDeletes = useRef(new Set<number>());
  const createMutation = useCreateSubscriptionMutation(activeWorkspace?.id, user?.id);
  const updateMutation = useUpdateSubscriptionMutation(activeWorkspace?.id, user?.id);
  const deleteMutation = useDeleteSubscriptionMutation(activeWorkspace?.id, user?.id);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  useSuccessToast(feedback, {
    clear: () => setFeedback(null),
  });
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
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
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [analyticsSubscriptionId, setAnalyticsSubscriptionId] = useState<number | null>(null);
  const [detailSubscriptionId, setDetailSubscriptionId] = useState<number | null>(null);
  const [detailInitialPanel, setDetailInitialPanel] = useState<"detail" | "pay">("detail");
  const [cancelSubscriptionId, setCancelSubscriptionId] = useState<number | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const { schedule, cancel } = useUndoQueue();
  const {
    filters: subscriptionFilters,
    setFilters: setSubscriptionFilters,
    currentPage,
    setCurrentPage,
    updateFilter: updateSubscriptionFilter,
    clearFilters: clearSubscriptionFilters,
  } = useSubscriptionsFilters("table");
  const [formState, setFormState] = useState<SubscriptionFormState>(
    createDefaultFormState(activeWorkspace?.baseCurrencyCode ?? "USD"),
  );

  const subscriptions = useMemo(
    () => (snapshot?.subscriptions ?? []).filter(item => item.workspaceId === activeWorkspace?.id).sort((left, right) => {
      const rank = (item: SubscriptionSummary) => item.status === "active" ? (item.nextDueDate < todayPeru() ? 0 : 1) : item.status === "paused" ? 2 : 3;
      return rank(left) - rank(right) || Number(right.isPinned) - Number(left.isPinned) || left.nextDueDate.localeCompare(right.nextDueDate);
    }),
    [snapshot?.subscriptions, activeWorkspace?.id],
  );
  const rows = useRef(subscriptions); rows.current = subscriptions;
  const categories = snapshot?.catalogs.categories ?? [];
  const counterparties = snapshot?.catalogs.counterparties ?? [];
  const accounts = (snapshot?.accounts ?? []).filter(item => item.workspaceId === activeWorkspace?.id);
  const movements = (snapshot?.movements ?? []).filter(item => item.workspaceId === activeWorkspace?.id);
  const currentMovements = useRef(movements); currentMovements.current = movements;
  const baseCurrencyCode = snapshot?.workspace.baseCurrencyCode ?? activeWorkspace?.baseCurrencyCode ?? "USD";
  const selectedSubscription =
    selectedSubscriptionId === null
      ? null
      : subscriptions.find((subscription) => subscription.id === selectedSubscriptionId) ?? null;
  const deleteTarget =
    deleteTargetId === null
      ? null
      : subscriptions.find((subscription) => subscription.id === deleteTargetId) ?? null;
  const detailSubscription = detailSubscriptionId === null ? null : subscriptions.find((subscription) => subscription.id === detailSubscriptionId) ?? null;
  useResourceLink(subscriptions, setDetailSubscriptionId);
  const cancelSubscription = cancelSubscriptionId === null ? null : subscriptions.find((subscription) => subscription.id === cancelSubscriptionId) ?? null;
  const editorWrite = useFinancialWriteGuard(`${user?.id}:${activeWorkspace?.id}:subscription-editor:${isEditorOpen}:${editorMode}:${selectedSubscriptionId}`);
  const canAct = access.writable && !isActionPending && !createMutation.isPending && !updateMutation.isPending && !deleteMutation.isPending;
  useEffect(() => () => { queued.current.forEach(id => cancel(id)); queued.current.clear(); }, [cancel]);
  useEffect(() => { if (!access.writable) { queued.current.forEach(id => cancel(id)); queued.current.clear(); } }, [access.writable, cancel]);
  useEffect(() => { if (!permitted) { setIsEditorOpen(false); setShowUnsavedDialog(false); setDeleteTargetId(null); setCancelSubscriptionId(null); setShowBulkDeleteConfirm(false); } }, [permitted]);
  function currentSubscription(id: number) {
    access.assertCurrent();
    const item = rows.current.find(item => item.id === id && item.workspaceId === activeWorkspace?.id);
    if (!item || pendingDeletes.current.has(id)) throw new Error("La suscripción ya no está disponible en este espacio.");
    return item;
  }
  async function runWrite<T>(action: () => Promise<T>) {
    access.assertCurrent();
    if (flight.current) throw new Error("Ya hay una operación de suscripciones pendiente.");
    flight.current = true; setIsActionPending(true);
    try { return await action(); } finally { flight.current = false; setIsActionPending(false); }
  }
  function exportRows(items: SubscriptionSummary[], filename: string) {
    if (!ready) return;
    const ids = new Set(items.map(item => item.id));
    downloadSubscriptionsCSV(rows.current.filter(item => ids.has(item.id)), filename);
  }
  function openDelete(id: number) { if (canAct && access.isCurrent() && rows.current.some(item => item.id === id)) setDeleteTargetId(id); }
  function openPay(item: SubscriptionSummary) {
    if (!canAct || !access.isCurrent()) return;
    const current = rows.current.find(row => row.id === item.id);
    if (!current || current.status !== "active") return;
    setDetailInitialPanel("pay"); setDetailSubscriptionId(current.id);
  }

  const hasActiveFilters =
    subscriptionFilters.name.trim() !== "" ||
    subscriptionFilters.pinned ||
    subscriptionFilters.vendor.trim() !== "" ||
    subscriptionFilters.category.trim() !== "" ||
    subscriptionFilters.account.trim() !== "" ||
    subscriptionFilters.amount.trim() !== "" ||
    subscriptionFilters.nextDueDateFrom !== "" ||
    subscriptionFilters.nextDueDateTo !== "" ||
    subscriptionFilters.frequency !== "all" ||
    subscriptionFilters.status !== "all";
  const filteredSubscriptions = useMemo(() => {
    let result = subscriptions.filter((s) => !hiddenIds.has(s.id));
    if (subscriptionFilters.pinned) result = result.filter((subscription) => subscription.isPinned);
    const normalizedName = subscriptionFilters.name.trim().toLowerCase();
    const normalizedVendor = subscriptionFilters.vendor.trim().toLowerCase();
    const normalizedCategory = subscriptionFilters.category.trim().toLowerCase();
    const normalizedAccount = subscriptionFilters.account.trim().toLowerCase();
    const normalizedAmount = subscriptionFilters.amount.trim();
    if (normalizedName) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(normalizedName) ||
          (s.vendor ?? "").toLowerCase().includes(normalizedName) ||
          (s.categoryName ?? "").toLowerCase().includes(normalizedName) ||
          (s.accountName ?? "").toLowerCase().includes(normalizedName),
      );
    }
    if (normalizedVendor) {
      result = result.filter((s) => (s.vendor ?? "").toLowerCase().includes(normalizedVendor));
    }
    if (normalizedCategory) {
      result = result.filter((s) => (s.categoryName ?? "").toLowerCase().includes(normalizedCategory));
    }
    if (normalizedAccount) {
      result = result.filter((s) => (s.accountName ?? "").toLowerCase().includes(normalizedAccount));
    }
    if (subscriptionFilters.frequency !== "all") {
      result = result.filter((s) => s.frequency === subscriptionFilters.frequency);
    }
    if (subscriptionFilters.status !== "all") {
      result = result.filter((s) => s.status === subscriptionFilters.status);
    }
    if (normalizedAmount) {
      result = result.filter((s) => String(s.amount).includes(normalizedAmount));
    }
    if (subscriptionFilters.nextDueDateFrom) {
      result = result.filter((s) => s.nextDueDate >= subscriptionFilters.nextDueDateFrom);
    }
    if (subscriptionFilters.nextDueDateTo) {
      result = result.filter((s) => s.nextDueDate <= subscriptionFilters.nextDueDateTo);
    }
    return result;
  }, [hiddenIds, subscriptionFilters, subscriptions]);
  const totalPages = Math.max(1, Math.ceil(filteredSubscriptions.length / SUBSCRIPTIONS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSubscriptions = useMemo(
    () => filteredSubscriptions.slice((safePage - 1) * SUBSCRIPTIONS_PAGE_SIZE, safePage * SUBSCRIPTIONS_PAGE_SIZE),
    [filteredSubscriptions, safePage],
  );
  const { selectedIds, toggle: toggleSelect, selectAll, clearAll, selectedCount, allSelected, someSelected, selectedItems } = useSelection(filteredSubscriptions);

  useEffect(() => {
    if (!isEditorOpen) {
      setFormState(createDefaultFormState(baseCurrencyCode));
    }
  }, [baseCurrencyCode, isEditorOpen]);

  function updateFormState<Field extends keyof SubscriptionFormState>(
    field: Field,
    value: SubscriptionFormState[Field],
  ) {
    if (flight.current || editorWrite.blocked) return;
    setIsDirty(true);
    setFormState((currentValue) => ({ ...currentValue, [field]: value }));
  }

  function closeEditor() {
    if (isSavingEditor || flight.current) return;
    setIsEditorOpen(false);
    setSelectedSubscriptionId(null);
    setIsDirty(false);
  }

  function requestCloseEditor() {
    if (isSavingEditor || flight.current) return;
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
    setSelectedSubscriptionId(null);
    setFormState(createDefaultFormState(baseCurrencyCode));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  function openEditEditor(subscription: SubscriptionSummary) {
    if (!canAct || !access.isCurrent()) return;
    const current = rows.current.find(item => item.id === subscription.id);
    if (!current) return;
    setFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("edit");
    setSelectedSubscriptionId(subscription.id);
    setFormState(buildFormStateFromSubscription(current));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  const isSavingEditor = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const todayKey = todayPeru();
  const today = new Date(`${todayKey}T12:00:00Z`);
  const inSevenDays = new Date(today);
  inSevenDays.setUTCDate(today.getUTCDate() + 7);
  const inSevenDaysKey = inSevenDays.toISOString().slice(0, 10);
  const dueSoonCount = subscriptions.filter((subscription) => subscription.status === "active" && subscription.nextDueDate >= todayKey && subscription.nextDueDate <= inSevenDaysKey).length;
  const overdueCount = subscriptions.filter((subscription) => subscription.status === "active" && subscription.nextDueDate < todayKey).length;
  const nextUpcoming = subscriptions.find((subscription) => subscription.status === "active" && subscription.nextDueDate >= todayKey);
  const activeInFilter = filteredSubscriptions.filter((subscription) => subscription.status === "active");
  const pausedInFilter = filteredSubscriptions.filter((subscription) => subscription.status === "paused").length;
  const monthlySummary = summarizeSubscriptionsMonthly(activeInFilter, baseCurrencyCode);
  const monthlyTotal = monthlySummary.total;
  const subscriptionVendors = useMemo(
    () =>
      Array.from(
        new Set(
          subscriptions
            .map((subscription) => subscription.vendor?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [subscriptions],
  );
  const subscriptionCategories = useMemo(
    () =>
      Array.from(
        new Set(
          subscriptions
            .map((subscription) => subscription.categoryName?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [subscriptions],
  );
  const subscriptionAccounts = useMemo(
    () =>
      Array.from(
        new Set(
          subscriptions
            .map((subscription) => subscription.accountName?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [subscriptions],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!access.isCurrent() || flight.current || editorWrite.blocked) return;

    if (!activeWorkspace || !user?.id) {
      setFeedback({
        tone: "error",
        title: "No encontramos el espacio activo",
        description: "Recarga la página e intenta nuevamente.",
      });
      return;
    }

    const name = formState.name.trim();
    const vendorPartyId = parseOptionalInteger(formState.vendorPartyId);
    const accountId = parseOptionalInteger(formState.accountId);
    const categoryId = parseOptionalInteger(formState.categoryId);
    const amount = parseOptionalNumber(formState.amount);
    const intervalCount = parseOptionalInteger(formState.intervalCount);
    const dayOfMonth = parseOptionalInteger(formState.dayOfMonth);
    const dayOfWeek = parseOptionalInteger(formState.dayOfWeek);
    const remindDaysBefore = parseOptionalInteger(formState.remindDaysBefore);

    const subErrors: string[] = [];
    if (!name) subErrors.push("name");
    if (amount === null || Number.isNaN(amount) || amount <= 0) subErrors.push("amount");
    if (!formState.startDate) subErrors.push("startDate");
    if (!formState.nextDueDate) subErrors.push("nextDueDate");
    if (subErrors.length > 0) {
      setInvalidFields(new Set(subErrors));
      setFeedback({
        tone: "error",
        title: "Revisa los campos requeridos",
        description: "Completa los campos marcados en rojo antes de guardar.",
      });
      return;
    }

    if (intervalCount === null || !Number.isInteger(intervalCount) || intervalCount <= 0) {
      setFeedback({
        tone: "error",
        title: "Intervalo inválido",
        description: "Indica un intervalo mayor que cero.",
      });
      return;
    }

    if (!formState.startDate || !formState.nextDueDate) {
      setFeedback({
        tone: "error",
        title: "Faltan fechas clave",
        description: "Completa la fecha de inicio y el próximo cobro.",
      });
      return;
    }

    if (formState.nextDueDate < formState.startDate) {
      setFeedback({
        tone: "error",
        title: "La fecha no cuadra",
        description: "El próximo cobro no puede ser anterior al inicio.",
      });
      return;
    }

    if (formState.endDate && formState.endDate < formState.startDate) {
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

    if (vendorPartyId !== null && Number.isNaN(vendorPartyId)) {
      setFeedback({
        tone: "error",
        title: "Proveedor inválido",
        description: "Vuelve a seleccionar el proveedor si deseas asociarlo.",
      });
      return;
    }

    if (accountId !== null && Number.isNaN(accountId)) {
      setFeedback({
        tone: "error",
        title: "Cuenta inválida",
        description: "Vuelve a seleccionar la cuenta sugerida.",
      });
      return;
    }

    if (formState.autoCreateMovement && accountId === null) {
      setFeedback({
        tone: "error",
        title: "Falta la cuenta",
        description: "Elige la cuenta con la que se paga: el cobro automático se anotará en ella.",
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
      const payload = buildSubscriptionEditorInput(formState, snapshot, editorMode === "create");
      if (editorMode === "edit") currentSubscription(selectedSubscriptionId ?? 0);
      attempt = editorWrite.begin(); if (!attempt) return;
      if (editorMode === "create") {
        const result = await runWrite(() => createMutation.mutateAsync({
          workspaceId: activeWorkspace.id,
          userId: user.id,
          ...payload,
        }));
        if (!responseScope.isCurrent() || !editorWrite.isCurrent(attempt)) return;
        confirmSubscriptionWrite(result && { id: result.id, workspace_id: result.workspaceId }, { workspaceId: activeWorkspace.id });
        editorWrite.confirm(attempt);
        setFeedback({
          tone: "success",
          title: "Suscripcion creada",
          description: "Ya aparece en tu radar de vencimientos y en la lista principal.",
        });
      } else if (selectedSubscription) {
        const result = await runWrite(() => updateMutation.mutateAsync({
          subscriptionId: selectedSubscription.id,
          workspaceId: activeWorkspace.id,
          userId: user.id,
          ...payload,
        }));
        if (!responseScope.isCurrent() || !editorWrite.isCurrent(attempt)) return;
        confirmSubscriptionWrite(result && { id: result.id, workspace_id: result.workspaceId }, { workspaceId: activeWorkspace.id, subscriptionId: selectedSubscription.id });
        editorWrite.confirm(attempt);
        setFeedback({
          tone: "success",
          title: "Cambios guardados",
          description: "La suscripción se actualizó correctamente.",
        });
      }

      setIsEditorOpen(false);
      setSelectedSubscriptionId(null);
    } catch (error) {
      if (!responseScope.isCurrent() || (attempt && !editorWrite.isCurrent(attempt))) return;
      const rejected = isSubscriptionWriteRejected(error);
      if (attempt) { if (rejected) editorWrite.reject(attempt); else editorWrite.fail(attempt); }
      setFeedback({
        tone: "error",
        title: attempt && !rejected ? "Resultado por comprobar" : "No pudimos guardar la suscripción",
        description: `${getQueryErrorMessage(error, "Revisa los datos.")}${attempt && !rejected ? " No repitas este envío: cierra y comprueba Suscripciones antes de registrar otra vez; el cambio podría haberse guardado." : ""}`,
      });
    }
  }

  function handleDelete() {
    if (!activeWorkspace || !deleteTarget || !canAct || !access.isCurrent() || pendingDeletes.current.has(deleteTarget.id)) return;
    const targetId = deleteTarget.id;
    currentSubscription(targetId);
    pendingDeletes.current.add(targetId);
    setDeleteTargetId(null);
    setHiddenIds((prev) => new Set([...prev, targetId]));
    let resolved = false;
    const restore = () => setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
    });
    const queueId = schedule({
      label: "Suscripción pendiente de eliminar",
      onCommit: async () => {
        if (resolved) return;
        resolved = true; queued.current.delete(queueId); pendingDeletes.current.delete(targetId);
        if (!access.isCurrent()) { restore(); return; }
        try {
          currentSubscription(targetId);
          if (currentMovements.current.some(item => item.subscriptionId === targetId)) throw new Error("La suscripción tiene pagos asociados. No se eliminó.");
          await runWrite(() => deleteMutation.mutateAsync({ subscriptionId: targetId, workspaceId: activeWorkspace.id, userId: user!.id, isCurrent: responseScope.isCurrent }));
        }
        catch (error) { restore(); if (responseScope.isCurrent()) setFeedback({ tone: "error", title: "Eliminación por comprobar", description: `${getQueryErrorMessage(error)} Actualiza y comprueba la suscripción y su calendario antes de repetir.` }); }
      },
      onUndo: () => {
        if (resolved) return;
        resolved = true; queued.current.delete(queueId); pendingDeletes.current.delete(targetId); restore();
      },
    });
    queued.current.add(queueId);
  }

  async function runStatusChange(subscription: SubscriptionSummary, status: SubscriptionStatus) {
    if (!canAct || !access.isCurrent() || flight.current) return;
    try {
      const current = currentSubscription(subscription.id); if (current.status === status) return;
      const nextDueDate = await runWrite(() => changeSubscriptionStatus(current, status));
      if (!responseScope.isCurrent()) return;
      await snapshotQuery.refetch();
      if (!responseScope.isCurrent()) return;
      setFeedback({ tone: "success", title: status === "active" ? "Suscripción reactivada" : status === "paused" ? "Suscripción pausada" : "Suscripción cancelada", description: status === "active" ? `Próximo pago: ${formatDate(nextDueDate)}.` : "El historial de pagos se conserva." });
    } catch (error) {
      if (responseScope.isCurrent()) setFeedback({ tone: "error", title: "No se pudo cambiar el estado", description: getQueryErrorMessage(error) });
    } finally {
      if (responseScope.isCurrent()) setCancelSubscriptionId(null);
    }
  }

  async function handleTogglePin(subscription: SubscriptionSummary) {
    if (!canAct || !access.isCurrent() || flight.current) return;
    try {
      const current = currentSubscription(subscription.id), pinned = !subscription.isPinned;
      if (current.isPinned === pinned) return;
      await runWrite(() => setSubscriptionPinned(current, pinned));
      if (!responseScope.isCurrent()) return;
      await snapshotQuery.refetch();
    } catch (error) {
      if (responseScope.isCurrent()) setFeedback({ tone: "error", title: "No se pudo cambiar la posición", description: getQueryErrorMessage(error) });
    }
  }

  async function handleAssignField(subscription: SubscriptionSummary, field: "account_id" | "category_id", value: number | null) {
    if (!canAct || !access.isCurrent() || flight.current) return;
    try {
      const current = currentSubscription(subscription.id);
      if (value != null && !Number.isSafeInteger(value)) throw new Error("Selecciona una opción válida.");
      if (field === "account_id" && value != null && !accounts.some(account => account.id === value && !account.isArchived && account.currencyCode === current.currencyCode)) throw new Error(`Elige una cuenta activa en ${current.currencyCode}.`);
      if (field === "account_id" && value == null && current.autoCreateMovement) throw new Error("Desactiva el registro automático antes de quitar la cuenta.");
      if (field === "category_id" && value != null && !categories.some(category => category.id === value && category.isActive && ["expense", "both"].includes(category.kind))) throw new Error("Elige una categoría de gasto activa.");
      await runWrite(() => assignSubscriptionField(current, field, value));
      if (!responseScope.isCurrent()) return;
      await snapshotQuery.refetch();
    } catch (error) {
      if (responseScope.isCurrent()) setFeedback({ tone: "error", title: "No se pudo actualizar la suscripción", description: getQueryErrorMessage(error) });
    }
  }

  async function handleMarkPaid(subscription: SubscriptionSummary, input: { paidDate: string; amount: number; accountId: number }) {
    const current = currentSubscription(subscription.id);
    if (current.nextDueDate !== subscription.nextDueDate || current.currencyCode !== subscription.currencyCode || current.amount !== subscription.amount || current.frequency !== subscription.frequency || current.intervalCount !== subscription.intervalCount || current.dayOfMonth !== subscription.dayOfMonth) throw new Error("El calendario de la suscripción cambió. Cierra y revisa el próximo cobro antes de confirmar.");
    validateSubscriptionPayment(current, accounts, input);
    try {
      const nextDueDate = await runWrite(() => markSubscriptionPaid(current, input, { isCurrent: responseScope.isCurrent }));
      if (!responseScope.isCurrent()) return;
      await Promise.all([snapshotQuery.refetch(), queryClient.invalidateQueries({ queryKey: ["subscription-occurrences", current.workspaceId, user?.id, current.id] })]);
      if (!responseScope.isCurrent()) return;
      setFeedback({ tone: "success", title: "Pago registrado", description: `Próximo cobro: ${formatDate(nextDueDate)}.` });
    } catch (error) {
      if (responseScope.isCurrent()) await snapshotQuery.refetch();
      throw error;
    }
  }

  function applyDuePreset(preset: "all" | "overdue" | "today" | "next7" | "month") {
    const today = todayPeru();
    const day = new Date(`${today}T12:00:00Z`);
    const addDays = (count: number) => {
      const result = new Date(day);
      result.setUTCDate(result.getUTCDate() + count);
      return result.toISOString().slice(0, 10);
    };
    const monthStart = `${today.slice(0, 7)}-01`;
    const monthEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10);
    const [from, to] = preset === "overdue" ? ["", addDays(-1)]
      : preset === "today" ? [today, today]
      : preset === "next7" ? [today, addDays(7)]
      : preset === "month" ? [monthStart, monthEnd]
      : ["", ""];
    setSubscriptionFilters((current) => ({ ...current, nextDueDateFrom: from, nextDueDateTo: to }));
  }

  async function handleBulkDelete() {
    if (selectedCount === 0 || !canAct || !access.isCurrent()) return;
    setShowBulkDeleteConfirm(true);
  }

  async function handleBulkPause() {
    if (!canAct || !access.isCurrent() || flight.current) return;
    const active = selectedItems.filter((subscription) => subscription.status === "active");
    if (!active.length) return;
    let completed = 0;
    try {
      await runWrite(async () => { for (const subscription of active) {
        responseScope.assertCurrent(); latestAccess.current.assertCurrent();
        const current = rows.current.find(item => item.id === subscription.id);
        if (!current || current.status !== "active") continue;
        await changeSubscriptionStatus(current, "paused");
        completed += 1;
      } });
      if (!responseScope.isCurrent()) return;
      clearAll();
      setFeedback({ tone: "success", title: `${completed} suscripción${completed === 1 ? "" : "es"} pausada${completed === 1 ? "" : "s"}`, description: "Puedes reactivarlas desde su detalle." });
    } catch (error) {
      if (responseScope.isCurrent()) setFeedback({ tone: "error", title: `${completed} de ${active.length} confirmadas como pausadas`, description: `${getQueryErrorMessage(error)} Comprueba el estado de la última antes de repetir.` });
    } finally {
      if (responseScope.isCurrent()) await snapshotQuery.refetch();
    }
  }

  async function confirmBulkDelete() {
    if (!canAct || !access.isCurrent() || flight.current || !activeWorkspace) return;
    setIsBulkDeleting(true);
    try {
      await runWrite(async () => { for (const id of Array.from(selectedIds)) {
        responseScope.assertCurrent(); latestAccess.current.assertCurrent();
        if (!rows.current.some(item => item.id === id)) throw new Error("Una suscripción seleccionada ya no está disponible.");
        if (currentMovements.current.some(item => item.subscriptionId === id)) throw new Error("Una suscripción tiene pagos asociados. No se elimina.");
        await deleteMutation.mutateAsync({ subscriptionId: id, workspaceId: activeWorkspace.id, userId: user!.id, isCurrent: responseScope.isCurrent });
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

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Estamos preparando los pagos recurrentes del espacio activo." eyebrow="suscripciones" title="Cargando suscripciones" />
        <SubscriptionsLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Necesitamos acceder correctamente al espacio activo." eyebrow="suscripciones" title="Suscripciones no disponibles" />
        <DataState description={getQueryErrorMessage(workspaceError, "No pudimos abrir tu espacio actual.")} title="No hay acceso al espacio" tone="error" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Cuando tengas un espacio activo, aquí verás tus pagos recurrentes." eyebrow="suscripciones" title="Aún no hay un espacio activo" />
        <DataState description="Activa o crea un espacio para comenzar a registrar suscripciones." title="Sin suscripciones para mostrar" />
      </div>
    );
  }

  if (!snapshotQuery.error && (snapshotQuery.isLoading || !snapshot)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Estamos cargando tus pagos recurrentes y sus próximos vencimientos." eyebrow="suscripciones" title="Cargando suscripciones" />
        <SubscriptionsLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Intentamos reconstruir el estado actual de tus suscripciones." eyebrow="suscripciones" title="No fue posible cargar la información" />
        <DataState description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer tus suscripciones actuales.")} title="Error al cargar suscripciones" tone="error" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <section className="module-header">
        <div className="min-w-0 flex-1 basis-[15rem]">
          <h1 className="module-heading">Suscripciones</h1>
          <p className="mt-1.5 text-sm leading-6 text-storm">
            {subscriptions.length} registradas · {overdueCount > 0 ? `${overdueCount} con cobro vencido` : dueSoonCount > 0 ? `${dueSoonCount} vencen en los próximos 7 días` : nextUpcoming ? `siguiente cobro el ${formatDate(nextUpcoming.nextDueDate)}` : "sin cobros próximos"}.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
        <Button data-tour="create-subscription" disabled={!canAct} onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" /><span className="sm:hidden">Nueva</span><span className="hidden sm:inline">Nueva suscripción</span></Button>
        <div className="relative">
          <button aria-expanded={isActionsMenuOpen} aria-label="Más acciones" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] text-storm transition hover:bg-white/[0.04] hover:text-ink" onClick={() => setIsActionsMenuOpen((value) => !value)} type="button"><MoreVertical className="h-4 w-4" /></button>
          {isActionsMenuOpen ? (
            <>
              <button aria-label="Cerrar acciones" className="fixed inset-0 z-30 cursor-default" onClick={() => setIsActionsMenuOpen(false)} type="button" />
              <div className="absolute right-0 top-12 z-40 min-w-52 overflow-hidden rounded-xl border border-white/[0.1] bg-[#1b1a18] py-1">
                <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-white/[0.04] disabled:opacity-40" disabled={snapshotQuery.isFetching} onClick={() => { setIsActionsMenuOpen(false); snapshotQuery.refetch(); }} type="button"><RefreshCw className={snapshotQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Actualizar</button>
                <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-white/[0.04] disabled:opacity-40" disabled={!ready || !filteredSubscriptions.length} onClick={() => { setIsActionsMenuOpen(false); exportRows(filteredSubscriptions, "suscripciones-" + new Date().toISOString().slice(0, 10) + ".csv"); }} type="button"><Download className="h-4 w-4" />Exportar las {filteredSubscriptions.length}</button>
              </div>
            </>
          ) : null}
        </div>
        </div>
      </section>

      <section>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_auto]">
          <input aria-label="Buscar suscripciones" className="field-dark !h-14" onChange={(event) => updateSubscriptionFilter("name", event.target.value)} placeholder="Buscar por nombre, proveedor o categoría..." type="search" value={subscriptionFilters.name} />
          <SearchablePicker appearance="toolbar" emptyMessage="No hay estados." onChange={(value) => updateSubscriptionFilter("status", value as "all" | SubscriptionStatus)} options={statusFilterPickerOptions} placeholderDescription="Estado" placeholderLabel="Todos los estados" queryPlaceholder="Buscar estado..." showSearch={false} value={subscriptionFilters.status} />
          <SearchablePicker appearance="toolbar" emptyMessage="No hay frecuencias." onChange={(value) => updateSubscriptionFilter("frequency", value as "all" | SubscriptionFrequency)} options={frequencyFilterPickerOptions} placeholderDescription="Frecuencia" placeholderLabel="Todas las frecuencias" queryPlaceholder="Buscar frecuencia..." showSearch={false} value={subscriptionFilters.frequency} />
          <button aria-expanded={showMoreFilters} className="flex h-14 items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 text-sm text-storm transition hover:text-ink" onClick={() => setShowMoreFilters((value) => !value)} type="button"><SlidersHorizontal className="h-4 w-4" />Más filtros</button>
        </div>
        {showMoreFilters ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <label className="flex h-14 items-center gap-3 rounded-xl border border-white/[0.1] px-4 text-sm text-ink"><input checked={subscriptionFilters.pinned} onChange={(event) => updateSubscriptionFilter("pinned", event.target.checked)} type="checkbox" />Solo fijadas</label>
            <SearchablePicker appearance="toolbar" emptyMessage="No hay proveedores." onChange={(value) => updateSubscriptionFilter("vendor", value)} options={[{ value: "", label: "Todos los proveedores", description: "", leadingLabel: "—" }, ...subscriptionVendors.map((value) => ({ value, label: value, description: "", leadingLabel: value.slice(0, 2).toUpperCase() }))]} placeholderDescription="Proveedor" placeholderLabel="Todos los proveedores" queryPlaceholder="Buscar proveedor..." value={subscriptionFilters.vendor} />
            <SearchablePicker appearance="toolbar" emptyMessage="No hay categorías." onChange={(value) => updateSubscriptionFilter("category", value)} options={[{ value: "", label: "Todas las categorías", description: "", leadingLabel: "—" }, ...subscriptionCategories.map((value) => ({ value, label: value, description: "", leadingLabel: value.slice(0, 2).toUpperCase() }))]} placeholderDescription="Categoría" placeholderLabel="Todas las categorías" queryPlaceholder="Buscar categoría..." value={subscriptionFilters.category} />
            <SearchablePicker appearance="toolbar" emptyMessage="No hay cuentas." onChange={(value) => updateSubscriptionFilter("account", value)} options={[{ value: "", label: "Todas las cuentas", description: "", leadingLabel: "—" }, ...subscriptionAccounts.map((value) => ({ value, label: value, description: "", leadingLabel: value.slice(0, 2).toUpperCase() }))]} placeholderDescription="Cuenta" placeholderLabel="Todas las cuentas" queryPlaceholder="Buscar cuenta..." value={subscriptionFilters.account} />
            <input aria-label="Filtrar por monto" className="field-dark !h-14" onChange={(event) => updateSubscriptionFilter("amount", event.target.value)} placeholder="Monto" type="search" value={subscriptionFilters.amount} />
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
              <div><p className="mb-1.5 text-[13px] font-medium text-storm">Cobro desde</p><DatePickerField appearance="compact" onChange={(value) => updateSubscriptionFilter("nextDueDateFrom", value)} value={subscriptionFilters.nextDueDateFrom} /></div>
              <div><p className="mb-1.5 text-[13px] font-medium text-storm">Cobro hasta</p><DatePickerField appearance="compact" onChange={(value) => updateSubscriptionFilter("nextDueDateTo", value)} value={subscriptionFilters.nextDueDateTo} /></div>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-3">{([ ["all", "Todo"], ["overdue", "Vencidas"], ["today", "Hoy"], ["next7", "Próx. 7 días"], ["month", "Este mes"] ] as const).map(([value, label]) => <button className="rounded-lg border border-white/[0.1] px-3 py-2 text-sm text-storm hover:text-ink" key={value} onClick={() => applyDuePreset(value)} type="button">{label}</button>)}</div>
          </div>
        ) : null}
        {hasActiveFilters ? <button className="mt-2 text-xs text-storm underline-offset-4 hover:text-ink hover:underline" onClick={clearSubscriptionFilters} type="button">Limpiar filtros</button> : null}
      </section>

      <section aria-label="Resumen de suscripciones filtradas" className="module-summary">
        <span className="mr-auto">Los <span className="font-semibold text-ink">{filteredSubscriptions.length}</span> del filtro{activeInFilter.length !== filteredSubscriptions.length ? ` · ${activeInFilter.length} activas` : ""}{pausedInFilter ? ` · ${pausedInFilter} pausadas, no suman` : ""}</span>
        <span>Al mes <strong className="font-semibold text-ink">{formatCurrency(monthlyTotal, baseCurrencyCode)}</strong>{monthlySummary.unconvertedCount ? <span className="ml-2 text-storm">· {monthlySummary.unconvertedCount} sin conversión no {monthlySummary.unconvertedCount === 1 ? "suma" : "suman"}</span> : null}</span>
      </section>

      {!permitted ? <p className="text-sm text-storm">{activeWorkspace?.isArchived ? "Este espacio está archivado. Puedes consultar y exportar, pero no modificar suscripciones." : "Tienes acceso de solo lectura. Puedes consultar y exportar las suscripciones."}</p> : !ready ? <p className="text-sm text-storm">Comprobando datos y permisos; espera antes de modificar o exportar.</p> : null}

      {feedback && !isEditorOpen ? (
        <DataState description={feedback.description} title={feedback.title} tone={feedback.tone} />
      ) : null}

      {subscriptions.length === 0 ? (
        <DataState action={<Button disabled={!canAct} onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Crear primera suscripción</Button>} description="Todavía no hay pagos recurrentes registrados en este espacio." title="Sin suscripciones" />
      ) : filteredSubscriptions.length === 0 ? (
        <DataState action={hasActiveFilters ? <Button onClick={clearSubscriptionFilters} variant="secondary">Quitar filtros</Button> : undefined} description="No hay suscripciones que coincidan con los filtros." title="Sin resultados" />
      ) : (
        <SubscriptionTable
          allSelected={allSelected}
          canWrite={canAct}
          canAnalyze={ready}
          onAnalytics={(id) => { if (ready) setAnalyticsSubscriptionId(id); }}
          onClearAll={clearAll}
          onDelete={openDelete}
          onEdit={openEditEditor}
          onOpen={(subscription) => { setDetailInitialPanel("detail"); setDetailSubscriptionId(subscription.id); }}
          onPay={openPay}
          onReactivate={(subscription) => void runStatusChange(subscription, "active")}
          onSelectAll={selectAll}
          onToggleSelect={toggleSelect}
          selectedIds={selectedIds}
          someSelected={someSelected}
          subscriptions={paginatedSubscriptions}
        />
      )}

      {filteredSubscriptions.length > 0 ? (
        <Pagination
          onPageChange={setCurrentPage}
          page={safePage}
          pageSize={SUBSCRIPTIONS_PAGE_SIZE}
          totalItems={filteredSubscriptions.length}
        />
      ) : null}

      {isEditorOpen && permitted ? (
        <EditorDialog
          accounts={accounts}
          baseCurrencyCode={baseCurrencyCode}
          categories={categories}
          clearFieldError={clearFieldError}
          closeEditor={requestCloseEditor}
          counterparties={counterparties}
          feedback={feedback}
          formState={formState}
          invalidFields={invalidFields}
          isCreateMode={editorMode === "create"}
          isSaving={isSavingEditor || isActionPending || !access.writable}
          saveBlocked={editorWrite.status === "uncertain"}
          movements={movements}
          onSubmit={handleSubmit}
          updateFormState={updateFormState}
        />
      ) : null}

      {detailSubscription && !isEditorOpen ? <SubscriptionDetailDialog
        accounts={accounts}
        initialPanel={detailInitialPanel}
        categories={categories}
        isPending={isActionPending || !ready}
        canWrite={permitted}
        userId={user?.id}
        errorMessage={feedback?.tone === "error" ? feedback.description : undefined}
        movements={movements}
        onAnalytics={() => { if (ready) setAnalyticsSubscriptionId(detailSubscription.id); }}
        onClose={() => setDetailSubscriptionId(null)}
        onDelete={() => { if (canAct && access.isCurrent()) { setDetailSubscriptionId(null); openDelete(detailSubscription.id); } }}
        onEdit={() => openEditEditor(detailSubscription)}
        onPay={(input) => handleMarkPaid(detailSubscription, input)}
        onOpenMovement={(movementId) => navigate(`/app/movements?period=all&movement=${movementId}`)}
        onAssignAccount={(value) => void handleAssignField(detailSubscription, "account_id", value)}
        onAssignCategory={(value) => void handleAssignField(detailSubscription, "category_id", value)}
        onPin={() => void handleTogglePin(detailSubscription)}
        onStatus={(status) => { if (!canAct || !access.isCurrent()) return; if (status === "cancelled") setCancelSubscriptionId(detailSubscription.id); else void runStatusChange(detailSubscription, status); }}
        subscription={detailSubscription}
      /> : null}

      {cancelSubscription && permitted ? <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/75 p-3" role="presentation">
        <div aria-labelledby="cancel-subscription-title" aria-modal="true" className="w-full max-w-md rounded-[14px] border border-white/10 bg-[#1a1917] p-6" role="dialog">
          <h2 className="font-display text-xl font-semibold text-ink" id="cancel-subscription-title">¿Cancelar suscripción?</h2>
          <p className="mt-3 text-sm leading-6 text-storm">«{cancelSubscription.name}» dejará de generar cobros. Su historial de pagos se conserva y podrás reactivarla cuando quieras.</p>
          <div className="mt-6 flex gap-3"><Button disabled={isActionPending} onClick={() => void runStatusChange(cancelSubscription, "cancelled")}>Sí, cancelar</Button><Button disabled={isActionPending} onClick={() => setCancelSubscriptionId(null)} variant="ghost">Volver</Button></div>
        </div>
      </div> : null}

      {showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => { setShowUnsavedDialog(false); closeEditor(); }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}

      {deleteTarget && permitted ? (
        <DeleteConfirmDialog
          badge="Eliminar suscripción"
          description="Esto elimina la suscripción y su calendario asociado. Si ya tiene movimientos vinculados, primero tendrás que resolverlos."
          isDeleting={isDeleting || !canAct}
          onCancel={() => {
            if (!isDeleting) {
              setDeleteTargetId(null);
            }
          }}
          onConfirm={() => {
            void handleDelete();
          }}
        >
          <div>
            <p className="truncate text-lg font-semibold text-ink">{deleteTarget.name}</p>
            <p className="mt-1 text-sm text-storm">{deleteTarget.vendor}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ink">
                {formatCurrency(deleteTarget.amount, deleteTarget.currencyCode)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-storm">
                {getFrequencyOption(deleteTarget.frequency).label}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-storm">
                {formatDate(deleteTarget.nextDueDate)}
              </span>
            </div>
          </div>
        </DeleteConfirmDialog>
      ) : null}

      {analyticsSubscriptionId !== null && ready ? (() => {
        const analyticsSub = subscriptions.find((s) => s.id === analyticsSubscriptionId);
        return analyticsSub ? (
          <SubscriptionAnalyticsModal
            exchangeRates={snapshot?.exchangeRates ?? []}
            baseCurrencyCode={baseCurrencyCode}
            movements={movements}
            subscription={analyticsSub}
            onClose={() => setAnalyticsSubscriptionId(null)}
          />
        ) : null;
      })() : null}

      <BulkActionBar
        archiveLabel="Pausar"
        isArchiving={!canAct}
        isDeleting={!canAct || isBulkDeleting}
        onClearAll={clearAll}
        onDelete={permitted ? handleBulkDelete : undefined}
        onExport={ready ? () => exportRows(selectedItems, `suscripciones-seleccionadas-${new Date().toISOString().slice(0, 10)}.csv`) : undefined}
        onArchive={permitted && selectedItems.some((subscription) => subscription.status === "active") ? () => void handleBulkPause() : undefined}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredSubscriptions.length}
      />
      {showBulkDeleteConfirm && permitted ? (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/75 p-3" role="dialog" aria-modal="true" aria-labelledby="sub-bulk-title">
          <div className="w-full max-w-md rounded-[14px] border border-white/10 bg-[#1a1917] p-6 shadow-none">
            <h2 id="sub-bulk-title" className="font-display text-xl font-semibold text-ink">
              Eliminar {selectedCount} suscripción{selectedCount !== 1 ? "es" : ""}?
            </h2>
            <p className="mt-3 text-sm leading-7 text-storm">
              Esta acción eliminará permanentemente las suscripciones seleccionadas. No se puede deshacer.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button disabled={isBulkDeleting || !canAct} onClick={() => void confirmBulkDelete()}>
                {isBulkDeleting ? "Eliminando..." : `Eliminar ${selectedCount}`}
              </Button>
              <Button disabled={isBulkDeleting} onClick={() => setShowBulkDeleteConfirm(false)} variant="ghost">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
