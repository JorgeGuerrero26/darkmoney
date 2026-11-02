import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "../../../components/ui/button";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { Input } from "../../../components/ui/fields";
import { FormField } from "../../../components/ui/form-field";
import { InlineFormError } from "../../../components/ui/inline-form-error";
import { SurfaceCard } from "../../../components/ui/surface-card";
import {
  type AccountDeletionPreview,
  DELETE_CONFIRM_WORD,
  deleteMyAccount,
  fetchAccountDeletionPreview,
  leaveAfterAccountDeletion,
} from "../lib/account-deletion";

const WHAT_GETS_DELETED = [
  "Tus cuentas, movimientos, presupuestos, suscripciones, deudas y contactos.",
  "Tus comprobantes y tu foto de perfil.",
  "Tus ajustes y notificaciones, y lo que guardaba este navegador.",
];

/**
 * Eliminar la cuenta: explica qué se borra, pide escribir ELIMINAR y recién entonces enciende el botón rojo.
 * Sin "Deshacer". Los errores se quedan dentro del diálogo. El diálogo va fuera del formulario de ajustes (portal):
 * un Enter en el campo no debe enviar ese formulario.
 */
export function DeleteAccountPanel() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<AccountDeletionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setPreviewError(null);
    setConfirmText("");
    setError(null);
    let alive = true;
    fetchAccountDeletionPreview()
      .then((result) => {
        if (!alive) return;
        setPreview(result);
        if (result.mustCancelPro) {
          setError("Tu plan Pro se sigue cobrando. Cancélalo primero en Configuración → Plan y pagos y vuelve a intentarlo.");
        }
      })
      .catch((cause: unknown) => alive && setPreviewError(cause instanceof Error ? cause.message : String(cause)));
    return () => {
      alive = false;
    };
  }, [open]);

  const confirmed = confirmText.trim().toUpperCase() === DELETE_CONFIRM_WORD;
  const blockedByPro = preview?.mustCancelPro === true;

  async function handleDelete() {
    if (!confirmed || deleting || blockedByPro) return;
    setDeleting(true);
    setError(null);
    const result = await deleteMyAccount(confirmText);
    if (result.kind === "deleted") {
      await leaveAfterAccountDeletion(() => queryClient.clear());
      return;
    }
    setDeleting(false);
    setError(result.message);
  }

  return (
    <SurfaceCard
      action={<Trash2 className="h-5 w-5 text-[#eb766e]" />}
      description="Borra para siempre tu cuenta y todos tus datos. No se puede deshacer."
      title="Eliminar mi cuenta"
    >
      <Button
        className="!bg-transparent !text-[#eb766e] border border-[#eb766e]/40 hover:!bg-[#eb766e]/10"
        onClick={() => setOpen(true)}
        type="button"
        variant="ghost"
      >
        Eliminar mi cuenta
      </Button>
      {open
        ? createPortal(
            <DeleteConfirmDialog
              badge="Eliminar cuenta"
              childrenLabel={null}
              confirmDisabled={!confirmed || !preview || blockedByPro}
              confirmLabel="Eliminar cuenta"
              description="Se borrarán para siempre tu cuenta y todos tus datos. No se puede deshacer."
              isDeleting={deleting}
              onCancel={() => setOpen(false)}
              onConfirm={() => void handleDelete()}
              title="Eliminar tu cuenta"
            >
              <ul className="space-y-2 text-sm leading-6 text-storm">
                {WHAT_GETS_DELETED.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
                {preview?.transfers.map((transfer) => (
                  <li key={transfer.workspaceName}>
                    • «{transfer.workspaceName}» no se borra: pasará a ser de {transfer.newOwnerName}, con lo que registraron los demás.
                  </li>
                ))}
              </ul>
              {!preview && !previewError ? <LoaderCircle className="mt-4 h-4 w-4 animate-spin text-storm" /> : null}
              {previewError ? <InlineFormError className="mt-4" message={previewError} /> : null}
              {!blockedByPro ? (
                <form
                  className="mt-5"
                  onSubmit={(event) => {
                    // En React el envío sube por el árbol aunque el diálogo esté en un portal: no debe llegar al
                    // formulario de ajustes.
                    event.preventDefault();
                    event.stopPropagation();
                    void handleDelete();
                  }}
                >
                  <FormField label={`Escribe ${DELETE_CONFIRM_WORD} para confirmar`}>
                    <Input
                      autoCapitalize="characters"
                      autoComplete="off"
                      disabled={deleting}
                      onChange={(event) => {
                        setConfirmText(event.target.value);
                        setError(null);
                      }}
                      spellCheck={false}
                      value={confirmText}
                    />
                  </FormField>
                </form>
              ) : null}
              {error ? <InlineFormError className="mt-4" message={error} /> : null}
            </DeleteConfirmDialog>,
            document.body,
          )
        : null}
    </SurfaceCard>
  );
}
