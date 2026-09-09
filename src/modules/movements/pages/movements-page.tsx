import {
  Download,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Pagination } from "../../../components/ui/pagination";
import { DataState } from "../../../components/ui/data-state";
import { formatCurrency } from "../../../lib/formatting/money";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { InfoTip } from "../../../components/ui/info-tip";
import { PageHeader } from "../../../components/ui/page-header";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { ColumnPicker, type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
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
  useUpdateMovementMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";

import { MovementEditorDialog } from "../components/movement-editor-dialog";
import { MovementsList } from "../components/movements-list";
import { MovementsGrid } from "../components/movements-grid";
import { MovementsTable } from "../components/movements-table";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import {
  buildFormStateFromMovement,
  createDefaultMovementFormState,
  downloadMovementsCSV,
  expenseLikeMovementTypes,
  getMovementDisplayInfo,
  incomeLikeMovementTypes,
  movementStatusOptions,
  movementTypeOptions,
  parseMetadataValue,
  parseOptionalInteger,
  parseOptionalNumber,
} from "../lib/movement-form";
import type {
  MovementEditorMode,
  MovementFormState,
} from "../lib/movement-form";
import { useMovementTableFilters } from "../hooks/use-movement-table-filters";

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
  ...movementTypeOptions.map((option) => ({
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
  const {
    tableFilters,
    currentPage,
    setCurrentPage,
    openTableFilter,
    updateTableFilter,
    clearTableFilters,
    toggleTableFilterMenu,
    closeTableFilterMenu,
    clearSingleTableFilter,
    applyTableFilterAndClose,
  } = useMovementTableFilters(viewMode);

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
  const filteredTotals = filteredMovements.reduce(
    (totals, movement) => {
      if (incomeLikeMovementTypes.has(movement.movementType)) {
        totals.income += movement.destinationAmountInBaseCurrency ?? movement.destinationAmount ?? movement.sourceAmountInBaseCurrency ?? movement.sourceAmount ?? 0;
      } else if (expenseLikeMovementTypes.has(movement.movementType)) {
        totals.expense += movement.sourceAmountInBaseCurrency ?? movement.sourceAmount ?? movement.destinationAmountInBaseCurrency ?? movement.destinationAmount ?? 0;
      }
      return totals;
    },
    { income: 0, expense: 0 },
  );
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
          <p className="font-public-mono text-[10px] uppercase tracking-[0.2em] text-storm">Actividad</p>
          <div className="mt-1 flex items-center gap-2.5">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">
              Movimientos
            </h2>
            <InfoTip ariaLabel="Sobre el libro de movimientos">
              Entra directo a tus registros, revisa el estado de cada movimiento y filtra por columna
              cuando necesites encontrar algo puntual. La tabla manda; el resumen solo acompaña.
            </InfoTip>
          </div>
          <p className="mt-1 text-sm text-storm">
            <span className="text-ink">{snapshot.movements.length}</span> registrados; <span className="text-ink">{transferCount}</span> son traspasos entre tus cuentas y no cuentan como gasto.
          </p>
        </section>

        {/* Toolbar sticky (estándar de cuentas) */}
        <section className="sticky top-[64px] z-30 rounded-[9px] border border-white/[0.08] bg-[#141312]/95 p-3 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            <ViewSelector available={["table"]} onChange={setViewMode} value={viewMode} />
            {viewMode === "table" ? (
              <ColumnPicker columns={movementColumns} visible={colVis} onToggle={toggleCol} />
            ) : null}
            <div className="ml-auto flex flex-wrap items-center gap-2">
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
            </div>
          </div>

          {/* Filtros principales: siempre visibles (aplican a todas las vistas) */}
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <input
              className="field-dark"
              onChange={(event) => updateTableFilter("description", event.target.value)}
              placeholder="Buscar por descripcion, categoria o contraparte..."
              type="text"
              value={tableFilters.description}
            />
            <SearchablePicker
              emptyMessage="No hay estados para mostrar."
              onChange={(value) => updateTableFilter("status", value as MovementStatus | "all")}
              options={statusFilterPickerOptions}
              placeholderDescription="Filtra por estado del movimiento."
              placeholderLabel="Estado"
              queryPlaceholder="Buscar estado..."
              value={tableFilters.status}
            />
            <SearchablePicker
              emptyMessage="No hay tipos para mostrar."
              onChange={(value) => updateTableFilter("type", value as MovementType | "all")}
              options={typeFilterPickerOptions}
              placeholderDescription="Filtra por tipo de movimiento."
              placeholderLabel="Tipo"
              queryPlaceholder="Buscar tipo..."
              value={tableFilters.type}
            />
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-white/[0.07] py-3 text-sm">
          <p className="mr-auto text-storm"><span className="font-medium text-ink">{filteredMovements.length}</span> movimientos en esta vista</p>
          <p className="text-storm">Entró <span className="font-medium text-pine">{formatCurrency(filteredTotals.income, snapshot.workspace.baseCurrencyCode)}</span></p>
          <p className="text-storm">Salió <span className="font-medium text-ink">{formatCurrency(filteredTotals.expense, snapshot.workspace.baseCurrencyCode)}</span></p>
          <p className="font-medium text-ink">Neto {formatCurrency(filteredTotals.income - filteredTotals.expense, snapshot.workspace.baseCurrencyCode)}</p>
        </section>

        {errorMessage && !isEditorOpen ? (
        <DataState
          description={errorMessage}
          title="No pudimos completar la accion"
          tone="error"
        />
      ) : null}
        <SurfaceCard
          className="relative z-10"
          title="Movimientos registrados"
          titleAccessory={
            <InfoTip ariaLabel="Sobre la lista de movimientos">
              Abre cualquier movimiento para editarlo o revisarlo. Los filtros de la barra superior
              aplican a todas las vistas.
            </InfoTip>
          }
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
            <MovementsList
              baseCurrencyCode={snapshot.workspace.baseCurrencyCode}
              movements={paginatedMovements}
              onOpen={openEditEditor}
              onToggleSelect={toggleSelect}
              selectedIds={selectedIds}
            />
          ) : viewMode === "grid" ? (
            <MovementsGrid
              baseCurrencyCode={snapshot.workspace.baseCurrencyCode}
              movements={paginatedMovements}
              onOpen={openEditEditor}
              onToggleSelect={toggleSelect}
              selectedIds={selectedIds}
            />
          ) : viewMode === "table" ? (
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
            />
          ) : null}

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
