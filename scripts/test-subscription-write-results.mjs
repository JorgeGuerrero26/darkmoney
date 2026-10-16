import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { dom, load, mock } from "./lib/web-ui-harness.mjs";

const rules = await import(load("src/modules/subscriptions/lib/subscription-write-result.ts"));
const source = readFileSync(new URL("../src/services/queries/workspace-data.ts", import.meta.url), "utf8"), ast = ts.createSourceFile("workspace-data.ts", source, ts.ScriptTarget.Latest, true);
const names = ["useCreateSubscriptionMutation", "useUpdateSubscriptionMutation", "useDeleteSubscriptionMutation"];
const declarations = [...names, "buildSubscriptionMutationPayload", "normalizeOptionalText"];
const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node) && declarations.includes(node.name?.text)); assert.equal(nodes.length, declarations.length);
const code = ts.transpileModule(nodes.map(node => node.getText(ast).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
let operations, replies, current, afterReply, gateAt, release;
const invalidations = [], queryClient = { invalidateQueries: async value => invalidations.push(value) };
const client = { from(table) {
  return { table, kind: "read", filters: [],
    insert(payload) { this.kind = "insert"; this.payload = payload; return this; }, update(payload) { this.kind = "update"; this.payload = payload; return this; },
    delete(options) { this.kind = "delete"; this.options = options; return this; }, eq(key, value) { this.filters.push([key, value]); return this; }, is(key, value) { this.filters.push([key, value, "is"]); return this; },
    select(columns, options) { this.columns = columns; this.selectOptions = options; return this; }, abortSignal(signal) { this.signal = signal; return this; },
    single() { this.isSingle = true; return this.execute(); }, then(resolve, reject) { return this.execute().then(resolve, reject); },
    async execute() { const index = operations.length; operations.push(this); if (index === gateAt) await new Promise(resolve => { release = resolve; }); afterReply?.(index); return replies[index]; },
  };
} };
const hooks = new Function("useQueryClient", "useMutation", "getClient", "invalidateWorkspaceSnapshot", ...Object.keys(rules), `${code};return {${names.join(",")}};`)(
  () => queryClient, options => options, () => client, async (_client, ws, user) => invalidations.push({ ws, user }), ...Object.values(rules));
const input = { workspaceId: 8, userId: "A", subscriptionId: 9, name: " Internet ", currencyCode: "PEN", amount: 30, frequency: "monthly", intervalCount: 1, startDate: "2026-01-01", nextDueDate: "2026-11-01", status: "active", autoCreateMovement: false, remindDaysBefore: 3, isCurrent: () => current };
const row = { id: 9, workspace_id: 8, status: input.status, next_due_date: input.nextDueDate };
const ok = data => ({ data, error: null });
const deletion = () => [ok(row), { data: null, error: null, count: 0 }, { data: null, error: null, count: 2 }, ok(row)];
function reset(values = [ok(row)]) { operations = []; replies = values; current = true; afterReply = null; gateAt = -1; release = null; }
const writes = () => operations.filter(op => op.kind !== "read");
for (const name of names) {
  const isDelete = name.includes("Delete"), hook = hooks[name](8, "A");
  assert.equal(hook.retry, false); assert.equal(hook.onMutate, undefined); assert.equal(hook.onError, undefined);
  reset(isDelete ? deletion() : [ok(row)]);
  assert.deepEqual(await hook.mutationFn(input), { id: 9, workspaceId: 8 });
  assert.ok(operations.every(op => op.signal instanceof AbortSignal));
  const target = operations.at(-1); assert.equal(target.isSingle, true); assert.match(target.columns, /workspace_id/);
  if (!name.includes("Create")) { assert.ok(target.filters.some(([key, value]) => key === "id" && value === 9)); assert.ok(target.filters.some(([key, value]) => key === "workspace_id" && value === 8)); }
  if (isDelete) { assert.deepEqual(operations.map(op => `${op.table}:${op.kind}`), ["subscriptions:read", "movements:read", "subscription_occurrences:delete", "subscriptions:delete"]); assert.deepEqual(operations[2].options, { count: "exact" }); await hook.onSettled(); }
  else await hook.onSuccess();
  assert.ok(invalidations.some(value => value.ws === 8 && value.user === "A"));
  for (const data of [null, {}, [], { ...row, id: "9" }, { ...row, id: 0 }, { ...row, workspace_id: 99 }, ...(!name.includes("Create") ? [{ ...row, id: 10 }] : [])]) {
    const responses = isDelete ? deletion() : [ok(row)]; responses[isDelete ? 3 : 0] = ok(data); reset(responses);
    await assert.rejects(hook.mutationFn(input), /No se confirmó/); assert.equal(writes().length, isDelete ? 2 : 1);
  }
  if (!isDelete) for (const patch of [{ status: "paused" }, { next_due_date: "2027-01-01" }]) {
    reset([ok({ ...row, ...patch })]); await assert.rejects(hook.mutationFn(input), /No se confirmó/);
  }
  for (const [ws, user, patch] of [[undefined, "A", {}], [8, undefined, {}], [99, "A", {}], [8, "A", { workspaceId: 99 }], [8, "A", { userId: "B" }], [8, "A", { subscriptionId: 0 }], [8, "A", { subscriptionId: NaN }]]) {
    reset(); await assert.rejects(hooks[name](ws, user).mutationFn({ ...input, ...patch }), rules.SubscriptionWritePreflightError); assert.equal(operations.length, 0);
  }
  if (!name.includes("Create")) { reset(); await assert.rejects(hook.mutationFn({ ...input, subscriptionId: undefined }), rules.SubscriptionWritePreflightError); assert.equal(operations.length, 0); }
  for (const error of [{ code: "23514", message: "SQL rejected" }, { code: "PGRST116", message: "No rows" }, new Error("Failed to fetch")]) {
    const responses = isDelete ? deletion() : [ok(row)]; responses[isDelete ? 3 : 0] = { data: null, error }; reset(responses);
    await assert.rejects(hook.mutationFn(input), found => found === error);
  }
}
assert.ok(invalidations.some(value => JSON.stringify(value.queryKey) === '["subscription-occurrences",8,"A"]'));
const remove = hooks.useDeleteSubscriptionMutation(8, "A");
for (const count of [null, undefined, -1, 0.5, "0", 1]) {
  const responses = deletion(); responses[1].count = count; reset(responses);
  await assert.rejects(remove.mutationFn(input), /movimientos asociados/); assert.equal(writes().length, 0);
}
for (const badParent of [null, { ...row, workspace_id: 99 }, { ...row, id: 10 }]) {
  const responses = deletion(); responses[0] = ok(badParent); reset(responses); await assert.rejects(remove.mutationFn(input), /No se confirmó/); assert.equal(operations.length, 1);
}
for (const error of [{ code: "42501", message: "permission denied for subscription_occurrences" }, { code: "42P01", message: "subscription_occurrences missing" }, new Error("network")]) {
  const responses = deletion(); responses[2] = { data: null, error }; reset(responses);
  await assert.rejects(remove.mutationFn(input), found => found === error); assert.equal(operations.length, 3); // Never swallow an error because it names the table.
}
for (const count of [null, undefined, -1, 0.5, "2"]) {
  const responses = deletion(); responses[2].count = count; reset(responses); await assert.rejects(remove.mutationFn(input), /calendario está por comprobar/); assert.equal(operations.length, 3);
}
for (const index of [0, 1, 2]) {
  reset(deletion()); afterReply = phase => { if (phase === index) current = false; };
  await assert.rejects(remove.mutationFn(input), /acceso cambió/); assert.equal(operations.length, index + 1);
}
reset(); current = false; await assert.rejects(remove.mutationFn(input), /acceso cambió/); assert.equal(operations.length, 0);
reset(); await assert.rejects(remove.mutationFn({ ...input, isCurrent: undefined }), /acceso cambió/); assert.equal(operations.length, 0);
assert.equal(rules.isSubscriptionWriteRejected({ code: "23514" }), true); assert.equal(rules.isSubscriptionWriteRejected(new rules.SubscriptionWritePreflightError()), true);
for (const error of [new Error("network"), { code: "PGRST116" }, { code: 20 }, null]) assert.equal(rules.isSubscriptionWriteRejected(error), false);

// Execute the real status/pin/assignment helpers, not their page mocks.
globalThis.subscriptionWriteClient = client; mock("src/services/supabase/client.ts", "export const supabase=globalThis.subscriptionWriteClient;");
const actions = await import(load("src/modules/subscriptions/lib/subscription-actions.ts"));
const subscription = { id: 9, workspaceId: 8, status: "active", isPinned: false, nextDueDate: "2026-11-01", frequency: "monthly", intervalCount: 1, accountId: 1, categoryId: null, currencyCode: "PEN", autoCreateMovement: false };
const actionCases = [
  { run: sub => actions.changeSubscriptionStatus(sub, "paused"), expected: { status: "paused", next_due_date: subscription.nextDueDate }, filters: [["status", "active"], ["next_due_date", subscription.nextDueDate]] },
  { run: sub => actions.setSubscriptionPinned(sub, true), expected: { is_pinned: true }, filters: [["is_pinned", false]] },
  { run: sub => actions.assignSubscriptionField(sub, "account_id", 2), expected: { account_id: 2 }, filters: [["account_id", 1], ["currency_code", "PEN"]] },
  { run: sub => actions.assignSubscriptionField(sub, "category_id", 11), expected: { category_id: 11 }, filters: [["category_id", null, "is"]] },
  { run: sub => actions.assignSubscriptionField(sub, "account_id", null), expected: { account_id: null }, filters: [["auto_create_movement", false]] },
];
for (const action of actionCases) {
  reset([ok({ ...row, ...action.expected })]); await action.run(subscription); assert.equal(operations.length, 1); const query = operations[0];
  assert.equal(query.isSingle, true); assert.ok(query.signal instanceof AbortSignal); assert.deepEqual(query.payload, action.expected);
  for (const filter of [["id", 9], ["workspace_id", 8], ...action.filters]) assert.ok(query.filters.some(actual => JSON.stringify(actual) === JSON.stringify(filter)), JSON.stringify(filter));
  for (const data of [null, {}, { ...row, ...action.expected, id: 10 }, { ...row, ...action.expected, workspace_id: 99 }, ...Object.keys(action.expected).map(key => ({ ...row, ...action.expected, [key]: "unexpected" }))]) {
    reset([ok(data)]); await assert.rejects(action.run(subscription), /No se confirmó/); assert.equal(operations.length, 1);
  }
  for (const patch of [{ id: 0 }, { id: NaN }, { workspaceId: -1 }]) { reset(); await assert.rejects(action.run({ ...subscription, ...patch }), rules.SubscriptionWritePreflightError); assert.equal(operations.length, 0); }
  const error = { code: "PGRST116", message: "stale row/CAS" }; reset([{ data: null, error }]); await assert.rejects(action.run(subscription), found => found === error); assert.equal(operations.length, 1);
}
for (const action of [() => actions.changeSubscriptionStatus(subscription, "unknown"), () => actions.setSubscriptionPinned(subscription, "true"), () => actions.assignSubscriptionField(subscription, "name", 2), () => actions.assignSubscriptionField(subscription, "account_id", 0), () => actions.assignSubscriptionField({ ...subscription, autoCreateMovement: true }, "account_id", null)]) {
  reset(); await assert.rejects(action(), rules.SubscriptionWritePreflightError); assert.equal(operations.length, 0);
}

// Deterministic timeout: even a transport that ignores abort cannot continue a compound delete.
const originalTimeout = globalThis.setTimeout, originalClear = globalThis.clearTimeout, timers = new Map();
globalThis.setTimeout = (callback, delay, ...args) => { if (delay !== rules.SUBSCRIPTION_WRITE_TIMEOUT_MS) return originalTimeout(callback, delay, ...args); const id = {}; timers.set(id, callback); return id; };
globalThis.clearTimeout = id => { if (!timers.delete(id)) originalClear(id); };
for (const [name, phase] of [[names[0], 0], [names[1], 0], [names[2], 0], [names[2], 2]]) {
  reset(name === names[2] ? deletion() : [ok(row)]); gateAt = phase;
  const pending = hooks[name](8, "A").mutationFn(input), rejected = assert.rejects(pending, /tardó demasiado/);
  for (let i = 0; i < 20; i++) await Promise.resolve(); assert.equal(timers.size, 1); assert.ok(release);
  [...timers.values()][0](); await rejected; assert.equal(operations.at(-1).signal.aborted, true); assert.equal(timers.size, 0);
  const beforeLate = operations.length; release(); for (let i = 0; i < 20; i++) await Promise.resolve(); assert.equal(operations.length, beforeLate);
}
for (const action of actionCases) {
  reset([ok({ ...row, ...action.expected })]); gateAt = 0;
  const pending = action.run(subscription), rejected = assert.rejects(pending, /tardó demasiado/); for (let i = 0; i < 10; i++) await Promise.resolve(); assert.ok(release);
  [...timers.values()][0](); await rejected; assert.equal(operations[0].signal.aborted, true); release(); for (let i = 0; i < 10; i++) await Promise.resolve(); assert.equal(operations.length, 1);
}
globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear;
dom.window.close();
console.log("subscription-write-results: OK (three actual hooks/payload and status/pin/assignment helpers; scoped confirmed rows/status/date/fields, CAS filters, unknown reference counts, parent-before-child, strict child errors/counts, context checks between phases, no snapshot rollback/retry, timeouts and abort-ignoring late replies; fake transport, not server atomicity/RLS)");
