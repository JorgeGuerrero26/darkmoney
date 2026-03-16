import { ExternalLink, ImagePlus, LoaderCircle, Lock, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/status-badge";
import type { AttachmentSummary } from "../../../types/domain";
import { formatDateTime } from "../../../lib/formatting/dates";
import { createReceiptSignedUrl } from "../receipt-utils";

type AttachmentGalleryProps = {
  accessMessage: string;
  attachments: AttachmentSummary[];
  canManage: boolean;
  deletingAttachmentId?: number | null;
  entityLabel?: string;
  isUploading: boolean;
  onDelete: (attachment: AttachmentSummary) => void;
  onUpload: (file: File) => void;
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

export function AttachmentGallery({
  accessMessage,
  attachments,
  canManage,
  deletingAttachmentId = null,
  entityLabel = "registro",
  isUploading,
  onDelete,
  onUpload,
}: AttachmentGalleryProps) {
  const inputId = useId();
  const [signedUrls, setSignedUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    let isMounted = true;

    async function resolveSignedUrls() {
      if (attachments.length === 0) {
        setSignedUrls({});
        return;
      }

      const urlEntries = await Promise.all(
        attachments.map(async (attachment) => {
          try {
            const signedUrl = await createReceiptSignedUrl(
              attachment.bucketName,
              attachment.filePath,
            );
            return [attachment.id, signedUrl] as const;
          } catch {
            return [attachment.id, ""] as const;
          }
        }),
      );

      if (!isMounted) {
        return;
      }

      setSignedUrls(Object.fromEntries(urlEntries));
    }

    void resolveSignedUrls();

    return () => {
      isMounted = false;
    };
  }, [attachments]);

  return (
    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
            Comprobantes
          </p>
          <p className="mt-2 text-sm leading-7 text-storm">
            Adjunta y revisa imagenes del comprobante vinculadas a este {entityLabel}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge
            status={`${attachments.length} adjunto${attachments.length === 1 ? "" : "s"}`}
            tone="neutral"
          />
          {canManage ? <StatusBadge status="Modo Pro" tone="success" /> : null}
        </div>
      </div>

      {canManage ? (
        <div className="mt-4">
          <input
            accept="image/*"
            className="hidden"
            id={inputId}
            onChange={(event) => {
              const nextFile = event.target.files?.[0];

              if (nextFile) {
                onUpload(nextFile);
              }

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
                {isUploading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">
                  {isUploading ? "Subiendo comprobante..." : "Agregar comprobante"}
                </span>
                <span className="mt-1 block text-xs text-storm">
                  Sube una imagen y la comprimimos a WebP antes de guardarla.
                </span>
              </span>
            </span>
            <span className="text-xs text-pine">Imagen</span>
          </label>
        </div>
      ) : (
        <div className="mt-4 rounded-[24px] border border-[#f0b35e]/18 bg-[#24190c]/70 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-[#f0b35e]/18 bg-[#f0b35e]/10 text-[#f6c97f]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Gestion de comprobantes en Modo Pro</p>
              <p className="mt-2 text-sm leading-7 text-storm">{accessMessage}</p>
            </div>
          </div>
        </div>
      )}

      {attachments.length === 0 ? (
        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-storm">
          Aun no hay comprobantes adjuntos para este {entityLabel}.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {attachments.map((attachment) => {
            const signedUrl = signedUrls[attachment.id] ?? "";
            const isDeleting = deletingAttachmentId === attachment.id;

            return (
              <article
                className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04]"
                key={attachment.id}
              >
                <div className="aspect-[16/10] bg-black/25">
                  {signedUrl ? (
                    <img
                      alt={attachment.fileName}
                      className="h-full w-full object-cover"
                      src={signedUrl}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-storm">
                      Preparando vista previa...
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <p className="truncate text-sm font-semibold text-ink">{attachment.fileName}</p>
                    <p className="mt-1 text-xs text-storm">
                      {formatFileSize(attachment.sizeBytes)} · {formatDateTime(attachment.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {signedUrl ? (
                      <a
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-ink transition hover:border-white/16 hover:bg-white/[0.08]"
                        href={signedUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Ver
                      </a>
                    ) : null}

                    {canManage ? (
                      <Button
                        disabled={isDeleting}
                        onClick={() => onDelete(attachment)}
                        type="button"
                        variant="ghost"
                      >
                        {isDeleting ? (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Eliminar
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
