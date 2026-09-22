import assert from "node:assert/strict";
import { computeNextRecurringDate, rollDueDateForward } from "../src/modules/subscriptions/lib/subscriptions-presenters.ts";

assert.equal(computeNextRecurringDate("2026-01-31", "monthly", 1, 31), "2026-02-28");
assert.equal(computeNextRecurringDate("2026-02-28", "monthly", 1, 31), "2026-03-31");
assert.equal(computeNextRecurringDate("2026-03-31", "quarterly", 1, 31), "2026-06-30");
assert.equal(computeNextRecurringDate("2026-09-18", "custom", 14), "2026-10-02");
assert.equal(rollDueDateForward("2026-01-31", "monthly", 1, "2026-03-01", 31), "2026-03-31");
console.log("subscription-parity: OK");
