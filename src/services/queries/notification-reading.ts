import type { SupabaseClient } from "@supabase/supabase-js";

/** One scoped update for selected notifications; never broadens to another user's inbox. */
export async function updateNotificationReading(client: SupabaseClient, userId: string | undefined, ids: number[], read: boolean) {
  if (!userId) throw new Error("No hay sesión activa.");
  if (!ids.length) return;
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Selección de notificaciones inválida.");
  const { error } = await client.from("notifications")
    .update({ status: read ? "read" : "sent", read_at: read ? new Date().toISOString() : null })
    .eq("user_id", userId).in("id", [...new Set(ids)]);
  if (error) throw error;
}
