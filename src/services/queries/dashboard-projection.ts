import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase/client";
import type { ProjectionSupplement } from "../../modules/dashboard/lib/projection/build-dashboard-cashflow";
import { readIncomeScheduledChanges } from "../../modules/recurring-income/lib/scheduled-changes";

/** Same checked model as editing; invalid changes make the projection unavailable, never silently smaller. */
export function parseProjectionChanges(raw: unknown) {
  return readIncomeScheduledChanges(raw);
}

export async function readProjectionSupplement(
  client: NonNullable<typeof supabase>, workspaceId: number, signal: AbortSignal,
): Promise<ProjectionSupplement> {
  const readAll = async (table: string, columns: string) => {
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += 500) {
      signal.throwIfAborted();
      const { data, error } = await client.from(table).select(columns)
        .eq("workspace_id", workspaceId).order("id", { ascending: true })
        .range(offset, offset + 499).abortSignal(signal);
      if (error) throw error;
      signal.throwIfAborted();
      const page = (data ?? []) as unknown as Record<string, unknown>[];
      if (page.some(row => Number(row.workspace_id) !== workspaceId)) throw new Error("Datos de proyección de otro espacio.");
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  };
  const [types, incomes] = await Promise.all([
    readAll("spend_types", "id, workspace_id, excluded_from_typical"),
    readAll("recurring_income", "id, workspace_id, scheduled_changes"),
  ]);
  return {
    workspaceId,
    // Include inactive types: historical purchases keep their classification.
    oneOffTypeIds: types.filter(row => row.excluded_from_typical === true).map(row => Number(row.id)),
    scheduledChanges: incomes.map(row => ({ id: Number(row.id), changes: parseProjectionChanges(row.scheduled_changes) })),
  };
}

export function useProjectionSupplement(workspaceId?: number, userId?: string) {
  return useQuery({
    queryKey: ["dashboard-projection-inputs", workspaceId, userId],
    enabled: Boolean(workspaceId && userId), staleTime: 30_000,
    queryFn: ({ signal }) => {
      if (!supabase || !workspaceId || !userId) throw new Error("La sesión o el espacio no están disponibles.");
      return readProjectionSupplement(supabase, workspaceId, signal);
    },
  });
}
