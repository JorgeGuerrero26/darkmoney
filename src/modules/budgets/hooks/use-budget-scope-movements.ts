import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { supabase } from "../../../services/supabase/client";
import type { AccountSummary, BudgetOverview, CategorySummary, MovementRecord } from "../../../types/domain";
import { budgetDateFrom, budgetDateTo } from "../lib/budget-date";

const PAGE_SIZE = 500;

type ScopeRow = {
  id: number;
  movement_type: MovementRecord["movementType"];
  occurred_at: string;
  description: string | null;
  category_id: number | null;
  spend_type_id: number | null;
  category: { default_spend_type_id: number | null } | null;
  source_account_id: number | null;
  source_amount: number | string | null;
  destination_account_id: number | null;
  destination_amount: number | string | null;
};

export function useBudgetScopeMovements({ workspaceId, userId, budgets, accounts, categories, refreshKey }: {
  workspaceId?: number;
  userId?: string;
  budgets: BudgetOverview[];
  accounts: AccountSummary[];
  categories: CategorySummary[];
  refreshKey: number;
}) {
  const bounds = useMemo(() => budgets.length ? {
    start: budgets.reduce((min, budget) => budget.periodStart < min ? budget.periodStart : min, budgets[0].periodStart),
    end: budgets.reduce((max, budget) => budget.periodEnd > max ? budget.periodEnd : max, budgets[0].periodEnd),
  } : null, [budgets]);

  return useQuery({
    queryKey: ["budget-scope-movements", workspaceId, userId, bounds?.start, bounds?.end, refreshKey],
    enabled: Boolean(supabase && workspaceId && userId && bounds),
    queryFn: async ({ signal }): Promise<MovementRecord[]> => {
      if (!supabase || !workspaceId || !userId || !bounds) throw new Error("No hay un espacio o sesión activos.");
      const accountMap = new Map(accounts.map((account) => [account.id, account]));
      const categoryMap = new Map(categories.map((category) => [category.id, category]));
      const rows: MovementRecord[] = [];
      for (let page = 0; ; page += 1) {
        const { data, error } = await supabase.from("movements")
          .select("id, movement_type, occurred_at, description, category_id, spend_type_id, category:categories(default_spend_type_id), source_account_id, source_amount, destination_account_id, destination_amount")
          .eq("workspace_id", workspaceId)
          .eq("status", "posted")
          .gte("occurred_at", budgetDateFrom(bounds.start))
          .lte("occurred_at", budgetDateTo(bounds.end))
          .order("occurred_at", { ascending: false })
          .order("id", { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).abortSignal(signal);
        if (error) throw error;
        const pageRows = (data ?? []) as unknown as ScopeRow[];
        for (const row of pageRows) {
          const source = row.source_account_id ? accountMap.get(row.source_account_id) : null;
          const destination = row.destination_account_id ? accountMap.get(row.destination_account_id) : null;
          rows.push({
            id: row.id, workspaceId, movementType: row.movement_type, status: "posted",
            description: row.description ?? "", category: row.category_id ? categoryMap.get(row.category_id)?.name ?? "Sin categoría" : "Sin categoría",
            categoryId: row.category_id, spendTypeId: row.spend_type_id, categoryDefaultSpendTypeId: row.category?.default_spend_type_id ?? null, counterparty: "Sin contraparte",
            occurredAt: row.occurred_at, sourceAccountId: row.source_account_id,
            sourceAccountName: source?.name ?? null, sourceCurrencyCode: source?.currencyCode ?? null,
            sourceAmount: row.source_amount === null ? null : Number(row.source_amount),
            destinationAccountId: row.destination_account_id, destinationAccountName: destination?.name ?? null,
            destinationCurrencyCode: destination?.currencyCode ?? null,
            destinationAmount: row.destination_amount === null ? null : Number(row.destination_amount),
          });
        }
        if (pageRows.length < PAGE_SIZE) break;
      }
      return rows;
    },
  });
}
