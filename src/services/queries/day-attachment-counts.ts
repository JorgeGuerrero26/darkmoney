import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

/** Same flat Storage source as mobile, including older receipts without a table row. */
export async function fetchDayAttachmentCounts(client: Pick<SupabaseClient, "storage">, workspaceId: number): Promise<Record<number, number>> {
  if (!Number.isSafeInteger(workspaceId) || workspaceId <= 0) throw new Error("Espacio inválido.");
  const root = `${workspaceId}/movement/`;
  const counts: Record<number, number> = {};
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const { data, error } = await client.storage.from("receipts").listV2({ prefix: root, cursor, limit: 1000, with_delimiter: false });
    if (error || !data) throw new Error("No se pudieron consultar los comprobantes.");
    for (const object of data.objects) {
      const path = (object.key ?? object.name ?? "").replace(/^\/+/, "");
      const markerIndex = path.startsWith(root) ? 0 : path.indexOf(`/${root}`) + 1;
      if (markerIndex === 0 && !path.startsWith(root)) continue;
      const relative = path.slice(markerIndex + root.length);
      const match = relative.match(/^(\d+)\/(.+)$/);
      if (!match) continue;
      const id = Number(match[1]);
      if (Number.isSafeInteger(id) && id > 0) counts[id] = (counts[id] ?? 0) + 1;
    }
    if (!data.hasNext) return counts;
    if (!data.nextCursor || cursors.has(data.nextCursor)) throw new Error("No se pudo completar la consulta de comprobantes.");
    cursor = data.nextCursor;
    cursors.add(cursor);
  } while (cursor);
  return counts;
}

export function useDayAttachmentCounts(userId: string | undefined, workspaceId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["attachments", workspaceId, "day-counts", userId ?? null],
    queryFn: () => {
      if (!supabase || !userId) throw new Error("No se puede consultar los comprobantes.");
      return fetchDayAttachmentCounts(supabase, workspaceId);
    },
    enabled: Boolean(userId && workspaceId && enabled),
    staleTime: 30_000,
    retry: 1,
  });
}
