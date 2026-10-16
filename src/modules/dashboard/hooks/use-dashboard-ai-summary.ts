import { useCallback, useEffect, useRef, useState } from "react";

import { useDashboardAiSummaryMutation, type DashboardAiSection } from "../../../services/queries/workspace-data";
import type { DashboardAiDailyCache, DashboardAiTone } from "../lib/dashboard-ai-content";

const TONE_KEY_PREFIX = "darkmoney.dashboard.aiTone";
const SUMMARY_CACHE_KEY_PREFIX = "darkmoney.dashboard.aiSummaryCache";
type ScopedCache = DashboardAiDailyCache & { contextKey?: string };
// Shared across mounts: leaving a tab must not permit a second concurrent generation.
const activeRequests = new Map<string, AbortController>();
const confirmedUsage = new Map<string, string>();

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
  section = "summary",
  contextKey = "default",
  enabled = true,
}: {
  userId?: string | null;
  workspaceId?: number | null;
  currencyCode?: string;
  isAdmin?: boolean;
  section?: DashboardAiSection;
  contextKey?: string;
  enabled?: boolean;
}) {
  const toneKey = userId ? `${TONE_KEY_PREFIX}.${userId}` : null;
  const prefix = section === "summary" ? SUMMARY_CACHE_KEY_PREFIX : `darkmoney.dashboard.ai${section}Cache`;
  // Previous replies could be reused by the server without currency/period isolation.
  // Preserve usage, never the conclusions of those unverified responses.
  const cacheBase = userId && workspaceId && currencyCode ? `${prefix}.${userId}.${workspaceId}.${currencyCode}` : null;
  const cacheKey = cacheBase ? `${cacheBase}.section-context-v4` : null;
  const usageKey = userId ? `${prefix}.usage.${userId}` : null;
  const scope = enabled && cacheKey ? JSON.stringify([cacheKey, contextKey]) : null;
  const expectedWorkspaceId=workspaceId;

  const [tone, setToneState] = useState<DashboardAiTone>("personal");
  const [cacheState, setCacheState] = useState<{key:string|null;value:ScopedCache|null}>({key:null,value:null});
  const cache=enabled && cacheState.key===cacheKey && (cacheState.value?.contextKey ?? "default") === contextKey ? cacheState.value : null;
  const [usage,setUsage]=useState<{key:string|null;date:string|null}>({key:null,date:null});
  const [localError,setLocalError]=useState<{key:string|null;value:unknown}|null>(null);
  const currentScope=useRef(scope);currentScope.current=scope;
  const flight=useRef<AbortController|null>(null);
  const [pendingScope, setPendingScope] = useState<string | null>(null);
  const summaryMutation = useDashboardAiSummaryMutation(section);

  // Hidratar tono + caché al montar (o al cambiar de usuario).
  useEffect(() => {
    const storedTone = readStored<DashboardAiTone>(toneKey);
    if (storedTone === "managerial" || storedTone === "personal") {
      setToneState(storedTone);
    }
    else setToneState("personal");
    const stored=readStored<ScopedCache>(cacheKey);
    const valid=stored&&stored.responses&&typeof stored.responses==="object"&&!Array.isArray(stored.responses)&&typeof stored.usageDate==="string"&&["personal","managerial"].every(tone=>{
      const reply=stored.responses[tone as DashboardAiTone];return !reply||(typeof reply.reply==="string"&&Boolean(reply.reply.trim())&&typeof reply.generatedAt==="string"&&Number.isFinite(new Date(reply.generatedAt).getTime())&&Array.isArray(reply.complexTerms)&&reply.complexTerms.every(term=>term&&typeof term.term==="string"&&typeof term.explanation==="string"));
    });
    setCacheState({key:cacheKey,value:valid?stored:null});
    // Legacy user-only replies are never displayed; their usage timestamp only preserves the quota.
    const legacy=readStored<DashboardAiDailyCache>(userId?`${prefix}.${userId}`:null);
    const oldScoped = ["lima-calendar-v3", "liquid-health-v2", "liquid-v1", ""].map(version => readStored<DashboardAiDailyCache>(cacheBase ? `${cacheBase}${version ? "." + version : ""}` : null)).find(value => value?.lastUsedAt && value.usageDate === getDashboardAiUsageDate());
    const used=readStored<string>(usageKey);
    const today = getDashboardAiUsageDate();
    const dates = [used, valid && stored.lastUsedAt ? stored.usageDate : null, oldScoped?.usageDate, legacy?.lastUsedAt ? legacy.usageDate : null];
    const usedDate = dates.includes(today) ? today : typeof used === "string" ? used : null;
    setUsage({key:usageKey,date:usedDate});
    if (usageKey && usedDate === today) confirmedUsage.set(usageKey, today);
    setLocalError(null);
  }, [toneKey, cacheKey,usageKey,userId,prefix,cacheBase]);
  useEffect(()=>()=>{flight.current?.abort();},[scope]);

  const setTone = useCallback(
    (next: DashboardAiTone) => {
      setToneState(next);
      writeStored(toneKey, next);
    },
    [toneKey],
  );

  const setCache = useCallback(
    (updater: (current: ScopedCache | null) => ScopedCache) => {
      setCacheState((current) => {
        const next = updater(current.key===cacheKey && (current.value?.contextKey ?? "default") === contextKey ? current.value:null);
        writeStored(cacheKey, next);
        return {key:cacheKey,value:next};
      });
    },
    [cacheKey,contextKey],
  );

  const usageDate = getDashboardAiUsageDate();
  // 1 generación por día, usuario y sección, como las funciones móviles.
  const limitReached =
    !isAdmin && ((usage.key===usageKey&&usage.date===usageDate)||Boolean(usageKey && confirmedUsage.get(usageKey)===usageDate)||(cache?.usageDate === usageDate && Boolean(cache?.lastUsedAt)));
  const currentResponse =
    cache?.usageDate === usageDate ? cache.responses[tone] ?? null : null;

  const requestSummary = useCallback(
    async (requestedWorkspaceId: number, summary: Record<string, unknown>) => {
      const reject = (message: string): never => {
        const error = new Error(message);
        if (scope && currentScope.current === scope) setLocalError({ key: scope, value: error });
        throw error;
      };
      if(!scope||!usageKey||currentScope.current!==scope||requestedWorkspaceId!==expectedWorkspaceId||summary.currency!==currencyCode)return reject("Espera y revisa el espacio y moneda antes de consultar.");
      if(flight.current||activeRequests.has(usageKey))return reject("Ya hay una explicación de esta sección en curso.");
      const requestedDate=getDashboardAiUsageDate();
      if(!isAdmin && ((limitReached&&usageDate===requestedDate) || readStored<string>(usageKey)===requestedDate || confirmedUsage.get(usageKey)===requestedDate || (usage.key===usageKey&&usage.date===requestedDate)))return reject("Ya usaste tu explicación de hoy.");
      const original=scope;const controller=new AbortController();flight.current=controller;activeRequests.set(usageKey,controller);setPendingScope(scope);setLocalError(null);
      try {
      const response = await summaryMutation.mutateAsync({ workspaceId:requestedWorkspaceId, summary, tone,signal:controller.signal });
      if(!response||response.ok===false||typeof response.reply!=="string"||!response.reply.trim())throw new Error("No se pudo confirmar la explicación de la IA.");
      // The legacy server cache is keyed only by space/section/day, not currency,
      // year or payload. Never relabel an unverifiable cached reply as this context.
      if(response.cached===true)throw new Error("El servidor devolvió una explicación guardada sin confirmar su moneda o período. No la mostramos para evitar mezclar resultados. Hay que actualizar la caché del servidor.");
      const generatedAt = new Date().toISOString();
      writeStored(usageKey,requestedDate);confirmedUsage.set(usageKey,requestedDate);
      if(controller.signal.aborted||currentScope.current!==original)return response;
      setUsage({key:usageKey,date:requestedDate});
      setCache((current) => ({
        usageDate:requestedDate,
        contextKey,
        lastUsedAt: generatedAt,
        responses: {
          ...(current?.usageDate === requestedDate ? current.responses : {}),
          [tone]: {
            reply: response.reply,
            complexTerms: Array.isArray(response.complexTerms)?response.complexTerms.filter(term=>term&&typeof term.term==="string"&&typeof term.explanation==="string"):[],
            generatedAt,
          },
        },
      }));
      return response;
      }catch(error){if(!controller.signal.aborted&&currentScope.current===original)setLocalError({key:original,value:error});throw error;}
      finally {if(flight.current===controller)flight.current=null;if(activeRequests.get(usageKey)===controller)activeRequests.delete(usageKey);if(currentScope.current===original)setPendingScope(null);}
    },
    [summaryMutation, tone, setCache,scope,currencyCode,usageKey,expectedWorkspaceId,isAdmin,usage,contextKey,limitReached,usageDate],
  );

  return {
    tone,
    setTone,
    currentResponse,
    limitReached,
    isPending: Boolean(scope && pendingScope===scope && flight.current && !flight.current.signal.aborted),
    error: enabled && localError?.key===scope?localError.value:null,
    requestSummary,
  };
}
