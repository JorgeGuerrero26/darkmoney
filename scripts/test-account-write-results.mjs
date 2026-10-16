import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { dom, load, root } from "./lib/web-ui-harness.mjs";

const rules = await import(load("src/modules/accounts/lib/account-write-result.ts"));
const source = readFileSync(resolve(root, "src/services/queries/workspace-data.ts"), "utf8"), ast = ts.createSourceFile("workspace-data.ts", source, ts.ScriptTarget.Latest, true);
const names = ["useCreateAccountMutation", "useUpdateAccountMutation", "useArchiveAccountMutation", "useDeleteAccountMutation"];
const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)); assert.equal(nodes.length, 4);
const code = ts.transpileModule(nodes.map(node => node.getText(ast).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
let outcome, ops, signal, finishWrite, waitForReply = false;
const refreshed = [];
const client = { from(table) {
  assert.equal(table, "accounts"); ops.push(["from", table]);
  return {
    insert(payload) { ops.push(["insert", payload]); return this; }, update(payload) { ops.push(["update", payload]); return this; }, delete() { ops.push(["delete"]); return this; },
    eq(key, value) { ops.push(["eq", key, value]); return this; }, select(columns) { ops.push(["select", columns]); return this; }, abortSignal(value) { signal = value; return this; },
    single() { ops.push(["single"]); return waitForReply ? new Promise(resolve => { finishWrite = resolve; }) : Promise.resolve(outcome); },
  };
} };
const hooks = new Function("useQueryClient", "useMutation", "getClient", "invalidateWorkspaceSnapshot", "assertAccountWriteScope", "confirmAccountWrite", "withAccountWriteTimeout", `${code};return {${names.join(",")}};`)(
  () => ({}), options => options, () => client, async (_client, ws, user) => refreshed.push({ ws, user }), rules.assertAccountWriteScope, rules.confirmAccountWrite, rules.withAccountWriteTimeout);
const input = { workspaceId: 8, userId: "A", accountId: 9, name: "Sueldo", type: "bank", currencyCode: "PEN", openingBalance: 1200, color: "#4566d6", icon: "landmark", includeInNetWorth: true, sortOrder: 1, isArchived: true };
function reset(...args) { outcome = { data: args.length ? args[0] : { id: 9, workspace_id: 8, is_archived: false }, error: args[1] ?? null }; ops = []; signal = null; waitForReply = false; }
for (const name of names) {
  const archived = name.includes("Archive") || name.includes("Delete"), hook = hooks[name](8, "A");
  assert.equal(hook.retry, false); assert.equal(hook.onMutate, undefined); // No cache-wide optimistic rollback masquerades as server evidence.
  reset({ id: 9, workspace_id: 8, is_archived: archived });
  const result = await hook.mutationFn(input); assert.deepEqual(result, { id: 9, workspaceId: 8, isArchived: archived }); assert.ok(signal instanceof AbortSignal);
  assert.ok(ops.some(op => op[0] === "single")); assert.ok(ops.some(op => op[0] === "select" && op[1] === "id, workspace_id, is_archived"));
  if (!name.includes("Create")) { assert.ok(ops.some(op => op[0] === "eq" && op[1] === "workspace_id" && op[2] === 8)); assert.ok(ops.some(op => op[0] === "eq" && op[1] === "id" && op[2] === 9)); }
  if (name.includes("Delete")) assert.ok(ops.some(op => op[0] === "eq" && op[1] === "is_archived" && op[2] === true));
  await hook.onSuccess(); assert.deepEqual(refreshed.at(-1), { ws: 8, user: "A" });
  for (const data of [null, undefined, {}, [], { id: "9", workspace_id: 8, is_archived: archived }, { id: 0, workspace_id: 8, is_archived: archived }, { id: 9, workspace_id: 99, is_archived: archived }, { id: 9, workspace_id: 8 }]) {
    reset(data); await assert.rejects(hook.mutationFn(input), /No se confirmó/); assert.equal(ops.filter(op => ["insert", "update", "delete"].includes(op[0])).length, 1);
  }
  if (!name.includes("Create")) { reset({ id: 10, workspace_id: 8, is_archived: archived }); await assert.rejects(hook.mutationFn(input), /No se confirmó/); }
  if (name.includes("Create") || archived) { reset({ id: 9, workspace_id: 8, is_archived: !archived }); await assert.rejects(hook.mutationFn(input), /No se confirmó/); }
  for (const error of [{ code: "23514", message: "SQL rejection" }, { code: "PGRST116", message: "Zero returned rows" }, new Error("Failed to fetch"), { code: 20, message: "Abort" }]) {
    reset(null, error); await assert.rejects(hook.mutationFn(input), found => found === error); assert.equal(ops.filter(op => ["insert", "update", "delete"].includes(op[0])).length, 1);
  }
  for (const [ws, user, patch] of [[undefined, "A", {}], [8, undefined, {}], [99, "A", {}], [8, "A", { workspaceId: 99 }], [8, "A", { accountId: 0 }], [8, "A", { accountId: NaN }]]) {
    reset(); await assert.rejects(hooks[name](ws, user).mutationFn({ ...input, ...patch }), rules.AccountWritePreflightError); assert.equal(ops.length, 0);
  }
  if (!name.includes("Delete")) { reset(); await assert.rejects(hook.mutationFn({ ...input, userId: "B" }), rules.AccountWritePreflightError); assert.equal(ops.length, 0); }
  if (!name.includes("Create")) { reset(); await assert.rejects(hook.mutationFn({ ...input, accountId: undefined }), rules.AccountWritePreflightError); assert.equal(ops.length, 0); }
}
assert.equal(rules.isAccountWriteRejected({ code: "23514" }), true); assert.equal(rules.isAccountWriteRejected(new rules.AccountWritePreflightError("not sent")), true);
for (const error of [new Error("network"), { code: "20" }, { code: 20 }, { code: "PGRST116" }, { code: "23514x" }, null]) assert.equal(rules.isAccountWriteRejected(error), false);

// Real timeout wrapper: deterministic timers, no sleeping; late replies do not trigger another write.
const originalTimeout = globalThis.setTimeout, originalClear = globalThis.clearTimeout, timers = new Map();
globalThis.setTimeout = (callback, delay, ...args) => { if (delay !== rules.ACCOUNT_WRITE_TIMEOUT_MS) return originalTimeout(callback, delay, ...args); const id = {}; timers.set(id, callback); return id; };
globalThis.clearTimeout = id => { if (!timers.delete(id)) originalClear(id); };
for (const name of names) {
  reset(); waitForReply = true;
  const pending = hooks[name](8, "A").mutationFn(input), rejected = assert.rejects(pending, /tardó demasiado/);
  await Promise.resolve(); await Promise.resolve(); assert.equal(timers.size, 1); assert.ok(finishWrite);
  [...timers.values()][0](); await rejected; assert.equal(signal.aborted, true); assert.equal(timers.size, 0);
  finishWrite({ data: { id: 9, workspace_id: 8, is_archived: true }, error: null }); await Promise.resolve(); assert.equal(ops.filter(op => ["insert", "update", "delete"].includes(op[0])).length, 1);
}
globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear;
dom.window.close();
console.log("account-write-results: OK (four actual mutations and helpers; returned ID/workspace/archive evidence, zero/missing/wrong rows, scope preflight before IO, scoped archived-only DELETE, explicit no retries, bounded wait/abort and late replies; fake transport only, not server RLS/deduplication)");
