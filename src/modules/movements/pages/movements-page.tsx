import {
  Check,
  Download,
  MoreVertical,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { Pagination } from "../../../components/ui/pagination";
import { DataState } from "../../../components/ui/data-state";
import { formatCurrency } from "../../../lib/formatting/money";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { PageHeader } from "../../../components/ui/page-header";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { BulkActionBar, useSelection } from "../../../components/ui/bulk-action-bar";
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
  useCurrentUserEntitlementQuery,
  useUpdateMovementMutation,
  usePersistLearningFeedbackMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";

import { MovementEditorDialog, type MovementCategoryFeedbackIntent } from "../components/movement-editor-dialog";
import { MovementTemplateMenu } from "../components/movement-template-menu";
import {
  useMovementTemplateMutations,
  useMovementTemplatesQuery,
  type MovementTemplate,
} from "../../../services/queries/movement-templates";
import type { BudgetInsight, RiskInsight } from "../../../services/queries/movement-ai";
import { MovementDateFilter } from "../components/movement-date-filter";
import { MovementsTable } from "../components/movements-table";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import {
  buildFormStateFromMovement,
  createDefaultMovementFormState,
  downloadMovementsCSV,
  expenseLikeMovementTypes,
  getMovementDisplayInfo,
  incomeLikeMovementTypes,
  movementActsAsIncome,
  movementFilterTypeOptions,
  movementMatchesTypeFilter,
  movementStatusOptions,
  parseMetadataValue,
  parseOptionalInteger,
  parseOptionalNumber,
} from "../lib/movement-form";
import { normalizeAnalyticsText } from "@darkmoney/shared/movement-features";
import { buildMovementDescription } from "../lib/movement-description";
import { movementSpendTypeId } from "../lib/movement-spend-type";
import {
  buildSplitDescription,
  buildSplitMetadata,
  canSplitMovement,
  validateMovementSplit,
  type MovementSplitLine,
} from "../lib/split-movement";
import type {
  MovementEditorMode,
  MovementFormState,
} from "../lib/movement-form";
import { useMovementTableFilters } from "../hooks/use-movement-table-filters";
import { useMovementsRealtimeSync } from "../hooks/use-movements-realtime-sync";
import { getMovementDateRangeLabel, movementDateInPeru } from "../lib/movement-date-range";

const statusFilterPickerOptions: PickerOption[] = [
  { value: "all", label: "Todos los estados", description: "No filtra por estado.", leadingLabel: "TO", searchText: "todos estados" },
  ...movementStatusOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.label.slice(0, 2).toUpperCase(),
    searchText: `${option.value} ${option.label}`,
  })),
];

const typeFilterPickerOptions: PickerOption[] = [
  { value: "all", label: "Todos los tipos", description: "No filtra por tipo.", leadingLabel: "TO", searchText: "todos tipos" },
  ...movementFilterTypeOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.label.slice(0, 2).toUpperCase(),
    searchText: `${option.value} ${option.label}`,
  })),
];

function MovementsLoadingSkeleton() {
  return (
    <>
      <div className="shimmer-surface h-[248px] rounded-[32px]" />
      <div className="shimmer-surface h-[520px] rounded-[32px]" />
    </>
  );
}
export function MovementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, user } = useAuth();
  const { accessMessage, canUploadReceipts } = useReceiptFeatureAccess();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  useMovementsRealtimeSync(activeWorkspace?.id, user?.id);
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const entitlementQuery = useCurrentUserEntitlementQuery(user?.id);
  const snapshot = snapshotQuery.data;
  const movementColumns: ColumnDef[] = [
    { key: "categoria", label: "Categoría" },
    { key: "cuenta_origen", label: "Cuenta" },
    { key: "contraparte", label: "Contraparte" },
    { key: "estado", label: "Estado", defaultVisible: false },
  ];
  const { visible: colVis, toggle: toggleCol, cv } = useColumnVisibility("columns-movements", movementColumns);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const templatesQuery = useMovementTemplatesQuery(activeWorkspace?.id, user?.id, isActionsMenuOpen);
  const templateMutations = useMovementTemplateMutations(activeWorkspace?.id, user?.id);
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
  const submitDedupeKeyRef = useRef(crypto.randomUUID());
  const submittingRef = useRef(false);
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [categoryFeedbackIntent, setCategoryFeedbackIntent] = useState<MovementCategoryFeedbackIntent | null>(null);
  const [editorIntelligence, setEditorIntelligence] = useState<{
    budget: BudgetInsight | null;
    risk: RiskInsight | null;
  }>({ budget: null, risk: null });
  // Filtros y página viven en la URL: enlaces compartibles y back/forward funcional.
  const {
    tableFilters,
    currentPage,
    setCurrentPage,
    openTableFilter,
    updateTableFilter,
    updateDateRange,
    clearTableFilters,
    toggleTableFilterMenu,
    closeTableFilterMenu,
    clearSingleTableFilter,
    applyTableFilterAndClose,
  } = useMovementTableFilters("table");

  const createMovementMutation = useCreateMovementMutation(activeWorkspace?.id, user?.id);
  const updateMovementMutation = useUpdateMovementMutation(activeWorkspace?.id, user?.id);
  const deleteMovementMutation = useDeleteMovementMutation(activeWorkspace?.id, user?.id);
  const createAttachmentRecordMutation = useCreateAttachmentRecordMutation(activeWorkspace?.id, user?.id);
  const deleteAttachmentRecordMutation = useDeleteAttachmentRecordMutation(activeWorkspace?.id, user?.id);
  const persistLearningFeedbackMutation = usePersistLearningFeedbackMutation(activeWorkspace?.id, user?.id);
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
    const rawMin = Number(tableFilters.amountMin.replace(",", "."));
    const rawMax = Number(tableFilters.amountMax.replace(",", "."));
    const amountMin = Number.isFinite(rawMin) && rawMin > 0 ? rawMin : null;
    const amountMax = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : null;

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
      const filterAmount = Math.abs(Number(
        movementActsAsIncome(movement)
          ? movement.destinationAmount ?? movement.sourceAmount ?? 0
          : movement.sourceAmount ?? movement.destinationAmount ?? 0,
      ));
      const occurredDate = movementDateInPeru(movement.occurredAt);

      const matchesDescription =
        !normalizedDescription ||
        movement.description.toLowerCase().includes(normalizedDescription);
      const matchesStatus = tableFilters.status === "all" || movement.status === tableFilters.status;
      const matchesType = movementMatchesTypeFilter(movement, tableFilters.type);
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
      const matchesAmountRange =
        (amountMin === null || filterAmount >= amountMin) &&
        (amountMax === null || filterAmount <= amountMax);
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
        matchesAmountRange &&
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

  useEffect(() => {
    const linkedId = Number(searchParams.get("movement"));
    if (!Number.isSafeInteger(linkedId) || linkedId <= 0 || !snapshot) return;
    const linkedMovement = snapshot.movements.find((movement) => movement.id === linkedId);
    if (!linkedMovement) return;
    openEditEditor(linkedMovement);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("movement");
      return next;
    }, { replace: true });
  }, [snapshot, searchParams, setSearchParams]);

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

  const transferCount = filteredMovements.filter((movement) => movement.movementType === "transfer").length;
  const activeDateLabel = getMovementDateRangeLabel(tableFilters.dateFrom, tableFilters.dateTo);
  const filteredTotals = filteredMovements.reduce(
    (totals, movement) => {
      if (movement.status === "voided" || movement.movementType === "transfer") {
        return totals;
      }

      const incomingAmount =
        movement.destinationAmountInBaseCurrency ?? movement.destinationAmount ?? 0;
      const outgoingAmount = movement.sourceAmountInBaseCurrency ?? movement.sourceAmount ?? 0;

      if (movementActsAsIncome(movement)) {
        totals.income += Math.abs(incomingAmount || outgoingAmount);
      } else {
        totals.expense += Math.abs(outgoingAmount || incomingAmount);
      }

      return totals;
    },
    { income: 0, expense: 0 },
  );
  const filteredNet = filteredTotals.income - filteredTotals.expense;
  const hasActiveFilters = Boolean(
    tableFilters.description.trim() ||
      tableFilters.category.trim() ||
      tableFilters.counterparty.trim() ||
      tableFilters.sourceAccount.trim() ||
      tableFilters.amount.trim() ||
      tableFilters.amountMin.trim() ||
      tableFilters.amountMax.trim() ||
      tableFilters.dateFrom ||
      tableFilters.dateTo ||
      tableFilters.status !== "all" ||
      tableFilters.type !== "all",
  );

  function openCreateEditor() {
    submitDedupeKeyRef.current = crypto.randomUUID();
    setFeedbackMessage("");
    setErrorMessage("");
    setEditorMode("create");
    setSelectedMovementId(null);
    setFormState(createDefaultMovementFormState());
    setPendingReceiptFile(null);
    setIsDirty(false);
    setInvalidFields(new Set());
    setCategoryFeedbackIntent(null);
    setEditorIntelligence({ budget: null, risk: null });
    setIsEditorOpen(true);
  }

  function openEditEditor(movement: MovementRecord) {
    submitDedupeKeyRef.current = crypto.randomUUID();
    setFeedbackMessage("");
    setErrorMessage("");
    setEditorMode("edit");
    setSelectedMovementId(movement.id);
    setFormState(buildFormStateFromMovement(movement));
    setPendingReceiptFile(null);
    setIsDirty(false);
    setInvalidFields(new Set());
    setCategoryFeedbackIntent(null);
    setEditorIntelligence({ budget: null, risk: null });
    setIsEditorOpen(true);
  }

  function openCreateWithType(type: MovementTemplate["movementType"]) {
    openCreateEditor();
    setFormState({ ...createDefaultMovementFormState(), movementType: type });
    setIsActionsMenuOpen(false);
  }

  function openCreateFromTemplate(template: MovementTemplate) {
    openCreateEditor();
    setFormState({
      ...createDefaultMovementFormState(),
      movementType: template.movementType,
      description: template.description,
      notes: template.notes ?? "",
      sourceAccountId: template.sourceAccountId == null ? "" : String(template.sourceAccountId),
      destinationAccountId: template.destinationAccountId == null ? "" : String(template.destinationAccountId),
      sourceAmount: template.sourceAmount == null ? "" : String(template.sourceAmount),
      destinationAmount: template.destinationAmount == null ? "" : String(template.destinationAmount),
      categoryId: template.categoryId == null ? "" : String(template.categoryId),
      counterpartyId: template.counterpartyId == null ? "" : String(template.counterpartyId),
    });
    setIsActionsMenuOpen(false);
  }

  async function saveSelectedAsTemplate() {
    if (!selectedMovement || !["expense", "income", "transfer"].includes(selectedMovement.movementType)) return;
    try {
      await templateMutations.create.mutateAsync({
        name: selectedMovement.description.trim() || "Atajo sin nombre",
        movementType: selectedMovement.movementType as MovementTemplate["movementType"],
        sourceAccountId: selectedMovement.sourceAccountId,
        destinationAccountId: selectedMovement.destinationAccountId,
        sourceAmount: selectedMovement.sourceAmount ?? null,
        destinationAmount: selectedMovement.destinationAmount ?? null,
        categoryId: selectedMovement.categoryId ?? null,
        counterpartyId: selectedMovement.counterpartyId ?? null,
        description: selectedMovement.description,
        notes: selectedMovement.notes ?? null,
      });
      setFeedbackMessage("Atajo guardado. Lo encontrarás en Más opciones de Movimientos.");
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos guardar el atajo."));
    }
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
    setCategoryFeedbackIntent(null);
    setEditorIntelligence({ budget: null, risk: null });
  }

  function requestCloseEditor() {
    if (isSaving || submittingRef.current) return;
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>, splitLines: MovementSplitLine[] | null, linkedRecurringIncomeId: number | null) {
    event.preventDefault();
    if (submittingRef.current) return;

    if (!activeWorkspace || !user || !snapshot) {
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");

    const movErrors: string[] = [];
    const occurredAt = new Date(formState.occurredAt);

    if (!formState.occurredAt || Number.isNaN(occurredAt.getTime())) movErrors.push("occurredAt");

    const sourceAccountId = parseOptionalInteger(formState.sourceAccountId);
    const destinationAccountId = parseOptionalInteger(formState.destinationAccountId);
    const categoryId = parseOptionalInteger(formState.categoryId);
    const spendTypeId = parseOptionalInteger(formState.spendTypeId);
    const counterpartyId = parseOptionalInteger(formState.counterpartyId);
    const obligationId = parseOptionalInteger(formState.obligationId);
    const subscriptionId = parseOptionalInteger(formState.subscriptionId);
    const sourceAmount = parseOptionalNumber(formState.sourceAmount);
    const destinationAmount = parseOptionalNumber(formState.destinationAmount);
    const manualFxRate = parseOptionalNumber(formState.fxRate);

    if (splitLines) {
      if (!canSplitMovement(formState.movementType, editorMode === "edit" ? selectedMovement?.metadata : undefined)) {
        setErrorMessage("Solo puedes dividir gastos e ingresos que no estén divididos ni vinculados a un evento de crédito o deuda.");
        return;
      }
      const splitAmount = formState.movementType === "income" ? destinationAmount : sourceAmount;
      const splitError = validateMovementSplit(splitLines, splitAmount ?? 0);
      if (splitError) {
        setErrorMessage(splitError);
        return;
      }
    }

    const numericFieldError =
      [sourceAccountId, destinationAccountId, categoryId, spendTypeId, counterpartyId, obligationId, subscriptionId].some(
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

    if (splitLines && !canSplitMovement(formState.movementType, metadata)) {
      setErrorMessage("Un movimiento dividido o vinculado a un evento de crédito o deuda no se puede volver a dividir.");
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

    const metadataObject = metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata
      : {};
    const payload: MovementFormInput = {
      movementType: formState.movementType,
      status: formState.status,
      occurredAt: occurredAt.toISOString(),
      description: buildMovementDescription({
        description: formState.description,
        movementType: formState.movementType,
        categoryName: snapshot.catalogs.categories.find((category) => category.id === categoryId)?.name,
        counterpartyName: snapshot.catalogs.counterparties.find((counterparty) => counterparty.id === counterpartyId)?.name,
        accountName: (incomeLikeMovementTypes.has(formState.movementType) ? destinationAccount : sourceAccount)?.name,
      }),
      notes: formState.notes,
      sourceAccountId,
      sourceAmount,
      destinationAccountId,
      destinationAmount,
      fxRate: manualFxRate ?? inferredFxRate,
      categoryId,
      spendTypeId: movementSpendTypeId(formState.movementType, spendTypeId),
      counterpartyId,
      obligationId,
      subscriptionId,
      dedupeKey: submitDedupeKeyRef.current,
      metadata: {
        ...metadataObject,
        ...(editorMode === "create" && linkedRecurringIncomeId !== null
          ? { recurring_income_id: linkedRecurringIncomeId }
          : {}),
        riskAi: editorIntelligence.risk?.source === "deepseek" ? editorIntelligence.risk : null,
        budgetAi: editorIntelligence.budget?.source === "deepseek" ? editorIntelligence.budget : null,
      },
    };

    const persistCategoryLearning = (movementId: number, previousCategoryId: number | null) => {
      if (categoryId === null) return;
      const categoryChanged = categoryId !== previousCategoryId;
      if (!categoryChanged && categoryFeedbackIntent?.kind !== "accepted_category_suggestion") return;
      void persistLearningFeedbackMutation.mutateAsync({
        movementId,
        feedbackKind: categoryFeedbackIntent?.kind ?? "manual_category_change",
        normalizedDescription: normalizeAnalyticsText(payload.description) || null,
        previousCategoryId,
        acceptedCategoryId: categoryId,
        confidence: categoryFeedbackIntent?.confidence ?? null,
        source: categoryFeedbackIntent?.source ?? "movement-form",
        metadata: {
          movementType: formState.movementType,
          counterpartyId,
          sourceAccountId,
          destinationAccountId,
          amount: destinationAmount ?? sourceAmount,
        },
      }).catch(() => undefined);
    };

    submittingRef.current = true;
    try {
      if (splitLines) {
        const splitGroupId = submitDedupeKeyRef.current;
        let firstMovementId: number | null = null;

        for (const [index, line] of splitLines.entries()) {
          const lineAmount = Number(line.amount);
          const splitPayload: MovementFormInput = {
            ...payload,
            categoryId: Number(line.categoryId),
            spendTypeId: movementSpendTypeId(formState.movementType, parseOptionalInteger(line.spendTypeId ?? "")),
            description: buildSplitDescription(payload.description, index, splitLines.length),
            destinationAmount: formState.movementType === "income" ? lineAmount : null,
            obligationId: index === 0 ? payload.obligationId : null,
            sourceAmount: formState.movementType === "expense" ? lineAmount : null,
            subscriptionId: index === 0 ? payload.subscriptionId : null,
            dedupeKey: `${splitGroupId}:split-${index + 1}`,
            metadata: {
              ...buildSplitMetadata(payload.metadata, splitGroupId, index, splitLines.length),
              ...(index > 0 && linkedRecurringIncomeId !== null ? { recurring_income_id: null } : {}),
            },
          };

          if (editorMode === "edit" && index === 0) {
            if (!selectedMovement) {
              setErrorMessage("No encontramos el movimiento que quieres editar.");
              return;
            }
            await updateMovementMutation.mutateAsync({
              ...splitPayload,
              movementId: selectedMovement.id,
              userId: user.id,
              workspaceId: activeWorkspace.id,
            });
            firstMovementId = selectedMovement.id;
          } else {
            const movementId = await createMovementMutation.mutateAsync({
              ...splitPayload,
              userId: user.id,
              workspaceId: activeWorkspace.id,
            });
            firstMovementId ??= movementId;
          }
        }

        let receiptPending = false;
        if (editorMode === "create" && pendingReceiptFile && canUploadReceipts && firstMovementId !== null) {
          try {
            await uploadReceiptForMovement(firstMovementId, pendingReceiptFile);
          } catch {
            receiptPending = true;
          }
        }
        setFeedbackMessage(
          "Movimiento dividido en " +
            splitLines.length +
            " partes" +
            (receiptPending ? "; el comprobante quedó pendiente." : " correctamente."),
        );
        setPendingReceiptFile(null);
        setIsEditorOpen(false);
        return;
      }

      if (editorMode === "create") {
        const createdMovementId = await createMovementMutation.mutateAsync({
          ...payload,
          userId: user.id,
          workspaceId: activeWorkspace.id,
        });
        persistCategoryLearning(createdMovementId, null);

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
      persistCategoryLearning(selectedMovement.id, selectedMovement.categoryId ?? null);

      setFeedbackMessage("Movimiento actualizado correctamente.");
      setPendingReceiptFile(null);
      setIsEditorOpen(false);
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos guardar el movimiento."));
    } finally {
      submittingRef.current = false;
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

  function handleDuplicateMovement() {
    if (!selectedMovement) return;
    submitDedupeKeyRef.current = crypto.randomUUID();
    const duplicated = buildFormStateFromMovement(selectedMovement);
    setEditorMode("create");
    setSelectedMovementId(null);
    setFormState({
      ...duplicated,
      occurredAt: createDefaultMovementFormState().occurredAt,
      metadata: "",
      obligationId: "",
      subscriptionId: "",
    });
    setPendingReceiptFile(null);
    setCategoryFeedbackIntent(null);
    setEditorIntelligence({ budget: null, risk: null });
    setErrorMessage("");
    setIsDirty(true);
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
        <section className="module-header">
          <div className="min-w-0 flex-1">
            <h1 className="module-heading">
              Movimientos
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-storm">
              <span className="text-ink">{filteredMovements.length}</span> movimientos · mostrando los{" "}
              <span className="text-ink">{paginatedMovements.length}</span>{" "}
              {safePage === 1 ? "más recientes" : "de esta página"}.{" "}
              <span className="text-ink">{transferCount}</span> son traspasos entre tus cuentas y no cuentan como gasto.
            </p>
          </div>

          <div className="relative shrink-0">
            <button
              aria-expanded={isActionsMenuOpen}
              aria-label="Más opciones de movimientos"
              className="grid h-9 w-9 place-items-center rounded-[7px] border border-white/[0.08] text-storm transition hover:bg-white/[0.04] hover:text-ink"
              onClick={() => setIsActionsMenuOpen((current) => !current)}
              type="button"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {isActionsMenuOpen ? (
              <>
                <button
                  aria-label="Cerrar opciones"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setIsActionsMenuOpen(false)}
                  type="button"
                />
                <div className="absolute right-0 top-11 z-50 max-h-[min(80vh,640px)] w-72 overflow-y-auto rounded-[9px] border border-white/[0.1] bg-[#1a1917]">
                  <p className="px-4 pb-2 pt-4 font-public-mono text-[10px] uppercase tracking-[0.16em] text-storm">
                    Columnas visibles
                  </p>
                  {movementColumns.map((column) => (
                    <button
                      aria-checked={colVis[column.key]}
                      className={`flex h-9 w-full items-center gap-3 px-4 text-left text-sm transition hover:bg-white/[0.05] ${
                        colVis[column.key] ? "bg-white/[0.035] text-ink" : "text-storm"
                      }`}
                      key={column.key}
                      onClick={() => toggleCol(column.key)}
                      role="menuitemcheckbox"
                      type="button"
                    >
                      <Check className={`h-3.5 w-3.5 ${colVis[column.key] ? "text-[#d6b69b] opacity-100" : "opacity-0"}`} />
                      {column.label}
                    </button>
                  ))}
                  <div className="border-t border-white/[0.08] px-4 py-3">
                    <p className="mb-2 font-public-mono text-[10px] uppercase tracking-[0.16em] text-storm">Monto nominal</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-storm">
                        Mínimo
                        <input
                          aria-label="Monto mínimo"
                          className="field-dark mt-1 h-9 w-full px-2 text-sm"
                          inputMode="decimal"
                          min="0"
                          onChange={(event) => updateTableFilter("amountMin", event.target.value)}
                          placeholder="0"
                          step="0.01"
                          type="number"
                          value={tableFilters.amountMin}
                        />
                      </label>
                      <label className="text-xs text-storm">
                        Máximo
                        <input
                          aria-label="Monto máximo"
                          className="field-dark mt-1 h-9 w-full px-2 text-sm"
                          inputMode="decimal"
                          min="0"
                          onChange={(event) => updateTableFilter("amountMax", event.target.value)}
                          placeholder="Sin límite"
                          step="0.01"
                          type="number"
                          value={tableFilters.amountMax}
                        />
                      </label>
                    </div>
                  </div>
                  <MovementTemplateMenu
                    isBusy={templateMutations.rename.isPending || templateMutations.remove.isPending}
                    isLoading={templatesQuery.isLoading}
                    onDelete={async (id) => {
                      try {
                        await templateMutations.remove.mutateAsync(id);
                        return true;
                      } catch (error) {
                        setErrorMessage(getQueryErrorMessage(error, "No pudimos eliminar el atajo."));
                        return false;
                      }
                    }}
                    onRename={async (id, name) => {
                      try {
                        await templateMutations.rename.mutateAsync({ id, name });
                        return true;
                      } catch (error) {
                        setErrorMessage(getQueryErrorMessage(error, "No pudimos renombrar el atajo."));
                        return false;
                      }
                    }}
                    onStart={openCreateWithType}
                    onUse={openCreateFromTemplate}
                    templates={templatesQuery.data ?? []}
                  />
                  {hasActiveFilters ? (
                    <button
                      className="flex h-11 w-full items-center border-t border-white/[0.08] px-4 text-left text-sm text-storm transition hover:bg-white/[0.04] hover:text-ink"
                      onClick={() => {
                        clearTableFilters();
                        setIsActionsMenuOpen(false);
                      }}
                      type="button"
                    >
                      Limpiar filtros
                    </button>
                  ) : null}
                  <button
                    className="flex h-11 w-full items-center gap-3 border-t border-white/[0.08] px-4 text-left text-sm font-medium text-ink transition hover:bg-white/[0.04] disabled:text-storm/45"
                    disabled={!filteredMovements.length}
                    onClick={() => {
                      downloadMovementsCSV(
                        filteredMovements,
                        `movimientos-${new Date().toISOString().slice(0, 10)}.csv`,
                      );
                      setIsActionsMenuOpen(false);
                    }}
                    type="button"
                  >
                    <Download className="h-4 w-4" />
                    Exportar los {filteredMovements.length}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.72fr)_minmax(0,0.72fr)_minmax(0,0.72fr)]">
            <input
              aria-label="Buscar movimientos"
              className="field-dark"
              onChange={(event) => updateTableFilter("description", event.target.value)}
              placeholder="Buscar por descripción, categoría o contraparte..."
              type="text"
              value={tableFilters.description}
            />
            <MovementDateFilter
              dateFrom={tableFilters.dateFrom}
              dateTo={tableFilters.dateTo}
              onChange={updateDateRange}
            />
            <SearchablePicker
              appearance="toolbar"
              emptyMessage="No hay estados para mostrar."
              onChange={(value) => updateTableFilter("status", value as MovementStatus | "all")}
              options={statusFilterPickerOptions}
              placeholderDescription="Filtra por estado del movimiento."
              placeholderLabel="Estado"
              queryPlaceholder="Buscar estado..."
              showSearch={false}
              value={tableFilters.status}
            />
            <SearchablePicker
              appearance="toolbar"
              emptyMessage="No hay tipos para mostrar."
              onChange={(value) => updateTableFilter("type", value as MovementType | "all")}
              options={typeFilterPickerOptions}
              placeholderDescription="Filtra por tipo de movimiento."
              placeholderLabel="Tipo"
              queryPlaceholder="Buscar tipo..."
              showSearch={false}
              value={tableFilters.type}
            />
        </section>

        <section aria-label="Resumen de movimientos filtrados" className="module-summary">
          <p className="mr-auto text-storm">
            Los <span className="font-medium text-ink">{filteredMovements.length}</span> del filtro
            <span className="ml-2 text-storm/70">· {activeDateLabel}</span>
          </p>
          <p
            className="text-storm"
            title="Suma los ingresos del período. Los traspasos entre tus cuentas no cuentan."
          >
            Entró <span className="font-medium text-ink">{formatCurrency(filteredTotals.income, snapshot.workspace.baseCurrencyCode)}</span>
          </p>
          <p
            className="text-storm"
            title="Suma los gastos del período. Los traspasos entre tus cuentas no cuentan."
          >
            Salió <span className="font-medium text-ink">{formatCurrency(filteredTotals.expense, snapshot.workspace.baseCurrencyCode)}</span>
          </p>
          <p
            className="text-right text-storm"
            title="Diferencia entre lo que entró y lo que salió en el período, sin contar traspasos."
          >
            Neto <span className="block font-medium text-ink sm:inline">{formatCurrency(filteredNet, snapshot.workspace.baseCurrencyCode)}</span>
          </p>
        </section>

        {errorMessage && !isEditorOpen ? (
        <DataState
          description={errorMessage}
          title="No pudimos completar la accion"
          tone="error"
        />
        ) : null}
        <section className="relative z-10">
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
          ) : (
            <MovementsTable
              allSelected={allSelected}
              baseCurrencyCode={snapshot.workspace.baseCurrencyCode}
              categories={movementCategories}
              counterparties={movementCounterparties}
              cv={cv}
              filters={tableFilters}
              movements={paginatedMovements}
              onApplyFilterAndClose={applyTableFilterAndClose}
              onClearAll={clearAll}
              onClearSingleFilter={clearSingleTableFilter}
              onCloseFilterMenu={closeTableFilterMenu}
              onOpen={openEditEditor}
              onSelectAll={selectAll}
              onToggleFilterMenu={toggleTableFilterMenu}
              onToggleSelect={toggleSelect}
              onUpdateFilter={updateTableFilter}
              openFilter={openTableFilter}
              someSelected={someSelected}
              selectedIds={selectedIds}
              sourceAccounts={movementSourceAccounts}
              visibleColumns={colVis}
            />
          )}

          <Pagination
            className="mt-5"
            onPageChange={setCurrentPage}
            page={safePage}
            pageSize={MOVEMENTS_PAGE_SIZE}
            totalItems={filteredMovements.length}
          />
        </section>

      </div>

      {isEditorOpen ? (
        <MovementEditorDialog
          accounts={snapshot.accounts}
          accessMessage={accessMessage}
          attachments={selectedMovementAttachments}
          baseCurrencyCode={snapshot.workspace.baseCurrencyCode}
          budgets={snapshot.budgets}
          canManageReceipts={canUploadReceipts}
          categories={snapshot.catalogs.categories}
          closeEditor={requestCloseEditor}
          counterparties={snapshot.catalogs.counterparties}
          errorMessage={errorMessage}
          exchangeRates={snapshot.exchangeRates}
          formState={formState}
          handleDeleteMovement={handleDeleteMovement}
          handleDuplicateMovement={handleDuplicateMovement}
          handleSaveTemplate={() => { void saveSelectedAsTemplate(); }}
          handleDeleteReceipt={handleDeleteReceipt}
          handleUploadReceipt={handleUploadReceipt}
          handleSubmit={handleSubmit}
          clearFieldError={clearFieldError}
          invalidFields={invalidFields}
          isCreateMode={editorMode === "create"}
          isSaving={isSaving}
          isSavingTemplate={templateMutations.create.isPending}
          isUploadingReceipt={isUploadingReceipt}
          obligations={snapshot.obligations}
          onErrorMessage={setErrorMessage}
          onDirty={() => setIsDirty(true)}
          onCategoryFeedback={setCategoryFeedbackIntent}
          onIntelligenceChange={setEditorIntelligence}
          pendingReceiptFile={pendingReceiptFile}
          proAccessEnabled={entitlementQuery.data?.proAccessEnabled}
          recurringIncome={snapshot.recurringIncome}
          movementHistory={snapshot.movements}
          selectedMovement={selectedMovement}
          subscriptions={snapshot.subscriptions}
          updatePendingReceiptFile={setPendingReceiptFile}
          updateFormState={updateFormState}
          workspaceId={activeWorkspace.id}
          userId={user?.id ?? ""}
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
