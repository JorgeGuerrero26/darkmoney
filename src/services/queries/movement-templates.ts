import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../supabase/client";

export type MovementTemplate = {
  id: number;
  workspaceId: number;
  name: string;
  movementType: "expense" | "income" | "transfer";
  sourceAccountId: number | null;
  destinationAccountId: number | null;
  sourceAmount: number | null;
  destinationAmount: number | null;
  categoryId: number | null;
  counterpartyId: number | null;
  description: string;
  notes: string | null;
};

type TemplateInput = Omit<MovementTemplate, "id" | "workspaceId">;

function mapRow(row: Record<string, unknown>): MovementTemplate {
  return {
    id: Number(row.id),
    workspaceId: Number(row.workspace_id),
    name: String(row.name ?? ""),
    movementType: String(row.movement_type) as MovementTemplate["movementType"],
    sourceAccountId: row.source_account_id == null ? null : Number(row.source_account_id),
    destinationAccountId: row.destination_account_id == null ? null : Number(row.destination_account_id),
    sourceAmount: row.source_amount == null ? null : Number(row.source_amount),
    destinationAmount: row.destination_amount == null ? null : Number(row.destination_amount),
    categoryId: row.category_id == null ? null : Number(row.category_id),
    counterpartyId: row.counterparty_id == null ? null : Number(row.counterparty_id),
    description: String(row.description ?? ""),
    notes: row.notes == null ? null : String(row.notes),
  };
}

function requireClient() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  return supabase;
}

export function useMovementTemplatesQuery(workspaceId?: number | null, userId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["movement-templates", userId ?? null, workspaceId ?? null],
    enabled: Boolean(enabled && workspaceId && userId && supabase),
    queryFn: async (): Promise<MovementTemplate[]> => {
      const { data, error } = await requireClient()
        .from("movement_templates")
        .select("id, workspace_id, name, movement_type, source_account_id, destination_account_id, source_amount, destination_amount, category_id, counterparty_id, description, notes")
        .eq("workspace_id", workspaceId!)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
    },
  });
}

export function useMovementTemplateMutations(workspaceId?: number | null, userId?: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["movement-templates", userId ?? null, workspaceId ?? null] });

  const create = useMutation({
    mutationFn: async (input: TemplateInput) => {
      if (!workspaceId || !userId) throw new Error("Espacio no disponible.");
      const { error } = await requireClient().from("movement_templates").insert({
        workspace_id: workspaceId,
        created_by_user_id: userId,
        name: input.name,
        movement_type: input.movementType,
        source_account_id: input.sourceAccountId,
        destination_account_id: input.destinationAccountId,
        source_amount: input.sourceAmount,
        destination_amount: input.destinationAmount,
        category_id: input.categoryId,
        counterparty_id: input.counterpartyId,
        description: input.description,
        notes: input.notes,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const { error } = await requireClient().from("movement_templates")
        .update({ name }).eq("id", id).eq("workspace_id", workspaceId!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await requireClient().from("movement_templates")
        .delete().eq("id", id).eq("workspace_id", workspaceId!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, rename, remove };
}
