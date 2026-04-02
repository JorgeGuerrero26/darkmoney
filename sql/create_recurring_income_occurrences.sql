-- ============================================================
-- recurring_income_occurrences
-- Historial de confirmaciones de llegada de ingresos recurrentes
-- Idempotente: seguro correrlo varias veces
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recurring_income_occurrences (
  id                   bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id         bigint        NOT NULL REFERENCES public.workspaces(id)       ON DELETE CASCADE,
  recurring_income_id  bigint        NOT NULL REFERENCES public.recurring_income(id) ON DELETE CASCADE,
  expected_date        date          NOT NULL,
  actual_date          date,
  amount               numeric(18,4) NOT NULL,
  currency_code        text          NOT NULL DEFAULT 'USD',
  movement_id          bigint        REFERENCES public.movements(id) ON DELETE SET NULL,
  status               text          NOT NULL DEFAULT 'on_time'
                           CHECK (status IN ('on_time','late','missed')),
  notes                text,
  created_at           timestamptz   NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_recurring_income_occurrences_workspace
  ON public.recurring_income_occurrences (workspace_id, expected_date DESC);

CREATE INDEX IF NOT EXISTS idx_recurring_income_occurrences_income
  ON public.recurring_income_occurrences (recurring_income_id, expected_date DESC);

-- RLS
ALTER TABLE public.recurring_income_occurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_members_select_recurring_income_occurrences" ON public.recurring_income_occurrences;
CREATE POLICY "workspace_members_select_recurring_income_occurrences"
  ON public.recurring_income_occurrences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = recurring_income_occurrences.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "workspace_members_insert_recurring_income_occurrences" ON public.recurring_income_occurrences;
CREATE POLICY "workspace_members_insert_recurring_income_occurrences"
  ON public.recurring_income_occurrences FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = recurring_income_occurrences.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "workspace_members_update_recurring_income_occurrences" ON public.recurring_income_occurrences;
CREATE POLICY "workspace_members_update_recurring_income_occurrences"
  ON public.recurring_income_occurrences FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = recurring_income_occurrences.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "workspace_members_delete_recurring_income_occurrences" ON public.recurring_income_occurrences;
CREATE POLICY "workspace_members_delete_recurring_income_occurrences"
  ON public.recurring_income_occurrences FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = recurring_income_occurrences.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.recurring_income_occurrences TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.recurring_income_occurrences TO service_role;
