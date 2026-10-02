import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { notificationPriority, notificationKindGroup, filterNotificationList, notificationReadingCounts } from "../src/modules/notifications/lib/notification-list-model.ts";
import { notificationHref } from "../src/modules/notifications/lib/notification-navigation.ts";
import { updateNotificationReading } from "../src/services/queries/notification-reading.ts";

const rows = [
  { id: 1, title: "Cobro", body: "Cuenta Sueldo", kind: "obligation_due", status: "pending", payload: { obligationTitle: "Préstamo" } },
  { id: 2, title: "Taxi", body: "Pago detectado", kind: "detected_movement_suggestion", status: "read" },
  { id: 3, title: "Saldo", body: "Cuenta Principal", kind: "negative_balance", status: "failed" },
];
assert.deepEqual(filterNotificationList(rows, { search: "sueldo", priority: "important", kind: "obligations" }).map((item) => item.id), [1]);
assert.deepEqual(filterNotificationList(rows, { search: "préstamo", priority: "all", kind: "all" }).map((item) => item.id), [1]);
assert.deepEqual(filterNotificationList(rows, { search: "sueldo", priority: "critical", kind: "all" }), []);
assert.deepEqual(notificationReadingCounts(rows), { total: 3, unread: 2, read: 1 });
assert.equal(notificationKindGroup("obligation_share_invite"), "invites");
assert.equal(notificationKindGroup("weekly_ai_digest"), "digest");

// Compare the actual mobile priority sets, not a duplicate expectation in this test.
const mobilePriorityPath = new URL("../../DarkMoneyApp/lib/notification-priority.ts", import.meta.url);
if (existsSync(mobilePriorityPath)) {
  const mobileSource = readFileSync(mobilePriorityPath, "utf8");
  const critical = [...mobileSource.match(/CRITICAL_KINDS = new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  const important = [...mobileSource.match(/IMPORTANT_KINDS = new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  for (const kind of critical) assert.equal(notificationPriority(kind), "critical", kind);
  for (const kind of important) assert.equal(notificationPriority(kind), "important", kind);
} else console.log("Sibling mobile checkout absent: cross-client priority comparison skipped.");
assert.equal(notificationPriority("obligation_due"), "important");
assert.equal(notificationPriority("negative_balance"), "critical");
for (const kind of ["budget_alert", "daily_ai_digest", "unknown"]) assert.equal(notificationPriority(kind), "informational", kind);

assert.equal(notificationHref({ kind: "subscription_reminder", relatedEntityId: 17 }), "/app/subscriptions?resource=17");
assert.equal(notificationHref({ kind: "negative_balance", relatedEntityId: 4 }), "/app/accounts?resource=4");
assert.equal(notificationHref({ kind: "obligation_due", payload: { obligationId: 9 } }), "/app/obligations?resource=9");
assert.equal(notificationHref({ kind: "obligation_share_invite", payload: { token: "a/b" } }), "/share/obligations/a%2Fb");
assert.equal(notificationHref({ kind: "custom", payload: { url: "https://evil.invalid" } }), "/app/notifications");
assert.equal(notificationHref({ kind: "subscription_reminder", relatedEntityId: -1 }), "/app/subscriptions");
assert.equal(notificationHref({ kind: "custom", relatedEntityType: "movement", relatedEntityId: 3 }), "/app/movements?period=all&movement=3");

const calls = [];
let fail = false;
const client = { from(table) { calls.push(["table", table]); return {
  update(patch) { calls.push(["patch", patch]); return this; },
  eq(field, value) { calls.push(["eq", field, value]); return this; },
  async in(field, value) { calls.push(["in", field, value]); return { error: fail ? new Error("network") : null }; },
}; } };
await updateNotificationReading(client, "user-1", [3, 4, 3], true);
assert.deepEqual(calls[2], ["eq", "user_id", "user-1"]);
assert.deepEqual(calls[3], ["in", "id", [3, 4]]);
assert.equal(calls[1][1].status, "read");
assert.ok(!Number.isNaN(Date.parse(calls[1][1].read_at)));
calls.length = 0;
await updateNotificationReading(client, "user-1", [3], false);
assert.deepEqual(calls[1], ["patch", { status: "sent", read_at: null }]);
calls.length = 0;
await updateNotificationReading(client, "user-1", [], true);
assert.equal(calls.length, 0);
await assert.rejects(updateNotificationReading(client, undefined, [3], true), /sesión/);
await assert.rejects(updateNotificationReading(client, "user-1", [0], true), /inválida/);
assert.equal(calls.length, 0);
fail = true;
await assert.rejects(updateNotificationReading(client, "user-1", [3], true), /network/);

const source = readFileSync(new URL("../src/services/queries/workspace-data.ts", import.meta.url), "utf8");
assert.match(source, /relatedEntityId: row.related_entity_id/);
assert.match(source, /payload: row.payload/);
assert.match(source, /related_entity_type, related_entity_id, payload/);
console.log("notification-parity: OK (pure rules and simulated writes; no real inbox changed)");
