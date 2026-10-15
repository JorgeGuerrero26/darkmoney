import { useCallback, useEffect, useRef, useState } from "react";

import { useDashboardAiSummaryMutation } from "../../../services/queries/workspace-data";
import type { DashboardAiDailyCache, DashboardAiTone } from "../lib/dashboard-ai-content";

const TONE_KEY_PREFIX = "darkmoney.dashboard.aiTone";
const SUMMARY_CACHE_KEY_PREFIX = "darkmoney.dashboard.aiSummaryCache";

/** Fecha de uso en zona Lima ("YYYY-MM-DD"), igual que el móvil. */
export function getDashboardAiUsageDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function readStored<T>(key: string | null): T | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string | null, value: unknown) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function useDashboardAiSummary({
  userId,
  workspaceId,
  currencyCode,
  isAdmin = false,
}: {
  userId?: string | null;
  workspaceId?: number | null;
  currencyCode?: string;
  isAdmin?: boolean;
}) {
  const toneKey = userId ? `${TONE_KEY_PREFIX}.${userId}` : null;
  // Older scoped replies were based on net worth. Keep quota, never reuse that explanation.
  const cacheKey = userId && workspaceId && currencyCode ? `${SUMMARY_CACHE_KEY_PREFIX}.${userId}.${workspaceId}.${currencyCode}.liquid-v1` : null;
  const usageKey = userId ? `${SUMMARY_CACHE_KEY_PREFIX}.usage.${userId}` : null;
  const expectedWorkspaceId=workspaceId;

  const [tone, setToneState] = useState<DashboardAiTone>("personal");
  const [cacheState, setCacheState] = useState<{key:string|null;value:DashboardAiDailyCache|null}>({key:null,value:null});
  const cache=cacheState.key===cacheKey?cacheState.value:null;
  const [usage,setUsage]=useState<{key:string|null;date:string|null}>({key:null,date:null});
  const [localError,setLocalError]=useState<{key:string|null;value:unknown}|null>(null);
  const currentScope=useRef(cacheKey);currentScope.current=cacheKey;
  const flight=useRef<AbortController|null>(null);
  const summaryMutation = useDashboardAiSummaryMutation();

  // Hidratar tono + caché al montar (o al cambiar de usuario).
  useEffect(() => {
    const storedTone = readStored<DashboardAiTone>(toneKey);
    if (storedTone === "managerial" || storedTone === "personal") {
      setToneState(storedTone);
    }
    else setToneState("personal");
    const stored=readStored<DashboardAiDailyCache>(cacheKey);
    const valid=stored&&stored.responses&&typeof stored.usageDate==="string"&&["personal","managerial"].every(tone=>{
      const reply=stored.responses[tone as DashboardAiTone];return !reply||(typeof reply.reply==="string"&&typeof reply.generatedAt==="string"&&Array.isArray(reply.complexTerms)&&reply.complexTerms.every(term=>term&&typeof term.term==="string"&&typeof term.explanation==="string"));
    });
    setCacheState({key:cacheKey,value:valid?stored:null});
    // Legacy user-only replies are never displayed; their usage timestamp only preserves the quota.
    const legacy=readStored<DashboardAiDailyCache>(userId?`${SUMMARY_CACHE_KEY_PREFIX}.${userId}`:null);
    const used=readStored<string>(usageKey);
    setUsage({key:usageKey,date:typeof used==="string"?used:legacy?.lastUsedAt?legacy.usageDate:null});
    setLocalError(null);
  }, [toneKey, cacheKey,usageKey,userId]);
  useEffect(()=>()=>{flight.current?.abort();},[cacheKey]);

  const setTone = useCallback(
    (next: DashboardAiTone) => {
      setToneState(next);
      writeStored(toneKey, next);
    },
    [toneKey],
  );

  const setCache = useCallback(
    (updater: (current: DashboardAiDailyCache | null) => DashboardAiDailyCache) => {
      setCacheState((current) => {
        const next = updater(current.key===cacheKey?current.value:null);
        writeStored(cacheKey, next);
        return {key:cacheKey,value:next};
      });
    },
    [cacheKey],
  );

  const usageDate = getDashboardAiUsageDate();
  // 1 generación por día por usuario (los admins no tienen límite).
  const limitReached =
    !isAdmin && ((usage.key===usageKey&&usage.date===usageDate)||(cache?.usageDate === usageDate && Boolean(cache?.lastUsedAt)));
  const currentResponse =
    cache?.usageDate === usageDate ? cache.responses[tone] ?? null : null;

  const requestSummary = useCallback(
    async (requestedWorkspaceId: number, summary: Record<string, unknown>) => {
      if(!cacheKey||requestedWorkspaceId!==expectedWorkspaceId||summary.currency!==currencyCode||flight.current)throw new Error("Espera y revisa el espacio y moneda antes de consultar.");
      if(limitReached)throw new Error("Ya usaste tu explicación de hoy.");
      const original=cacheKey;const controller=new AbortController();flight.current=controller;setLocalError(null);
      try {
      const response = await summaryMutation.mutateAsync({ workspaceId:requestedWorkspaceId, summary, tone,signal:controller.signal });
      if(!response||response.ok===false||typeof response.reply!=="string"||!response.reply.trim())throw new Error("No se pudo confirmar la explicación de la IA.");
      const generatedAt = new Date().toISOString();
      writeStored(usageKey,usageDate);
      if(controller.signal.aborted||currentScope.current!==original)return response;
      setUsage({key:usageKey,date:usageDate});
      setCache((current) => ({
        usageDate,
        lastUsedAt: generatedAt,
        responses: {
          ...(current?.usageDate === usageDate ? current.responses : {}),
          [tone]: {
            reply: response.reply,
            complexTerms: Array.isArray(response.complexTerms)?response.complexTerms.filter(term=>term&&typeof term.term==="string"&&typeof term.explanation==="string"):[],
            generatedAt,
          },
        },
      }));
      return response;
      }catch(error){if(!controller.signal.aborted&&currentScope.current===original)setLocalError({key:original,value:error});throw error;}
      finally {if(flight.current===controller)flight.current=null;}
    },
    [summaryMutation, tone, usageDate, setCache,cacheKey,currencyCode,limitReached,usageKey,expectedWorkspaceId],
  );

  return {
    tone,
    setTone,
    currentResponse,
    limitReached,
    isPending: summaryMutation.isPending,
    error: localError?.key===cacheKey?localError.value:null,
    requestSummary,
  };
}
