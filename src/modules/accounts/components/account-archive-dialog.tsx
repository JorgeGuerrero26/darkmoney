import { Archive, RotateCcw } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Modal, ModalFooter, ModalHeader } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary } from "../../../types/domain";
import { getAccountIcon, getTypePreset } from "../lib/account-options";

type AccountArchiveDialogProps = {
  account: AccountSummary;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AccountArchiveDialog({
  account,
  isSaving,
  onCancel,
  onConfirm,
}: AccountArchiveDialogProps) {
  const nextArchivedValue = !account.isArchived;
  const AccountIcon = getAccountIcon(account.icon, account.type);
  const ActionIcon = nextArchivedValue ? Archive : RotateCcw;

  return (
    <Modal
      disableOutsideClose={isSaving}
      labelledBy="account-archive-title"
      onClose={onCancel}
      size="sm"
    >
      <ModalHeader
        description={
          nextArchivedValue
            ? "La cuenta dejara de aparecer en el flujo principal, pero podras reactivarla despues."
            : "La cuenta volvera a aparecer en el inventario operativo."
        }
        onClose={isSaving ? undefined : onCancel}
        title={nextArchivedValue ? "Archivar cuenta" : "Reactivar cuenta"}
        titleId="account-archive-title"
      />
      <ModalBody>
        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
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
      </ModalBody>
      <ModalFooter>
        <Button disabled={isSaving} onClick={onCancel} variant="ghost">
          Cancelar
        </Button>
        <Button disabled={isSaving} onClick={onConfirm}>
          <ActionIcon className="h-4 w-4" />
          {isSaving
            ? "Guardando..."
            : nextArchivedValue
              ? "Archivar"
              : "Reactivar"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
