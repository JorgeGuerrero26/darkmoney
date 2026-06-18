import { Archive } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import {
  BulkActionBar,
  useSelection,
} from "../../../components/ui/bulk-action-bar";
import { type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { DataState } from "../../../components/ui/data-state";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { InfoTip } from "../../../components/ui/info-tip";
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
import { AccountAnalyticsModal } from "../components/account-analytics-modal";
import { AccountArchiveDialog } from "../components/account-archive-dialog";
import { AccountEditorDialog } from "../components/account-editor-dialog";
import { AccountSummaryStrip } from "../components/account-summary-strip";
import { AccountsGrid } from "../components/accounts-grid";
import { AccountsList } from "../components/accounts-list";
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
  { key: "activity", label: "Ultima actividad", defaultVisible: false },
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

function AccountsModuleHeader() {
  return (
    <section className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine/80">Cuentas</p>
      <div className="mt-1 flex items-center gap-2.5">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">
          Cuentas
        </h1>
        <InfoTip title="Objetivo del modulo">
          Inventario operativo para saber donde esta tu dinero, que suma al patrimonio y que
          requiere orden antes de tomar decisiones. Administra saldos, monedas, archivo e impacto
          patrimonial desde una vista pensada para operar rapido y revisar con contexto.
        </InfoTip>
      </div>
      <p className="mt-1 text-xs text-storm">Saldos, monedas, archivo e impacto patrimonial en un solo lugar.</p>
    </section>
  );
}

function EmptyAccountsState({ onCreate }: { onCreate: () => void }) {
  return (
    <DataState
      action={<Button onClick={onCreate}>Crear primera cuenta</Button>}
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
  const { profile, user } = useAuth();
  const {
    activeWorkspace,
    error: workspaceError,
    isLoading: isWorkspacesLoading,
  } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = snapshotQuery.data;
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
  const [showBulkArchiveConfirm, setShowBulkArchiveConfirm] = useState(false);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [openTableFilter, setOpenTableFilter] = useState<"q" | "type" | "currency" | "status" | null>(null);
  const { schedule } = useUndoQueue();

  const accounts = useMemo(
    () => (snapshot?.accounts ?? []).filter((account) => !hiddenIds.has(account.id)),
    [hiddenIds, snapshot?.accounts],
  );
  const availableTypes = useMemo(() => getAvailableAccountTypes(accounts), [accounts]);
  const availableCurrencyCodes = useMemo(
    () => getAvailableCurrencyCodes(accounts),
    [accounts],
  );
  const filteredAccounts = useMemo(
    () => filterAccounts(accounts, filters),
    [accounts, filters],
  );
  const paginatedAccounts = useMemo(
    () => paginateAccounts(filteredAccounts, filters.page, ACCOUNT_PAGE_SIZE),
    [filteredAccounts, filters.page],
  );
  const archiveTarget =
    archiveTargetId !== null
      ? accounts.find((account) => account.id === archiveTargetId) ?? null
      : null;
  const analyticsAccount =
    analyticsAccountId !== null
      ? accounts.find((account) => account.id === analyticsAccountId) ?? null
      : null;
  const editor = useAccountEditor({
    accounts,
    baseCurrencyCode,
    isLoadingWorkspace: isWorkspacesLoading,
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
    setErrorMessage("");
    setFormErrors({});
    editor.openCreateEditor();
  }

  function openEditEditor(account: AccountSummary) {
    setErrorMessage("");
    setFormErrors({});
    editor.openEditEditor(account);
  }

  function requestCloseEditor() {
    if (isSaving) {
      return;
    }

    editor.requestCloseEditor();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeWorkspace || !user) {
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
        await createAccountMutation.mutateAsync({
          ...toAccountInput(editor.formState),
          sortOrder: (snapshot?.accounts.length ?? 0) + 1,
          userId: user.id,
          workspaceId: activeWorkspace.id,
        });

        editor.closeEditor();
        setFeedbackMessage("Cuenta creada correctamente.");
        return;
      }

      if (!editor.selectedAccount) {
        setErrorMessage("No encontramos la cuenta que quieres editar.");
        return;
      }

      await updateAccountMutation.mutateAsync({
        ...toAccountInput(editor.formState),
        accountId: editor.selectedAccount.id,
        userId: user.id,
        workspaceId: activeWorkspace.id,
      });

      editor.closeEditor();
      setFeedbackMessage("Cuenta actualizada correctamente.");
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos guardar la cuenta."));
    }
  }

  function handleArchiveToggle(account: AccountSummary) {
    if (!activeWorkspace || !user) {
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");
    setArchiveTargetId(account.id);
  }

  async function handleConfirmArchiveToggle() {
    if (!activeWorkspace || !user || !archiveTarget) {
      return;
    }

    const nextArchivedValue = !archiveTarget.isArchived;

    try {
      await archiveAccountMutation.mutateAsync({
        accountId: archiveTarget.id,
        isArchived: nextArchivedValue,
        userId: user.id,
        workspaceId: activeWorkspace.id,
      });

      setArchiveTargetId(null);
      setFeedbackMessage(
        nextArchivedValue ? "Cuenta archivada correctamente." : "Cuenta reactivada correctamente.",
      );
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos actualizar la cuenta."));
    }
  }

  function handleDeleteAccount() {
    if (!activeWorkspace || !editor.selectedAccount) {
      return;
    }

    setShowDeleteDialog(true);
  }

  function handleConfirmDeleteAccount() {
    if (!activeWorkspace || !editor.selectedAccount) {
      return;
    }

    const targetId = editor.selectedAccount.id;
    const workspaceId = activeWorkspace.id;

    setShowDeleteDialog(false);
    editor.closeEditor();
    setHiddenIds((currentIds) => new Set([...currentIds, targetId]));
    schedule({
      label: "Cuenta eliminada permanentemente",
      onCommit: () => deleteAccountMutation.mutateAsync({ accountId: targetId, workspaceId }),
      onUndo: () => {
        setHiddenIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.delete(targetId);
          return nextIds;
        });
      },
    });
  }

  async function confirmBulkArchive() {
    if (!activeWorkspace || !user || selectedCount === 0) {
      return;
    }

    setIsBulkArchiving(true);
    setErrorMessage("");

    try {
      for (const accountId of selectedIds) {
        await archiveAccountMutation.mutateAsync({
          accountId,
          isArchived: true,
          userId: user.id,
          workspaceId: activeWorkspace.id,
        });
      }
      clearAll();
      setShowBulkArchiveConfirm(false);
      setFeedbackMessage("Cuentas archivadas correctamente.");
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos archivar las cuentas."));
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
        <AccountsModuleHeader />

        <AccountSummaryStrip
          accounts={accounts}
          baseCurrencyCode={baseCurrencyCode}
          isFetching={snapshotQuery.isFetching}
          workspaceKind={snapshot.workspace.kind}
        />

        <AccountsToolbar
          availableCurrencyCodes={availableCurrencyCodes}
          availableTypes={availableTypes}
          canExport={filteredAccounts.length > 0}
          columns={accountColumns}
          filteredCount={filteredAccounts.length}
          filters={filters}
          isFetching={snapshotQuery.isFetching}
          onCreate={openCreateEditor}
          onExport={() =>
            downloadAccountsCSV(
              filteredAccounts,
              `cuentas-${new Date().toISOString().slice(0, 10)}.csv`,
            )
          }
          onRefresh={() => void snapshotQuery.refetch()}
          onResetFilters={resetFilters}
          onToggleColumn={toggleColumn}
          onUpdateFilters={writeFilters}
          totalCount={accounts.length}
          visibleColumns={visibleColumns}
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
          <EmptyAccountsState onCreate={openCreateEditor} />
        ) : filteredAccounts.length === 0 ? (
          <NoFilteredAccountsState onReset={resetFilters} status={filters.status} />
        ) : (
          <div className="space-y-4">
            {filters.view === "table" ? (
              <AccountsTable
                accounts={paginatedAccounts.items}
                allSelected={allSelected}
                availableCurrencyCodes={availableCurrencyCodes}
                availableTypes={availableTypes}
                filters={filters}
                onArchive={handleArchiveToggle}
                onCloseFilterMenu={() => setOpenTableFilter(null)}
                onEdit={openEditEditor}
                onOpenAnalytics={(account) => setAnalyticsAccountId(account.id)}
                onSelectAll={() => (allSelected ? clearAll() : selectAll())}
                onToggleFilterMenu={(field) => setOpenTableFilter((current) => (current === field ? null : field))}
                onToggleSelect={toggleSelect}
                onUpdateFilters={writeFilters}
                openFilter={openTableFilter}
                selectedIds={selectedIds}
                someSelected={someSelected}
                visibleColumns={visibleColumns}
              />
            ) : filters.view === "list" ? (
              <AccountsList
                accounts={paginatedAccounts.items}
                onArchive={handleArchiveToggle}
                onEdit={openEditEditor}
                onOpenAnalytics={(account) => setAnalyticsAccountId(account.id)}
                onToggleSelect={toggleSelect}
                selectedCount={selectedCount}
                selectedIds={selectedIds}
              />
            ) : (
              <AccountsGrid
                accounts={paginatedAccounts.items}
                onArchive={handleArchiveToggle}
                onEdit={openEditEditor}
                onOpenAnalytics={(account) => setAnalyticsAccountId(account.id)}
                onToggleSelect={toggleSelect}
                selectedCount={selectedCount}
                selectedIds={selectedIds}
              />
            )}

            <Pagination
              className="glass-panel-soft rounded-[24px] px-4 py-3"
              onPageChange={(page) => writeFilters({ page })}
              page={paginatedAccounts.page}
              pageSize={ACCOUNT_PAGE_SIZE}
              totalItems={filteredAccounts.length}
            />
          </div>
        )}
      </div>

      {editor.isEditorOpen ? (
        <AccountEditorDialog
          baseCurrencyCode={baseCurrencyCode}
          errorMessage={errorMessage}
          formErrors={formErrors}
          formState={editor.formState}
          isCreateMode={editor.editorMode === "create"}
          isSaving={isSaving}
          onArchiveToggle={handleArchiveToggle}
          onClose={requestCloseEditor}
          onDelete={handleDeleteAccount}
          onFieldChange={updateFormField}
          onSubmit={handleSubmit}
          onTypeChange={handleTypeChange}
          selectedAccount={editor.selectedAccount}
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

      {archiveTarget ? (
        <AccountArchiveDialog
          account={archiveTarget}
          isSaving={archiveAccountMutation.isPending}
          onCancel={() => {
            if (!archiveAccountMutation.isPending) {
              setArchiveTargetId(null);
            }
          }}
          onConfirm={() => void handleConfirmArchiveToggle()}
        />
      ) : null}

      {showDeleteDialog && editor.selectedAccount ? (
        <DeleteConfirmDialog
          badge="Eliminar cuenta"
          description="Esto elimina la cuenta permanentemente. Si tiene movimientos vinculados, primero tendras que resolverlos."
          isDeleting={deleteAccountMutation.isPending}
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

      {analyticsAccount ? (
        <AccountAnalyticsModal
          account={analyticsAccount}
          movements={snapshot.movements}
          onClose={() => setAnalyticsAccountId(null)}
        />
      ) : null}

      <BulkActionBar
        deleteLabel="Archivar"
        deletingLabel="Archivando..."
        isDeleting={isBulkArchiving}
        onClearAll={clearAll}
        onDelete={() => setShowBulkArchiveConfirm(true)}
        onExport={() =>
          downloadAccountsCSV(
            selectedItems,
            `cuentas-seleccionadas-${new Date().toISOString().slice(0, 10)}.csv`,
          )
        }
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredAccounts.length}
      />

      {showBulkArchiveConfirm ? (
        <Modal
          disableOutsideClose={isBulkArchiving}
          labelledBy="accounts-bulk-archive-title"
          onClose={() => {
            if (!isBulkArchiving) {
              setShowBulkArchiveConfirm(false);
            }
          }}
          size="sm"
        >
          <ModalHeader
            description="Las cuentas seleccionadas dejaran de aparecer en el flujo principal. Podras reactivarlas despues."
            onClose={isBulkArchiving ? undefined : () => setShowBulkArchiveConfirm(false)}
            title={`Archivar ${selectedCount} cuenta${selectedCount !== 1 ? "s" : ""}`}
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
                    Se archivaran solo las cuentas filtradas que seleccionaste.
                  </p>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              disabled={isBulkArchiving}
              onClick={() => setShowBulkArchiveConfirm(false)}
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button disabled={isBulkArchiving} onClick={() => void confirmBulkArchive()}>
              <Archive className="h-4 w-4" />
              {isBulkArchiving ? "Archivando..." : "Archivar"}
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </>
  );
}
