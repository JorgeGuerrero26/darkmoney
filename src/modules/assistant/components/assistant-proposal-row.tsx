import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AssistantProposal, ProposalStatus } from "../lib/assistant-contract";
import { proposalCanReview } from "../lib/proposal-memory";
import { AssistantMovementReview, type AssistantMovementSession } from "./assistant-movement-review";

export function AssistantProposalRow({ proposal, intentKey, workspaceId, userId, busy, onOutcome }: {
  proposal: AssistantProposal; intentKey: string; workspaceId: number; userId: string; busy: boolean;
  onOutcome: (status: ProposalStatus, note?: string) => void;
}) {
  const [open, setOpen] = useState(false); const session = useRef<AssistantMovementSession>({});
  const pending = !proposal.status || proposal.status === "pending";
  return <div className="border-b border-white/10 py-3">
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink">
      <span>{proposal.label} · {formatCurrency(proposal.amount, proposal.currency)}</span>
      {pending ? <div className="flex items-center gap-3">
        {proposalCanReview(proposal) ? <Button variant="ghost" disabled={busy} onClick={() => setOpen(true)}>Revisar y registrar</Button> : <Link className="underline underline-offset-4" to={proposal.href}>Revisar en el módulo</Link>}
        <Button variant="ghost" disabled={busy} onClick={() => onOutcome("discarded")}>Descartar</Button>
      </div> : <span className="text-xs text-storm">{proposal.status === "saved" ? "Guardado" : "Descartado"}</span>}
    </div>
    {proposal.statusNote ? <p className="mt-2 text-xs text-storm">{proposal.statusNote}</p> : null}
    {open && pending && proposal.movementDraft ? <AssistantMovementReview draft={proposal.movementDraft} intentKey={intentKey}
      workspaceId={workspaceId} userId={userId} session={session.current} onClose={() => setOpen(false)}
      onSaved={note => { onOutcome("saved", note); setOpen(false); }} /> : null}
  </div>;
}
