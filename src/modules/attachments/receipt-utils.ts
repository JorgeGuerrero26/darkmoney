import type { AttachmentEntityType } from "../../types/domain";
import { supabase } from "../../services/supabase/client";

export const RECEIPTS_BUCKET_NAME = "receipts";
const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_WEBP_QUALITY = 0.82;

export type PreparedReceiptUpload = {
  bucketName: string;
  filePath: string;
  fileName: string;
  mimeType: "image/webp";
  sizeBytes: number;
  width: number;
  height: number;
  blob: Blob;
};

function assertStorageClient() {
  if (!supabase) {
    throw new Error("Supabase no esta configurado para gestionar comprobantes.");
  }

  return supabase;
}

function sanitizeFileStem(fileName: string) {
  const baseName = fileName.replace(/\.[^/.]+$/, "").trim().toLowerCase();
  const normalized = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "comprobante";
}

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("No pudimos leer la imagen seleccionada."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function compressImageToWebp(
  file: File,
  maxDimension = DEFAULT_MAX_DIMENSION,
  quality = DEFAULT_WEBP_QUALITY,
) {
  const image = await loadImage(file);
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height, 1));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No pudimos preparar el canvas para comprimir la imagen.");
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("No pudimos convertir la imagen a WebP."));
          return;
        }

        resolve(result);
      },
      "image/webp",
      quality,
    );
  });

  return { blob, width, height };
}

export function buildReceiptStoragePath(
  workspaceId: number,
  entityType: AttachmentEntityType,
  entityId: number,
) {
  return `${workspaceId}/${entityType}/${entityId}/${crypto.randomUUID()}.webp`;
}

export async function prepareReceiptUpload(input: {
  workspaceId: number;
  entityType: AttachmentEntityType;
  entityId: number;
  file: File;
}) {
  const { blob, width, height } = await compressImageToWebp(input.file);
  const filePath = buildReceiptStoragePath(input.workspaceId, input.entityType, input.entityId);

  return {
    bucketName: RECEIPTS_BUCKET_NAME,
    filePath,
    fileName: `${sanitizeFileStem(input.file.name)}.webp`,
    mimeType: "image/webp" as const,
    sizeBytes: blob.size,
    width,
    height,
    blob,
  } satisfies PreparedReceiptUpload;
}

export async function uploadPreparedReceipt(preparedReceipt: PreparedReceiptUpload) {
  const client = assertStorageClient();
  const { error } = await client.storage
    .from(preparedReceipt.bucketName)
    .upload(preparedReceipt.filePath, preparedReceipt.blob, {
      cacheControl: "3600",
      upsert: false,
      contentType: preparedReceipt.mimeType,
    });

  if (error) {
    throw error;
  }
}

export async function deleteStoredReceipt(bucketName: string, filePath: string) {
  const client = assertStorageClient();
  const { error } = await client.storage.from(bucketName).remove([filePath]);

  if (error) {
    throw error;
  }
}

export async function createReceiptSignedUrl(
  bucketName: string,
  filePath: string,
  expiresInSeconds = 60 * 10,
) {
  const client = assertStorageClient();
  const { data, error } = await client.storage
    .from(bucketName)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
