export type AssistantMessage = { role: "user" | "assistant"; content: string };
export type AssistantEvidence = { label: string; movementIds: number[] };
export type AssistantProposal = { label: string; amount: number; currency: string; href: string };
export type AssistantReply = { reply: string; evidence: AssistantEvidence[]; proposals: AssistantProposal[]; remainingToday: number | null };
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
    const row=object(value),amount=Number(row[amountKey]);
    if (Number.isFinite(amount)&&amount>0&&typeof row.currency==="string"&&/^[A-Z]{3}$/.test(row.currency)) proposals.push({label,href,amount,currency:row.currency});
  };
  for(const value of drafts.slice(0,20)) {
    const row=object(value),operation=operations[String(row.operation)];
    if(operation)add(row,operation.label,operation.href);
  }
  add(raw.budgetDraft,"Presupuesto","/app/budgets","limitAmount");
  add(raw.obligationDraft,"Crédito o deuda","/app/obligations","principalAmount");
  if(object(raw.recurringDraft).kind==="subscription")add(raw.recurringDraft,"Suscripción","/app/subscriptions");
  if(object(raw.recurringDraft).kind==="recurring_income")add(raw.recurringDraft,"Ingreso fijo","/app/recurring-income");
  return {reply:raw.reply.trim(),evidence,proposals,remainingToday:typeof raw.remainingToday==="number"&&Number.isSafeInteger(raw.remainingToday)&&raw.remainingToday>=0?raw.remainingToday:null};
}

export function assistantRequest(message: string, history: AssistantMessage[], workspaceId: number) {
  if (!id(workspaceId)||!message.trim()||message.trim().length>4000) throw new Error("Elige un espacio y escribe una pregunta de hasta 4000 caracteres.");
  if(history.some(row=>!["user","assistant"].includes(row.role)||typeof row.content!=="string"))throw new Error("El historial de conversación no es válido.");
  return {message:message.trim(),workspaceId,history:history.slice(-16).map(row=>({role:row.role,content:row.content.slice(0,3000)}))};
}
