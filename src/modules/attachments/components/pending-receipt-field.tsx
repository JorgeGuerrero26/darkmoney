import { ImagePlus, Lock, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/status-badge";

type PendingReceiptFieldProps = {
  canUpload: boolean;
  description?: string;
  file: File | null;
  lockedMessage: string;
  onChange: (file: File | null) => void;
  title?: string;
};

function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${sizeBytes} B`;
}

export function PendingReceiptField({
  canUpload,
  description = "Opcional. Puedes adjuntar una foto del comprobante antes de guardar.",
  file,
  lockedMessage,
  onChange,
  title = "Comprobante",
}: PendingReceiptFieldProps) {
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
            {title}
          </p>
          <p className="mt-2 text-sm leading-7 text-storm">{description}</p>
        </div>
        {file ? <StatusBadge status="Listo para subir" tone="success" /> : null}
      </div>

      {!canUpload ? (
        <div className="mt-4 rounded-[24px] border border-[#f0b35e]/18 bg-[#24190c]/70 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-[#f0b35e]/18 bg-[#f0b35e]/10 text-[#f6c97f]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Disponible en Modo Pro</p>
              <p className="mt-2 text-sm leading-7 text-storm">{lockedMessage}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <input
            accept="image/*"
            className="hidden"
            id={inputId}
            onChange={(event) => {
              onChange(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
            type="file"
          />

          <label
            className="flex cursor-pointer items-center justify-between gap-3 rounded-[24px] border border-dashed border-pine/25 bg-pine/[0.08] px-4 py-4 transition duration-200 hover:border-pine/35 hover:bg-pine/[0.12]"
            htmlFor={inputId}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-pine/25 bg-pine/10 text-pine">
                <ImagePlus className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">
                  {file ? "Cambiar imagen" : "Seleccionar comprobante"}
                </span>
                <span className="mt-1 block text-xs text-storm">
                  JPG, PNG o HEIC. Lo comprimimos a WebP antes de subir.
                </span>
              </span>
            </span>
            <span className="text-xs text-pine">Imagen</span>
          </label>

          {file ? (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="overflow-hidden rounded-[20px] border border-white/10 bg-black/25 md:w-[190px]">
                  {previewUrl ? (
                    <img
                      alt={file.name}
                      className="h-full w-full object-cover"
                      src={previewUrl}
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
                  <p className="mt-2 text-sm text-storm">{formatFileSize(file.size)}</p>
                  <div className="mt-4">
                    <Button
                      onClick={() => onChange(null)}
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Quitar imagen
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
