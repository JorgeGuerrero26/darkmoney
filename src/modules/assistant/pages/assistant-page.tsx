import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { askAssistant, useAssistantInsight } from "../../../services/queries/assistant";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { useProFeatureAccess } from "../../shared/use-pro-feature-access";
import { notificationId } from "../../notifications/lib/notification-navigation";
import { useAssistantChats } from "../hooks/use-assistant-chats";
import { AssistantChatsPanel } from "../components/assistant-chats-panel";
import { AssistantProposalRow } from "../components/assistant-proposal-row";
import { assistantHistoryTurn } from "../lib/proposal-memory";

export function AssistantPage() {
  const {user}=useAuth();const [params]=useSearchParams();
  const noticeId=notificationId(params.get("noticeId"));
  return <AssistantConversation key={`${user?.id}:${noticeId??"new"}`} userId={user?.id} noticeId={noticeId}/>;
}

function AssistantConversation({userId,noticeId}:{userId?:string;noticeId:number|null}) {
  const {workspaces,activeWorkspace,isFetching,isError,setActiveWorkspaceId}=useActiveWorkspace();
  const access=useProFeatureAccess();const insight=useAssistantInsight(userId,noticeId);
  // Legacy assistant notices have no workspace. Never guess its original space or auto-send.
  const [workspaceId,setWorkspaceId]=useState(noticeId?"":String(activeWorkspace?.id??""));
  const [question,setQuestion]=useState("");
  const chats=useAssistantChats(userId,Number(workspaceId)||undefined,Boolean(noticeId));
  const turns=chats.turns;
  const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  const initialized=useRef(false);const flight=useRef<AbortController|null>(null);const lock=useRef(false);
  const scope=useRef("");scope.current=`${userId}:${workspaceId}:${activeWorkspace?.id}:${chats.activeId}`;
  useEffect(()=>{if(insight.data&&!initialized.current){initialized.current=true;setQuestion(insight.data.prompt);}},[insight.data]);
  useEffect(()=>()=>{flight.current?.abort();},[userId,workspaceId]);
  useEffect(()=>{
    flight.current?.abort();flight.current=null;lock.current=false;setBusy(false);setError("");
    if(workspaceId&&activeWorkspace)setWorkspaceId(String(activeWorkspace.id));
  },[activeWorkspace?.id]);
  const selected=workspaces.find(row=>String(row.id)===workspaceId&&!row.isArchived);
  const lastResponse=[...turns].reverse().find(row=>row.response)?.response;
  async function send(event:FormEvent) {
    event.preventDefault();if(lock.current||!userId||!selected||!chats.ready||isError||isFetching||!access.canAccessProFeatures)return;
    lock.current=true;setBusy(true);setError("");
    const controller=new AbortController();flight.current=controller;const originalScope=scope.current;
    const message=question.trim();
    try {
      const response=await askAssistant(message,turns.map(assistantHistoryTurn),selected.id,controller.signal);
      if(controller.signal.aborted||scope.current!==originalScope)return;
      chats.append([{role:"user",content:message},{role:"assistant",content:response.reply,response}]);setQuestion("");
    }catch(e){if(!controller.signal.aborted&&scope.current===originalScope)setError(e instanceof Error?e.message:"No se pudo consultar. Puedes reintentar.");}
    finally {if(flight.current===controller){flight.current=null;lock.current=false;setBusy(false);}}
  }
  if(noticeId&&(insight.isPending||insight.isError))return <DataState title={insight.isError?"No se pudo abrir el aviso":"Consultando el aviso"}
    description={insight.error instanceof Error?insight.error.message:"Preparando la pregunta, sin enviarla."} action={<div className="flex gap-3"><Button onClick={()=>void insight.refetch()}>Reintentar</Button><Link to="/app/notifications">Volver a Avisos</Link></div>}/>;
  return <section className="mx-auto w-full max-w-3xl space-y-6">
    <header className="border-b border-white/10 pb-5"><h1 className="font-display text-3xl font-semibold text-ink">Asistente</h1><p className="mt-2 text-sm text-storm">Consulta tus datos. Ninguna sugerencia registra, cobra o paga por sí sola.</p></header>
    {insight.data?<div className="border-b border-white/10 pb-5"><h2 className="text-lg font-semibold text-ink">{insight.data.title}</h2><p className="mt-2 whitespace-pre-line text-sm text-storm">{insight.data.body}</p><p className="mt-3 text-xs text-storm">El aviso no identifica su espacio original. Elige dónde consultar y revisa la pregunta antes de enviarla.</p></div>:null}
    <label className="block text-sm text-storm">Espacio de consulta<select aria-label="Espacio de consulta" className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#1a1917] px-3 text-ink" disabled={busy||isFetching||isError}
      value={workspaceId} onChange={event=>{const value=event.target.value;setWorkspaceId(value);if(workspaces.some(row=>String(row.id)===value&&!row.isArchived))setActiveWorkspaceId(Number(value));setError("");}}><option value="">Elige un espacio</option>{workspaces.filter(row=>!row.isArchived).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    {isError?<p role="alert" className="text-sm text-ink">No se pudo comprobar tus espacios. La consulta no se enviará.</p>:null}
    <AssistantChatsPanel key={workspaceId} chats={chats.chats} activeId={chats.activeId} busy={busy||!chats.ready}
      onSelect={id=>{chats.select(id);setQuestion("");setError("");}} onRename={chats.rename}
      onRemove={id=>{chats.remove(id);if(id===chats.activeId){setQuestion("");setError("");}}}/>
    {chats.error?<p role="status" className="text-xs text-storm">{chats.error}</p>:null}
    <div aria-live="polite" className="divide-y divide-white/10">{turns.map(turn=><article className="py-5" key={turn.id}>
      <p className="mb-2 text-xs text-storm">{turn.role==="user"?"Tú":"Asistente"}</p><p className="whitespace-pre-line text-sm leading-7 text-ink">{turn.content}</p>
      {turn.response?.evidence.map((e,i)=><div className="mt-3 text-xs text-storm" key={i}>{e.label}: {e.movementIds.map(id=><Link className="mr-3 underline underline-offset-4" key={id} to={`/app/movements?period=all&movement=${id}`}>Movimiento #{id}</Link>)}</div>)}
      {turn.response?.proposals.length?<div className="mt-4 border-t border-white/10 pt-3"><p className="text-xs text-storm">Sugerencias sin registrar automáticamente. Revisa y confirma cada una:</p>{turn.response.proposals.map((proposal,i)=><AssistantProposalRow key={`${turn.id}:${i}`} proposal={proposal}
        intentKey={`assistant:${userId}:${workspaceId}:${turn.id}:${i}`} userId={userId ?? ""} workspaceId={Number(workspaceId)}
        busy={busy||!chats.ready||!selected||selected.id!==activeWorkspace?.id||isFetching||isError||!access.canAccessProFeatures}
        onOutcome={(status,note)=>chats.markProposal(turn.id,i,status,note)}/>)}</div>:null}
    </article>)}</div>
    <form onSubmit={event=>void send(event)} className="space-y-3"><label className="block text-sm text-storm">Tu pregunta<textarea aria-label="Tu pregunta" maxLength={4000} rows={3} disabled={busy} value={question} onChange={e=>setQuestion(e.target.value)} className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-[#1a1917] p-3 text-ink focus:outline-none focus:ring-1 focus:ring-white/30" placeholder="¿Qué quieres revisar?"/></label>
      {error?<p role="alert" className="text-sm text-ink">{error}</p>:null}
      {!access.canAccessProFeatures&&!access.isLoadingEntitlement?<p className="text-sm text-storm">El Asistente requiere DarkMoney Pro.</p>:null}
      <div className="flex flex-wrap items-center gap-3"><Button disabled={busy||!chats.ready||!question.trim()||!selected||isFetching||isError||!access.canAccessProFeatures||lastResponse?.remainingToday===0} type="submit">{busy?"Consultando…":"Enviar pregunta"}</Button>
      {busy?<Button variant="ghost" onClick={()=>{flight.current?.abort();flight.current=null;lock.current=false;setBusy(false);}}>Cancelar consulta</Button>:<Button variant="ghost" onClick={()=>{chats.startNew();setQuestion("");setError("");}}>Nueva conversación</Button>}
      {lastResponse?.remainingToday!=null?<span className="text-xs text-storm">{lastResponse.remainingToday} consultas disponibles hoy</span>:null}</div>
    </form><p className="text-xs text-storm">El texto del chat se guarda en este navegador por usuario y espacio. Al reabrirlo, borradores y evidencia no se restauran como acciones. Puedes pedir al Asistente que recuerde o elimine preferencias; esas acciones usan el contrato del servidor.</p>
  </section>;
}
