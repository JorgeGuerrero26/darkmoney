import { AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "./button";
import { useFocusTrap } from "./use-focus-trap";

type UnsavedChangesDialogProps = {
  onDiscard: () => void;
  onKeepEditing: () => void;
};

export function UnsavedChangesDialog({ onDiscard, onKeepEditing }: UnsavedChangesDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onKeepEditing();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onKeepEditing]);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-labelledby="unsaved-changes-title"
    >
      <div
        className="absolute inset-0 bg-void/70 backdrop-blur-sm"
        onClick={onKeepEditing}
      />

      <div ref={dialogRef} className="relative w-full max-w-sm rounded-[28px] border border-white/10 bg-shell/95 p-6 shadow-[0_32px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-[#f27a86]/24 bg-[#f27a86]/12">
            <AlertTriangle className="h-6 w-6 text-[#ffb4bc]" />
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-xl font-semibold text-ink" id="unsaved-changes-title">
              ¿Salir sin guardar?
            </h2>
            <p className="text-sm leading-6 text-storm">
              Tenés cambios que no fueron guardados. Si salís ahora, se perderán.
            </p>
          </div>

          <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row-reverse">
            <button
              className="flex-1 rounded-2xl bg-[#f27a86]/18 px-4 py-3 text-sm font-semibold text-[#ffb4bc] ring-1 ring-[#f27a86]/24 transition duration-200 hover:bg-[#f27a86]/28"
              onClick={onDiscard}
              type="button"
            >
              Sí, descartar
            </button>
            <Button
              className="flex-1"
              onClick={onKeepEditing}
              variant="secondary"
            >
              Seguir editando
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
