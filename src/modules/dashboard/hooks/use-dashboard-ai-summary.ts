import { useCallback, useEffect, useState } from "react";

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
  isAdmin = false,
}: {
  userId?: string | null;
  isAdmin?: boolean;
}) {
  const toneKey = userId ? `${TONE_KEY_PREFIX}.${userId}` : null;
  const cacheKey = userId ? `${SUMMARY_CACHE_KEY_PREFIX}.${userId}` : null;

  const [tone, setToneState] = useState<DashboardAiTone>("personal");
  const [cache, setCacheState] = useState<DashboardAiDailyCache | null>(null);
  const summaryMutation = useDashboardAiSummaryMutation();

  // Hidratar tono + caché al montar (o al cambiar de usuario).
  useEffect(() => {
    const storedTone = readStored<DashboardAiTone>(toneKey);
    if (storedTone === "managerial" || storedTone === "personal") {
      setToneState(storedTone);
    }
    setCacheState(readStored<DashboardAiDailyCache>(cacheKey));
  }, [toneKey, cacheKey]);

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
        const next = updater(current);
        writeStored(cacheKey, next);
        return next;
      });
    },
    [cacheKey],
  );

  const usageDate = getDashboardAiUsageDate();
  // 1 generación por día por usuario (los admins no tienen límite).
  const limitReached =
    !isAdmin && cache?.usageDate === usageDate && Boolean(cache?.lastUsedAt);
  const currentResponse =
    cache?.usageDate === usageDate ? cache.responses[tone] ?? null : null;

  const requestSummary = useCallback(
    async (workspaceId: number, summary: Record<string, unknown>) => {
      const response = await summaryMutation.mutateAsync({ workspaceId, summary, tone });
      const generatedAt = new Date().toISOString();
      setCache((current) => ({
        usageDate,
        lastUsedAt: generatedAt,
        responses: {
          ...(current?.usageDate === usageDate ? current.responses : {}),
          [tone]: {
            reply: response.reply,
            complexTerms: response.complexTerms ?? [],
            generatedAt,
          },
        },
      }));
      return response;
    },
    [summaryMutation, tone, usageDate, setCache],
  );

  return {
    tone,
    setTone,
    currentResponse,
    limitReached,
    isPending: summaryMutation.isPending,
    error: summaryMutation.error,
    requestSummary,
  };
}
