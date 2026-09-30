import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase/client";
import type { CategoryLearningFeedback } from "../../modules/movements/lib/local-category-suggestion";

export function useMovementLearningQuery(workspaceId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["movement-learning-feedback", workspaceId],
    enabled: enabled && Boolean(supabase && workspaceId),
    staleTime: 30_000,
    queryFn: async (): Promise<CategoryLearningFeedback[]> => {
      const { data, error } = await supabase!.from("movement_learning_feedback")
        .select("feedback_kind, accepted_category_id, normalized_description, created_at")
        .eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        feedbackKind: row.feedback_kind,
        acceptedCategoryId: row.accepted_category_id,
        normalizedDescription: row.normalized_description,
        createdAt: row.created_at,
      }));
    },
  });
}
