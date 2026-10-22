import { parseMovementProposal, type AssistantMovementDraft } from "./movement-proposal";
import { parseBudgetProposal, type AssistantBudgetDraft } from "./budget-proposal";
import { parseRecurringProposal, type AssistantRecurringDraft } from "./recurring-proposal";
import { parseObligationProposal, type AssistantObligationDraft } from "./obligation-proposal";
import { parseMovementChange, type AssistantMovementChange } from "./movement-change";

export type AssistantMessage = { role: "user" | "assistant"; content: string };
export type AssistantEvidence = { label: string; movementIds: number[] };
export type ProposalStatus = "pending" | "saved" | "discarded" | "unconfirmed";
export type AssistantProposal = { label: string; amount: number; currency: string; href: string; movementDraft?: AssistantMovementDraft; budgetDraft?: AssistantBudgetDraft; recurringDraft?: AssistantRecurringDraft; obligationDraft?: AssistantObligationDraft; movementChange?: AssistantMovementChange; status?: ProposalStatus; statusNote?: string };
/** `suggestions`: preguntas de seguimiento que propone el servidor (máximo 3, como móvil). */
export type AssistantReply = { reply: string; evidence: AssistantEvidence[]; proposals: AssistantProposal[]; remainingToday: number | null; suggestions?: string[] };
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const id = (value: unknown) => (typeof value==="number"||typeof value==="string")&&Number.isSafeInteger(Number(value))&&Number(value)>0;

/** Responses are suggestions, never commands. Payload URLs/HTML/tool calls are not executed. */
export function parseAssistantReply(value: unknown): AssistantReply {
  const raw = object(value);
  if (raw.ok === false) throw new Error(typeof raw.error === "string" ? raw.error : "El Asistente no pudo responder.");
  if (typeof raw.reply !== "string" || !raw.reply.trim()) throw new Error("El Asistente devolvió una respuesta incompleta. Puedes reintentar.");
  const evidence: AssistantEvidence[] = [];
  for (const value of Array.isArray(raw.evidence) ? raw.evidence : []) {
    const row = object(value);
    const ids = Array.isArray(row.movementIds) ? [...new Set(row.movementIds.filter(id).map(Number))] : [];
    if (typeof row.label === "string" && ids.length) evidence.push({label: row.label.slice(0,300),movementIds:ids.slice(0,100)});
  }
  const proposals: AssistantProposal[] = [];
  const drafts = Array.isArray(raw.drafts) && raw.drafts.length ? raw.drafts : raw.draft ? [raw.draft] : [];
  const operations: Record<string,{label:string;href:string}> = {
    expense:{label:"Gasto",href:"/app/movements"},income:{label:"Ingreso",href:"/app/movements"},transfer:{label:"Transferencia",href:"/app/movements"},
    pay_subscription:{label:"Pago de suscripción",href:"/app/subscriptions"},pay_debt:{label:"Pago de deuda",href:"/app/obligations"},
  };
  const add = (value: unknown, label: string, href: string, amountKey="amount") => {
    const row=object(value),amount=typeof row[amountKey]==="number"||typeof row[amountKey]==="string"?Number(row[amountKey]):NaN;
    if (Number.isFinite(amount)&&amount>0&&typeof row.currency==="string"&&/^[A-Z]{3}$/.test(row.currency)) proposals.push({label,href,amount,currency:row.currency});
  };
  for(const value of drafts.slice(0,20)) {
    const row=object(value),operation=operations[String(row.operation)];
    if(operation){
      const before=proposals.length;add(row,operation.label,operation.href);
      const draft=parseMovementProposal(row);
      if(draft&&proposals.length>before)proposals[before].movementDraft=draft;
    }
  }
  const budgetIndex=proposals.length;
  add(raw.budgetDraft,"Presupuesto","/app/budgets","limitAmount");
  const budgetDraft=parseBudgetProposal(raw.budgetDraft);
  if(budgetDraft&&proposals.length>budgetIndex)proposals[budgetIndex].budgetDraft=budgetDraft;
  const obligationIndex=proposals.length;
  add(raw.obligationDraft,"Crédito o deuda","/app/obligations","principalAmount");
  const obligationDraft=parseObligationProposal(raw.obligationDraft);
  if(obligationDraft&&proposals.length>obligationIndex)proposals[obligationIndex].obligationDraft=obligationDraft;
  const recurringIndex=proposals.length;
  if(object(raw.recurringDraft).kind==="subscription")add(raw.recurringDraft,"Suscripción","/app/subscriptions");
  if(object(raw.recurringDraft).kind==="recurring_income")add(raw.recurringDraft,"Ingreso fijo","/app/recurring-income");
  const recurringDraft=parseRecurringProposal(raw.recurringDraft);
  if(recurringDraft&&proposals.length>recurringIndex)proposals[recurringIndex].recurringDraft=recurringDraft;
  // Correcciones o borrados de movimientos ya registrados: cada uno con su tarjeta para confirmar (móvil).
  for(const value of (Array.isArray(raw.movementChanges)?raw.movementChanges:[]).slice(0,10)){
    const change=parseMovementChange(value);if(!change)continue;
    const kind=change.movementType==="expense"?"gasto":"ingreso";
    proposals.push({label:`${change.action==="delete"?"Borrar":"Corregir"} ${kind} #${change.movementId}${change.before.description?` "${change.before.description.slice(0,80)}"`:""}`,href:`/app/movements?period=all&movement=${change.movementId}`,amount:change.after.amount??change.before.amount,currency:change.currency,movementChange:change});
  }
  const suggestions=Array.isArray(raw.suggestions)?raw.suggestions.filter((item):item is string=>typeof item==="string"&&item.trim().length>0).map(item=>item.trim().slice(0,200)).slice(0,3):[];
  return {reply:raw.reply.trim(),evidence,proposals,suggestions,remainingToday:typeof raw.remainingToday==="number"&&Number.isSafeInteger(raw.remainingToday)&&raw.remainingToday>=0?raw.remainingToday:null};
}

export function assistantRequest(message: string, history: AssistantMessage[], workspaceId: number) {
  if (!id(workspaceId)||!message.trim()||message.trim().length>4000) throw new Error("Elige un espacio y escribe una pregunta de hasta 4000 caracteres.");
  if(history.some(row=>!["user","assistant"].includes(row.role)||typeof row.content!=="string"))throw new Error("El historial de conversación no es válido.");
  return {message:message.trim(),workspaceId,history:history.slice(-16).map(row=>({role:row.role,content:row.content.slice(0,3000)}))};
}
