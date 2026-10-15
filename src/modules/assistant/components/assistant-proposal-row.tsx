import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AssistantProposal, ProposalStatus } from "../lib/assistant-contract";
import { proposalCanReview } from "../lib/proposal-memory";
import { AssistantMovementReview, type AssistantMovementSession } from "./assistant-movement-review";
import { AssistantBudgetReview, type AssistantBudgetSession } from "./assistant-budget-review";
import { AssistantRecurringReview, type AssistantRecurringSession } from "./assistant-recurring-review";
import { AssistantObligationReview, type AssistantObligationSession } from "./assistant-obligation-review";
import { AssistantPaymentReview, type AssistantPaymentSession } from "./assistant-payment-review";

export function AssistantProposalRow({ proposal, intentKey, workspaceId, userId, busy, onOutcome }: {
  proposal: AssistantProposal; intentKey: string; workspaceId: number; userId: string; busy: boolean;
  onOutcome: (status: ProposalStatus, note?: string) => void;
}) {
  const [open, setOpen] = useState(false); const session = useRef<AssistantMovementSession>({});
  const budgetSession = useRef<AssistantBudgetSession>({});
  const recurringSession = useRef<AssistantRecurringSession>({});
  const obligationSession = useRef<AssistantObligationSession>({});
  const paymentSession = useRef<AssistantPaymentSession>({});
  const isPayment = proposal.movementDraft && ["pay_subscription", "pay_debt"].includes(proposal.movementDraft.operation);
  const pending = !proposal.status || proposal.status === "pending";
  return <div className="border-b border-white/10 py-3">
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink">
      <span>{proposal.label} · {formatCurrency(proposal.amount, proposal.currency)}</span>
      {pending ? <div className="flex items-center gap-3">
        {proposalCanReview(proposal) ? <Button variant="ghost" disabled={busy} onClick={() => setOpen(true)}>Revisar y registrar</Button> : <Link className="underline underline-offset-4" to={proposal.href}>Revisar en el módulo</Link>}
        <Button variant="ghost" disabled={busy} onClick={() => onOutcome("discarded")}>Descartar</Button>
      </div> : proposal.status === "unconfirmed" ? <Link className="underline underline-offset-4" to={proposal.href}>Comprobar en el módulo</Link> : <span className="text-xs text-storm">{proposal.status === "saved" ? "Guardado" : "Descartado"}</span>}
    </div>
    {proposal.statusNote ? <p className="mt-2 text-xs text-storm">{proposal.statusNote}</p> : null}
    {open && pending && proposal.movementDraft && !isPayment ? <AssistantMovementReview draft={proposal.movementDraft} intentKey={intentKey}
      workspaceId={workspaceId} userId={userId} session={session.current} onClose={() => setOpen(false)}
      onSaved={note => { onOutcome("saved", note); setOpen(false); }} /> : null}
    {open && pending && proposal.movementDraft && isPayment ? <AssistantPaymentReview draft={proposal.movementDraft}
      workspaceId={workspaceId} userId={userId} session={paymentSession.current} onClose={() => setOpen(false)}
      onSaved={note => { onOutcome("saved", note); setOpen(false); }}
      onUnconfirmed={note => { onOutcome("unconfirmed", note); setOpen(false); }} /> : null}
    {open && pending && proposal.budgetDraft ? <AssistantBudgetReview draft={proposal.budgetDraft}
      workspaceId={workspaceId} userId={userId} session={budgetSession.current} onClose={() => setOpen(false)}
      onSaved={note => { onOutcome("saved", note); setOpen(false); }}
      onUnconfirmed={note => { onOutcome("unconfirmed", note); setOpen(false); }} /> : null}
    {open && pending && proposal.recurringDraft ? <AssistantRecurringReview draft={proposal.recurringDraft}
      workspaceId={workspaceId} userId={userId} session={recurringSession.current} onClose={() => setOpen(false)}
      onSaved={note => { onOutcome("saved", note); setOpen(false); }}
      onUnconfirmed={note => { onOutcome("unconfirmed", note); setOpen(false); }} /> : null}
    {open && pending && proposal.obligationDraft ? <AssistantObligationReview draft={proposal.obligationDraft}
      workspaceId={workspaceId} userId={userId} session={obligationSession.current} onClose={() => setOpen(false)}
      onSaved={note => { onOutcome("saved", note); setOpen(false); }}
      onUnconfirmed={note => { onOutcome("unconfirmed", note); setOpen(false); }} /> : null}
  </div>;
}
