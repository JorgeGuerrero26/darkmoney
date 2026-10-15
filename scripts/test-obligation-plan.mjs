import assert from "node:assert/strict";

import {
  coverPlan,
  defaultFirstDueDate,
  expandPaymentPlan,
  normalizePaymentPlan,
  parsePaymentPlan,
  planDifference,
} from "../src/modules/obligations/lib/payment-plan.ts";

const equal = { mode: "equal", count: 6, firstDueDate: "2026-09-15" };
const equalRows = expandPaymentPlan(equal, 1000, "2026-03-15");
assert.equal(equalRows.length, 6);
assert.equal(equalRows[0].amount, 166.67);
assert.equal(equalRows.at(-1).amount, 166.65);
assert.equal(planDifference(1000, equalRows), 0);
assert.equal(equalRows[0].dueDate, "2026-09-15");
assert.equal(defaultFirstDueDate("2026-03-15", new Date("2026-09-18T12:00:00Z")), "2026-09-15");

const custom = {
  mode: "custom",
  agreed: [
    { amount: 540, dueDate: "2026-09-15" },
    { amount: 100, dueDate: "2026-09-15" },
  ],
  tail: 200,
  firstDueDate: "2026-09-15",
};
const saved = JSON.parse(JSON.stringify(normalizePaymentPlan(custom)));
assert.deepEqual(parsePaymentPlan(saved), custom);
const customRows = expandPaymentPlan(parsePaymentPlan(saved), 1000, "2026-03-15");
assert.deepEqual(customRows.map((row) => row.amount), [540, 100, 200, 160]);
assert.deepEqual(customRows.map((row) => row.dueDate), ["2026-09-15", "2026-10-15", "2026-11-15", "2026-12-15"]);
assert.equal(planDifference(1000, customRows), 0);
assert.deepEqual(parsePaymentPlan({ mode: "custom", agreed: [100, "150"], tail: null }), {
  mode: "custom", agreed: [{ amount: 100 }, { amount: 150 }], tail: null,
});

const covered = coverPlan(equal, 1000, 1000, "2026-03-15", [
  { amount: 30, date: "2026-09-16" },
  { amount: 200, date: "2026-09-17" },
]);
assert.equal(covered[0].status, "covered");
assert.equal(covered[1].status, "partial");
assert.equal(covered[1].covered, 63.33);
assert.equal(covered[1].remaining, 103.34);
assert.equal(covered[2].status, "pending");
assert.equal(covered[0].coveredAt, "2026-09-17");
assert.equal(covered[1].coveredAt, null);

const laterPlan = coverPlan({ mode: "equal", count: 2, firstDueDate: "2026-09-15" }, 1000, 1000, "2026-03-15", [
  { amount: 100, date: "2026-09-10" },
  { amount: 300, date: "2026-08-31" },
]);
assert.deepEqual(laterPlan.map(row => [row.amount, row.covered, row.remaining]), [[350, 100, 250], [350, 0, 350]]);
assert.equal(laterPlan.every(row => row.coveredAt === null), true);

const adjusted = coverPlan({ mode: "equal", count: 4, firstDueDate: "2026-09-15" }, 400, 500, "2026-03-15", [
  { amount: 100, date: "2026-09-16" },
]);
assert.deepEqual(adjusted.map((row) => row.amount), [100, 133.33, 133.33, 133.34]);
assert.equal(adjusted[0].status, "covered");

console.log("obligation-payment-plan: OK");
