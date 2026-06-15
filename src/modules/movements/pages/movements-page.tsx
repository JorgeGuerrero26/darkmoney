import {
  Download,
  PencilLine,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { Pagination } from "../../../components/ui/pagination";
import { DataState } from "../../../components/ui/data-state";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { InfoTip } from "../../../components/ui/info-tip";
import { InlineDateRangePicker } from "../../../components/ui/inline-date-range-picker";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { TableColumnFilterMenu, TableFilterOptionButton } from "../../../components/ui/table-column-filter-menu";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { ColumnPicker, type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { BulkActionBar, SelectionCheckbox, useSelection, createLongPressHandlers, wasRecentLongPress } from "../../../components/ui/bulk-action-bar";
import { formatDateTime } from "../../../lib/formatting/dates";
import { formatMovementStatusLabel } from "../../../lib/formatting/labels";
import { formatCurrency } from "../../../lib/formatting/money";
import type {
  AttachmentSummary,
  JsonValue,
  MovementRecord,
  MovementStatus,
  MovementType,
} from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import {
  deleteStoredReceipt,
  prepareReceiptUpload,
  uploadPreparedReceipt,
} from "../../attachments/receipt-utils";
import { useReceiptFeatureAccess } from "../../attachments/use-receipt-feature-access";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  useCreateAttachmentRecordMutation,
  getQueryErrorMessage,
  type MovementFormInput,
  useCreateMovementMutation,
  useDeleteAttachmentRecordMutation,
  useDeleteMovementMutation,
  useEntityAttachmentsQuery,
  useUpdateMovementMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";

import { MovementEditorDialog } from "../components/movement-editor-dialog";
import {
  buildFormStateFromMovement,
  createDefaultMovementFormState,
  defaultMovementTableFilters,
  downloadMovementsCSV,
  expenseLikeMovementTypes,
  getMovementStatusTone,
  getMovementTypeOption,
  getMovementTypeTone,
  incomeLikeMovementTypes,
  isMovementTableFilterActive,
  movementStatusOptions,
  movementTableFilterDefaults,
  movementTypeOptions,
  parseMetadataValue,
  parseOptionalInteger,
  parseOptionalNumber,
} from "../lib/movement-form";
import type {
  MovementEditorMode,
  MovementFormState,
  MovementTableFilterField,
  MovementTableFilters,
} from "../lib/movement-form";

function MovementsLoadingSkeleton() {
  return (
    <>
      <div className="shimmer-surface h-[248px] rounded-[32px]" />
      <div className="shimmer-surface h-[520px] rounded-[32px]" />
    </>
  );
}
const movementTableFilterInputClassName =
  "w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";

type MovementSummaryChipProps = {
  label: string;
  tone?: "neutral" | "info" | "warning";
  value: string;
};

type MovementDisplayInfo = {
  accountLabel: string;
  amount: number | null;
  currencyCode: string;
};

function getMovementDisplayInfo(
  movement: MovementRecord,
  fallbackCurrencyCode: string,
): MovementDisplayInfo {
  if (incomeLikeMovementTypes.has(movement.movementType)) {
    return {
      accountLabel: movement.destinationAccountName ?? "-",
      amount: movement.destinationAmount,
      currencyCode: movement.destinationCurrencyCode ?? fallbackCurrencyCode,
    };
  }

  if (movement.movementType === "transfer") {
    const accountLabel =
      movement.sourceAccountName && movement.destinationAccountName
        ? `${movement.sourceAccountName} -> ${movement.destinationAccountName}`
        : movement.sourceAccountName ?? movement.destinationAccountName ?? "-";

    return {
      accountLabel,
      amount: movement.sourceAmount ?? movement.destinationAmount,
      currencyCode:
        movement.sourceCurrencyCode ?? movement.destinationCurrencyCode ?? fallbackCurrencyCode,
    };
  }

  if (expenseLikeMovementTypes.has(movement.movementType)) {
    return {
      accountLabel: movement.sourceAccountName ?? "-",
      amount: movement.sourceAmount,
      currencyCode: movement.sourceCurrencyCode ?? fallbackCurrencyCode,
    };
  }

  const amount = movement.sourceAmount ?? movement.destinationAmount;
  const accountLabel =
    movement.sourceAccountName ?? movement.destinationAccountName ?? "-";

  return {
    accountLabel,
    amount,
    currencyCode:
      movement.sourceCurrencyCode ?? movement.destinationCurrencyCode ?? fallbackCurrencyCode,
  };
}

function MovementSummaryChip({
  label,
  tone = "neutral",
  value,
}: MovementSummaryChipProps) {
  const valueTone = {
    neutral: "text-ink",
    info: "text-ember",
    warning: "text-gold",
  } as const;

  return (
    <article className="glass-panel-soft min-w-0 rounded-[24px] p-4 transition duration-300 hover:border-white/15">
      <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-storm/80">{label}</p>
      <p className={`mt-2 truncate font-display text-2xl font-semibold leading-tight ${valueTone[tone]}`}>
        {value}
      </p>
    </article>
  );
}

export function MovementsPage() {
  const { profile, user } = useAuth();
  const { accessMessage, canUploadReceipts } = useReceiptFeatureAccess();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = snapshotQuery.data;
  const movementColumns: ColumnDef[] = [
    { key: "tipo", label: "Tipo" },
    { key: "estado", label: "Estado" },
    { key: "categoria", label: "Categoria" },
    { key: "contraparte", label: "Contraparte" },
    { key: "cuenta_origen", label: "Cuenta" },
    { key: "fecha", label: "Fecha" },
  ];
  const { visible: colVis, toggle: toggleCol, cv } = useColumnVisibility("columns-movements", movementColumns);
  const [viewMode, setViewMode] = useViewMode("movements", "table");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [editorMode, setEditorMode] = useState<MovementEditorMode>("create");

  function clearFieldError(field: string) {
    setInvalidFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }
  const [selectedMovementId, setSelectedMovementId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const { schedule } = useUndoQueue();
  const [formState, setFormState] = useState<MovementFormState>(() => createDefaultMovementFormState());
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  // Filtros y página viven en la URL: enlaces compartibles y back/forward funcional.
  const [searchParams, setSearchParams] = useSearchParams();
  const tableFilters = useMemo<MovementTableFilters>(() => {
    const defaults = defaultMovementTableFilters();
    const typeParam = searchParams.get("type");
    const statusParam = searchParams.get("status");

    return {
      description: searchParams.get("q") ?? defaults.description,
      type: movementTypeOptions.some((option) => option.value === typeParam)
        ? (typeParam as MovementType)
        : "all",
      status: movementStatusOptions.some((option) => option.value === statusParam)
        ? (statusParam as MovementStatus)
        : "all",
      category: searchParams.get("cat") ?? defaults.category,
      counterparty: searchParams.get("who") ?? defaults.counterparty,
      sourceAccount: searchParams.get("account") ?? defaults.sourceAccount,
      amount: searchParams.get("amount") ?? defaults.amount,
      dateFrom: searchParams.get("from") ?? defaults.dateFrom,
      dateTo: searchParams.get("to") ?? defaults.dateTo,
    };
  }, [searchParams]);
  const currentPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const writeFiltersToParams = useCallback(
    (filters: MovementTableFilters, page: number) => {
      const params = new URLSearchParams();
      if (filters.description.trim()) params.set("q", filters.description);
      if (filters.type !== "all") params.set("type", filters.type);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.category.trim()) params.set("cat", filters.category);
      if (filters.counterparty.trim()) params.set("who", filters.counterparty);
      if (filters.sourceAccount.trim()) params.set("account", filters.sourceAccount);
      if (filters.amount.trim()) params.set("amount", filters.amount);
      if (filters.dateFrom) params.set("from", filters.dateFrom);
      if (filters.dateTo) params.set("to", filters.dateTo);
      if (page > 1) params.set("page", String(page));
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const setTableFilters = useCallback(
    (
      next:
        | MovementTableFilters
        | ((currentValue: MovementTableFilters) => MovementTableFilters),
    ) => {
      const value = typeof next === "function" ? next(tableFilters) : next;
      // Cambiar filtros siempre vuelve a la página 1.
      writeFiltersToParams(value, 1);
    },
    [tableFilters, writeFiltersToParams],
  );

  const setCurrentPage = useCallback(
    (page: number) => writeFiltersToParams(tableFilters, page),
    [tableFilters, writeFiltersToParams],
  );
  const [openTableFilter, setOpenTableFilter] = useState<MovementTableFilterField | null>(null);
  useEffect(() => {
    if (viewMode === "table") {
      return;
    }

    setOpenTableFilter(null);
    setTableFilters((currentValue) => {
      if (
        !currentValue.category &&
        !currentValue.counterparty &&
        !currentValue.sourceAccount &&
        !currentValue.amount &&
        !currentValue.dateFrom &&
        !currentValue.dateTo
      ) {
        return currentValue;
      }

      return {
        ...currentValue,
        category: "",
        counterparty: "",
        sourceAccount: "",
        amount: "",
        dateFrom: "",
        dateTo: "",
      };
    });
  }, [viewMode]);
  const createMovementMutation = useCreateMovementMutation(activeWorkspace?.id, user?.id);
  const updateMovementMutation = useUpdateMovementMutation(activeWorkspace?.id, user?.id);
  const deleteMovementMutation = useDeleteMovementMutation(activeWorkspace?.id, user?.id);
  const createAttachmentRecordMutation = useCreateAttachmentRecordMutation(activeWorkspace?.id, user?.id);
  const deleteAttachmentRecordMutation = useDeleteAttachmentRecordMutation(activeWorkspace?.id, user?.id);
  useSuccessToast(feedbackMessage, {
    clear: () => setFeedbackMessage(""),
    title: "Cambios aplicados",
  });

  const selectedMovement =
    selectedMovementId !== null
      ? snapshot?.movements.find((movement) => movement.id === selectedMovementId) ?? null
      : null;
  const attachmentsQuery = useEntityAttachmentsQuery(
    activeWorkspace?.id,
    "movement",
    isEditorOpen && editorMode === "edit" && selectedMovement ? selectedMovement.id : null,
  );
  const selectedMovementAttachments = attachmentsQuery.data ?? [];
  const isSaving =
    createMovementMutation.isPending ||
    updateMovementMutation.isPending ||
    deleteMovementMutation.isPending ||
    createAttachmentRecordMutation.isPending;
  const isUploadingReceipt =
    createAttachmentRecordMutation.isPending || deleteAttachmentRecordMutation.isPending;

  const movementCategories = useMemo(
    () => Array.from(new Set((snapshot?.movements ?? []).map((movement) => movement.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [snapshot],
  );
  const movementCounterparties = useMemo(
    () => Array.from(new Set((snapshot?.movements ?? []).map((movement) => movement.counterparty).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [snapshot],
  );
  const movementSourceAccounts = useMemo(
    () =>
      Array.from(
        new Set(
          (snapshot?.movements ?? [])
            .flatMap((movement) => [
              movement.sourceAccountName,
              movement.destinationAccountName,
            ])
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [snapshot],
  );

  const filteredMovements = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    const normalizedDescription = tableFilters.description.trim().toLowerCase();
    const normalizedCategory = tableFilters.category.trim().toLowerCase();
    const normalizedCounterparty = tableFilters.counterparty.trim().toLowerCase();
    const normalizedSourceAccount = tableFilters.sourceAccount.trim().toLowerCase();
    const normalizedAmount = tableFilters.amount.trim();

    return snapshot.movements.filter((movement) => {
      if (hiddenIds.has(movement.id)) {
        return false;
      }

      const displayInfo = getMovementDisplayInfo(
        movement,
        snapshot.workspace.baseCurrencyCode,
      );
      const amountCandidates = [
        displayInfo.amount,
        movement.sourceAmount,
        movement.destinationAmount,
      ]
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        .map((value) => String(value));
      const occurredDate = movement.occurredAt.slice(0, 10);

      const matchesDescription =
        !normalizedDescription ||
        movement.description.toLowerCase().includes(normalizedDescription);
      const matchesStatus = tableFilters.status === "all" || movement.status === tableFilters.status;
      const matchesType = tableFilters.type === "all" || movement.movementType === tableFilters.type;
      const matchesCategory =
        !normalizedCategory || movement.category.toLowerCase().includes(normalizedCategory);
      const matchesCounterparty =
        !normalizedCounterparty || movement.counterparty.toLowerCase().includes(normalizedCounterparty);
      const matchesSourceAccount =
        !normalizedSourceAccount ||
        displayInfo.accountLabel.toLowerCase().includes(normalizedSourceAccount) ||
        (movement.sourceAccountName ?? "").toLowerCase().includes(normalizedSourceAccount) ||
        (movement.destinationAccountName ?? "").toLowerCase().includes(normalizedSourceAccount);
      const matchesAmount =
        !normalizedAmount || amountCandidates.some((candidate) => candidate.includes(normalizedAmount));
      const matchesDateFrom = !tableFilters.dateFrom || occurredDate >= tableFilters.dateFrom;
      const matchesDateTo = !tableFilters.dateTo || occurredDate <= tableFilters.dateTo;

      return (
        matchesDescription &&
        matchesStatus &&
        matchesType &&
        matchesCategory &&
        matchesCounterparty &&
        matchesSourceAccount &&
        matchesAmount &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [hiddenIds, snapshot, tableFilters]);
  const MOVEMENTS_PAGE_SIZE = 50;
  const totalFilteredPages = Math.max(1, Math.ceil(filteredMovements.length / MOVEMENTS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalFilteredPages);
  const paginatedMovements = useMemo(
    () =>
      filteredMovements.slice(
        (safePage - 1) * MOVEMENTS_PAGE_SIZE,
        safePage * MOVEMENTS_PAGE_SIZE,
      ),
    [filteredMovements, safePage],
  );
  const { selectedIds, toggle: toggleSelect, selectAll, clearAll, selectedCount, allSelected, someSelected, selectedItems } = useSelection(filteredMovements);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Estamos preparando tu historial de movimientos."
          eyebrow="movimientos"
          title="Cargando movimientos"
        />
        <MovementsLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Necesitamos acceso al espacio que tienes seleccionado para mostrar tus movimientos."
          eyebrow="movimientos"
          title="Movimientos no disponibles"
        />
        <DataState
          description={getQueryErrorMessage(workspaceError, "No pudimos cargar tus espacios.")}
          title="No hay acceso al espacio"
          tone="error"
        />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Para mostrar movimientos necesitamos un espacio activo."
          eyebrow="movimientos"
          title="Aun no hay un workspace activo"
        />
        <DataState
          description="Cuando tengas un espacio con actividad, aqui veras tus movimientos y su historial."
          title="Sin movimientos para mostrar"
        />
      </div>
    );
  }

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Estamos cargando tu actividad reciente."
          eyebrow="movimientos"
          title="Cargando movimientos"
        />
        <MovementsLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Intentamos reunir tus cuentas, categorias, contrapartes y movimientos."
          eyebrow="movimientos"
          title="No fue posible cargar los movimientos"
        />
        <DataState
          description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer la informacion de movimientos.")}
          title="Error al cargar movimientos"
          tone="error"
        />
      </div>
    );
  }

  const transferCount = snapshot.movements.filter((movement) => movement.movementType === "transfer").length;
  const queuedCount = snapshot.movements.filter(
    (movement) => movement.status === "planned" || movement.status === "pending",
  ).length;
  const latestMovement = snapshot.movements[0] ?? null;
  const hasAnyMovements = snapshot.movements.length > 0;
  const hasActiveFilters = Boolean(
    tableFilters.description.trim() ||
      tableFilters.category.trim() ||
      tableFilters.counterparty.trim() ||
      tableFilters.sourceAccount.trim() ||
      tableFilters.amount.trim() ||
      tableFilters.dateFrom ||
      tableFilters.dateTo ||
      tableFilters.status !== "all" ||
      tableFilters.type !== "all",
  );
  const showMovementExplore = viewMode !== "table" && hasAnyMovements;

  function updateTableFilter<Field extends keyof MovementTableFilters>(
    field: Field,
    value: MovementTableFilters[Field],
  ) {
    setTableFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function clearTableFilters() {
    setTableFilters(defaultMovementTableFilters());
    setOpenTableFilter(null);
  }

  function toggleTableFilterMenu(field: MovementTableFilterField) {
    setOpenTableFilter((current) => (current === field ? null : field));
  }

  function closeTableFilterMenu() {
    setOpenTableFilter(null);
  }

  function clearSingleTableFilter(field: MovementTableFilterField) {
    updateTableFilter(field, movementTableFilterDefaults[field]);
  }

  function applyTableFilterAndClose<Field extends MovementTableFilterField>(
    field: Field,
    value: MovementTableFilters[Field],
  ) {
    updateTableFilter(field, value);
    setOpenTableFilter(null);
  }

  function openCreateEditor() {
    setFeedbackMessage("");
    setErrorMessage("");
    setEditorMode("create");
    setSelectedMovementId(null);
    setFormState(createDefaultMovementFormState());
    setPendingReceiptFile(null);
    setIsDirty(false);
    setInvalidFields(new Set());
    setIsEditorOpen(true);
  }

  function openEditEditor(movement: MovementRecord) {
    setFeedbackMessage("");
    setErrorMessage("");
    setEditorMode("edit");
    setSelectedMovementId(movement.id);
    setFormState(buildFormStateFromMovement(movement));
    setPendingReceiptFile(null);
    setIsDirty(false);
    setInvalidFields(new Set());
    setIsEditorOpen(true);
  }

  function closeEditor() {
    if (isSaving) {
      return;
    }

    setIsEditorOpen(false);
    setSelectedMovementId(null);
    setPendingReceiptFile(null);
    setErrorMessage("");
    setIsDirty(false);
  }

  function requestCloseEditor() {
    if (isSaving) return;
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      closeEditor();
    }
  }

  function updateFormState<Field extends keyof MovementFormState>(
    field: Field,
    value: MovementFormState[Field],
  ) {
    setIsDirty(true);
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  async function uploadReceiptForMovement(movementId: number, file: File) {
    if (!activeWorkspace || !user) {
      throw new Error("Necesitamos un usuario y workspace activos para subir comprobantes.");
    }

    const preparedReceipt = await prepareReceiptUpload({
      workspaceId: activeWorkspace.id,
      entityType: "movement",
      entityId: movementId,
      file,
    });

    await uploadPreparedReceipt(preparedReceipt);

    try {
      await createAttachmentRecordMutation.mutateAsync({
        workspaceId: activeWorkspace.id,
        entityType: "movement",
        entityId: movementId,
        bucketName: preparedReceipt.bucketName,
        filePath: preparedReceipt.filePath,
        fileName: preparedReceipt.fileName,
        mimeType: preparedReceipt.mimeType,
        sizeBytes: preparedReceipt.sizeBytes,
        width: preparedReceipt.width,
        height: preparedReceipt.height,
        uploadedByUserId: user.id,
      });
    } catch (error) {
      await deleteStoredReceipt(preparedReceipt.bucketName, preparedReceipt.filePath).catch(() => undefined);
      throw error;
    }
  }

  async function handleUploadReceipt(file: File) {
    if (!selectedMovement) {
      setErrorMessage("Guarda primero el movimiento para poder adjuntar comprobantes.");
      return;
    }

    if (!canUploadReceipts) {
      setErrorMessage("Tu plan actual no tiene habilitada la subida de comprobantes.");
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");

    try {
      await uploadReceiptForMovement(selectedMovement.id, file);
      setFeedbackMessage("Comprobante guardado correctamente.");
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos subir el comprobante."));
    }
  }

  async function handleDeleteReceipt(attachment: AttachmentSummary) {
    if (!activeWorkspace) {
      return;
    }

    if (!canUploadReceipts) {
      setErrorMessage("Tu plan actual no tiene habilitada la gestion de comprobantes.");
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");

    try {
      await deleteStoredReceipt(attachment.bucketName, attachment.filePath);
      await deleteAttachmentRecordMutation.mutateAsync({
        attachmentId: attachment.id,
        workspaceId: activeWorkspace.id,
      });
      setFeedbackMessage("Comprobante eliminado correctamente.");
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos eliminar el comprobante."));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeWorkspace || !user || !snapshot) {
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");

    const movErrors: string[] = [];
    const occurredAt = new Date(formState.occurredAt);

    if (!formState.description.trim()) movErrors.push("description");
    if (!formState.occurredAt || Number.isNaN(occurredAt.getTime())) movErrors.push("occurredAt");

    const sourceAccountId = parseOptionalInteger(formState.sourceAccountId);
    const destinationAccountId = parseOptionalInteger(formState.destinationAccountId);
    const categoryId = parseOptionalInteger(formState.categoryId);
    const counterpartyId = parseOptionalInteger(formState.counterpartyId);
    const obligationId = parseOptionalInteger(formState.obligationId);
    const subscriptionId = parseOptionalInteger(formState.subscriptionId);
    const sourceAmount = parseOptionalNumber(formState.sourceAmount);
    const destinationAmount = parseOptionalNumber(formState.destinationAmount);
    const manualFxRate = parseOptionalNumber(formState.fxRate);

    const numericFieldError =
      [sourceAccountId, destinationAccountId, categoryId, counterpartyId, obligationId, subscriptionId].some(
        (value) => value !== null && !Number.isFinite(value),
      ) ||
      [sourceAmount, destinationAmount, manualFxRate].some(
        (value) => value !== null && !Number.isFinite(value),
      );

    if (numericFieldError) {
      setErrorMessage("Revisa los montos y relaciones numericas antes de guardar.");
      return;
    }

    if (sourceAmount !== null && sourceAmount <= 0) movErrors.push("sourceAmount");
    if (destinationAmount !== null && destinationAmount <= 0) movErrors.push("destinationAmount");

    if (manualFxRate !== null && manualFxRate <= 0) {
      setErrorMessage("La tasa de cambio debe ser mayor a cero.");
      return;
    }

    if (sourceAccountId !== null && sourceAmount === null) movErrors.push("sourceAmount");
    if (destinationAccountId !== null && destinationAmount === null) movErrors.push("destinationAmount");

    const hasSourceSide = sourceAccountId !== null && sourceAmount !== null;
    const hasDestinationSide = destinationAccountId !== null && destinationAmount !== null;

    if (formState.movementType === "transfer") {
      if (!hasSourceSide) { movErrors.push("sourceAccountId"); movErrors.push("sourceAmount"); }
      if (!hasDestinationSide) { movErrors.push("destinationAccountId"); movErrors.push("destinationAmount"); }
      if (hasSourceSide && hasDestinationSide && sourceAccountId === destinationAccountId) {
        setErrorMessage("La cuenta origen y destino deben ser distintas en una transferencia.");
        return;
      }
    } else if (expenseLikeMovementTypes.has(formState.movementType)) {
      if (!hasSourceSide) { movErrors.push("sourceAccountId"); movErrors.push("sourceAmount"); }
    } else if (incomeLikeMovementTypes.has(formState.movementType)) {
      if (!hasDestinationSide) { movErrors.push("destinationAccountId"); movErrors.push("destinationAmount"); }
    } else if (!hasSourceSide && !hasDestinationSide) {
      movErrors.push("sourceAccountId"); movErrors.push("sourceAmount");
    }

    if (movErrors.length > 0) {
      setInvalidFields(new Set(movErrors));
      setErrorMessage("Completa los campos requeridos antes de guardar.");
      return;
    }

    let metadata: JsonValue;

    try {
      metadata = parseMetadataValue(formState.metadata);
    } catch {
      setErrorMessage("Metadata JSON no es valido. Revisa comillas, llaves y formato.");
      return;
    }

    const sourceAccount =
      sourceAccountId !== null
        ? snapshot.accounts.find((account) => account.id === sourceAccountId) ?? null
        : null;
    const destinationAccount =
      destinationAccountId !== null
        ? snapshot.accounts.find((account) => account.id === destinationAccountId) ?? null
        : null;
    const inferredFxRate =
      sourceAccount &&
      destinationAccount &&
      sourceAccount.currencyCode !== destinationAccount.currencyCode &&
      sourceAmount !== null &&
      destinationAmount !== null &&
      sourceAmount > 0
        ? destinationAmount / sourceAmount
        : null;

    const payload: MovementFormInput = {
      movementType: formState.movementType,
      status: formState.status,
      occurredAt: occurredAt.toISOString(),
      description: formState.description,
      notes: formState.notes,
      sourceAccountId,
      sourceAmount,
      destinationAccountId,
      destinationAmount,
      fxRate: manualFxRate ?? inferredFxRate,
      categoryId,
      counterpartyId,
      obligationId,
      subscriptionId,
      metadata,
    };

    try {
      if (editorMode === "create") {
        const createdMovementId = await createMovementMutation.mutateAsync({
          ...payload,
          userId: user.id,
          workspaceId: activeWorkspace.id,
        });

        if (pendingReceiptFile && canUploadReceipts) {
          try {
            await uploadReceiptForMovement(createdMovementId, pendingReceiptFile);
            setFeedbackMessage("Movimiento creado y comprobante guardado correctamente.");
          } catch (attachmentError) {
            setFeedbackMessage("Movimiento creado correctamente.");
            setErrorMessage(
              `${getQueryErrorMessage(
                attachmentError,
                "No pudimos subir el comprobante del movimiento.",
              )} El movimiento si quedo guardado.`,
            );
          }
        } else {
          setFeedbackMessage("Movimiento creado correctamente.");
        }

        setPendingReceiptFile(null);
        setIsEditorOpen(false);
        return;
      }

      if (!selectedMovement) {
        setErrorMessage("No encontramos el movimiento que quieres editar.");
        return;
      }

      await updateMovementMutation.mutateAsync({
        ...payload,
        movementId: selectedMovement.id,
        userId: user.id,
        workspaceId: activeWorkspace.id,
      });

      setFeedbackMessage("Movimiento actualizado correctamente.");
      setPendingReceiptFile(null);
      setIsEditorOpen(false);
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos guardar el movimiento."));
    }
  }

  function handleDeleteMovement() {
    if (!activeWorkspace || !selectedMovement) return;
    const targetId = selectedMovement.id;
    setIsEditorOpen(false);
    setSelectedMovementId(null);
    setHiddenIds((prev) => new Set([...prev, targetId]));
    schedule({
      label: "Movimiento eliminado",
      onCommit: () =>
        deleteMovementMutation.mutateAsync({ movementId: targetId, workspaceId: activeWorkspace.id }),
      onUndo: () => {
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      },
    });
  }

  async function handleBulkDelete() {
    if (selectedCount === 0) return;
    setShowBulkDeleteConfirm(true);
  }

  async function confirmBulkDelete() {
    setIsBulkDeleting(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await deleteMovementMutation.mutateAsync({ movementId: id, workspaceId: activeWorkspace!.id });
      }
      clearAll();
    } catch (err) {
      setErrorMessage(getQueryErrorMessage(err));
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-6 pb-8">
        {/* Header compacto (estándar de cuentas) */}
        <section className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine/80">Movimientos</p>
          <div className="mt-1 flex items-center gap-2.5">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">
              Libro de movimientos
            </h2>
            <InfoTip ariaLabel="Sobre el libro de movimientos">
              Entra directo a tus registros, revisa el estado de cada movimiento y filtra por columna
              cuando necesites encontrar algo puntual. La tabla manda; el resumen solo acompaña.
            </InfoTip>
          </div>
          <p className="mt-1 text-xs text-storm">
            Historial de ingresos, gastos y transferencias del workspace.
          </p>
        </section>

        {/* Métricas compactas */}
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
          <MovementSummaryChip label="movimientos" value={String(snapshot.movements.length)} />
          <MovementSummaryChip label="aplicados" tone="info" value={String(snapshot.metrics.postedCount)} />
          {queuedCount > 0 ? (
            <MovementSummaryChip label="en cola" tone="warning" value={String(queuedCount)} />
          ) : null}
          <MovementSummaryChip label="transferencias" tone="info" value={String(transferCount)} />
          {hasAnyMovements ? (
            <MovementSummaryChip label="ult. registro" value={latestMovement ? formatDateTime(latestMovement.occurredAt) : "—"} />
          ) : null}
        </div>

        {/* Toolbar sticky (estándar de cuentas) */}
        <section className="sticky top-3 z-30 rounded-[24px] border border-white/10 bg-canvas/85 p-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            <ViewSelector available={["grid", "list", "table"]} onChange={setViewMode} value={viewMode} />
            {viewMode === "table" ? (
              <ColumnPicker columns={movementColumns} visible={colVis} onToggle={toggleCol} />
            ) : null}
            <StatusBadge status={`${filteredMovements.length} visibles`} tone="neutral" />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-storm transition hover:border-white/16 hover:text-ink disabled:opacity-50"
                disabled={snapshotQuery.isFetching}
                onClick={() => snapshotQuery.refetch()}
                title="Actualizar"
                type="button"
              >
                <RefreshCw className={`h-4 w-4${snapshotQuery.isFetching ? " animate-spin" : ""}`} />
              </button>
              {hasActiveFilters ? (
                <Button onClick={clearTableFilters} variant="ghost">
                  <X className="mr-2 h-4 w-4" />
                  Limpiar
                </Button>
              ) : null}
              <Button
                disabled={!filteredMovements.length}
                onClick={() =>
                  downloadMovementsCSV(
                    filteredMovements,
                    `movimientos-${new Date().toISOString().slice(0, 10)}.csv`,
                  )
                }
                variant="ghost"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
              <Button data-tour="create-movement" onClick={openCreateEditor}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo movimiento
              </Button>
            </div>
          </div>
        </section>

        {errorMessage && !isEditorOpen ? (
        <DataState
          description={errorMessage}
          title="No pudimos completar la accion"
          tone="error"
        />
      ) : null}
        {showMovementExplore ? (
          <SurfaceCard
            description="Busca por descripcion y filtra por estado o tipo cuando prefieras recorrer la vista lista o tarjetas."
            title="Explorar movimientos"
          >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(230px,0.75fr)_minmax(230px,0.75fr)_auto]">
              <div className="flex items-center gap-2">
                <button
                  className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-storm transition hover:border-white/16 hover:text-ink disabled:opacity-50"
                  disabled={snapshotQuery.isFetching}
                  onClick={() => snapshotQuery.refetch()}
                  title="Actualizar"
                  type="button"
                >
                  <RefreshCw className={`h-4 w-4${snapshotQuery.isFetching ? " animate-spin" : ""}`} />
                </button>
                <div className="flex-1">
                  <input
                    className="w-full rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-4 py-4 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition placeholder:text-storm/70 hover:border-white/14 hover:bg-[#101928] focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]"
                    onChange={(event) => updateTableFilter("description", event.target.value)}
                    placeholder="Buscar por descripcion, categoria o contraparte..."
                    type="text"
                    value={tableFilters.description}
                  />
                </div>
              </div>

              <select
                className="h-16 w-full rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-4 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition hover:border-white/14 hover:bg-[#101928] focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]"
                onChange={(event) => updateTableFilter("status", event.target.value as MovementStatus | "all")}
                value={tableFilters.status}
              >
                <option value="all">Todos los estados</option>
                {movementStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                className="h-16 w-full rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-4 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition hover:border-white/14 hover:bg-[#101928] focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]"
                onChange={(event) => updateTableFilter("type", event.target.value as MovementType | "all")}
                value={tableFilters.type}
              >
                <option value="all">Todos los tipos</option>
                {movementTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <Button
                className="h-16 px-6"
                onClick={clearTableFilters}
                variant={hasActiveFilters ? "secondary" : "ghost"}
              >
                Limpiar filtros
              </Button>
            </div>
          </SurfaceCard>
        ) : null}
        <SurfaceCard
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {hasActiveFilters ? (
                <Button
                  className="h-10 px-4"
                  onClick={clearTableFilters}
                  variant="ghost"
                >
                  Limpiar filtros
                </Button>
              ) : null}
              <StatusBadge status={`${filteredMovements.length} visibles`} tone="neutral" />
            </div>
          }
          className="relative z-10"
          description="La tabla queda al final como vista principal. Desde aqui abres cualquier movimiento para editarlo o revisarlo."
          title="Movimientos registrados"
        >
          {filteredMovements.length === 0 ? (
            <DataState
              action={
                hasActiveFilters ? (
                  <Button onClick={clearTableFilters} variant="secondary">
                    Quitar filtros
                  </Button>
                ) : (
                  <Button onClick={openCreateEditor}>Crear primer movimiento</Button>
                )
              }
              description={
                hasActiveFilters
                  ? "No hay movimientos que coincidan con los filtros activos en la tabla."
                  : "Todavia no hay movimientos registrados en este espacio."
              }
              title={hasActiveFilters ? "Sin resultados" : "Sin movimientos"}
            />
          ) : viewMode === "list" ? (
            <div className="space-y-2">
              {paginatedMovements.map((movement) => {
                const movementTypeOption = getMovementTypeOption(movement.movementType);
                const displayInfo = getMovementDisplayInfo(
                  movement,
                  snapshot.workspace.baseCurrencyCode,
                );
                return (
                  <article className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-3.5 transition hover:border-white/16" key={movement.id}>
                    <SelectionCheckbox
                      checked={selectedIds.has(movement.id)}
                      onChange={() => toggleSelect(movement.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{movement.description}</p>
                      <p className="text-xs text-storm">{movement.category} · {movement.counterparty} · {formatDateTime(movement.occurredAt)}</p>
                    </div>
                    <div className="hidden sm:flex gap-2">
                      <StatusBadge status={movementTypeOption.label} tone={getMovementTypeTone(movement.movementType)} />
                      <StatusBadge status={formatMovementStatusLabel(movement.status)} tone={getMovementStatusTone(movement.status)} />
                    </div>
                    {displayInfo.amount !== null ? <p className="text-sm font-semibold text-ink shrink-0">{formatCurrency(displayInfo.amount, displayInfo.currencyCode)}</p> : null}
                    <Button className="py-1.5 text-xs shrink-0" onClick={() => openEditEditor(movement)} variant="ghost">Ver</Button>
                  </article>
                );
              })}
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto rounded-[24px] border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="w-10 px-4 py-3">
                      <SelectionCheckbox
                        ariaLabel="Seleccionar todos"
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={() => (allSelected ? clearAll() : selectAll())}
                      />
                    </th>
                    <th className="relative px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em]">
                      <TableColumnFilterMenu
                        active={isMovementTableFilterActive(tableFilters, "description")}
                        isOpen={openTableFilter === "description"}
                        label="Descripcion"
                        onClear={() => clearSingleTableFilter("description")}
                        onClose={closeTableFilterMenu}
                        onToggle={() => toggleTableFilterMenu("description")}
                      >
                        <div className="space-y-3">
                          <input
                            className={movementTableFilterInputClassName}
                            onChange={(event) => updateTableFilter("description", event.target.value)}
                            placeholder="Buscar descripcion"
                            type="text"
                            value={tableFilters.description}
                          />
                          <p className="text-xs leading-6 text-storm">
                            Busca por texto parcial en la descripcion del movimiento.
                          </p>
                        </div>
                      </TableColumnFilterMenu>
                    </th>
                    <th className={`relative px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${cv("tipo", "hidden sm:table-cell")}`}>
                      <TableColumnFilterMenu
                        active={isMovementTableFilterActive(tableFilters, "type")}
                        isOpen={openTableFilter === "type"}
                        label="Tipo"
                        onClear={() => clearSingleTableFilter("type")}
                        onClose={closeTableFilterMenu}
                        onToggle={() => toggleTableFilterMenu("type")}
                      >
                        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                          <TableFilterOptionButton
                            onClick={() => applyTableFilterAndClose("type", "all")}
                            selected={tableFilters.type === "all"}
                          >
                            Todos
                          </TableFilterOptionButton>
                          {movementTypeOptions.map((option) => (
                            <TableFilterOptionButton
                              key={option.value}
                              onClick={() => applyTableFilterAndClose("type", option.value)}
                              selected={tableFilters.type === option.value}
                            >
                              {option.label}
                            </TableFilterOptionButton>
                          ))}
                        </div>
                      </TableColumnFilterMenu>
                    </th>
                    <th className={`relative px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${cv("estado", "hidden sm:table-cell")}`}>
                      <TableColumnFilterMenu
                        active={isMovementTableFilterActive(tableFilters, "status")}
                        isOpen={openTableFilter === "status"}
                        label="Estado"
                        onClear={() => clearSingleTableFilter("status")}
                        onClose={closeTableFilterMenu}
                        onToggle={() => toggleTableFilterMenu("status")}
                      >
                        <div className="space-y-1">
                          <TableFilterOptionButton
                            onClick={() => applyTableFilterAndClose("status", "all")}
                            selected={tableFilters.status === "all"}
                          >
                            Todos
                          </TableFilterOptionButton>
                          {movementStatusOptions.map((option) => (
                            <TableFilterOptionButton
                              key={option.value}
                              onClick={() => applyTableFilterAndClose("status", option.value)}
                              selected={tableFilters.status === option.value}
                            >
                              {option.label}
                            </TableFilterOptionButton>
                          ))}
                        </div>
                      </TableColumnFilterMenu>
                    </th>
                    <th className={`relative px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${cv("categoria", "hidden lg:table-cell")}`}>
                      <TableColumnFilterMenu
                        active={isMovementTableFilterActive(tableFilters, "category")}
                        isOpen={openTableFilter === "category"}
                        label="Categoria"
                        onClear={() => clearSingleTableFilter("category")}
                        onClose={closeTableFilterMenu}
                        onToggle={() => toggleTableFilterMenu("category")}
                      >
                        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                          <TableFilterOptionButton
                            onClick={() => applyTableFilterAndClose("category", "")}
                            selected={!tableFilters.category}
                          >
                            Todas
                          </TableFilterOptionButton>
                          {movementCategories.map((category) => (
                            <TableFilterOptionButton
                              key={category}
                              onClick={() => applyTableFilterAndClose("category", category)}
                              selected={tableFilters.category === category}
                            >
                              {category}
                            </TableFilterOptionButton>
                          ))}
                        </div>
                      </TableColumnFilterMenu>
                    </th>
                    <th className={`relative px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${cv("contraparte", "hidden xl:table-cell")}`}>
                      <TableColumnFilterMenu
                        active={isMovementTableFilterActive(tableFilters, "counterparty")}
                        isOpen={openTableFilter === "counterparty"}
                        label="Contraparte"
                        onClear={() => clearSingleTableFilter("counterparty")}
                        onClose={closeTableFilterMenu}
                        onToggle={() => toggleTableFilterMenu("counterparty")}
                      >
                        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                          <TableFilterOptionButton
                            onClick={() => applyTableFilterAndClose("counterparty", "")}
                            selected={!tableFilters.counterparty}
                          >
                            Todas
                          </TableFilterOptionButton>
                          {movementCounterparties.map((counterparty) => (
                            <TableFilterOptionButton
                              key={counterparty}
                              onClick={() => applyTableFilterAndClose("counterparty", counterparty)}
                              selected={tableFilters.counterparty === counterparty}
                            >
                              {counterparty}
                            </TableFilterOptionButton>
                          ))}
                        </div>
                      </TableColumnFilterMenu>
                    </th>
                    <th className={`relative px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${cv("cuenta_origen", "hidden md:table-cell")}`}>
                      <TableColumnFilterMenu
                        active={isMovementTableFilterActive(tableFilters, "sourceAccount")}
                        isOpen={openTableFilter === "sourceAccount"}
                        label="Cuenta"
                        onClear={() => clearSingleTableFilter("sourceAccount")}
                        onClose={closeTableFilterMenu}
                        onToggle={() => toggleTableFilterMenu("sourceAccount")}
                      >
                        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                          <TableFilterOptionButton
                            onClick={() => applyTableFilterAndClose("sourceAccount", "")}
                            selected={!tableFilters.sourceAccount}
                          >
                            Todas
                          </TableFilterOptionButton>
                          {movementSourceAccounts.map((accountName) => (
                            <TableFilterOptionButton
                              key={accountName}
                              onClick={() => applyTableFilterAndClose("sourceAccount", accountName)}
                              selected={tableFilters.sourceAccount === accountName}
                            >
                              {accountName}
                            </TableFilterOptionButton>
                          ))}
                        </div>
                      </TableColumnFilterMenu>
                    </th>
                    <th className="relative px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em]">
                      <TableColumnFilterMenu
                        active={isMovementTableFilterActive(tableFilters, "amount")}
                        align="right"
                        isOpen={openTableFilter === "amount"}
                        label="Monto"
                        onClear={() => clearSingleTableFilter("amount")}
                        onClose={closeTableFilterMenu}
                        onToggle={() => toggleTableFilterMenu("amount")}
                        triggerClassName="justify-end text-right"
                      >
                        <div className="space-y-3">
                          <input
                            className={`${movementTableFilterInputClassName} text-right`}
                            onChange={(event) => updateTableFilter("amount", event.target.value)}
                            placeholder="Ej. 120 o 120.50"
                            type="text"
                            value={tableFilters.amount}
                          />
                          <p className="text-xs leading-6 text-storm">
                            Filtra por coincidencia en el monto visible de la tabla.
                          </p>
                        </div>
                      </TableColumnFilterMenu>
                    </th>
                    <th className={`relative px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${cv("fecha", "hidden md:table-cell")}`}>
                      <TableColumnFilterMenu
                        active={
                          isMovementTableFilterActive(tableFilters, "dateFrom") ||
                          isMovementTableFilterActive(tableFilters, "dateTo")
                        }
                        align="right"
                        isOpen={openTableFilter === "dateFrom" || openTableFilter === "dateTo"}
                        label="Fecha"
                        minWidthClassName="min-w-[320px]"
                        onClear={() => {
                          clearSingleTableFilter("dateFrom");
                          clearSingleTableFilter("dateTo");
                        }}
                        onClose={closeTableFilterMenu}
                        onToggle={() => toggleTableFilterMenu("dateFrom")}
                        triggerClassName="justify-end text-right"
                      >
                        <div className="space-y-3">
                          <InlineDateRangePicker
                            endDate={tableFilters.dateTo}
                            onEndDateChange={(value) => updateTableFilter("dateTo", value)}
                            onStartDateChange={(value) => updateTableFilter("dateFrom", value)}
                            startDate={tableFilters.dateFrom}
                          />
                          <p className="text-xs leading-6 text-storm">
                            Filtra por rango cronologico para trabajar como una hoja de calculo.
                          </p>
                        </div>
                      </TableColumnFilterMenu>
                    </th>
                    <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMovements.map((movement, index) => {
                    const movementTypeOption = getMovementTypeOption(movement.movementType);
                    const displayInfo = getMovementDisplayInfo(
                      movement,
                      snapshot.workspace.baseCurrencyCode,
                    );
                    return (
                      <tr className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === paginatedMovements.length - 1 ? "border-b-0" : ""}`} key={movement.id}>
                        <td className="w-10 px-4 py-3.5">
                          <SelectionCheckbox
                            ariaLabel={`Seleccionar ${movement.description}`}
                            checked={selectedIds.has(movement.id)}
                            onChange={() => toggleSelect(movement.id)}
                          />
                        </td>
                        <td className="px-5 py-3.5 font-medium text-ink">{movement.description}</td>
                        <td className={`px-5 py-3.5 ${cv("tipo", "hidden sm:table-cell")}`}><StatusBadge status={movementTypeOption.label} tone={getMovementTypeTone(movement.movementType)} /></td>
                        <td className={`px-5 py-3.5 ${cv("estado", "hidden sm:table-cell")}`}><StatusBadge status={formatMovementStatusLabel(movement.status)} tone={getMovementStatusTone(movement.status)} /></td>
                        <td className={`px-5 py-3.5 text-storm ${cv("categoria", "hidden lg:table-cell")}`}>{movement.category}</td>
                        <td className={`px-5 py-3.5 text-storm ${cv("contraparte", "hidden xl:table-cell")}`}>{movement.counterparty}</td>
                        <td className={`px-5 py-3.5 text-storm ${cv("cuenta_origen", "hidden md:table-cell")}`}>{displayInfo.accountLabel}</td>
                        <td className="px-5 py-3.5 text-right font-medium text-ink">{displayInfo.amount !== null ? formatCurrency(displayInfo.amount, displayInfo.currencyCode) : "-"}</td>
                        <td className={`px-5 py-3.5 text-right text-storm ${cv("fecha", "hidden md:table-cell")}`}>{formatDateTime(movement.occurredAt)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <Button className="py-1.5 text-xs" onClick={() => openEditEditor(movement)} variant="ghost">Ver</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedMovements.map((movement) => {
                const movementTypeOption = getMovementTypeOption(movement.movementType);
                const sourceCurrencyCode = movement.sourceCurrencyCode ?? snapshot.workspace.baseCurrencyCode;
                const destinationCurrencyCode =
                  movement.destinationCurrencyCode ?? snapshot.workspace.baseCurrencyCode;
                const isSelected = selectedIds.has(movement.id);
                const longPressHandlers = createLongPressHandlers(() => toggleSelect(movement.id));

                return (
                  <article
                    className={`glass-panel-soft relative rounded-[28px] p-5 transition duration-200 hover:border-white/16 ${isSelected ? "ring-2 ring-pine/30 border-pine/25" : ""}`}
                    key={movement.id}
                    onClick={(e) => {
                      if (wasRecentLongPress()) return;
                      if (selectedCount === 0) return;
                      if (e.target instanceof HTMLElement && e.target.closest('button, a, input, label, [role="button"]')) return;
                      toggleSelect(movement.id);
                    }}
                    {...longPressHandlers}
                  >
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="font-medium text-ink">{movement.description}</p>
                            <StatusBadge
                              status={movementTypeOption.label}
                              tone={getMovementTypeTone(movement.movementType)}
                            />
                            <StatusBadge
                              status={formatMovementStatusLabel(movement.status)}
                              tone={getMovementStatusTone(movement.status)}
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-sm text-storm">
                            <span>{movement.category}</span>
                            <span className="text-white/20">/</span>
                            <span>{movement.counterparty}</span>
                            <span className="text-white/20">/</span>
                            <span>{formatDateTime(movement.occurredAt)}</span>
                          </div>

                          {movement.notes ? (
                            <p className="max-w-4xl text-sm leading-7 text-storm">{movement.notes}</p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            onClick={() => openEditEditor(movement)}
                            variant="secondary"
                          >
                            <PencilLine className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            onClick={() => {
                              openEditEditor(movement);
                            }}
                            variant="ghost"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Revisar o eliminar
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_0.8fr]">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Origen</p>
                          <p className="mt-2 text-sm font-medium text-ink">
                            {movement.sourceAccountName ?? "Sin salida"}
                          </p>
                          <p className="mt-1 text-sm text-storm">
                            {movement.sourceAmount !== null
                              ? formatCurrency(movement.sourceAmount, sourceCurrencyCode)
                              : "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Destino</p>
                          <p className="mt-2 text-sm font-medium text-ink">
                            {movement.destinationAccountName ?? "Sin destino"}
                          </p>
                          <p className="mt-1 text-sm text-storm">
                            {movement.destinationAmount !== null
                              ? formatCurrency(movement.destinationAmount, destinationCurrencyCode)
                              : "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Relacion</p>
                          <p className="mt-2 text-sm font-medium text-ink">
                            {movement.subscriptionId
                              ? "Ligado a suscripcion"
                              : movement.obligationId
                                ? "Ligado a obligacion"
                                : "Libre"}
                          </p>
                          <p className="mt-1 text-sm text-storm">
                            {movement.fxRate
                              ? `FX ${movement.fxRate.toFixed(6)}`
                              : movement.metadata &&
                                  typeof movement.metadata === "object" &&
                                  !Array.isArray(movement.metadata) &&
                                  Object.keys(movement.metadata).length > 0
                                ? "Con detalles adicionales"
                                : "Sin extras"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <Pagination
            className="mt-5"
            onPageChange={setCurrentPage}
            page={safePage}
            pageSize={MOVEMENTS_PAGE_SIZE}
            totalItems={filteredMovements.length}
          />
        </SurfaceCard>

      </div>

      {isEditorOpen ? (
        <MovementEditorDialog
          accounts={snapshot.accounts}
          accessMessage={accessMessage}
          attachments={selectedMovementAttachments}
          baseCurrencyCode={snapshot.workspace.baseCurrencyCode}
          canManageReceipts={canUploadReceipts}
          categories={snapshot.catalogs.categories}
          closeEditor={requestCloseEditor}
          counterparties={snapshot.catalogs.counterparties}
          errorMessage={errorMessage}
          formState={formState}
          handleDeleteMovement={handleDeleteMovement}
          handleDeleteReceipt={handleDeleteReceipt}
          handleUploadReceipt={handleUploadReceipt}
          handleSubmit={handleSubmit}
          clearFieldError={clearFieldError}
          invalidFields={invalidFields}
          isCreateMode={editorMode === "create"}
          isSaving={isSaving}
          isUploadingReceipt={isUploadingReceipt}
          obligations={snapshot.obligations}
          pendingReceiptFile={pendingReceiptFile}
          selectedMovement={selectedMovement}
          subscriptions={snapshot.subscriptions}
          updatePendingReceiptFile={setPendingReceiptFile}
          updateFormState={updateFormState}
        />
      ) : null}

      {showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => { setShowUnsavedDialog(false); closeEditor(); }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}
      <BulkActionBar
        isDeleting={isBulkDeleting}
        onClearAll={clearAll}
        onDelete={handleBulkDelete}
        onExport={() => downloadMovementsCSV(selectedItems, `movimientos-seleccionados-${new Date().toISOString().slice(0, 10)}.csv`)}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredMovements.length}
      />
      {showBulkDeleteConfirm ? (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0d1520] p-6">
            <h2 className="font-display text-xl font-semibold text-ink">
              Eliminar {selectedCount} movimiento{selectedCount !== 1 ? "s" : ""}?
            </h2>
            <p className="mt-3 text-sm leading-7 text-storm">
              Esta accion eliminara permanentemente los elementos seleccionados y no se puede deshacer.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button disabled={isBulkDeleting} onClick={() => void confirmBulkDelete()}>
                {isBulkDeleting ? "Eliminando..." : `Eliminar ${selectedCount}`}
              </Button>
              <Button disabled={isBulkDeleting} onClick={() => setShowBulkDeleteConfirm(false)} variant="ghost">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
