import { ExternalLink, LoaderCircle, Paperclip, Trash2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import type { AttachmentSummary } from "../../../types/domain";
import { createReceiptSignedUrl } from "../receipt-utils";

type CompactAttachmentFieldProps = {
  accessMessage: string;
  attachments: AttachmentSummary[];
  canManage: boolean;
  embedded?: boolean;
  isUploading: boolean;
  onDelete: (attachment: AttachmentSummary) => void;
  onUpload: (file: File) => void;
};

type PendingAttachmentControlProps = {
  canUpload: boolean;
  file: File | null;
  lockedMessage: string;
  onChange: (file: File | null) => void;
};

function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(0)} KB`;
  }
  return `${sizeBytes} B`;
}

export function PendingAttachmentControl({ canUpload, file, lockedMessage, onChange }: PendingAttachmentControlProps) {
  const inputId = useId();

  if (!canUpload) {
    return <span className="max-w-48 truncate text-right text-xs text-storm/65" title={lockedMessage}>Disponible con Pro</span>;
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <input accept="image/*" className="sr-only" id={inputId} onChange={(event) => { onChange(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} type="file" />
      <label className="flex min-w-0 cursor-pointer items-center gap-2 text-sm font-medium text-storm transition hover:text-ink" htmlFor={inputId}>
        <span className="max-w-48 truncate">{file?.name ?? "Adjuntar"}</span>
        <Paperclip className="h-4 w-4 shrink-0" />
      </label>
      {file ? <button aria-label="Quitar comprobante" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-storm transition hover:bg-white/[0.06] hover:text-ink" onClick={() => onChange(null)} type="button"><X className="h-3.5 w-3.5" /></button> : null}
    </div>
  );
}

export function CompactPendingAttachmentField(props: PendingAttachmentControlProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">
      <div className="flex min-h-[54px] items-center justify-between gap-4 px-4">
        <span className="shrink-0 text-sm font-medium text-ink">Comprobante</span>
        <PendingAttachmentControl {...props} />
      </div>
    </div>
  );
}

export function CompactAttachmentField({
  accessMessage,
  attachments,
  canManage,
  embedded = false,
  isUploading,
  onDelete,
  onUpload,
}: CompactAttachmentFieldProps) {
  const inputId = useId();
  const [signedUrls, setSignedUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    let isMounted = true;

    void Promise.all(
      attachments.map(async (attachment) => {
        try {
          return [
            attachment.id,
            await createReceiptSignedUrl(attachment.bucketName, attachment.filePath),
          ] as const;
        } catch {
          return [attachment.id, ""] as const;
        }
      }),
    ).then((entries) => {
      if (isMounted) {
        setSignedUrls(Object.fromEntries(entries));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [attachments]);

  return (
    <div className={embedded ? "" : "overflow-hidden rounded-xl border border-white/10 bg-[#141311]"}>
      <div
        className={`flex min-h-[54px] items-center justify-between gap-4 px-4 ${
          embedded ? "border-t border-white/10" : ""
        }`}
      >
        <span className="shrink-0 text-sm font-medium text-ink">Comprobante</span>
        <div className="flex min-w-0 items-center gap-3">
          {attachments.length ? (
            <span className="truncate text-xs text-storm">
              {attachments.length} {attachments.length === 1 ? "adjunto" : "adjuntos"}
            </span>
          ) : null}
          {canManage ? (
            <>
              <input
                accept="image/*"
                className="sr-only"
                disabled={isUploading}
                id={inputId}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onUpload(file);
                  }
                  event.currentTarget.value = "";
                }}
                type="file"
              />
              <label
                className={`inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-storm transition hover:text-ink ${isUploading ? "pointer-events-none opacity-60" : ""}`}
                htmlFor={inputId}
              >
                {isUploading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
                {isUploading ? "Subiendo..." : attachments.length ? "Agregar" : "Adjuntar"}
              </label>
            </>
          ) : (
            <span className="max-w-48 truncate text-right text-xs text-storm/65" title={accessMessage}>
              Disponible con Pro
            </span>
          )}
        </div>
      </div>

      {attachments.map((attachment) => {
        const signedUrl = signedUrls[attachment.id] ?? "";

        return (
          <div
            className="flex min-h-[54px] items-center justify-between gap-3 border-t border-white/10 px-4"
            key={attachment.id}
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">{attachment.fileName}</p>
              <p className="mt-0.5 text-[11px] text-storm/65">{formatFileSize(attachment.sizeBytes)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {signedUrl ? (
                <a
                  aria-label={`Ver ${attachment.fileName}`}
                  className="grid h-8 w-8 place-items-center rounded-full text-storm transition hover:bg-white/[0.05] hover:text-ink"
                  href={signedUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {canManage ? (
                <button
                  aria-label={`Eliminar ${attachment.fileName}`}
                  className="grid h-8 w-8 place-items-center rounded-full text-storm transition hover:bg-white/[0.05] hover:text-ink"
                  onClick={() => onDelete(attachment)}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
