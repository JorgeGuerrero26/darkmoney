import { useEffect, useRef, useState } from "react";

type Status = "idle" | "pending" | "confirmed" | "uncertain";
type Attempt = { scope: string };
/** UI replay protection, not a substitute for server transactions/idempotency. */
export function useFinancialWriteGuard(scopeKey: string) {
  const currentScope = useRef(scopeKey); currentScope.current = scopeKey;
  const alive = useRef(true), state = useRef<{ scope: string; status: Status; attempt: Attempt | null }>({ scope: scopeKey, status: "idle", attempt: null });
  if (state.current.scope !== scopeKey) state.current = { scope: scopeKey, status: "idle", attempt: null };
  const [, render] = useState(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const isCurrent = (attempt: Attempt) => alive.current && currentScope.current === attempt.scope && state.current.attempt === attempt;
  function mark(attempt: Attempt, status: Status) {
    if (!isCurrent(attempt)) return;
    state.current = { scope: attempt.scope, status, attempt }; render(value => value + 1);
  }
  function begin() {
    if (!alive.current || currentScope.current !== scopeKey) return null;
    if (state.current.scope === scopeKey && state.current.status !== "idle") return null;
    const attempt = { scope: scopeKey }; state.current = { scope: scopeKey, status: "pending", attempt }; render(value => value + 1); return attempt;
  }
  const status = state.current.scope === scopeKey ? state.current.status : "idle";
  return { begin, isCurrent, confirm: (attempt: Attempt) => mark(attempt, "confirmed"), fail: (attempt: Attempt) => mark(attempt, "uncertain"), reject: (attempt: Attempt) => mark(attempt, "idle"),
    status, blocked: status !== "idle", pending: status === "pending" };
}
