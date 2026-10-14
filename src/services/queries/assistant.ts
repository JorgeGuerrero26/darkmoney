import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import { invokeAuthenticatedFunction } from "./workspace-data";
import { assistantRequest, parseAssistantReply, type AssistantMessage } from "../../modules/assistant/lib/assistant-contract";

export async function readAssistantInsight(client: Pick<SupabaseClient,"from">, userId: string, noticeId: number) {
  if(!userId||!Number.isSafeInteger(noticeId)||noticeId<=0)throw new Error("Aviso no válido.");
  const {data,error}=await client.from("notifications").select("id,kind,title,body,payload").eq("user_id",userId).eq("id",noticeId).maybeSingle();
  if(error)throw error;
  if(!data||data.kind!=="assistant_insight"||Number(data.id)!==noticeId)throw new Error("El aviso del Asistente ya no está disponible para este usuario.");
  const payload=data.payload&&typeof data.payload==="object"&&!Array.isArray(data.payload)?data.payload:{};
  const prompt=typeof payload.assistantPrompt==="string"?payload.assistantPrompt.trim():"";
  if(prompt.length>4000)throw new Error("La pregunta del aviso es demasiado larga. Abre una conversación nueva.");
  return {id:noticeId,title:String(data.title??"Asistente"),body:String(data.body??""),prompt};
}
export function useAssistantInsight(userId?: string,noticeId?: number|null) {
  return useQuery({queryKey:["assistant-insight",userId,noticeId],enabled:Boolean(userId&&noticeId),retry:1,
    queryFn:()=>{if(!supabase||!userId||!noticeId)throw new Error("No hay sesión para leer el aviso.");return readAssistantInsight(supabase,userId,noticeId);}});
}
export async function askAssistant(message: string,history: AssistantMessage[],workspaceId: number,signal?: AbortSignal) {
  const request=assistantRequest(message,history,workspaceId);
  return parseAssistantReply(await invokeAuthenticatedFunction<unknown>("assistant-chat",request,{signal}));
}
