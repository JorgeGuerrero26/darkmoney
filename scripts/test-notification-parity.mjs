import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { notificationPriority, notificationKindGroup, filterNotificationList, notificationReadingCounts } from "../src/modules/notifications/lib/notification-list-model.ts";
import { notificationHref } from "../src/modules/notifications/lib/notification-navigation.ts";
import { updateNotificationReading } from "../src/services/queries/notification-reading.ts";
import { selectNotificationDayMovements } from "../src/modules/notifications/lib/notification-day.ts";
import { resolveNotificationObligationTarget } from "../src/modules/notifications/lib/notification-obligation-target.ts";

const rows = [
  { id: 1, title: "Cobro", body: "Cuenta Sueldo", kind: "obligation_due", status: "pending", payload: { obligationTitle: "Préstamo" } },
  { id: 2, title: "Taxi", body: "Pago detectado", kind: "detected_movement_suggestion", status: "read" },
  { id: 3, title: "Saldo", body: "Cuenta Principal", kind: "negative_balance", status: "failed" },
];
assert.deepEqual(filterNotificationList(rows, { search: "sueldo", priority: "important", kind: "obligations" }).map((item) => item.id), [1]);
assert.deepEqual(filterNotificationList(rows, { search: "préstamo", priority: "all", kind: "all" }).map((item) => item.id), [1]);
assert.deepEqual(filterNotificationList(rows, { search: "sueldo", priority: "critical", kind: "all" }), []);
assert.deepEqual(notificationReadingCounts(rows), { total: 3, unread: 2, read: 1 });
assert.deepEqual(notificationReadingCounts([{ status: "read", readAt: null }, { status: "pending", readAt: "old" }]), { total: 2, unread: 1, read: 1 });
const shell = readFileSync(new URL("../src/app/layouts/app-shell.tsx", import.meta.url), "utf8");
assert.match(shell, /unreadNotificationsCount = notificationReadingCounts\(notificationsQuery.data \?\? \[\]\).unread/);
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
assert.equal(notificationHref({ kind: "negative_balance", relatedEntityType: "workspace", relatedEntityId: 4 }), "/app/accounts");
assert.equal(notificationHref({ kind: "multiple_subscriptions_due", relatedEntityType: "workspace", relatedEntityId: 4 }), "/app/subscriptions");
assert.equal(notificationHref({ kind: "subscription_cost_heavy", relatedEntityType: "workspace", relatedEntityId: 4 }), "/app/subscriptions");
assert.equal(notificationHref({ kind: "obligation_due", payload: { obligationId: 9 } }), "/app/obligations?resource=9");
assert.equal(notificationHref({ kind: "obligation_share_invite", payload: { token: "a/b" } }), "/share/obligations/a%2Fb");
assert.equal(notificationHref({ kind: "custom", payload: { url: "https://evil.invalid" } }), "/app/notifications");
assert.equal(notificationHref({ kind: "subscription_reminder", relatedEntityId: -1 }), "/app/subscriptions");
assert.equal(notificationHref({ kind: "custom", relatedEntityType: "movement", relatedEntityId: 3 }), "/app/movements?period=all&movement=3");

const now = new Date("2026-10-01T03:30:00Z"); // Still September in Peru, regardless of host timezone.
const routeParams = (input) => new URL(notificationHref(input, now), "http://local.test").searchParams;
assert.equal(routeParams({ kind: "high_expense_month" }).get("from"), "2026-09-01");
assert.equal(routeParams({ kind: "high_expense_month" }).get("to"), "2026-09-30");
assert.equal(routeParams({ kind: "high_expense_month" }).get("type"), "expense");
assert.equal(routeParams({ kind: "category_spending_spike", relatedEntityType: "category", relatedEntityId: 8 }).get("categoryId"), "8");
assert.equal(routeParams({ kind: "category_spending_spike", relatedEntityType: "movement", relatedEntityId: 8 }).get("categoryId"), null);
assert.equal(routeParams({ kind: "possible_duplicate_charge", payload: { day: "2026-08-19" } }).get("to"), "2026-08-19");
assert.equal(routeParams({ kind: "possible_duplicate_charge", payload: { day: "2026-02-30" } }).get("from"), "2026-09-01");
assert.equal(routeParams({ kind: "monthly_recap", payload: { monthFrom: "2026-08-01", monthTo: "2026-08-31" } }).get("from"), "2026-08-01");
assert.equal(routeParams({ kind: "no_income_month" }).get("type"), "income");
assert.equal(routeParams({ kind: "no_movements_week" }).get("from"), "2026-09-23");
assert.equal(routeParams({ kind: "daily_ai_digest", payload: { todayKey: "2026-08-12" } }).get("day"), "2026-08-12");
assert.equal(routeParams({ kind: "daily_digest", payload: { todayKey: "not a date" } }).get("day"), "2026-09-30");
assert.equal(notificationHref({ kind: "budget_period_ended", relatedEntityType: "budget", relatedEntityId: 2 }), "/app/budgets?duplicateFrom=2");
assert.equal(notificationHref({ kind: "budget_period_ended", relatedEntityType: "movement", relatedEntityId: 2 }), "/app/budgets");
assert.equal(notificationHref({ kind: "obligation_payment_request", relatedEntityId: 90, payload: { obligationId: 10, requestId: 20 } }), "/app/obligations?resource=10&paymentRequest=20&notificationKind=obligation_payment_request");
assert.equal(notificationHref({ kind: "obligation_payment_request", relatedEntityId: 90, payload: { obligationId: 10, responseStatus: "accepted" } }), "/app/obligations?resource=10");
assert.equal(routeParams({ kind: "obligation_event_updated", payload: { obligationId: 10, eventId: 35 } }).get("event"), "35");

const targets = { owned: [{ id: 10 }], shared: [{ id: 11 }], payments: [{ id: 20, obligationId: 10, status: "pending" }], deletes: [{ payload: { obligationId: 10, eventId: 35 } }], edits: [] };
assert.deepEqual(resolveNotificationObligationTarget(new URLSearchParams("resource=10&paymentRequest=20&notificationKind=obligation_payment_request"), targets), { mode: "payment", id: 10, request: 20 });
assert.deepEqual(resolveNotificationObligationTarget(new URLSearchParams("resource=11&event=35"), targets), { mode: "shared", id: 11, event: 35 });
assert.deepEqual(resolveNotificationObligationTarget(new URLSearchParams("resource=10&event=35&notificationKind=obligation_event_delete_request"), targets), { mode: "delete", id: 10, event: 35 });
assert.equal(resolveNotificationObligationTarget(new URLSearchParams("resource=999&paymentRequest=20"), targets), null);
assert.deepEqual(resolveNotificationObligationTarget(new URLSearchParams("resource=10&paymentRequest=20&notificationKind=obligation_payment_request"), { ...targets, payments: [{ id: 20, obligationId: 99, status: "pending" }] }), { mode: "owned", id: 10, event: null });
assert.deepEqual(resolveNotificationObligationTarget(new URLSearchParams("resource=10&paymentRequest=20&notificationKind=obligation_payment_request"), { ...targets, payments: [{ id: 20, obligationId: 10, status: "accepted" }] }), { mode: "owned", id: 10, event: null });
assert.deepEqual(selectNotificationDayMovements([
  { id: 1, status: "posted", occurredAt: "2026-09-02T04:59:59Z" },
  { id: 2, status: "posted", occurredAt: "2026-09-02T05:00:00Z" },
  { id: 3, status: "pending", occurredAt: "2026-09-01T10:00:00Z" },
], "2026-09-01").map((row) => row.id), [1]);

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
// The redesigned dashboard returns early; both layouts must render the day dialog.
const dashboardSource = readFileSync(new URL("../src/modules/dashboard/pages/dashboard-page.tsx", import.meta.url), "utf8");
assert.equal((dashboardSource.match(/\{notificationDayDialog\}/g) ?? []).length, 2);
const budgetSource = readFileSync(new URL("../src/modules/budgets/pages/budgets-overview-page.tsx", import.meta.url), "utf8");
const duplicateDestination = budgetSource.match(/useResourceLink\(budgets, \(id\) => \{([\s\S]*?)\}, "duplicateFrom"\)/)?.[1];
assert.ok(duplicateDestination, "budget notification must open a next-period draft");
assert.match(duplicateDestination, /duplicateBudgetPeriod\(source\)/);
assert.doesNotMatch(duplicateDestination, /mutate|createBudget|duplicateMutation/);
console.log("notification-parity: OK (pure rules and simulated writes; no real inbox changed)");
