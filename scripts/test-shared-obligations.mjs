import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "package.json"));
const virtual = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const cache = new Map();
cache.set(resolve(root, "src/services/supabase/client.ts"), virtual("export const supabase=null;"));
function compile(source) { return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText; }
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const js = compile(readFileSync(file, "utf8")).replace(/from "([^"]+)"/g, (_, specifier) => {
    if (!specifier.startsWith(".")) return `from "${pathToFileURL(require.resolve(specifier)).href}"`;
    const base = resolve(dirname(file), specifier); const found = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
    assert.ok(found, specifier); return `from "${load(found)}"`;
  });
  const url = virtual(js); cache.set(file, url); return url;
}
const { parseSharedObligationResponse } = await import(load(resolve(root, "src/modules/obligations/lib/shared-obligation-response.ts")));
const { readLegacySharedObligations, readSharedObligations } = await import(load(resolve(root, "src/services/queries/shared-obligations.ts")));
const { notificationObligationReadState } = await import(load(resolve(root, "src/modules/notifications/lib/notification-obligation-target.ts")));
const { fetchNotificationDestination } = await import(load(resolve(root, "src/services/queries/notification-destination.ts")));
const viewer = { userId: "11111111-1111-1111-1111-111111111111", email: "viewer@example.invalid" };
const other = "22222222-2222-2222-2222-222222222222";
const item = (id = 11, patch = {}) => ({
  obligation: { id, workspace_id: 8, title: `Crédito ${id}`, direction: "receivable", origin_type: "cash_loan", status: "active", currency_code: "USD",
    principal_initial_amount: "1000.25", principal_current_amount: "1100.25", pending_amount: "900.20", progress_percent: "18.18223",
    start_date: "2026-01-31", due_date: "2026-12-31", installment_amount: "100.25", installment_count: 12,
    payment_plan: { mode: "custom", agreed: [{ amount: 150, dueDate: "2026-02-28" }], tail: 100, firstDueDate: "2026-02-28" },
    interest_rate: "2.5", payment_count: 2, last_payment_date: "2026-08-15", counterparty_id: 4, counterparty_name: "Persona ficticia",
    settlement_account_id: 7, settlement_account_name: "Cuenta ficticia", description: "Prueba", notes: "Notas",
    events: [
      { id: 2, obligation_id: id, event_type: "payment", event_date: "2026-08-15", amount: "100.25", installment_no: 1, created_at: "2026-08-15T12:00:00Z", movement_id: 20 },
      { id: 3, obligation_id: id, event_type: "payment", event_date: "2026-08-15", amount: "100.25", installment_no: 2, created_at: "2026-08-15T13:00:00Z", movement_id: 21 },
    ],
  },
  share: { id: id + 100, obligation_id: id, workspace_id: 8, owner_user_id: other, invited_by_user_id: other, invited_user_id: viewer.userId, invited_email: viewer.email,
    status: "accepted", token: `token-${id}`, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", accepted_at: "2026-01-02T00:00:00Z" },
  ...patch,
});
const native = parseSharedObligationResponse([item()], viewer)[0];
assert.equal(native.pendingAmount, 900.2); assert.equal(native.progressPercent, 18.18223);
assert.equal(native.currencyCode, "USD"); assert.equal(native.pendingAmountInBaseCurrency, null);
assert.deepEqual(native.events.map(row => row.id), [3, 2]); assert.equal(native.events[0].createdAt, "2026-08-15T13:00:00Z");
assert.equal(native.installmentLabel, "2 de 12 cuotas");
assert.deepEqual(parseSharedObligationResponse({ ok: true, items: [item()] }, viewer), [native]);
assert.deepEqual(parseSharedObligationResponse({ ok: true, obligations: [native] }, viewer), [native]);
for (const response of [[], { ok: true, items: [] }, { ok: true, obligations: [] }]) assert.deepEqual(parseSharedObligationResponse(response, viewer), []);
for (const response of [null, {}, { ok: true }, { ok: true, items: null }, { ok: true, items: [], obligations: [] }, { ok: false, error: "denied" }]) assert.throws(() => parseSharedObligationResponse(response, viewer));
function bad(mutator) { const row = item(); mutator(row); assert.throws(() => parseSharedObligationResponse([row], viewer)); }
bad(row => { row.share.invited_user_id = other; row.share.invited_email = "not-viewer@example.invalid"; });
// ID or email are grants in the actual SQL contract. Changing the ID alone still grants by email.
const byEmail = item(); byEmail.share.invited_user_id = other;
assert.equal(parseSharedObligationResponse([byEmail], viewer).length, 1);
bad(row => row.share.workspace_id = 9); bad(row => row.share.obligation_id = 12);
bad(row => row.obligation.pending_amount = "bad"); bad(row => delete row.obligation.pending_amount);
bad(row => row.obligation.pending_amount = "0x10"); bad(row => row.share.updated_at = "2026");
bad(row => row.obligation.events[0].obligation_id = 999); bad(row => row.obligation.events.push(row.obligation.events[0]));
bad(row => delete row.obligation.events); bad(row => row.obligation.currency_code = "");
bad(row => row.obligation.start_date = "2026-02-30"); bad(row => row.obligation.payment_plan = { mode: "bad" });
bad(row => row.obligation.payment_plan.firstDueDate = "2026-02-30");
bad(row => row.obligation.payment_plan.agreed[0].dueDate = "not-a-date");
assert.throws(() => parseSharedObligationResponse([item(), item()], viewer));
const revoked = item(); revoked.share.status = "revoked";
assert.deepEqual(parseSharedObligationResponse([revoked], viewer), []);
const zero = item(); zero.obligation.pending_amount = "0"; zero.obligation.installment_amount = 0; zero.obligation.interest_rate = 0;
const zeroResult = parseSharedObligationResponse([zero], viewer)[0];
assert.equal(zeroResult.pendingAmount, 0); assert.equal(zeroResult.installmentAmount, 0); assert.equal(zeroResult.interestRate, 0);
const before = JSON.stringify(item()); const frozen = item();
function freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
parseSharedObligationResponse([freeze(frozen)], viewer); assert.equal(JSON.stringify(frozen), before);
const large = item(); large.obligation.events = Array.from({ length: 1503 }, (_, index) => ({ id: index + 1, obligation_id: 11, event_type: "payment", event_date: "2020-01-01", amount: 1 }));
assert.equal(parseSharedObligationResponse([large], viewer)[0].events.length, 1503);

// Execute the mobile parser and mapper, not hand-copied expected financial rules.
function declarations(file, names) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  return names.map(name => {
    const found = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(found, name); return found.getText(source);
  }).join("\n");
}
const mobile = resolve(root, "../DarkMoneyApp");
const mobileFunctions = declarations(resolve(mobile, "services/queries/obligations-impl.ts"), ["copyIfMissing", "mapObligationShareRow", "obligationShareRecordToSnake", "obligationRowFromUnknown", "eventRowFromUnknown", "mapObligation", "parseSharedObligationItem"]);
const mobileNumber = declarations(resolve(mobile, "services/queries/workspace-data.ts"), ["toNum"]);
const order = readFileSync(resolve(mobile, "lib/sort-obligation-events.ts"), "utf8");
const mobileParser = await import(virtual(compile(`${order}\n${mobileNumber}\n${mobileFunctions}\nexport {parseSharedObligationItem};`)));
const mobileRow = mobileParser.parseSharedObligationItem(structuredClone(item()));
for (const key of ["id", "workspaceId", "title", "direction", "originType", "status", "currencyCode", "principalAmount", "currentPrincipalAmount", "pendingAmount", "progressPercent", "startDate", "dueDate", "installmentAmount", "installmentCount", "interestRate", "description", "notes", "paymentCount", "lastPaymentDate"]) assert.deepEqual(native[key], mobileRow[key], key);
assert.deepEqual(native.events.map(row => [row.id, row.amount, row.eventDate, row.eventType, row.installmentNo, row.movementId]), mobileRow.events.map(row => [row.id, row.amount, row.eventDate, row.eventType, row.installmentNo, row.movementId]));

// RPC-first transport. No live Supabase, env/credentials or financial writes.
function client(response = [item()], rpcError = null) {
  const value = { rpcCalls: [], sessionCalls: 0, sessionUsers: [viewer.userId, viewer.userId], gate: null };
  value.auth = { getSession: async () => ({ data: { session: { user: { id: value.sessionUsers[Math.min(value.sessionCalls++, value.sessionUsers.length - 1)], email: viewer.email } } }, error: null }) };
  value.rpc = (...args) => { value.rpcCalls.push(args); return { abortSignal: (signal) => { value.signal = signal; return value.gate ?? Promise.resolve({ data: response, error: rpcError }); } }; };
  return value;
}
let fallbackCalls = 0; const legacy = async () => { fallbackCalls++; return { ok: true, items: [item()] }; };
const rpc = client(); assert.deepEqual(await readSharedObligations(rpc, viewer.userId, legacy), [native]); assert.equal(fallbackCalls, 0);
assert.deepEqual(rpc.rpcCalls, [["list_shared_obligations"]]); assert.equal(rpc.sessionCalls, 2);
for (const error of [{ code: "PGRST202", message: "Could not find the function public.list_shared_obligations without parameters" }, { code: "42883", message: "function public.list_shared_obligations() does not exist" }]) {
  assert.deepEqual(await readSharedObligations(client(null, error), viewer.userId, legacy), [native]);
}
assert.equal(fallbackCalls, 2);
const edgeSignal = new AbortController().signal;
const edge = { functions: { invoke: async (name, options) => {
  assert.equal(name, "list-shared-obligations"); assert.deepEqual(options.body, {}); assert.equal(options.signal, edgeSignal);
  return { data: { ok: true, items: [item()] }, error: null };
} } };
assert.deepEqual(parseSharedObligationResponse(await readLegacySharedObligations(edge, edgeSignal), viewer), [native]);
await assert.rejects(readLegacySharedObligations({ functions: { invoke: async () => ({ data: null, error: new Error("edge permission") }) } }), /edge permission/);
for (const error of [{ code: "42501", message: "permission denied" }, { code: "PGRST202", message: "Could not find the function public.other_function" }, { code: "42883", message: "function public.inner_dependency() does not exist" }, new Error("network")]) await assert.rejects(readSharedObligations(client(null, error), viewer.userId, legacy));
assert.equal(fallbackCalls, 2);
await assert.rejects(readSharedObligations(client(null), viewer.userId, legacy)); assert.equal(fallbackCalls, 2);
const switched = client(); switched.sessionUsers = [viewer.userId, other];
await assert.rejects(readSharedObligations(switched, viewer.userId, legacy), /sesión cambió/);
const wrongInitial = client(); wrongInitial.sessionUsers = [other];
await assert.rejects(readSharedObligations(wrongInitial, viewer.userId, legacy), /sesión cambió/); assert.equal(wrongInitial.rpcCalls.length, 0);
const timed = client(); let complete; timed.gate = new Promise(resolve => { complete = resolve; });
await assert.rejects(readSharedObligations(timed, viewer.userId, legacy, { timeoutMs: 5 }), /tardó demasiado/);
assert.equal(timed.signal.aborted, true); complete({ data: [item()], error: null }); assert.equal(fallbackCalls, 2);
const cancelled = client(); const controller = new AbortController(); cancelled.gate = new Promise(() => {});
const pending = readSharedObligations(cancelled, viewer.userId, legacy, { signal: controller.signal });
await Promise.resolve(); controller.abort(); await assert.rejects(pending, /cancelada/);
assert.equal(fallbackCalls, 2);

// Notification access uses the same RPC data, including email-only legacy grants.
const noticeCalls = [];
const noticeClient = { from(table) {
  noticeCalls.push(table);
  return { select() { return this; }, eq() { return this; }, async maybeSingle() {
    return { data: table === "notifications" ? { id: 5, kind: "obligation_event_updated", status: "sent", related_entity_type: "obligation", related_entity_id: 11, payload: { obligationId: 11, eventId: 3, workspaceId: 8 } } : null, error: null };
  } };
} };
const emailScope = await fetchNotificationDestination(noticeClient, viewer.userId, 5, async () => parseSharedObligationResponse([byEmail], viewer));
assert.equal(emailScope.scope, "shared"); assert.equal(emailScope.workspace, null);
assert.equal(noticeCalls.includes("obligation_shares"), false);
await assert.rejects(fetchNotificationDestination(noticeClient, viewer.userId, 5, async () => []), /no tienes acceso/);
await assert.rejects(fetchNotificationDestination(noticeClient, viewer.userId, 5, async () => { throw new Error("RPC offline"); }), /RPC offline/);

// A failed shared/request lookup retains the URL; owned links do not depend on unrelated sharing.
const link = new URLSearchParams("resource=11&event=3");
assert.equal(notificationObligationReadState(link, { owned: [], shared: "error", payments: "ready", events: "ready" }), "error");
assert.equal(notificationObligationReadState(link, { owned: [{ id: 11 }], shared: "error", payments: "ready", events: "ready" }), "ready");
assert.equal(notificationObligationReadState(new URLSearchParams("resource=11&event=3&notificationKind=obligation_event_edit_request"), { owned: [{ id: 11 }], shared: "ready", payments: "ready", events: "error" }), "error");
assert.equal(notificationObligationReadState(new URLSearchParams("resource=11&paymentRequest=20&notificationKind=obligation_payment_request"), { owned: [{ id: 11 }], shared: "ready", payments: "loading", events: "ready" }), "loading");
const page = readFileSync(resolve(root, "src/modules/obligations/pages/obligations-page.tsx"), "utf8");
assert.match(page, /useObligationNotificationOpening\(/);
const openingHook=readFileSync(resolve(root,"src/modules/notifications/hooks/use-obligation-notification-opening.ts"),"utf8");
assert.match(openingHook, /if\(reads==="error"\)[\s\S]*?return;[\s\S]*?resolveNotificationObligationTarget/);
assert.match(page, /onClick=\{\(\) => \{ void sharedObligationsQuery.refetch\(\); \}\}/);
const transportSource = readFileSync(resolve(root, "src/services/queries/workspace-data.ts"), "utf8");
const hook = transportSource.match(/export function useSharedObligationsQuery[\s\S]*?\n\}/)[0];
assert.doesNotMatch(hook, /placeholderData/); assert.match(hook, /userId/);

// Execute the real mobile read-only SQL in local Postgres, including its auth/email grants.
const db = new PGlite();
try {
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.viewer', true), '')::uuid $$;
    create table auth.users(id uuid primary key, email text);
    create table public.obligations(id bigint primary key, workspace_id bigint, title text, direction text, origin_type text, status text, currency_code text,
      principal_initial_amount numeric, principal_current_amount numeric, pending_amount numeric, progress_percent numeric, start_date date, due_date date,
      installment_amount numeric, installment_count integer, payment_plan jsonb, interest_rate numeric, payment_count integer, last_payment_date date);
    create view public.v_obligation_summary as select * from public.obligations;
    create table public.obligation_shares(id bigint primary key, workspace_id bigint, obligation_id bigint, owner_user_id uuid, invited_by_user_id uuid,
      invited_user_id uuid, invited_email text, status text, token text, created_at timestamptz, updated_at timestamptz);
    create table public.obligation_events(id bigint primary key, obligation_id bigint, event_type text, event_date date, created_at timestamptz, amount numeric,
      installment_no integer, reason text, description text, notes text, movement_id bigint, created_by_user_id uuid, metadata jsonb, private_column text);
    alter table public.obligation_events enable row level security;
    create policy no_direct_viewer_events on public.obligation_events for select to authenticated using(false);
    grant usage on schema public, auth to authenticated, anon; grant select on public.obligation_events to authenticated;
  `);
  await db.exec(readFileSync(resolve(mobile, "supabase/migrations/202607290001_list_shared_obligations_rpc.sql"), "utf8"));
  await db.query("insert into auth.users values ($1,$2),($3,$4)", [viewer.userId, viewer.email, other, "other@example.invalid"]);
  for (let id = 11; id <= 14; id++) {
    await db.query("insert into obligations values ($1,8,'Ficticio','receivable','cash_loan','active','USD',1000,1100,900,18.18,'2026-01-01',null,100,12,null,2,1,'2026-08-01')", [id]);
    await db.query("insert into obligation_shares values ($1,8,$2,$3,$3,$4,$5,$6,'token','2026-01-01','2026-09-01')", [id + 100, id, other, id === 11 ? viewer.userId : other, id === 12 ? viewer.email : "other@example.invalid", id === 13 ? "revoked" : "accepted"]);
    await db.query("insert into obligation_events values ($1,$2,'payment','2026-08-01',now(),100,1,null,null,null,null,$3,'{}','must-not-leak')", [id + 200, id, other]);
  }
  await db.query("select set_config('app.viewer', $1, false)", [viewer.userId]); await db.exec("set role authenticated");
  assert.equal((await db.query("select * from public.obligation_events")).rows.length, 0);
  const sqlResult = (await db.query("select public.list_shared_obligations() as result")).rows[0].result;
  assert.deepEqual(sqlResult.map(item => item.obligation.id).sort(), [11, 12]);
  assert.equal(sqlResult.some(item => "private_column" in item.obligation.events[0]), false);
  assert.deepEqual(parseSharedObligationResponse(sqlResult, viewer).map(row => row.id).sort(), [11, 12]);
  assert.equal((await db.query("select has_function_privilege('anon','public.list_shared_obligations()','execute') as allowed")).rows[0].allowed, false);
  await db.exec("reset role; set role anon"); await assert.rejects(db.query("select public.list_shared_obligations()"));
} finally { await db.close(); }
console.log("shared-obligations: OK (actual mobile parser/SQL comparison, RPC + both legacy contracts, exact native money/history, scoped auth/email, failures/cancellation/session switch; no remote data)");
