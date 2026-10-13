export type DuplicateVerdict = "duplicate" | "distinct" | "unknown" | "skipped";
export type DuplicateAiResult = { verdict: DuplicateVerdict; reason: string | null };

const VERDICTS: readonly DuplicateVerdict[] = ["duplicate", "distinct", "unknown", "skipped"];

/** Same response contract as mobile: unexpected responses never authorize registration. */
export function parseDuplicateVerdict(raw: unknown): DuplicateAiResult {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const verdict = (raw as Record<string, unknown>).verdict;
    if (typeof verdict === "string" && (VERDICTS as readonly string[]).includes(verdict)) {
      const reason = (raw as Record<string, unknown>).reason;
      return { verdict: verdict as DuplicateVerdict, reason: typeof reason === "string" && reason.trim() ? reason : null };
    }
  }
  return { verdict: "unknown", reason: null };
}
