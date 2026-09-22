import assert from "node:assert/strict";
import { computeNextRecurringDate, rollDueDateForward } from "../src/modules/subscriptions/lib/subscriptions-presenters.ts";
import { suggestSubscriptionFields } from "../src/modules/subscriptions/lib/subscription-patterns.ts";

assert.equal(computeNextRecurringDate("2026-01-31", "monthly", 1, 31), "2026-02-28");
assert.equal(computeNextRecurringDate("2026-02-28", "monthly", 1, 31), "2026-03-31");
assert.equal(computeNextRecurringDate("2026-03-31", "quarterly", 1, 31), "2026-06-30");
assert.equal(computeNextRecurringDate("2026-09-18", "custom", 14), "2026-10-02");
assert.equal(rollDueDateForward("2026-01-31", "monthly", 1, "2026-03-01", 31), "2026-03-31");
const previousPayments = [
  { status: "posted", description: "Netflix", categoryId: 7, counterpartyId: 4, sourceAccountId: 3, movementType: "expense" },
  { status: "posted", description: "Netflix", categoryId: 7, counterpartyId: 4, sourceAccountId: 3, movementType: "expense" },
  { status: "void", description: "Netflix", categoryId: 8, counterpartyId: 4, sourceAccountId: 9, movementType: "expense" },
];
assert.deepEqual(suggestSubscriptionFields("Netflix", 4, previousPayments), { categoryId: 7, accountId: 3 });
assert.deepEqual(suggestSubscriptionFields("Nuevo", null, previousPayments), { categoryId: null, accountId: null });
console.log("subscription-parity: OK");
