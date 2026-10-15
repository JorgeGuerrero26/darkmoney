import type { AssistantMessage, AssistantProposal, AssistantReply } from "./assistant-contract";

/** Preserve the outcome even when a long reply would otherwise consume the server's 3000-char history limit. */
export function assistantHistoryTurn(turn: AssistantMessage & { response?: AssistantReply }): AssistantMessage {
  if (!turn.response?.proposals.length) return { role: turn.role, content: turn.content };
  const statuses = turn.response.proposals.map((p, i) => `#${i + 1}: ${p.status === "saved" ? "el usuario lo GUARDÓ" : p.status === "discarded" ? "el usuario lo DESCARTÓ" : p.status === "unconfirmed" ? "RESULTADO INCIERTO; no repetir" : "SIN CONFIRMAR"}`).join("; ");
  const descriptions = turn.response.proposals.map((p, i) => `#${i + 1} propuesto: ${p.label} ${p.currency} ${p.amount.toFixed(2)}${p.statusNote ? `; resultado: ${p.statusNote}` : ""}`).join(" | ").slice(0, 1300);
  const note = `[Propuestas: ${statuses}. Detalle: ${descriptions}]`;
  return { role: turn.role, content: `${turn.content.slice(0, Math.max(0, 2999 - note.length))}\n${note}` };
}

export function proposalCanReview(proposal: AssistantProposal) {
  return Boolean(proposal.budgetDraft || proposal.recurringDraft || proposal.movementDraft && ["expense", "income", "transfer"].includes(proposal.movementDraft.operation));
}
