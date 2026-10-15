import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { formatCurrency } from "../../../lib/formatting/money";
import { useWorkspaceSnapshotQuery, useBudgetSpendTypesQuery, useCreateBudgetMutation, getQueryErrorMessage, type BudgetFormInput } from "../../../services/queries/workspace-data";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { useProFeatureAccess } from "../../shared/use-pro-feature-access";
import { BudgetEditorDialog, type BudgetEditorValue } from "../../budgets/components/budget-editor-dialog";
import { budgetEditorCurrencies, buildBudgetEditorInput } from "../../budgets/lib/budget-editor-input";
import { budgetTodayLima } from "../../budgets/lib/budget-date";
import { prepareBudgetProposal, type AssistantBudgetDraft } from "../lib/budget-proposal";
import { createAssistantResourceSaver } from "../lib/resource-proposal-save";

type Input = BudgetFormInput & { userId: string; workspaceId: number };
export type AssistantBudgetSession = { value?: BudgetEditorValue; saver?: ReturnType<typeof createAssistantResourceSaver<Input>>;
  live?: { current: () => boolean; insert: (input: Input) => Promise<void> } };

export function AssistantBudgetReview({ draft, userId, workspaceId, session, onClose, onSaved, onUnconfirmed }: {
  draft: AssistantBudgetDraft; userId: string; workspaceId: number; session: AssistantBudgetSession;
  onClose: () => void; onSaved: (note: string) => void; onUnconfirmed: (note: string) => void;
}) {
  const auth = useAuth(), { activeWorkspace } = useActiveWorkspace(), access = useProFeatureAccess();
  const query = useWorkspaceSnapshotQuery(activeWorkspace, auth.user?.id, auth.profile), spend = useBudgetSpendTypesQuery(workspaceId);
  const mutation = useCreateBudgetMutation(workspaceId, userId);
  const alive = useRef(true), scope = useRef(false), lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  scope.current = auth.user?.id === userId && activeWorkspace?.id === workspaceId && !activeWorkspace?.isArchived;
  const scoped = scope.current && !query.isPlaceholderData && query.data?.workspace.id === workspaceId;
  const ready = scoped && access.canAccessProFeatures && !query.isFetching && !query.isError && !spend.isFetching && !spend.isError;
  const [value, setValue] = useState<BudgetEditorValue | null>(() => session.value ?? null);
  const [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false), [unsaved, setUnsaved] = useState(false);
  const dirty = useRef(false);
  useEffect(() => { if (scoped && query.data) setValue(previous => previous ?? prepareBudgetProposal(draft, query.data)); }, [scoped, query.data, draft]);
  session.live = { current: () => alive.current && ready, insert: mutation.mutateAsync };
  if (!session.saver) session.saver = createAssistantResourceSaver<Input>({ isCurrent: () => session.live?.current() ?? false,
    insert: input => { if (!session.live) throw new Error("El formulario ya no está disponible."); return session.live.insert(input); } });
  function close() { if (lock.current) return; if (dirty.current) setUnsaved(true); else onClose(); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current || unsaved || !value || !query.data) return;
    setError(null); lock.current = true; setSaving(true);
    try {
      const input = buildBudgetEditorInput(value, query.data, spend.data ?? [], budgetTodayLima(), true);
      await session.saver!.save({ ...input, userId, workspaceId });
      const saved = session.saver!.confirmed();
      if (saved && alive.current && scope.current) onSaved(`Presupuesto «${saved.name}» creado por ${formatCurrency(saved.limitAmount, saved.currencyCode)}, del ${saved.periodStart} al ${saved.periodEnd}.`);
    } catch (e) {
      if (alive.current && scope.current) {
        if (session.saver!.uncertain()) onUnconfirmed("No se pudo confirmar la respuesta del servidor. El presupuesto podría haberse creado: comprueba Presupuestos antes de registrarlo otra vez.");
        else setError(getQueryErrorMessage(e, "No se pudo crear el presupuesto."));
      }
    } finally { lock.current = false; if (alive.current) setSaving(false); }
  }
  if (!scoped || !query.data || !value) return <DataState title={query.isError ? "No se pudo preparar el presupuesto" : "Comprobando el espacio"}
    description="La propuesta no se registra hasta que revises y confirmes el formulario." action={<div className="flex gap-3"><Button onClick={() => void query.refetch()}>Reintentar lectura</Button><Button variant="ghost" onClick={onClose}>Cerrar revisión</Button></div>} />;
  return <><BudgetEditorDialog value={value} onChange={next => { setValue(next); session.value = next; dirty.current = true; setError(null); }} onClose={close} onSubmit={event => void submit(event)}
    categories={query.data.catalogs.categories} accounts={query.data.accounts.filter(a => !a.isArchived && a.workspaceId === workspaceId)} spendTypes={spend.data ?? []}
    currencies={budgetEditorCurrencies(query.data)} isCreate isSaving={saving} error={error}
    context={<p>Propuesta del Asistente. {value.recurrence === "none" ? "Conservamos sus fechas exactas, sin renovación automática." : "Elegiste renovación: el primer período empezará hoy, como en el editor de Presupuestos."} Revisa el alcance y el monto antes de crear el presupuesto.</p>} />
    {unsaved ? <UnsavedChangesDialog onKeepEditing={() => setUnsaved(false)} onDiscard={() => { session.value = undefined; onClose(); }} /> : null}</>;
}
