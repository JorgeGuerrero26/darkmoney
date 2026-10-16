import { Archive, Check, Download, MoreVertical, Plus, RefreshCw } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useResourceLink } from "../../../hooks/use-resource-link";

import { Button } from "../../../components/ui/button";
import {
  BulkActionBar,
  useSelection,
} from "../../../components/ui/bulk-action-bar";
import { type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { DataState } from "../../../components/ui/data-state";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { Modal, ModalFooter, ModalHeader } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { Pagination } from "../../../components/ui/pagination";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { formatCurrency } from "../../../lib/formatting/money";
import {
  getQueryErrorMessage,
  useArchiveAccountMutation,
  useCreateAccountMutation,
  useDeleteAccountMutation,
  useUpdateAccountMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import type { AccountSummary } from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { canWriteWorkspaceCatalog, useCatalogWriteScope } from "../../shared/use-catalog-write-scope";
import { requestQuickMovement } from "../../movements/lib/quick-movement-event";
import { AccountAnalyticsModal } from "../components/account-analytics-modal";
import { AccountArchiveDialog } from "../components/account-archive-dialog";
import { AccountEditorDialog } from "../components/account-editor-dialog";
import { AccountDetailDialog } from "../components/account-detail-dialog";
import { AccountComposition } from "../components/account-composition";
import { AccountsTable } from "../components/accounts-table";
import { AccountsToolbar } from "../components/accounts-toolbar";
import { useAccountEditor } from "../hooks/use-account-editor";
import { useAccountFilters } from "../hooks/use-account-filters";
import {
  ACCOUNT_PAGE_SIZE,
  filterAccounts,
  getAvailableAccountTypes,
  getAvailableCurrencyCodes,
  paginateAccounts,
} from "../lib/account-filters";
import { downloadAccountsCSV } from "../lib/account-formatters";
import { getAccountIcon, getTypePreset } from "../lib/account-options";
import { computeAccountWorth } from "../lib/account-worth";
import {
  getFirstAccountFormError,
  toAccountInput,
  validateAccountForm,
  type AccountFormErrors,
  type AccountFormField,
  type AccountFormState,
} from "../lib/account-validation";

const accountColumns: ColumnDef[] = [
  { key: "type", label: "Tipo" },
  { key: "balance", label: "Saldo actual" },
  { key: "currency", label: "Moneda" },
  { key: "status", label: "Estado" },
  { key: "activity", label: "Última actividad", defaultVisible: false },
];

function AccountsLoadingSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="h-48 animate-pulse rounded-[30px] border border-white/10 bg-white/[0.04]" />
      <div className="h-28 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.035]" />
      <div className="h-96 animate-pulse rounded-[24px] border border-white/10 bg-white/[0.03]" />
    </div>
  );
}

function AccountsModuleHeader({ actions, totalCount, visibleCount }: { actions?: ReactNode; totalCount?: number; visibleCount?: number }) {
  return (
    <section className="module-header">
      <div className="min-w-0 flex-1 basis-[15rem]">
        <h1 className="module-heading">Cuentas</h1>
        <p className="mt-1.5 text-sm leading-6 text-storm">
          {typeof visibleCount === "number" ? <><span className="text-ink">{visibleCount}</span> cuentas en esta vista</> : "Consulta tus saldos y disponibilidad."}
          {typeof totalCount === "number" && visibleCount !== totalCount ? <> · {totalCount} registradas</> : null}
        </p>
      </div>
      {actions}
    </section>
  );
}

function EmptyAccountsState({ onCreate, disabled }: { onCreate: () => void; disabled: boolean }) {
  return (
    <DataState
      action={<Button disabled={disabled} onClick={onCreate}>Crear primera cuenta</Button>}
      description="Registra una cuenta real para activar saldos, filtros, vistas y analitica por cuenta."
      title="Aun no hay cuentas"
    />
  );
}

function NoFilteredAccountsState({
  onReset,
  status,
}: {
  onReset: () => void;
  status: string;
}) {
  const isArchivedOnly = status === "archived";

  return (
    <DataState
      action={<Button onClick={onReset} variant="secondary">Limpiar filtros</Button>}
      description={
        isArchivedOnly
          ? "No hay cuentas archivadas con los filtros actuales."
          : "Prueba cambiando busqueda, tipo, estado o moneda."
      }
      title={isArchivedOnly ? "Sin cuentas archivadas" : "Sin resultados"}
    />
  );
}

export function AccountsPage() {
  const auth = useAuth(), workspace = useActiveWorkspace();
  return <ScopedAccountsPage key={`${auth.user?.id}:${workspace.activeWorkspace?.id}`} auth={auth} workspace={workspace} />;
}

function ScopedAccountsPage({ auth, workspace }: { auth: ReturnType<typeof useAuth>; workspace: ReturnType<typeof useActiveWorkspace> }) {
  const navigate = useNavigate();
  const { profile, user } = auth;
  const {
    activeWorkspace,
    error: workspaceError,
    isLoading: isWorkspacesLoading,
  } = workspace;
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = user && !snapshotQuery.isPlaceholderData && snapshotQuery.data?.workspace.id === activeWorkspace?.id ? snapshotQuery.data : undefined;
  const ready = Boolean(snapshot && snapshotQuery.isSuccess && !snapshotQuery.error && !snapshotQuery.isFetching && !isWorkspacesLoading && !workspaceError && !workspace.isFetching && !workspace.isPlaceholderData);
  const access = useCatalogWriteScope(activeWorkspace, user?.id, ready);
  const responseScope = useCatalogWriteScope(activeWorkspace, user?.id, true);
  const latestAccess = useRef(access); latestAccess.current = access;
  const permitted = canWriteWorkspaceCatalog(activeWorkspace, user?.id, true);
  const locks = useRef(new Set<number | "new" | "bulk">());
  const [busy, setBusy] = useState(false);
  const canAct = access.writable && !busy;
  const queued = useRef(new Set<string>());
  const pendingDeletes = useRef(new Set<number>());
  const currentRows = useRef<AccountSummary[]>([]);
  currentRows.current = (snapshot?.accounts ?? []).filter(account => account.workspaceId === activeWorkspace?.id);
  const baseCurrencyCode =
    snapshot?.workspace.baseCurrencyCode ??
    activeWorkspace?.baseCurrencyCode ??
    profile?.baseCurrencyCode ??
    "USD";

  const { filters, resetFilters, writeFilters } = useAccountFilters();
  const { visible: visibleColumns, toggle: toggleColumn } = useColumnVisibility(
    "columns-accounts",
    accountColumns,
  );
  const [formErrors, setFormErrors] = useState<AccountFormErrors>({});
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [analyticsAccountId, setAnalyticsAccountId] = useState<number | null>(null);
  const [detailAccountId, setDetailAccountId] = useState<number | null>(null);
  const [bulkMode, setBulkMode] = useState<"archive" | "restore" | null>(null);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const groupingKey = `darkmoney.accounts-group.v1.${encodeURIComponent(user?.id ?? "signed-out")}.${activeWorkspace?.id}`;
  const [groupByType, setGroupByType] = useState(() => { try { return Boolean(user && window.localStorage.getItem(groupingKey) === "true"); } catch { return false; } });
  const { schedule, cancel } = useUndoQueue();

  const accounts = useMemo(
    () => (snapshot?.accounts ?? []).filter((account) => account.workspaceId === activeWorkspace?.id && !hiddenIds.has(account.id)),
    [hiddenIds, snapshot?.accounts, activeWorkspace?.id],
  );
  const availableTypes = useMemo(() => getAvailableAccountTypes(accounts), [accounts]);
  useResourceLink(accounts, setDetailAccountId);
  const availableCurrencyCodes = useMemo(
    () => getAvailableCurrencyCodes(accounts),
    [accounts],
  );
  const filteredAccounts = useMemo(
    () => filterAccounts(accounts, filters),
    [accounts, filters],
  );
  const hasActiveFilters = Boolean(
    filters.q.trim() || filters.type || filters.currency || filters.status !== "active",
  );
  const filteredActiveAccounts = filteredAccounts.filter((account) => !account.isArchived);
  const filteredPatrimony = computeAccountWorth(
    filteredActiveAccounts.filter((account) => account.includeInNetWorth),
    baseCurrencyCode,
    baseCurrencyCode,
    snapshot?.exchangeRates ?? [],
  );
  const filteredExcludedCount = filteredActiveAccounts.filter((account) => !account.includeInNetWorth).length;
  const orderedFilteredAccounts = useMemo(
    () => groupByType
      ? [...filteredAccounts].sort((left, right) => getTypePreset(left.type).label.localeCompare(getTypePreset(right.type).label, "es") || left.name.localeCompare(right.name, "es"))
      : filteredAccounts,
    [filteredAccounts, groupByType],
  );
  const paginatedAccounts = useMemo(
    () => paginateAccounts(orderedFilteredAccounts, filters.page, ACCOUNT_PAGE_SIZE),
    [filters.page, orderedFilteredAccounts],
  );
  const archiveTarget =
    archiveTargetId !== null
      ? accounts.find((account) => account.id === archiveTargetId) ?? null
      : null;
  const analyticsAccount =
    analyticsAccountId !== null
      ? accounts.find((account) => account.id === analyticsAccountId) ?? null
      : null;
  const detailAccount =
    detailAccountId !== null
      ? accounts.find((account) => account.id === detailAccountId) ?? null
      : null;
  const editor = useAccountEditor({
    accounts,
    baseCurrencyCode,
    isLoadingWorkspace: !ready,
    userId: user?.id,
    workspaceId: activeWorkspace?.id,
  });

  const createAccountMutation = useCreateAccountMutation(activeWorkspace?.id, user?.id);
  const updateAccountMutation = useUpdateAccountMutation(activeWorkspace?.id, user?.id);
  const archiveAccountMutation = useArchiveAccountMutation(activeWorkspace?.id, user?.id);
  const deleteAccountMutation = useDeleteAccountMutation(activeWorkspace?.id, user?.id);
  const isSaving =
    createAccountMutation.isPending ||
    updateAccountMutation.isPending ||
    archiveAccountMutation.isPending ||
    deleteAccountMutation.isPending ||
    isBulkArchiving;
  const formDisabled = isSaving || busy || !access.writable;
  const movements = (snapshot?.movements ?? []).filter(item => item.workspaceId === activeWorkspace?.id);

  useEffect(() => () => { queued.current.forEach(id => cancel(id)); queued.current.clear(); }, [cancel]);
  useEffect(() => {
    if (!access.writable) { queued.current.forEach(id => cancel(id)); queued.current.clear(); }
  }, [access.writable, cancel]);
  useEffect(() => {
    if (!permitted) { editor.closeEditor(); editor.setShowUnsavedDialog(false); setArchiveTargetId(null); setShowDeleteDialog(false); setBulkMode(null); }
  }, [permitted]);

  function currentAccount(id: number) {
    access.assertCurrent();
    const account = currentRows.current.find(item => item.id === id);
    if (!account) throw new Error("La cuenta ya no está disponible en este espacio.");
    return account;
  }
  async function runWrite<T>(id: number | "new" | "bulk", action: () => Promise<T>) {
    access.assertCurrent();
    if (locks.current.size) throw new Error("Ya hay una operación de cuentas pendiente.");
    locks.current.add(id); setBusy(true);
    try { return await action(); } finally { locks.current.delete(id); setBusy(false); }
  }
  function exportAccounts(items: AccountSummary[], filename: string) {
    if (!ready) return;
    const ids = new Set(items.map(item => item.id));
    downloadAccountsCSV(currentRows.current.filter(item => ids.has(item.id)), filename);
  }

  const {
    allSelected,
    clearAll,
    selectedCount,
    selectedIds,
    selectedItems,
    selectAll,
    someSelected,
    toggle: toggleSelect,
  } = useSelection(filteredAccounts);

  useSuccessToast(feedbackMessage, {
    clear: () => setFeedbackMessage(""),
    title: "Cambios aplicados",
  });

  useEffect(() => {
    if (paginatedAccounts.page !== filters.page) {
      writeFilters({ page: paginatedAccounts.page });
    }
  }, [filters.page, paginatedAccounts.page, writeFilters]);

  useEffect(() => {
    if (
      editor.editorMode === "edit" &&
      editor.selectedAccountId !== null &&
      !editor.selectedAccount &&
      !snapshotQuery.isFetching
    ) {
      editor.closeEditor();
    }
  }, [
    editor,
    editor.editorMode,
    editor.selectedAccount,
    editor.selectedAccountId,
    snapshotQuery.isFetching,
  ]);

  function clearFormFieldError(field: AccountFormField) {
    setFormErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  function updateFormField<Field extends AccountFormField>(
    field: Field,
    value: AccountFormState[Field],
  ) {
    clearFormFieldError(field);
    editor.updateFormState(field, value);
  }

  function handleTypeChange(type: string) {
    clearFormFieldError("type");
    clearFormFieldError("color");
    clearFormFieldError("icon");
    editor.handleAccountTypeChange(type);
  }

  function openCreateEditor() {
    if (!canAct || !access.isCurrent()) return;
    setErrorMessage("");
    setFormErrors({});
    editor.openCreateEditor();
  }

  function openEditEditor(account: AccountSummary) {
    if (!canAct || !access.isCurrent()) return;
    const current = currentRows.current.find(item => item.id === account.id);
    if (!current) return;
    setErrorMessage("");
    setFormErrors({});
    editor.openEditEditor(current);
  }

  function requestCloseEditor() {
    if (isSaving || busy) {
      return;
    }

    editor.requestCloseEditor();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeWorkspace || !user || !access.isCurrent() || locks.current.size) {
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");

    const errors = validateAccountForm(editor.formState);

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setErrorMessage(getFirstAccountFormError(errors) || "Revisa los campos marcados.");
      return;
    }

    try {
      if (editor.editorMode === "create") {
        await runWrite("new", () => createAccountMutation.mutateAsync({
          ...toAccountInput(editor.formState),
          sortOrder: accounts.length + 1,
          userId: user.id,
          workspaceId: activeWorkspace.id,
        }));

        if (!responseScope.isCurrent()) return;
        editor.closeEditor();
        setFeedbackMessage("Cuenta creada correctamente.");
        return;
      }

      if (!editor.selectedAccount) {
        setErrorMessage("No encontramos la cuenta que quieres editar.");
        return;
      }

      const target = currentAccount(editor.selectedAccount.id);
      await runWrite(target.id, () => updateAccountMutation.mutateAsync({
        ...toAccountInput(editor.formState),
        accountId: target.id,
        userId: user.id,
        workspaceId: activeWorkspace.id,
      }));

      if (!responseScope.isCurrent()) return;
      editor.closeEditor();
      setFeedbackMessage("Cuenta actualizada correctamente.");
    } catch (error) {
      if (responseScope.isCurrent()) setErrorMessage(getQueryErrorMessage(error, "No pudimos guardar la cuenta."));
    }
  }

  function handleArchiveToggle(account: AccountSummary) {
    if (!activeWorkspace || !user || !canAct || !access.isCurrent() || !currentRows.current.some(item => item.id === account.id)) {
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");
    setArchiveTargetId(account.id);
  }

  async function handleConfirmArchiveToggle() {
    if (!activeWorkspace || !user || !archiveTarget || !access.isCurrent() || locks.current.size) {
      return;
    }

    const nextArchivedValue = !archiveTarget.isArchived;

    try {
      const target = currentAccount(archiveTarget.id);
      await runWrite(target.id, () => archiveAccountMutation.mutateAsync({
        accountId: target.id,
        isArchived: nextArchivedValue,
        userId: user.id,
        workspaceId: activeWorkspace.id,
      }));

      if (!responseScope.isCurrent()) return;
      setArchiveTargetId(null);
      setFeedbackMessage(
        nextArchivedValue ? "Cuenta archivada correctamente." : "Cuenta reactivada correctamente.",
      );
    } catch (error) {
      if (responseScope.isCurrent()) setErrorMessage(getQueryErrorMessage(error, "No pudimos actualizar la cuenta."));
    }
  }

  function handleDeleteAccount() {
    if (!activeWorkspace || !editor.selectedAccount?.isArchived || !canAct || !access.isCurrent()) {
      return;
    }

    setShowDeleteDialog(true);
  }

  function handleConfirmDeleteAccount() {
    if (!activeWorkspace || !editor.selectedAccount || !canAct || !access.isCurrent()) {
      return;
    }

    const targetId = editor.selectedAccount.id;
    const workspaceId = activeWorkspace.id;
    const target = currentRows.current.find(item => item.id === targetId);
    if (!target?.isArchived || pendingDeletes.current.has(targetId)) return;
    pendingDeletes.current.add(targetId);

    setShowDeleteDialog(false);
    editor.closeEditor();
    setHiddenIds((currentIds) => new Set([...currentIds, targetId]));
    let resolved = false;
    const restore = () => setHiddenIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.delete(targetId);
          return nextIds;
    });
    const queueId = schedule({
      label: "Cuenta pendiente de eliminar",
      onCommit: async () => {
        if (resolved) return;
        resolved = true; queued.current.delete(queueId); pendingDeletes.current.delete(targetId);
        if (!access.isCurrent()) { restore(); return; }
        try {
          if (!currentAccount(targetId).isArchived) throw new Error("La cuenta fue reactivada. No se eliminó.");
          await runWrite(targetId, () => deleteAccountMutation.mutateAsync({ accountId: targetId, workspaceId }));
          if (responseScope.isCurrent()) setFeedbackMessage("Cuenta eliminada.");
        } catch (error) {
          restore();
          if (responseScope.isCurrent()) setErrorMessage(getQueryErrorMessage(error, "No pudimos confirmar la eliminación. Actualiza y comprueba la cuenta."));
        }
      },
      onUndo: () => {
        if (resolved) return;
        resolved = true; queued.current.delete(queueId); pendingDeletes.current.delete(targetId); restore();
      },
    });
    queued.current.add(queueId);
  }

  async function confirmBulkArchive() {
    if (!activeWorkspace || !user || selectedCount === 0 || !bulkMode || !access.isCurrent() || locks.current.size) {
      return;
    }

    const archived = bulkMode === "archive";
    const targets = selectedItems.filter(item => item.isArchived !== archived).map(item => item.id);
    setIsBulkArchiving(true);
    setErrorMessage("");

    try {
      await runWrite("bulk", async () => { for (const accountId of targets) {
        responseScope.assertCurrent(); latestAccess.current.assertCurrent();
        const current = currentRows.current.find(item => item.id === accountId);
        if (!current) throw new Error("Una cuenta seleccionada ya no está disponible. Comprueba las anteriores.");
        if (current.isArchived === archived) continue;
        await archiveAccountMutation.mutateAsync({
          accountId,
          isArchived: archived,
          userId: user.id,
          workspaceId: activeWorkspace.id,
        });
      } });
      if (!responseScope.isCurrent()) return;
      clearAll();
      setBulkMode(null);
      setFeedbackMessage(archived ? "Archivado de la selección completado." : "Restauración de la selección completada.");
    } catch (error) {
      if (responseScope.isCurrent()) { setBulkMode(null); setErrorMessage(`${getQueryErrorMessage(error, "No pudimos completar la selección.")} Puede haberse aplicado una parte; actualiza y comprueba antes de repetir.`); }
    } finally {
      setIsBulkArchiving(false);
    }
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <AccountsModuleHeader />
        <DataState
          description={getQueryErrorMessage(workspaceError, "No pudimos leer tus workspaces reales.")}
          title="No hay acceso al workspace"
          tone="error"
        />
      </div>
    );
  }

  if (!activeWorkspace && !isWorkspacesLoading) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <AccountsModuleHeader />
        <DataState
          description="Cuando exista un workspace personal o compartido, aqui veras solo las cuentas reales de la base."
          title="Sin workspace activo"
        />
      </div>
    );
  }

  if (!snapshot && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <AccountsModuleHeader />
        <AccountsLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error || !snapshot) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <AccountsModuleHeader />
        <DataState
          description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer la informacion de cuentas.")}
          title="Error al consultar cuentas"
          tone="error"
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6 pb-8">
        <AccountsModuleHeader
          actions={
            <div className="flex shrink-0 items-center gap-2">
              <Button disabled={!canAct} onClick={openCreateEditor}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva cuenta
              </Button>
              <div className="relative">
                <button
                  aria-expanded={isActionsMenuOpen}
                  aria-label="Más opciones de cuentas"
                  className="grid h-9 w-9 place-items-center rounded-[7px] border border-white/[0.08] text-storm transition hover:bg-white/[0.04] hover:text-ink"
                  onClick={() => setIsActionsMenuOpen((current) => !current)}
                  type="button"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {isActionsMenuOpen ? (
                  <>
                    <button aria-label="Cerrar opciones" className="fixed inset-0 z-40 cursor-default" onClick={() => setIsActionsMenuOpen(false)} type="button" />
                    <div className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-[9px] border border-white/[0.1] bg-[#1a1917]">
                      <p className="px-4 pb-2 pt-4 font-public-mono text-[10px] uppercase tracking-[0.16em] text-storm">Columnas visibles</p>
                      {accountColumns.map((column) => (
                        <button
                          aria-checked={visibleColumns[column.key]}
                          className={`flex h-9 w-full items-center gap-3 px-4 text-left text-sm transition hover:bg-white/[0.05] ${visibleColumns[column.key] ? "bg-white/[0.035] text-ink" : "text-storm"}`}
                          key={column.key}
                          onClick={() => toggleColumn(column.key)}
                          role="menuitemcheckbox"
                          type="button"
                        >
                          <Check className={`h-3.5 w-3.5 ${visibleColumns[column.key] ? "text-[#d6b69b] opacity-100" : "opacity-0"}`} />
                          {column.label}
                        </button>
                      ))}
                      <button className="flex h-11 w-full items-center gap-3 border-t border-white/[0.08] px-4 text-left text-sm text-storm hover:bg-white/[0.04] hover:text-ink" onClick={() => { void snapshotQuery.refetch(); setIsActionsMenuOpen(false); }} type="button">
                        <RefreshCw className={`h-4 w-4 ${snapshotQuery.isFetching ? "animate-spin" : ""}`} />Actualizar
                      </button>
                      <button className="flex h-11 w-full items-center gap-3 border-t border-white/[0.08] px-4 text-left text-sm text-storm hover:bg-white/[0.04] hover:text-ink" onClick={() => { const next = !groupByType; setGroupByType(next); try { if (user) window.localStorage.setItem(groupingKey, String(next)); } catch { /* Keep the preference in memory if storage is blocked. */ } setIsActionsMenuOpen(false); }} type="button">
                        <Check className={`h-3.5 w-3.5 ${groupByType ? "opacity-100" : "opacity-0"}`} />Agrupar por tipo
                      </button>
                      {hasActiveFilters ? (
                        <button className="flex h-11 w-full items-center border-t border-white/[0.08] px-4 text-left text-sm text-storm hover:bg-white/[0.04] hover:text-ink" onClick={() => { resetFilters(); setIsActionsMenuOpen(false); }} type="button">Limpiar filtros</button>
                      ) : null}
                      <button className="flex h-11 w-full items-center gap-3 border-t border-white/[0.08] px-4 text-left text-sm font-medium text-ink hover:bg-white/[0.04] disabled:text-storm/45" disabled={!ready || !filteredAccounts.length} onClick={() => { exportAccounts(filteredAccounts, `cuentas-${new Date().toISOString().slice(0, 10)}.csv`); setIsActionsMenuOpen(false); }} type="button">
                        <Download className="h-4 w-4" />Exportar las {filteredAccounts.length}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          }
          totalCount={accounts.length}
          visibleCount={filteredAccounts.length}
        />

        {!permitted ? <p className="text-sm text-storm">{activeWorkspace?.isArchived ? "Este espacio está archivado. Puedes consultar y exportar, pero no modificar cuentas." : "Tienes acceso de solo lectura. Puedes consultar y exportar las cuentas."}</p> : !ready ? <p className="text-sm text-storm">Comprobando datos y permisos; espera antes de modificar o exportar.</p> : null}

        <AccountsToolbar
          availableCurrencyCodes={availableCurrencyCodes}
          availableTypes={availableTypes}
          filters={filters}
          onUpdateFilters={writeFilters}
        />

        <section aria-label="Resumen de cuentas filtradas" className="module-summary">
          <p className="mr-auto text-storm">Las <span className="font-medium text-ink">{filteredAccounts.length}</span> del filtro</p>
          <p className="text-storm">Patrimonio <span className="font-medium text-ink">{filteredPatrimony.signedNetWorth == null ? "Por comprobar" : formatCurrency(filteredPatrimony.signedNetWorth, baseCurrencyCode)}</span></p>
          {!filteredPatrimony.available ? <p className="text-storm">{filteredPatrimony.missingAccountIds.length} sin saldo o conversión verificable</p> : null}
          {filteredActiveAccounts.length !== filteredAccounts.length ? <p className="text-storm">Activas <span className="font-medium text-ink">{filteredActiveAccounts.length}</span></p> : null}
          {filteredExcludedCount > 0 ? <p className="text-storm">Fuera de patrimonio <span className="font-medium text-ink">{filteredExcludedCount}</span></p> : null}
        </section>

        <AccountComposition
          accounts={accounts}
          baseCurrencyCode={baseCurrencyCode}
          exchangeRates={snapshot.exchangeRates}
          preferenceKey={`${groupingKey}.currency`}
        />

        {errorMessage && !editor.isEditorOpen ? (
          <FormFeedbackBanner
            description={errorMessage}
            onDismiss={() => setErrorMessage("")}
            title="No pudimos completar la accion"
            tone="error"
          />
        ) : null}

        {accounts.length === 0 ? (
          <EmptyAccountsState disabled={!canAct} onCreate={openCreateEditor} />
        ) : filteredAccounts.length === 0 ? (
          <NoFilteredAccountsState onReset={resetFilters} status={filters.status} />
        ) : (
          <div className="space-y-4">
            <AccountsTable
                accounts={paginatedAccounts.items}
                allSelected={allSelected}
                groupByType={groupByType}
                canWrite={canAct}
                canAnalyze={ready}
                onArchive={handleArchiveToggle}
                onEdit={openEditEditor}
                onOpenAnalytics={(account) => { if (ready) setAnalyticsAccountId(account.id); }}
                onOpen={(account) => setDetailAccountId(account.id)}
                onSelectAll={() => (allSelected ? clearAll() : selectAll())}
                onToggleSelect={toggleSelect}
                selectedIds={selectedIds}
                someSelected={someSelected}
                visibleColumns={visibleColumns}
              />

            <Pagination
              className="mt-5"
              onPageChange={(page) => writeFilters({ page })}
              page={paginatedAccounts.page}
              pageSize={ACCOUNT_PAGE_SIZE}
              totalItems={filteredAccounts.length}
            />
          </div>
        )}
      </div>

      {editor.isEditorOpen && permitted ? (
        <AccountEditorDialog
          baseCurrencyCode={baseCurrencyCode}
          errorMessage={errorMessage}
          formErrors={formErrors}
          formState={editor.formState}
          isCreateMode={editor.editorMode === "create"}
          isSaving={formDisabled}
          onArchiveToggle={handleArchiveToggle}
          onClose={requestCloseEditor}
          onDelete={handleDeleteAccount}
          onFieldChange={updateFormField}
          onSubmit={handleSubmit}
          onTypeChange={handleTypeChange}
          selectedAccount={editor.selectedAccount}
        />
      ) : null}

      {detailAccount && ready ? (
        <AccountDetailDialog
          account={detailAccount}
          movements={movements}
          canWrite={canAct}
          onCreateMovement={(kind) => {
            if (!canAct || !access.isCurrent()) return;
            const current = currentRows.current.find(item => item.id === detailAccount.id);
            if (!current || current.isArchived) return;
            setDetailAccountId(null);
            requestQuickMovement({ kind, accountId: current.id });
          }}
          onAnalyze={() => {
            setDetailAccountId(null);
            setAnalyticsAccountId(detailAccount.id);
          }}
          onArchive={() => {
            setDetailAccountId(null);
            handleArchiveToggle(detailAccount);
          }}
          onClose={() => setDetailAccountId(null)}
          onEdit={() => {
            setDetailAccountId(null);
            openEditEditor(detailAccount);
          }}
          onViewMovements={() => navigate(`/app/movements?account=${encodeURIComponent(detailAccount.name)}&period=all`)}
        />
      ) : null}

      {editor.showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => {
            editor.setShowUnsavedDialog(false);
            editor.closeEditor();
          }}
          onKeepEditing={() => editor.setShowUnsavedDialog(false)}
        />
      ) : null}

      {archiveTarget && permitted ? (
        <AccountArchiveDialog
          account={archiveTarget}
          isSaving={formDisabled}
          onCancel={() => {
            if (!archiveAccountMutation.isPending) {
              setArchiveTargetId(null);
            }
          }}
          onConfirm={() => void handleConfirmArchiveToggle()}
        />
      ) : null}

      {showDeleteDialog && editor.selectedAccount && permitted ? (
        <DeleteConfirmDialog
          badge="Eliminar cuenta"
          description="Esto elimina la cuenta permanentemente. Si tiene movimientos vinculados, primero tendras que resolverlos."
          isDeleting={formDisabled}
          onCancel={() => {
            if (!deleteAccountMutation.isPending) {
              setShowDeleteDialog(false);
            }
          }}
          onConfirm={handleConfirmDeleteAccount}
        >
          {(() => {
            const account = editor.selectedAccount;
            const AccountIcon = getAccountIcon(account.icon, account.type);

            return (
              <div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-white/10 text-white"
                    style={{ backgroundColor: account.color }}
                  >
                    <AccountIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-ink">{account.name}</p>
                    <p className="mt-0.5 text-sm text-storm">
                      {getTypePreset(account.type).label} - {account.currencyCode}
                    </p>
                  </div>
                </div>
                <p className="mt-4 font-display text-2xl font-semibold text-ink">
                  {formatCurrency(account.currentBalance, account.currencyCode)}
                </p>
              </div>
            );
          })()}
        </DeleteConfirmDialog>
      ) : null}

      {analyticsAccount && ready ? (
        <AccountAnalyticsModal
          account={analyticsAccount}
          movements={movements}
          onClose={() => setAnalyticsAccountId(null)}
        />
      ) : null}

      <BulkActionBar
        archiveLabel="Archivar activas"
        deleteLabel="Restaurar archivadas"
        deletingLabel="Procesando..."
        isArchiving={formDisabled}
        isDeleting={formDisabled}
        onClearAll={clearAll}
        onArchive={permitted && selectedItems.some(item => !item.isArchived) ? () => { if (canAct && access.isCurrent()) setBulkMode("archive"); } : undefined}
        onDelete={permitted && selectedItems.some(item => item.isArchived) ? () => { if (canAct && access.isCurrent()) setBulkMode("restore"); } : undefined}
        onExport={ready ? () =>
          exportAccounts(
            selectedItems,
            `cuentas-seleccionadas-${new Date().toISOString().slice(0, 10)}.csv`,
          ) : undefined}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredAccounts.length}
      />

      {bulkMode && permitted ? (
        <Modal
          disableOutsideClose={isBulkArchiving}
          labelledBy="accounts-bulk-archive-title"
          onClose={() => {
            if (!isBulkArchiving) {
              setBulkMode(null);
            }
          }}
          size="sm"
        >
          <ModalHeader
            description="Se intentará cambiar solo las cuentas que correspondan. Si una falla, las anteriores pueden haberse guardado."
            onClose={isBulkArchiving ? undefined : () => setBulkMode(null)}
            title={bulkMode === "archive" ? "Archivar cuentas activas" : "Restaurar cuentas archivadas"}
            titleId="accounts-bulk-archive-title"
          />
          <ModalBody>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-gold/20 bg-gold/10 text-gold">
                  <Archive className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-ink">Accion reversible</p>
                  <p className="mt-1 text-sm leading-6 text-storm">
                    {bulkMode === "archive" ? "Se archivarán las cuentas activas de la selección." : "Se restaurarán las cuentas archivadas de la selección."}
                  </p>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              disabled={isBulkArchiving}
              onClick={() => setBulkMode(null)}
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button disabled={formDisabled} onClick={() => void confirmBulkArchive()}>
              <Archive className="h-4 w-4" />
              {isBulkArchiving ? "Procesando..." : bulkMode === "archive" ? "Archivar" : "Restaurar"}
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </>
  );
}
