import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { detectedMovementDraft, validateDetectedMovement, detectedWriteInput, detectedInputSignature,
  possibleDetectedDuplicate, reconciliationCandidateForDetectedInput, detectedReviewParams, closeDetectedReviewParams } from "../src/modules/notifications/lib/detected-movement.ts";
import { createDetectedMovementStore, mapDetectedMovement } from "../src/services/queries/detected-movement-store.ts";
import { notificationHref, notificationDefersRead } from "../src/modules/notifications/lib/notification-navigation.ts";

process.env.TZ = "America/Lima";
const pendingOrigin = new URLSearchParams("detected=pending&other=kept");
const reviewParams = detectedReviewParams(pendingOrigin, 90);
assert.equal(reviewParams.get("detected"), "90");
assert.equal(reviewParams.get("detectedOrigin"), "pending");
assert.equal(pendingOrigin.get("detected"), "pending", "Opening does not mutate existing params");
assert.equal(closeDetectedReviewParams(reviewParams).toString(), "detected=pending&other=kept");
assert.equal(closeDetectedReviewParams(new URLSearchParams("detected=90&other=kept")).toString(), "other=kept");
assert.equal(closeDetectedReviewParams(new URLSearchParams("detected=90&detectedOrigin=https://example.com&other=kept")).toString(), "other=kept");
assert.equal(detectedReviewParams(new URLSearchParams("detectedOrigin=pending"), 90).has("detectedOrigin"), false);
const accounts = [
  { id: 1, workspaceId: 8, currencyCode: "PEN", isArchived: false, name: "Principal" },
  { id: 2, workspaceId: 8, currencyCode: "PEN", isArchived: false, name: "Sueldo" },
  { id: 3, workspaceId: 8, currencyCode: "USD", isArchived: false, name: "Dólares" },
  { id: 4, workspaceId: 8, currencyCode: "PEN", isArchived: true, name: "Archivada" },
];
const categories = [{ id: 5, name: "Transporte", kind: "expense", isActive: true }, { id: 6, name: "Ingreso", kind: "income", isActive: true }];
const raw = { id: 90, user_id: "u", workspace_id: 8, financial_app_key: "bcp", package_name: "app.bcp",
  app_label: "BCP", movement_type: "expense", amount: "20.50", currency_code: "PEN", description: "Taxi",
  occurred_at: "2026-10-01T04:50:00.000Z", confidence: "high", status: "pending", movement_id: null, metadata: null };
const suggestion = mapDetectedMovement(raw);
const input = { userId: "u", workspaceId: 8, movementType: "expense", status: "posted", description: "Taxi",
  occurredAt: raw.occurred_at, sourceAccountId: 1, sourceAmount: 20.5, destinationAccountId: null, destinationAmount: null,
  fxRate: null, categoryId: 5, counterpartyId: null };
assert.throws(() => mapDetectedMovement({ ...raw, amount: "bad" }), /inválidos/);
assert.throws(() => mapDetectedMovement({ ...raw, occurred_at: "bad" }), /inválidos/);
assert.equal(detectedMovementDraft(suggestion, accounts, categories, []).form.accountId, "");
assert.equal(detectedMovementDraft(suggestion, accounts.slice(0, 1), categories, []).form.accountId, "1");
assert.equal(detectedMovementDraft({ ...suggestion, metadata: { accountId: 4 } }, accounts, categories, []).form.accountId, "");
assert.equal(detectedMovementDraft(suggestion, accounts, categories, [{ financialAppKey: "bcp", enabled: true, defaultAccountId: 2 }]).form.accountId, "2");
assert.equal(detectedMovementDraft({ ...suggestion, metadata: { accountId: 1 } }, accounts, categories, [{ financialAppKey: "bcp", enabled: true, defaultAccountId: 2 }]).form.accountId, "1");
assert.equal(detectedMovementDraft({ ...suggestion, movementType: "transfer" }, accounts, categories, []).form.destinationAccountId, "");
assert.doesNotThrow(() => validateDetectedMovement(suggestion, input, accounts));
assert.doesNotThrow(() => validateDetectedMovement(suggestion, input, accounts, categories));
assert.throws(() => validateDetectedMovement(suggestion, { ...input, categoryId: 6 }, accounts, categories), /categoría/);
assert.throws(() => validateDetectedMovement(suggestion, { ...input, metadata: { split_group: "" } }, accounts), /división/);
for (const changed of [{ workspaceId: 9 }, { userId: "another" }, { status: "planned" }, { sourceAccountId: 3 }, { sourceAccountId: 4 }, { sourceAmount: 0 }]) {
  assert.throws(() => validateDetectedMovement(suggestion, { ...input, ...changed }, accounts));
}
const transfer = { ...input, movementType: "transfer", destinationAccountId: 3, destinationAmount: 5, fxRate: 5 / 20.5 };
assert.doesNotThrow(() => validateDetectedMovement(suggestion, transfer, accounts));
assert.throws(() => validateDetectedMovement(suggestion, { ...transfer, fxRate: null }, accounts));
assert.throws(() => validateDetectedMovement(suggestion, { ...transfer, destinationAccountId: 1 }, accounts));
const write = detectedWriteInput(suggestion, { ...input, dedupeKey: "random", metadata: { suggestionId: 999, source: "wrong" } });
assert.equal(write.dedupeKey, "suggestion:90");
assert.equal(write.metadata.suggestionId, 90);
assert.equal(write.metadata.source, "notification_detection");

const movement = { id: 70, workspaceId: 8, movementType: "expense", status: "posted", description: "Taxi",
  occurredAt: "2026-10-01T04:30:00Z", sourceAccountId: 1, sourceAmount: 20.5, destinationAccountId: null, destinationAmount: null };
assert.equal(possibleDetectedDuplicate(input, accounts, [movement])?.id, 70);
for (const changed of [{ sourceAccountId: 2 }, { status: "pending" }, { workspaceId: 9 }, { description: "Comida" }, { occurredAt: "2026-10-01T05:00:00Z" }]) {
  assert.equal(possibleDetectedDuplicate(input, accounts, [{ ...movement, ...changed }]), null);
}
assert.equal(reconciliationCandidateForDetectedInput(suggestion, input, accounts, movement)?.id, 70);
assert.equal(reconciliationCandidateForDetectedInput(suggestion, { ...input, description: "Otro taxi" }, accounts, movement), null);
assert.notEqual(detectedInputSignature(input), detectedInputSignature({ ...input, sourceAmount: 21 }));
assert.equal(notificationHref({ kind: "detected_movement_suggestion", relatedEntityType: "detected_movement_suggestion", relatedEntityId: 90, payload: { status: "registered" } }), "/app/notifications?detected=90");
assert.equal(notificationHref({ kind: "detected_movement_suggestion", payload: { suggestionId: 91 } }), "/app/notifications?detected=91");
assert.equal(notificationHref({ kind: "detected_movement_suggestion", relatedEntityType: "movement", relatedEntityId: 90 }), "/app/notifications?detected=pending");
assert.equal(notificationHref({ kind: "detected_suggestions_pending" }), "/app/notifications?detected=pending");
assert.equal(notificationDefersRead("detected_movement_suggestion"), true);
assert.equal(notificationDefersRead("daily_digest"), false);

// Read the actual pure mobile draft, not a rewritten reference implementation.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = resolve(root, "../DarkMoneyApp");
const mobileDraftFile = resolve(mobileRoot, "features/detected-movements/lib/review-draft.ts");
if (!existsSync(mobileDraftFile)) throw new Error("Mobile reference required for this parity test.");
const compiled = new Map();
function mobileModule(path) {
  if (compiled.has(path)) return compiled.get(path);
  let js = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  js = js.replace(/from "(\.[^"]+)"/g, (_, specifier) => `from "${mobileModule(resolve(dirname(path), `${specifier}.ts`))}"`);
  const url = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  compiled.set(path, url);
  return url;
}
const mobile = await import(mobileModule(mobileDraftFile));
for (const kind of ["expense", "income", "transfer", "unknown"]) {
  for (const metadata of [null, { accountId: 1, categoryId: 5 }, { accountId: 4 }, { sourceAccountId: 1, destinationAccountId: 2, categoryId: 6 }]) {
    const source = { ...suggestion, movementType: kind, metadata };
    const settings = [{ financialAppKey: "bcp", enabled: true, defaultAccountId: 2 }];
    const phone = mobile.buildDetectionDraft(source, accounts, categories, settings);
    const web = detectedMovementDraft(source, accounts, categories, settings);
    assert.equal(web.kind, phone.movementType);
    assert.equal(web.form.accountId || web.form.sourceAccountId, String(phone.accountId ?? ""));
    assert.equal(web.form.destinationAccountId, String(phone.destinationAccountId ?? ""));
    assert.equal(web.form.categoryId, kind === "transfer" ? "" : String(phone.categoryId ?? ""));
    assert.equal(new Date(web.form.occurredAt).toISOString().slice(0, 16), source.occurredAt.slice(0, 16));
  }
}
process.env.TZ = "UTC";
assert.equal(new Date(detectedMovementDraft(suggestion, accounts, categories, []).form.occurredAt).toISOString().slice(0, 16), raw.occurred_at.slice(0, 16));
process.env.TZ = "America/Lima";

// Fake Supabase: no network or real inbox/financial writes.
function fixture(rows = [structuredClone(raw)]) {
  const db = { suggestions: rows, movements: [], notifications: [{ user_id: "u", kind: "detected_movement_suggestion", related_entity_type: "detected_movement_suggestion", related_entity_id: 90, status: "sent" }] };
  const state = { rpcFail: false, pro: true, readFail: false, candidates: [], resolvedIds: [], beforeUpdate: null, rpcCalls: 0 };
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.patch = null; this.bounds = null; }
    select() { return this; }
    eq(field, value) { this.filters.push((row) => row[field] === value); return this; }
    neq(field, value) { this.filters.push((row) => row[field] !== value); return this; }
    is(field, value) { return this.eq(field, value); }
    in(field, values) { this.filters.push((row) => values.includes(row[field])); return this; }
    order() { return this; }
    range(from, to) { this.bounds = [from, to]; return this; }
    update(patch) { this.patch = patch; return this; }
    async execute(single = false) {
      if (this.patch && state.beforeUpdate) { state.beforeUpdate(); state.beforeUpdate = null; }
      if (this.patch && this.table === "notifications" && state.readFail === "throw") throw new Error("network failed");
      if (this.patch && this.table === "notifications" && state.readFail) return { data: null, error: new Error("offline") };
      let found = db[this.table === "notification_detected_movement_suggestions" ? "suggestions" : this.table].filter((row) => this.filters.every((test) => test(row)));
      if (this.bounds) found = found.slice(this.bounds[0], this.bounds[1] + 1);
      if (this.patch) for (const row of found) Object.assign(row, this.patch);
      return { data: structuredClone(single ? found[0] ?? null : found), error: null };
    }
    maybeSingle() { return this.execute(true); }
    then(yes, no) { return this.execute().then(yes, no); }
  }
  const client = { from: (table) => new Query(table), async rpc(name) {
    state.rpcCalls++;
    if (state.rpcFail) return { data: null, error: new Error("RPC missing") };
    return { data: name === "has_email_detection_pro_access" ? state.pro : { resolvedIds: state.resolvedIds, candidates: state.candidates }, error: null };
  } };
  return { db, state, store: createDetectedMovementStore(client, { userId: "u", workspaceId: 8 }) };
}
{
  const { store, db } = fixture();
  const result = await store.review(90);
  assert.equal(result.suggestion.status, "pending");
  assert.equal(db.notifications[0].status, "sent", "opening must not mark read");
}
{
  const { store, db } = fixture();
  const saved = await store.register(90, input, accounts, async (value) => {
    assert.equal(value.dedupeKey, "suggestion:90");
    db.movements.push({ id: 70, workspace_id: 8, status: "posted" });
    return 70; // Exercise the mobile-compatible post-registration fallback.
  });
  assert.equal(saved.movementId, 70);
  assert.equal(db.suggestions[0].status, "registered");
  assert.equal(db.notifications[0].status, "read");
}
{
  const { store, state, db } = fixture(); let inserted = 0;
  const create = async (value) => {
    assert.equal(value.dedupeKey, "suggestion:90");
    assert.equal(value.metadata.suggestionId, 90);
    // Simulate server uniqueness + transactional trigger used by both clients.
    if (!db.movements.length) { inserted++; db.movements.push({ id: 70, workspace_id: 8, status: "posted" }); Object.assign(db.suggestions[0], { status: "registered", movement_id: 70 }); }
    return 70;
  };
  const saved = await Promise.all([store.register(90, input, accounts, create), store.register(90, input, accounts, create)]);
  assert.deepEqual(saved.map((row) => row.movementId), [70, 70]);
  assert.equal(inserted, 1);
  assert.equal(db.notifications[0].status, "read");
  assert.equal((await store.register(90, input, accounts, create)).movementId, 70);
  assert.equal(inserted, 1, "retry after commit does not insert again");
  state.readFail = true;
  assert.equal((await store.register(90, input, accounts, create)).readingUpdated, false);
  state.readFail = "throw";
  assert.equal((await store.register(90, input, accounts, create)).readingUpdated, false);
}
{
  const { store, state } = fixture(); let writes = 0;
  const create = async () => { writes++; return 70; };
  state.rpcFail = true;
  await assert.rejects(store.register(90, input, accounts, create), /conciliar/);
  state.rpcFail = false;
  await assert.rejects(store.register(90, { ...input, sourceAccountId: 3 }, accounts, create), /PEN/);
  await assert.rejects(store.register(90, input, accounts, create, async () => { throw new Error("duplicate needs confirmation"); }), /confirmation/);
  assert.equal(writes, 0);
}
{
  const { store } = fixture([{ ...raw, user_id: "other" }]);
  assert.equal((await store.review(90)).suggestion, null);
  await assert.rejects(store.register(90, input, accounts, async () => assert.fail("must not insert")), /disponible/);
}
{
  const { store, state } = fixture([{ ...raw, package_name: "email:inbound" }]);
  state.pro = false;
  await assert.rejects(store.review(90), /PRO/);
  await assert.rejects(store.register(90, input, accounts, async () => assert.fail("no access")), /PRO/);
}
{
  const { store, db, state } = fixture();
  state.beforeUpdate = () => { db.suggestions[0].status = "registered"; };
  await assert.rejects(store.resolve(suggestion, "discarded"), /otro dispositivo/);
  assert.equal(db.suggestions[0].status, "registered");
  assert.equal(db.notifications[0].status, "sent");
}
{
  const { store, db, state } = fixture(); state.readFail = true;
  const result = await store.resolve(suggestion, "discarded");
  assert.equal(result.suggestion.status, "discarded"); assert.equal(result.readingUpdated, false);
  assert.equal(db.movements.length, 0);
  assert.equal((await store.restoreDiscarded(90)).status, "pending");
  assert.equal(db.notifications[0].status, "sent", "restore doesn't redefine notification reading");
  await assert.rejects(store.restoreDiscarded(90), /ya no puede/);
}
{
  const { store, db } = fixture();
  await store.resolve(suggestion, "discarded");
  await store.restoreDiscarded(90);
  assert.equal(db.notifications[0].status, "read", "restoring a detection doesn't reset the user's reading state");
}
{
  const { store, db } = fixture();
  await assert.rejects(store.resolve(suggestion, "duplicate", 70), /no está disponible/);
  db.movements.push({ id: 70, workspace_id: 8, status: "posted" });
  assert.equal((await store.resolve(suggestion, "duplicate", 70)).suggestion.movementId, 70);
  assert.equal(db.movements.length, 1, "linking a duplicate does not create a movement");
}
{
  const rows = Array.from({ length: 501 }, (_, index) => ({ ...raw, id: index + 1 }));
  rows.push({ ...raw, id: 600, status: "registered" }, { ...raw, id: 601, workspace_id: 9 });
  assert.equal((await fixture(rows).store.pending()).length, 501);
}

for (const file of ["src/app/layouts/app-shell.tsx", "src/modules/notifications/pages/notifications-redesign-page.tsx"]) {
  assert.match(readFileSync(resolve(root, file), "utf8"), /!notificationDefersRead\(notification.kind\)/);
}
assert.match(readFileSync(resolve(root, "src/modules/notifications/components/detected-movement-review.tsx"), "utf8"), /<QuickMovementDialog/);
console.log("detected-movement-parity: OK (actual mobile draft, scoped fake queries/writes, no real records changed)");
