import { useEffect, useRef } from "react";
import { DataState } from "../../../components/ui/data-state";
import { Button } from "../../../components/ui/button";
import { formatCurrency } from "../../../lib/formatting/money";
import { useWorkspaceSnapshotQuery, useCreateMovementMutation, type WorkspaceSnapshot, type MovementFormInput } from "../../../services/queries/workspace-data";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { useProFeatureAccess } from "../../shared/use-pro-feature-access";
import { QuickMovementDialog } from "../../movements/components/quick-movement-dialog";
import { prepareMovementProposal, type AssistantMovementDraft } from "../lib/movement-proposal";
import { createAssistantMovementSaver } from "../lib/proposal-save";

type Input = MovementFormInput & { userId: string; workspaceId: number };
export type AssistantMovementSession = {
  saver?: ReturnType<typeof createAssistantMovementSaver>;
  live?: { current: () => boolean; snapshot: () => WorkspaceSnapshot | null; insert: (input: Input) => Promise<number> };
};

export function AssistantMovementReview({ draft, intentKey, userId, workspaceId, session, onClose, onSaved }: {
  draft: AssistantMovementDraft; intentKey: string; userId: string; workspaceId: number; session: AssistantMovementSession;
  onClose: () => void; onSaved: (message: string) => void;
}) {
  const auth = useAuth(), { activeWorkspace } = useActiveWorkspace(), access = useProFeatureAccess();
  const query = useWorkspaceSnapshotQuery(activeWorkspace, auth.user?.id, auth.profile);
  const mutation = useCreateMovementMutation(workspaceId, userId);
  const alive = useRef(true);
  const currentScope = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const sameScope = activeWorkspace?.id === workspaceId && auth.user?.id === userId && !activeWorkspace?.isArchived;
  currentScope.current = sameScope;
  const scopedData = sameScope && !query.isPlaceholderData && query.data?.workspace.id === workspaceId;
  const ready = scopedData && access.canAccessProFeatures && !query.isFetching && !query.isError;
  session.live = { current: () => alive.current && ready, snapshot: () => ready ? query.data ?? null : null, insert: mutation.mutateAsync };
  if (!session.saver) session.saver = createAssistantMovementSaver({ userId, workspaceId, currency: draft.currency, intentKey,
    isCurrent: () => session.live?.current() ?? false, snapshot: () => session.live?.snapshot() ?? null,
    insert: input => { if (!session.live) throw new Error("El formulario ya no está disponible."); return session.live.insert(input); } });
  // Keep the shared form mounted during background refreshes, including its unsaved fields.
  if (!scopedData || !query.data) return <DataState title={query.isError ? "No se pudo preparar el borrador" : "Comprobando el espacio y sus cuentas"}
    description="No se registra nada hasta revisar el formulario y guardar. La lectura debe pertenecer al usuario y espacio actuales."
    action={<div className="flex gap-3"><Button onClick={() => void query.refetch()}>Reintentar lectura</Button><Button variant="ghost" onClick={onClose}>Cerrar revisión</Button></div>} />;
  const prepared = prepareMovementProposal(draft, query.data);
  const previous = session.saver.attempted();
  const localInput = (date: string) => { const value = new Date(date); return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
  const initialDraft = previous ? {
    amount: String(previous.movementType === "income" ? previous.destinationAmount : previous.sourceAmount),
    accountId: String((previous.movementType === "income" ? previous.destinationAccountId : previous.sourceAccountId) ?? ""),
    sourceAccountId: String(previous.sourceAccountId ?? ""), destinationAccountId: String(previous.destinationAccountId ?? ""),
    destinationAmount: String(previous.destinationAmount ?? ""), description: previous.description,
    categoryId: String(previous.categoryId ?? ""), counterpartyId: String(previous.counterpartyId ?? ""), spendTypeId: String(previous.spendTypeId ?? ""),
    occurredAt: localInput(previous.occurredAt), status: previous.status === "voided" ? "posted" as const : previous.status,
  } : prepared.initialDraft;
  return <QuickMovementDialog snapshot={query.data} userId={userId} workspaceId={workspaceId}
    initialKind={previous && ["expense", "income", "transfer"].includes(previous.movementType) ? previous.movementType as "expense" | "income" | "transfer" : prepared.kind}
    initialDraft={initialDraft} sourceCurrencyCode={draft.currency} allowSplit={false} proAccessEnabled={access.canAccessProFeatures}
    title="Revisar movimiento sugerido" context={<p>La IA propuso {draft.currency} {draft.amount.toFixed(2)}. {prepared.unresolved.length ? `Revisa: ${prepared.unresolved.join(", ")}. No elegimos coincidencias ambiguas.` : "Comprueba monto, cuentas y fecha antes de guardar."}</p>}
    isSubmitting={mutation.isPending} submitMovement={async input => {
      return session.saver!.save(input);
    }} onClose={() => { if (alive.current && currentScope.current) onClose(); }} onCreated={message => {
      const saved = session.saver?.confirmed();
      if (saved && alive.current && currentScope.current) {
        const value = saved.input;
        const primaryAmount = value.movementType === "income" ? value.destinationAmount : value.sourceAmount;
        const destinationCurrency = query.data.accounts.find(a => a.id === value.destinationAccountId)?.currencyCode;
        const result = `${value.movementType === "income" ? "Ingreso" : value.movementType === "transfer" ? "Transferencia" : "Gasto"} ${formatCurrency(primaryAmount ?? 0, draft.currency)}` +
          (value.movementType === "transfer" ? ` → ${formatCurrency(value.destinationAmount ?? 0, destinationCurrency ?? draft.currency)}` : "");
        onSaved(`Movimiento #${saved.id}. ${result}. ${message}`);
      }
    }} />;
}
