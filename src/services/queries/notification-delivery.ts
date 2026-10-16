import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

type Client = Pick<SupabaseClient, "from">;
type DeliveryRow = {
  user_id: string; is_active: boolean | null; daily_digest_enabled: boolean | null;
  predictive_alerts_enabled: boolean | null; push_token: string | null; platform: string | null;
};
export type NotificationDeliveryPreferences = {
  userId: string; pushEnabled: boolean; hasPushToken: boolean;
  dailyDigestEnabled: boolean; predictiveAlertsEnabled: boolean; platform: string | null;
};
export type DeliveryTopic = "dailyDigestEnabled" | "predictiveAlertsEnabled";
export type DeliveryTopicInput = { topic: DeliveryTopic; enabled: boolean; expectedEnabled: boolean; signal?: AbortSignal };

const columns = "user_id, is_active, daily_digest_enabled, predictive_alerts_enabled, push_token, platform";
const key = (userId?: string) => ["notification-delivery-preferences", userId];

function decode(row: DeliveryRow | null, userId: string): NotificationDeliveryPreferences {
  if (row && row.user_id !== userId) throw new Error("Las preferencias no pertenecen a esta sesión.");
  return { userId, pushEnabled: row?.is_active === true, hasPushToken: typeof row?.push_token === "string" && Boolean(row.push_token.trim()),
    dailyDigestEnabled: row?.daily_digest_enabled !== false, predictiveAlertsEnabled: row?.predictive_alerts_enabled !== false,
    platform: typeof row?.platform === "string" ? row.platform : null };
}

export function notificationDeliveryState(value: NotificationDeliveryPreferences | null | undefined) {
  const pushReady = value?.pushEnabled === true && value.hasPushToken === true;
  return { pushReady, dailyDigestActive: pushReady && value?.dailyDigestEnabled === true, predictiveAlertsActive: pushReady && value?.predictiveAlertsEnabled === true };
}

async function readRow(client: Client, userId: string, signal?: AbortSignal) {
  if (!userId || signal?.aborted) throw new Error("La sesión o la lectura ya no está disponible.");
  let request = client.from("notification_preferences").select(columns).eq("user_id", userId);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request.maybeSingle();
  if (error) throw error;
  const row = data as DeliveryRow | null;
  decode(row, userId);
  return row;
}

export async function readNotificationDelivery(client: Client, userId: string, signal?: AbortSignal) {
  return decode(await readRow(client, userId, signal), userId);
}

/** Change one existing topic, never register a device or modify its push authorization. */
export async function saveNotificationDeliveryTopic(client: Client, userId: string, input: DeliveryTopicInput) {
  if (!["dailyDigestEnabled", "predictiveAlertsEnabled"].includes(input.topic) || typeof input.enabled !== "boolean" || typeof input.expectedEnabled !== "boolean") throw new Error("Preferencia no válida.");
  const row = await readRow(client, userId, input.signal), current = decode(row, userId);
  if (!row || !notificationDeliveryState(current).pushReady) throw new Error("Activa los avisos y registra este teléfono desde la app móvil antes de cambiar sus temas.");
  if (current[input.topic] !== input.expectedEnabled) throw new Error("Esta preferencia cambió en otro dispositivo. Actualiza y revísala antes de guardar.");
  if (input.enabled === current[input.topic]) return current;
  if (input.signal?.aborted) throw new Error("La sesión o la lectura ya no está disponible.");
  const column = input.topic === "dailyDigestEnabled" ? "daily_digest_enabled" : "predictive_alerts_enabled";
  let request = client.from("notification_preferences").update({ [column]: input.enabled }).eq("user_id", userId).eq("is_active", true).eq("push_token", row.push_token);
  request = row[column] == null ? request.is(column, null) : request.eq(column, row[column]);
  if (input.signal) request = request.abortSignal(input.signal);
  const { data, error } = await request.select(columns).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Los avisos o la preferencia cambiaron durante el guardado. Actualiza para comprobar su estado.");
  return decode(data as DeliveryRow, userId);
}

export function useNotificationDeliveryQuery(userId?: string) {
  return useQuery({ queryKey: key(userId), enabled: Boolean(userId), staleTime: 30_000, retry: false,
    queryFn: ({ signal }) => {
      if (!supabase || !userId) throw new Error("No hay una conexión configurada para consultar tus avisos.");
      return readNotificationDelivery(supabase, userId, signal);
    } });
}

export function useSaveNotificationDeliveryTopicMutation(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({ retry: false, mutationFn: async (input: DeliveryTopicInput) => {
    if (!supabase || !userId) throw new Error("No hay sesión activa.");
    return saveNotificationDeliveryTopic(supabase, userId, input);
  }, onSuccess: result => {
    queryClient.setQueryData(key(result.userId), result);
    void queryClient.invalidateQueries({ queryKey: key(result.userId) });
  } });
}
