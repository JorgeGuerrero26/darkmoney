import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/modules/workspaces/workspace-data-sync.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { startWorkspaceDataSync, isWorkspaceDataQuery, workspaceSyncTables } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
for (const name of ["workspace-snapshot", "categories-overview", "counterparties-overview", "recurring_income_occurrences"]) {
  assert.equal(isWorkspaceDataQuery([name, 7, "user"], 7), true);
  assert.equal(isWorkspaceDataQuery([name, 8, "user"], 7), false);
}
assert.equal(isWorkspaceDataQuery(["notifications", 7], 7), false);
for (const table of ["accounts", "movements", "categories", "counterparties", "subscriptions", "recurring_income", "budgets", "obligations"]) assert.ok(workspaceSyncTables.includes(table));
let timer = null, changed, wake, poll;
let visible = true, stale = false, calls = 0, cleanups = 0, reject = false;
let release = null;
const stop = startWorkspaceDataSync({
  subscribe: (callback) => { changed = callback; return () => cleanups++; },
  onWake: (callback) => { wake = callback; return () => cleanups++; },
  every: (ms, callback) => { assert.equal(ms, 60_000); poll = callback; return () => cleanups++; },
  after: (ms, callback) => { assert.equal(ms, 120); assert.equal(timer, null); timer = callback; return () => { timer = null; }; },
  isVisible: () => visible,
  hasStaleData: () => stale,
  invalidate: async () => { calls++; if (release) await new Promise((resolve) => { release = resolve; }); if (reject) throw new Error("offline"); },
});
const flush = async () => { const callback = timer; timer = null; callback?.(); for (let i = 0; i < 8; i++) await Promise.resolve(); };
assert.equal(timer, null);
changed(); changed(); changed(); await flush(); assert.equal(calls, 1);
wake(); assert.equal(timer, null); // Fresh data: no request on focus.
stale = true; poll(); await flush(); assert.equal(calls, 2); stale = false;
visible = false; changed(); assert.equal(timer, null); poll(); assert.equal(calls, 2);
visible = true; wake(); await flush(); assert.equal(calls, 3);
release = true; changed(); await flush(); assert.equal(calls, 4);
changed(); assert.equal(timer, null); // Never start concurrent fetches.
const complete = release; release = null; complete(); for (let i = 0; i < 8; i++) await Promise.resolve();
assert.notEqual(timer, null); await flush(); assert.equal(calls, 5);
reject = true; changed(); await flush(); assert.equal(calls, 6); assert.equal(timer, null); // Failed requests don't spin.
reject = false; wake(); await flush(); assert.equal(calls, 7);
changed(); stop(); assert.equal(timer, null); assert.equal(cleanups, 3);
changed(); wake(); poll(); assert.equal(timer, null); assert.equal(calls, 7);
console.log("workspace-sync: OK — workspace scope, coalescing, fallback, focus, offline, in-flight events, failure and cleanup");
