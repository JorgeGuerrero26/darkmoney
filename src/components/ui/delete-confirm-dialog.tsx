import { AlertTriangle, LoaderCircle, Trash2 } from "lucide-react";
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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#02060d]/75 p-4 backdrop-blur-md sm:p-6"
      role="dialog"
    >
      <div ref={dialogRef} className="relative w-full max-w-[34rem] overflow-hidden rounded-[34px] [transform:translateZ(0)] border border-[#f27a86]/18 bg-[#07101a]/96 p-6 shadow-[0_35px_120px_rgba(0,0,0,0.58)] sm:p-7">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-8 top-6 h-28 w-28 rounded-full bg-[#f27a86]/18 blur-3xl" />
          <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#4566d6]/12 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_26%,transparent_78%,rgba(255,255,255,0.02))]" />
        </div>

        <div className="relative">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-[#f27a86]/20 bg-[#f27a86]/10 text-[#ffb4bc] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center rounded-full border border-[#f27a86]/18 bg-[#f27a86]/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#ffb4bc]">
                {badge}
              </div>
              <h3 className="mt-4 font-display text-[2rem] font-semibold leading-tight text-ink" id="delete-dialog-title">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-storm">{description}</p>
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
              className="!bg-[#f27a86] !text-white hover:!bg-[#ff8e98] focus-visible:outline-[#f27a86]"
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
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {confirmLabel}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
