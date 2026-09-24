import assert from "node:assert/strict";
import { advanceNextExpectedDate, monthlyEquivalent, pendingArrivalDates } from "../src/modules/recurring-income/lib/recurring-income-parity.ts";

const income = {
  status: "active", frequency: "monthly", intervalCount: 1, dayOfMonth: 31,
  nextExpectedDate: "2026-01-31", amount: 2630.5, amountInBaseCurrency: 2630.5,
};

assert.equal(advanceNextExpectedDate(income), "2026-02-28");
assert.equal(advanceNextExpectedDate({ ...income, nextExpectedDate: "2026-02-28" }), "2026-03-31");
assert.equal(advanceNextExpectedDate({ ...income, frequency: "quarterly" }), "2026-04-30");
assert.deepEqual(pendingArrivalDates({ ...income, nextExpectedDate: "2026-07-29", dayOfMonth: 29 }, "2026-09-24"), ["2026-07-29", "2026-08-29"]);
assert.deepEqual(pendingArrivalDates({ ...income, status: "paused" }, "2026-09-24"), []);
assert.equal(monthlyEquivalent({ ...income, frequency: "yearly" }), 2630.5 / 12);
assert.equal(monthlyEquivalent({ ...income, amountInBaseCurrency: null }), 0);
console.log("Recurring income parity checks passed.");
