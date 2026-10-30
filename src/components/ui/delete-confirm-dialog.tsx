import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { Button } from "./button";
import { useFocusTrap } from "./use-focus-trap";

interface DeleteConfirmDialogProps {
  /** Short badge label, e.g. "Eliminar movimiento" */
  badge: string;
  /** Main heading. Defaults to "Confirma antes de borrarlo" */
  title?: string;
  /** Explanatory paragraph shown below the heading */
  description: string;
  /** Label for the confirm button. Defaults to "Eliminar definitivamente" */
  confirmLabel?: string;
  isDeleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Preview card shown inside the dialog (item details) */
  children?: ReactNode;
}

export function DeleteConfirmDialog({
  badge,
  title = "Confirma antes de borrarlo",
  description,
  confirmLabel = "Eliminar definitivamente",
  isDeleting = false,
  onCancel,
  onConfirm,
  children,
}: DeleteConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isDeleting) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isDeleting, onCancel]);

  return (
    <div
      aria-labelledby="delete-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 sm:p-6"
      role="dialog"
    >
      <div ref={dialogRef} className="relative w-full max-w-[34rem] rounded-2xl border border-white/10 bg-[#1e1d1b] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-7">

        <div className="relative">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="sr-only">
                {badge}
              </div>
              <h3 className="font-display text-xl font-semibold leading-tight text-ink" id="delete-dialog-title">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-storm">{description}</p>
            </div>
          </div>

          {/* Preview card */}
          {children ? (
            <div className="mt-7 rounded-[28px] border border-white/10 bg-black/20 p-4 sm:p-5">
              <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                Registro seleccionado
              </p>
              <div className="mt-4">{children}</div>
            </div>
          ) : null}

          {/* Actions */}
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button disabled={isDeleting} onClick={onCancel} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              className="!bg-[#eb766e] !text-[#141312] hover:!bg-[#f58a82] focus-visible:outline-[#f27a86]"
              disabled={isDeleting}
              onClick={onConfirm}
              type="button"
            >
              {isDeleting ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
