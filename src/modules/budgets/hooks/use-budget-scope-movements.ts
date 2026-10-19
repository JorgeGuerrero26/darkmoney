import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { supabase } from "../../../services/supabase/client";
import type { AccountSummary, BudgetOverview, CategorySummary, MovementRecord } from "../../../types/domain";
import { readBudgetScopeMovements } from "../lib/budget-scope-reader";

export function useBudgetScopeMovements({ workspaceId, userId, budgets, accounts, categories, refreshKey }: {
  workspaceId?: number;
  userId?: string;
  budgets: BudgetOverview[];
  accounts: AccountSummary[];
  categories: CategorySummary[];
  refreshKey: number;
}) {
  const scopeKey = useMemo(() => budgets.map(budget => [budget.id, budget.workspaceId, budget.periodStart, budget.periodEnd]).sort((a, b) => String(a).localeCompare(String(b))), [budgets]);

  return useQuery({
    queryKey: ["budget-scope-movements", workspaceId, userId, scopeKey, refreshKey],
    enabled: Boolean(supabase && workspaceId && userId && budgets.length),
    staleTime: 0,
    queryFn: async ({ signal }): Promise<MovementRecord[]> => {
      if (!supabase || !workspaceId || !userId) throw new Error("No hay un espacio o sesión activos.");
      return readBudgetScopeMovements(supabase, { workspaceId, userId, budgets, accounts, categories }, signal);
    },
  });
}
