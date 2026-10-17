import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { dom, load } from "./lib/web-ui-harness.mjs";
const rules = await import(load("src/modules/recurring-income/lib/income-write-result.ts"));
const source = readFileSync(new URL("../src/services/queries/workspace-data.ts", import.meta.url), "utf8"), ast = ts.createSourceFile("workspace.ts", source, ts.ScriptTarget.Latest, true);
const names = ["useCreateRecurringIncomeMutation", "useUpdateRecurringIncomeMutation", "useSetRecurringIncomeFlagsMutation", "useDeleteRecurringIncomeMutation"], declarations = [...names, "buildRecurringIncomeMutationPayload", "normalizeOptionalText", "invalidateIncomeData"];
const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node) && declarations.includes(node.name?.text)); assert.equal(nodes.length, declarations.length);
const code = ts.transpileModule(nodes.map(node => node.getText(ast).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
let operations, overrides, current, afterReply, gateAt, release;
const invalidations = [], queryClient = { invalidateQueries: async args => invalidations.push(args) };
const row = { id: 9, workspace_id: 8 };
const client = { from(table) {
  assert.notEqual(table, "movements"); // Deleting a schedule must never delete its financial movements.
  return { table, kind: "read", filters: [],
    insert(payload) { this.kind = "insert"; this.payload = payload; return this; }, update(payload) { this.kind = "update"; this.payload = payload; return this; }, delete(options) { this.kind = "delete"; this.options = options; return this; },
    select(columns) { this.columns = columns; return this; }, eq(key, value) { this.filters.push([key, value]); return this; }, abortSignal(signal) { this.signal = signal; return this; },
    single() { this.isSingle = true; return this.execute(); }, then(resolve, reject) { return this.execute().then(resolve, reject); },
    async execute() { const phase = operations.length; operations.push(this); if (phase === gateAt) await new Promise(resolve => { release = resolve; }); afterReply?.(phase);
      const normal = { data: { ...row, ...this.payload }, error: null, ...(table === "recurring_income_occurrences" ? { count: 2 } : {}) };
      if (overrides.has(phase)) { const value = overrides.get(phase); return typeof value === "function" ? value(normal) : value; } return normal;
    },
  };
} };
const hooks = new Function("useQueryClient", "useMutation", "getClient", "invalidateWorkspaceSnapshot", ...Object.keys(rules), `${code};return {${names.join(",")}};`)(() => queryClient, options => options, () => client, async (_client, ws, user) => invalidations.push({ ws, user }), ...Object.values(rules));
const input = { workspaceId: 8, userId: "A", recurringIncomeId: 9, name: " Sueldo ", currencyCode: "pen", amount: 100, grossAmount: 120, deductions: [{ name: "Descuento", amount: 20 }], frequency: "monthly", intervalCount: 1, startDate: "2026-01-01", nextExpectedDate: "2026-11-01", status: "active", remindDaysBefore: 3, isCurrent: () => current, expectedStatus: "active", expectedIsPinned: false, patch: { status: "paused", is_pinned: true } };
function reset() { operations = []; overrides = new Map(); current = true; afterReply = null; gateAt = -1; release = null; invalidations.length = 0; }
for (const name of names) {
  const hook = hooks[name](8, "A"), deleting = name.includes("Delete"), flags = name.includes("Flags"), last = deleting ? 2 : 0;
  assert.equal(hook.retry, false); assert.equal(hook.onMutate, undefined); assert.equal(hook.onError, undefined);
  reset(); assert.deepEqual(await hook.mutationFn(input), { id: 9, workspaceId: 8 }); assert.ok(operations.every(op => op.signal instanceof AbortSignal));
  const target = operations.at(-1); assert.equal(target.isSingle, true); assert.match(target.columns, /workspace_id/);
  if (!name.includes("Create")) for (const pair of [["id", 9], ["workspace_id", 8]]) assert.ok(target.filters.some(filter => JSON.stringify(filter) === JSON.stringify(pair)));
  if (deleting) { assert.deepEqual(operations.map(op => `${op.table}:${op.kind}`), ["recurring_income:read", "recurring_income_occurrences:delete", "recurring_income:delete"]); assert.deepEqual(operations[1].options, { count: "exact" }); assert.deepEqual(operations[1].filters, [["workspace_id", 8], ["recurring_income_id", 9]]); }
  if (flags) for (const pair of [["status", "active"], ["is_pinned", false]]) assert.ok(target.filters.some(filter => JSON.stringify(filter) === JSON.stringify(pair)));
  if (!deleting && !flags) { assert.equal(target.payload.name, "Sueldo"); assert.equal(target.payload.currency_code, "PEN"); assert.equal(target.payload.gross_amount, 120); assert.deepEqual(target.payload.deductions, input.deductions); }
  await hook.onSettled(); assert.ok(invalidations.some(args => args.ws === 8 && args.user === "A")); assert.ok(invalidations.some(args => JSON.stringify(args.queryKey) === '["recurring_income_occurrences",8,"A"]'));
  for (const data of [null, {}, [], { id: 0, workspace_id: 8 }, { id: "9", workspace_id: 8 }, { id: 9, workspace_id: 99 }, ...(!name.includes("Create") ? [{ id: 10, workspace_id: 8 }] : [])]) {
    reset(); overrides.set(last, { data, error: null }); await assert.rejects(hook.mutationFn(input), /No se confirmó/); assert.equal(operations.length, last + 1);
  }
  if (!deleting) for (const patch of flags ? [{ status: "active" }, { is_pinned: false }] : [{ name: "Other" }, { status: "paused" }, { currency_code: "USD" }, { next_expected_date: "2027-01-01" }, { account_id: 1 }, { amount: true }, { gross_amount: 121 }, { deductions: [] }, { interval_count: 2 }]) {
    reset(); overrides.set(0, normal => ({ ...normal, data: { ...normal.data, ...patch } })); await assert.rejects(hook.mutationFn(input), /No se confirmó/);
  }
  if (!deleting && !flags) {
    reset(); overrides.set(0, normal => ({ ...normal, data: { ...normal.data, amount: "100.00", gross_amount: "120.00", deductions: [{ amount: 20, name: "Descuento" }] } })); assert.equal((await hook.mutationFn(input)).id, 9); // JSONB may reorder object keys; numeric SQL columns may be strings.
  }
  for (const patch of [{ workspaceId: 99 }, { userId: "B" }, { recurringIncomeId: 0 }, { recurringIncomeId: NaN }, { amount: 0 }, { amount: 1.001 }, { grossAmount: Infinity }]) {
    reset(); await assert.rejects(hook.mutationFn({ ...input, ...patch }), rules.IncomeWritePreflightError); assert.equal(operations.length, 0);
  }
  for (const [ws, user] of [[undefined, "A"], [8, undefined], [99, "A"]]) { reset(); await assert.rejects(hooks[name](ws, user).mutationFn(input), rules.IncomeWritePreflightError); assert.equal(operations.length, 0); }
  if (!name.includes("Create")) { reset(); await assert.rejects(hook.mutationFn({ ...input, recurringIncomeId: undefined }), rules.IncomeWritePreflightError); assert.equal(operations.length, 0); }
  for (const error of [{ code: "23514", message: "SQL rejected" }, { code: "PGRST116", message: "zero rows" }, new Error("Failed to fetch")]) {
    reset(); overrides.set(last, { data: null, error }); await assert.rejects(hook.mutationFn(input), found => found === error); assert.equal(operations.length, last + 1);
  }
}
const remove = hooks.useDeleteRecurringIncomeMutation(8, "A");
for (const data of [null, { id: 9, workspace_id: 99 }, { id: 10, workspace_id: 8 }]) { reset(); overrides.set(0, { data, error: null }); await assert.rejects(remove.mutationFn(input), /No se confirmó/); assert.equal(operations.length, 1); }
for (const count of [null, undefined, "2", -1, 0.5]) { reset(); overrides.set(1, { data: null, error: null, count }); await assert.rejects(remove.mutationFn(input), /historial está por comprobar/); assert.equal(operations.length, 2); }
for (const count of [0, 1, 5000]) { reset(); overrides.set(1, { data: null, error: null, count }); assert.equal((await remove.mutationFn(input)).id, 9); }
for (const error of [{ code: "42501", message: "permission denied recurring_income_occurrences" }, { code: "42P01", message: "recurring_income_occurrences missing" }]) { reset(); overrides.set(1, { data: null, error }); await assert.rejects(remove.mutationFn(input), found => found === error); assert.equal(operations.length, 2); }
for (const phase of [0, 1]) { reset(); afterReply = index => { if (index === phase) current = false; }; await assert.rejects(remove.mutationFn(input), /acceso cambió/); assert.equal(operations.length, phase + 1); }
reset(); current = false; await assert.rejects(remove.mutationFn(input), rules.IncomeWritePreflightError); assert.equal(operations.length, 0);
const flags = hooks.useSetRecurringIncomeFlagsMutation(8, "A");
for (const patch of [{ patch: {} }, { patch: { status: "invalid" } }, { patch: { is_pinned: "true" } }, { patch: { amount: 1 } }, { patch: { status: undefined } }, { expectedIsPinned: undefined }, { expectedStatus: "unknown" }]) { reset(); await assert.rejects(flags.mutationFn({ ...input, ...patch }), rules.IncomeWritePreflightError); assert.equal(operations.length, 0); }
assert.equal(rules.isIncomeWriteRejected({ code: "23514" }), true); assert.equal(rules.isIncomeWriteRejected(new rules.IncomeWritePreflightError()), true); for (const error of [new Error("network"), { code: "PGRST116" }, { code: 20 }, null]) assert.equal(rules.isIncomeWriteRejected(error), false);

// Bounded writes, including a deletion whose transport ignores abort and returns late.
const originalTimeout = globalThis.setTimeout, originalClear = globalThis.clearTimeout, timers = new Map();
globalThis.setTimeout = (callback, delay, ...args) => { if (delay !== rules.INCOME_WRITE_TIMEOUT_MS) return originalTimeout(callback, delay, ...args); const id = {}; timers.set(id, callback); return id; };
globalThis.clearTimeout = id => { if (!timers.delete(id)) originalClear(id); };
for (const [name, phase] of [...names.map(name => [name, 0]), [names[3], 1]]) {
  reset(); gateAt = phase; const pending = hooks[name](8, "A").mutationFn(input), rejected = assert.rejects(pending, /tardó demasiado/);
  for (let i = 0; i < 20; i++) await Promise.resolve(); assert.ok(release); assert.equal(timers.size, 1); [...timers.values()][0](); await rejected; assert.ok(operations.at(-1).signal.aborted); assert.equal(timers.size, 0);
  release(); for (let i = 0; i < 20; i++) await Promise.resolve(); assert.equal(operations.length, phase + 1);
}
globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear; dom.window.close();
console.log("recurring-income-write-results: OK (four actual hooks/payload; identity and requested fields/JSONB, scope/money preflight, CAS flags, scoped history-first deletion preserving movements, parent/child errors/counts/context, timeout/late reply, no retries/snapshot rollback; fake transport, not server atomicity/RLS)");
