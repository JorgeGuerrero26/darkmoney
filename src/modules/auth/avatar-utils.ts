import { supabase } from "../../services/supabase/client";

export const AVATARS_BUCKET_NAME = "avatars";
const AVATAR_SIZE = 256;
const AVATAR_WEBP_QUALITY = 0.88;

function assertStorageClient() {
  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }
  return supabase;
}

export function buildAvatarPath(userId: string) {
  return `${userId}/avatar.webp`;
}

async function compressAvatarToWebp(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No pudimos leer la imagen seleccionada."));
      img.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No pudimos preparar el canvas para procesar la imagen.");
    }

    // Center crop: recortamos al cuadrado desde el centro
    const shortSide = Math.min(image.width, image.height);
    const sx = (image.width - shortSide) / 2;
    const sy = (image.height - shortSide) / 2;
    ctx.drawImage(image, sx, sy, shortSide, shortSide, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error("No pudimos convertir la imagen a WebP."));
            return;
          }
          resolve(result);
        },
        "image/webp",
        AVATAR_WEBP_QUALITY,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const client = assertStorageClient();
  const blob = await compressAvatarToWebp(file);
  const path = buildAvatarPath(userId);

  const { error } = await client.storage.from(AVATARS_BUCKET_NAME).upload(path, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType: "image/webp",
  });

  if (error) {
    throw error;
  }

  const { data } = client.storage.from(AVATARS_BUCKET_NAME).getPublicUrl(path);
  // Agregamos timestamp para que el navegador no sirva la version en cache
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function deleteAvatar(userId: string): Promise<void> {
  const client = assertStorageClient();
  const { error } = await client.storage
    .from(AVATARS_BUCKET_NAME)
    .remove([buildAvatarPath(userId)]);

  if (error) {
    throw error;
  }
}
