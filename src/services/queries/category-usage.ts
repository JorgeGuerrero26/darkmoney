import type { SupabaseClient } from "@supabase/supabase-js";

/** Include every status, as the overview counts registrations, not only posted cashflow. */
export async function fetchCategoryMovementUsage(client: SupabaseClient, workspaceId: number) {
  const rows: { id: number; category_id: number | null; occurred_at: string }[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from("movements")
      .select("id, category_id, occurred_at").eq("workspace_id", workspaceId)
      .not("category_id", "is", null).order("occurred_at", { ascending: false })
      .order("id", { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}
