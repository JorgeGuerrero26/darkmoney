import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { dom, load } from "./lib/web-ui-harness.mjs";
const { confirmArrivalWrite, ARRIVAL_WRITE_TIMEOUT_MS } = await import(load("src/modules/recurring-income/lib/arrival-write.ts"));
const baseInput = { workspaceId: 8, userId: "A", recurringIncomeId: 9, expectedDate: "2026-01-31", actualDate: "2026-02-03", amount: 100, currencyCode: "PEN", accountId: 1, currentAccountId: 1, categoryId: 11, payerPartyId: 12, recurringIncomeName: "Sueldo", description: null, currentBaseAmount: 100, newBaseAmount: null, notes: " Nota ", nextExpectedDate: "2026-02-28", isCurrent: () => current };
let operations, overrides, current, afterReply, gateAt, release, input;
const parent = () => ({ id: 9, workspace_id: 8, status: "active", currency_code: "PEN", amount: "100.00", account_id: input.currentAccountId, category_id: 11, payer_party_id: 12, name: "Sueldo", description: null, frequency: "monthly", interval_count: 1, day_of_month: 31, next_expected_date: input.expectedDate });
const ok = data => ({ data, error: null });
const client = { from(table) {
  return { table, kind: "read", filters: [],
    insert(payload) { this.kind = "insert"; this.payload = payload; return this; }, update(payload) { this.kind = "update"; this.payload = payload; return this; },
    delete() { throw new Error("A lost response must not cause an automatic compensating DELETE"); },
    select(columns) { this.columns = columns; return this; }, eq(key, value) { this.filters.push([key, value]); return this; }, is(key, value) { this.filters.push([key, value, "is"]); return this; }, abortSignal(signal) { this.signal = signal; return this; },
    single() { return this.execute(); }, maybeSingle() { return this.execute(); },
    async execute() {
      const phase = operations.length; operations.push(this); if (phase === gateAt) await new Promise(resolve => { release = resolve; }); afterReply?.(phase);
      if (overrides.has(phase)) { const value = overrides.get(phase); return typeof value === "function" ? value(this) : value; }
      if (phase === 0) return ok(parent());
      if (phase === 1) return ok({ id: 1, workspace_id: 8, currency_code: "PEN", is_archived: false });
      if (phase === 2) return ok(null);
      if (phase === 3) return ok({ id: 400, ...this.payload });
      if (phase === 4) return ok({ id: 500, ...this.payload });
      if (phase === 5) return ok({ ...parent(), ...this.payload });
      throw new Error(`Unexpected phase ${phase}`);
    },
  };
} };
function reset(patch = {}) { input = { ...baseInput, ...patch }; operations = []; overrides = new Map(); current = true; afterReply = null; gateAt = -1; release = null; }
const run = () => confirmArrivalWrite(client, input, 8, "A");
for (const patch of [{}, { amount: 130, newBaseAmount: null }, { amount: 130, newBaseAmount: 130 }, { amount: 80, newBaseAmount: 80 }, { currentAccountId: null }, { actualDate: "2026-01-30" }]) {
  reset(patch); const result = await run(); assert.deepEqual(result, { movementId: 400, occurrenceId: 500, nextExpectedDate: input.nextExpectedDate, updatedBaseAmount: input.newBaseAmount });
  assert.deepEqual(operations.map(op => `${op.table}:${op.kind}`), ["recurring_income:read", "accounts:read", "recurring_income_occurrences:read", "movements:insert", "recurring_income_occurrences:insert", "recurring_income:update"]);
  assert.ok(operations.every(op => op.signal instanceof AbortSignal));
  assert.equal(operations[3].payload.destination_amount, input.amount); assert.equal(operations[4].payload.movement_id, 400);
  assert.equal(operations[4].payload.status, input.actualDate <= input.expectedDate ? "on_time" : "late");
  const update = operations[5]; for (const pair of [["workspace_id", 8], ["id", 9], ["status", "active"], ["next_expected_date", input.expectedDate], ["amount", 100], ["frequency", "monthly"], ["interval_count", 1], ["day_of_month", 31]]) assert.ok(update.filters.some(actual => JSON.stringify(actual) === JSON.stringify(pair)));
  assert.equal(update.payload.amount, input.newBaseAmount ?? undefined); assert.equal(update.payload.account_id, input.currentAccountId === null ? 1 : undefined);
  assert.equal(operations[3].payload.metadata.recurring_income_base_change_kind, input.newBaseAmount == null ? null : input.newBaseAmount > 100 ? "bonus" : "discount");
  const limaDay = new Date(Date.parse(operations[3].payload.occurred_at) - 5 * 3600000).toISOString().slice(0, 10); assert.equal(limaDay, input.actualDate);
}
for (const patch of [{ workspaceId: 99 }, { userId: "B" }, { recurringIncomeId: 0 }, { accountId: -1 }, { amount: null }, { amount: NaN }, { amount: 1.001 }, { currentBaseAmount: null }, { actualDate: "2026-02-30" }, { expectedDate: "2026-02-30" }, { nextExpectedDate: "invalid" }, { newBaseAmount: 99 }, { isCurrent: undefined }, { isCurrent: () => false }]) {
  reset(patch); await assert.rejects(run(), /Revisa/); assert.equal(operations.length, 0);
}
for (const patch of [{ id: 10 }, { workspace_id: 99 }, { status: "paused" }, { amount: "101" }, { currency_code: "USD" }, { next_expected_date: "2026-02-28" }, { interval_count: 2 }, { frequency: "unknown" }, { day_of_month: 32 }]) {
  reset(); overrides.set(0, ok({ ...parent(), ...patch })); await assert.rejects(run(), /cambiaron|calendario actual/); assert.equal(operations.length, 1);
}
for (const data of [null, { id: 1, workspace_id: 99, currency_code: "PEN", is_archived: false }, { id: 1, workspace_id: 8, currency_code: "USD", is_archived: false }, { id: 1, workspace_id: 8, currency_code: "PEN", is_archived: true }]) {
  reset(); overrides.set(1, ok(data)); await assert.rejects(run(), /cuenta de destino/); assert.equal(operations.length, 2);
}
for (const data of [undefined, {}, { id: 55 }]) { reset(); overrides.set(2, ok(data)); await assert.rejects(run(), /ya fue confirmada|por comprobar/); assert.equal(operations.length, 3); }
for (const phase of [0, 1, 2, 3, 4, 5]) {
  reset(); const error = { code: "23514", message: `phase ${phase} SQL failure` }; overrides.set(phase, { data: null, error }); await assert.rejects(run(), found => found === error); assert.equal(operations.length, phase + 1);
}
for (const [phase, changes] of [[3, [null, {}, { id: 0 }, { workspace_id: 99 }, { status: "draft" }, { source_account_id: 2 }, { occurred_at: "2026-01-01T00:00:00Z" }, { destination_amount: true }, { metadata: { recurring_income_id: 9, recurring_income_expected_date: "wrong" } }]], [4, [null, {}, { id: -1 }, { workspace_id: 99 }, { movement_id: 401 }, { amount: null }, { currency_code: "USD" }, { status: "on_time" }]], [5, [null, {}, { workspace_id: 99 }, { next_expected_date: "wrong" }, { amount: "101" }, { account_id: 2 }]]]) {
  for (const patch of changes) {
    reset(); overrides.set(phase, query => ok(patch === null ? null : Object.keys(patch).length ? { ...(phase === 5 ? parent() : { id: phase === 3 ? 400 : 500 }), ...query.payload, ...patch } : {}));
    await assert.rejects(run(), /confirm|comprobar/); assert.equal(operations.length, phase + 1);
  }
}
for (let phase = 0; phase < 5; phase++) { reset(); afterReply = index => { if (index === phase) current = false; }; await assert.rejects(run(), /acceso cambió/); assert.equal(operations.length, phase + 1); }

// The actual hook has no automatic retry/compensation and refreshes scoped evidence on errors too.
const service = readFileSync(new URL("../src/services/queries/workspace-data.ts", import.meta.url), "utf8"), ast = ts.createSourceFile("workspace.ts", service, ts.ScriptTarget.Latest, true);
const hookNode = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "useConfirmRecurringIncomeArrivalMutation");
const hookCode = ts.transpileModule(hookNode.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, invalidations = [];
const hook = new Function("useQueryClient", "useMutation", "getClient", "confirmArrivalWrite", "invalidateWorkspaceSnapshot", `${hookCode};return useConfirmRecurringIncomeArrivalMutation(8,'A');`)(() => ({ invalidateQueries: async args => invalidations.push(args) }), options => options, () => client, confirmArrivalWrite, async (_client, ws, user) => invalidations.push({ ws, user }));
assert.equal(hook.retry, false); reset(); assert.equal((await hook.mutationFn(input)).movementId, 400); await hook.onSettled(null, new Error("uncertain"), input); assert.ok(invalidations.some(args => JSON.stringify(args.queryKey) === '["recurring_income_occurrences",8,"A",9]')); assert.ok(invalidations.some(args => args.ws === 8 && args.user === "A"));

// Compare financial payloads with the original mobile mutation; never write to that repository.
function extract(path, names) { const text = readFileSync(new URL(path, import.meta.url), "utf8"), tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true); return ts.transpileModule(tree.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(tree).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; }
const dates = createRequire(new URL("../../DarkMoneyApp/package.json", import.meta.url))("date-fns");
const nativeCompute = new Function("addDays", "addWeeks", "addMonths", "addYears", `${extract("../../DarkMoneyApp/lib/subscription-helpers.ts", ["computeNextRecurringDate", "parseLocalYmd", "toLocalYmd", "clampDayOfMonth", "daysInMonthOf"])};return computeNextRecurringDate;`)(dates.addDays, dates.addWeeks, dates.addMonths, dates.addYears);
const nativeCode = extract("../../DarkMoneyApp/services/queries/workspace-data.ts", ["useConfirmRecurringIncomeArrivalMutation", "joinNotes", "formatAmountWithCurrency"]) + ";" + extract("../../DarkMoneyApp/features/recurring-income/lib/buildIncomeArrival.ts", ["buildIncomeArrival"]);
for (const patch of [{}, { amount: 130, newBaseAmount: 130 }, { amount: 80, newBaseAmount: 80 }, { amount: 130, newBaseAmount: null }]) {
  reset(patch); await run(); const web = operations, native = [];
  const nativeClient = { from: table => ({ insert(payload) { native.push({ table, payload }); return Promise.resolve({ error: null }); }, update(payload) { native.push({ table, payload }); return this; }, eq() { return this; }, then(resolve) { return Promise.resolve({ error: null }).then(resolve); } }) };
  const nativeHook = new Function("useQueryClient", "useOfflineFlag", "useMutation", "supabase", "offlineRuntime", "computeNextRecurringDate", "createMovement", "dateStrToISO", `${nativeCode};return useConfirmRecurringIncomeArrivalMutation(8);`)(() => ({}), () => ({ enabled: false }), options => options, nativeClient, { assertCompoundOnline() {}, async confirmArrival() { return null; } }, nativeCompute, async (ws, payload) => { native.push({ table: "movements", ws, payload }); return { id: 400 }; }, date => `${date}T12:00:00-05:00`);
  const result = await nativeHook.mutationFn({ ...input, frequency: "monthly", intervalCount: 1, baseChangeKind: input.newBaseAmount == null ? null : input.newBaseAmount > 100 ? "bonus" : "discount" });
  assert.equal(result.nextExpectedDate, input.nextExpectedDate); assert.equal(result.updatedBaseAmount, input.newBaseAmount);
  const m = native[0].payload; assert.equal(web[3].payload.destination_amount, m.destinationAmount); assert.equal(web[3].payload.destination_account_id, m.destinationAccountId); assert.equal(web[3].payload.category_id, m.categoryId); assert.equal(web[3].payload.counterparty_id, m.counterpartyId); assert.equal(web[3].payload.description, m.description); assert.equal(web[3].payload.notes, m.notes); assert.deepEqual(web[3].payload.metadata, m.metadata);
  assert.deepEqual(web[4].payload, native[1].payload); assert.deepEqual(web[5].payload, native[2].payload);
}

// A timed out transport may still reply; it must never send the next phase or a DELETE.
const originalTimeout = globalThis.setTimeout, originalClear = globalThis.clearTimeout, timers = new Map();
globalThis.setTimeout = (callback, delay, ...args) => { if (delay !== ARRIVAL_WRITE_TIMEOUT_MS) return originalTimeout(callback, delay, ...args); const id = {}; timers.set(id, callback); return id; };
globalThis.clearTimeout = id => { if (!timers.delete(id)) originalClear(id); };
for (const phase of [0, 3, 4]) {
  reset(); gateAt = phase; const pending = run(), rejected = assert.rejects(pending, /tardó demasiado/); for (let i = 0; i < 20; i++) await Promise.resolve(); assert.ok(release); assert.equal(timers.size, 1);
  [...timers.values()][0](); await rejected; assert.ok(operations.at(-1).signal.aborted); assert.equal(timers.size, 0); release(); for (let i = 0; i < 20; i++) await Promise.resolve(); assert.equal(operations.length, phase + 1);
}
globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear; dom.window.close();
console.log("recurring-income-arrival: OK (actual helper/hook and native mutation payload comparisons; parent/account/preflight, exact returned movement/occurrence/calendar, conditional update, lost scope per phase, SQL/empty/wrong replies, timeout/abort-ignoring late replies, no compensating deletes/retries; fake transport, not server atomicity/deduplication/RLS)");
