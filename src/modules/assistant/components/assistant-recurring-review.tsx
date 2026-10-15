import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { formatCurrency } from "../../../lib/formatting/money";
import { useWorkspaceSnapshotQuery, useCreateSubscriptionMutation, useCreateRecurringIncomeMutation, getQueryErrorMessage, type SubscriptionFormInput, type RecurringIncomeFormInput } from "../../../services/queries/workspace-data";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { useProFeatureAccess } from "../../shared/use-pro-feature-access";
import { buildSubscriptionEditorInput, buildRecurringIncomeEditorInput } from "../../shared/recurring-editor-input";
import { SubscriptionEditorDialog } from "../../subscriptions/components/subscription-editor-dialog";
import { RecurringIncomeEditorDialog } from "../../recurring-income/components/recurring-income-editor-dialog";
import { prepareRecurringProposal, type AssistantRecurringDraft, type RecurringEditorDraft } from "../lib/recurring-proposal";
import { createAssistantResourceSaver } from "../lib/resource-proposal-save";

type Scope = { userId: string; workspaceId: number };
type Input = { kind: "subscription"; value: SubscriptionFormInput & Scope } | { kind: "recurring_income"; value: RecurringIncomeFormInput & Scope };
export type AssistantRecurringSession = { value?: RecurringEditorDraft; createdId?: number; saver?: ReturnType<typeof createAssistantResourceSaver<Input>>;
  live?: { current: () => boolean; insert: (input: Input) => Promise<void> } };

export function AssistantRecurringReview({ draft, userId, workspaceId, session, onClose, onSaved, onUnconfirmed }: {
  draft: AssistantRecurringDraft; userId: string; workspaceId: number; session: AssistantRecurringSession;
  onClose: () => void; onSaved: (note: string) => void; onUnconfirmed: (note: string) => void;
}) {
  const auth = useAuth(), { activeWorkspace } = useActiveWorkspace(), access = useProFeatureAccess();
  const query = useWorkspaceSnapshotQuery(activeWorkspace, auth.user?.id, auth.profile);
  const subscriptions = useCreateSubscriptionMutation(workspaceId, userId), incomes = useCreateRecurringIncomeMutation(workspaceId, userId);
  const alive = useRef(true), scope = useRef(false), lock = useRef(false), dirty = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  scope.current = auth.user?.id === userId && activeWorkspace?.id === workspaceId && !activeWorkspace?.isArchived;
  const scoped = scope.current && !query.isPlaceholderData && query.data?.workspace.id === workspaceId;
  const ready = scoped && access.canAccessProFeatures && !query.isFetching && !query.isError;
  const [editor, setEditor] = useState<RecurringEditorDraft | null>(() => session.value ?? null);
  const [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false), [unsaved, setUnsaved] = useState(false);
  useEffect(() => { if (scoped && query.data) setEditor(previous => previous ?? prepareRecurringProposal(draft, query.data)); }, [scoped, query.data, draft]);
  session.live = { current: () => alive.current && ready, insert: async input => {
    const result = input.kind === "subscription" ? await subscriptions.mutateAsync(input.value) : await incomes.mutateAsync(input.value);
    if (!Number.isSafeInteger(result?.id) || result.id <= 0) throw new Error("El servidor no confirmó el identificador del registro.");
    session.createdId = result.id;
  } };
  if (!session.saver) session.saver = createAssistantResourceSaver<Input>({ isCurrent: () => session.live?.current() ?? false,
    insert: input => { if (!session.live) throw new Error("El formulario ya no está disponible."); return session.live.insert(input); } });
  function close() { if (lock.current) return; if (dirty.current) setUnsaved(true); else onClose(); }
  function update(field: string, value: unknown) {
    setEditor(previous => {
      if (!previous) return previous;
      const next = { ...previous, value: { ...previous.value, [field]: value } } as RecurringEditorDraft;
      session.value = next; return next;
    }); dirty.current = true; setError(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current || unsaved || !editor || !query.data) return;
    setError(null); lock.current = true; setSaving(true);
    try {
      const identity = { userId, workspaceId };
      const input: Input = editor.kind === "subscription" ? { kind: editor.kind, value: { ...buildSubscriptionEditorInput(editor.value, query.data), ...identity } }
        : { kind: editor.kind, value: { ...buildRecurringIncomeEditorInput(editor.value, query.data), ...identity } };
      await session.saver!.save(input);
      const saved = session.saver!.confirmed();
      if (saved && alive.current && scope.current) {
        const date = saved.kind === "subscription" ? saved.value.nextDueDate : saved.value.nextExpectedDate;
        onSaved(`${saved.kind === "subscription" ? "Suscripción" : "Ingreso fijo"} #${session.createdId}: «${saved.value.name}», ${formatCurrency(saved.value.amount, saved.value.currencyCode)}; próxima fecha ${date}. Se creó el calendario, no una confirmación manual de pago o llegada.`);
      }
    } catch (e) {
      if (alive.current && scope.current) {
        if (session.saver!.uncertain()) onUnconfirmed(`No se pudo confirmar la respuesta del servidor. El calendario podría haberse creado: comprueba ${draft.kind === "subscription" ? "Suscripciones" : "Ingresos fijos"} antes de repetirlo.`);
        else setError(getQueryErrorMessage(e, "No se pudo crear el calendario."));
      }
    } finally { lock.current = false; if (alive.current) setSaving(false); }
  }
  if (!scoped || !query.data || !editor) return <DataState title={query.isError ? "No se pudo preparar la propuesta" : "Comprobando el espacio"}
    description="No se registra nada hasta revisar y confirmar el formulario." action={<div className="flex gap-3"><Button onClick={() => void query.refetch()}>Reintentar lectura</Button><Button variant="ghost" onClick={onClose}>Cerrar revisión</Button></div>} />;
  const props = { accounts: query.data.accounts.filter(a => a.workspaceId === workspaceId), baseCurrencyCode: query.data.workspace.baseCurrencyCode,
    categories: query.data.catalogs.categories, counterparties: query.data.catalogs.counterparties, movements: query.data.movements,
    clearFieldError: () => setError(null), closeEditor: close, feedback: error ? { tone: "error" as const, title: "Revisa el calendario", description: error } : null,
    invalidFields: new Set<string>(), isCreateMode: true, isSaving: saving, onSubmit: submit, updateFormState: update,
    context: <p>Propuesta del Asistente. Revisa cuenta, categoría, frecuencia y fecha; los nombres ambiguos quedan sin asignar. {editor.kind === "subscription" && editor.value.autoCreateMovement ? "Activaste el registro automático de gastos en este calendario." : "Guardar este calendario no registra un pago ni confirma una llegada."}</p> };
  return <>{editor.kind === "subscription" ? <SubscriptionEditorDialog {...props} formState={editor.value} /> : <RecurringIncomeEditorDialog {...props} formState={editor.value} />}
    {unsaved ? <UnsavedChangesDialog onKeepEditing={() => setUnsaved(false)} onDiscard={() => { session.value = undefined; onClose(); }} /> : null}</>;
}
