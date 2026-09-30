import assert from "node:assert/strict";
import { buildMonthProjection } from "../../src/modules/dashboard/lib/calendar-month-projection.js";
import type { ParityConversionCtx } from "@darkmoney/shared/types";

const ctx: ParityConversionCtx = {
  baseCurrency: "PEN",
  displayCurrency: "PEN",
  exchangeRateMap: new Map([["USD->PEN", 3.75]]),
  accountCurrencyMap: new Map(),
};

const obligation = (dueDate: string, status = "active") => ({
  direction: "payable", pendingAmount: 100, installmentAmount: 25,
  currencyCode: "PEN", dueDate, status,
});
const income = (nextExpectedDate: string, status = "active") => ({
  amount: 500, currencyCode: "PEN", nextExpectedDate, status,
});
const subscription = (nextDueDate: string, status = "active") => ({
  amount: 10, currencyCode: "PEN", nextDueDate, status,
});

const projection = buildMonthProjection(
  [],
  [obligation("2026-09-30"), obligation("2026-10-01"), obligation("2026-09-29", "paid")],
  [subscription("2026-09-30"), subscription("2026-10-01"), subscription("2026-09-29", "paused")],
  [income("2026-09-30"), income("2026-10-01"), income("2026-09-29", "paused")],
  1000, ctx, new Date("2026-09-15T14:30:00Z"),
);
assert.equal(projection.committedInflow, 500);
assert.equal(projection.committedOutflow, 35);
assert.equal(projection.expectedBalance, 1465);
assert.equal(projection.remainingDays, 15);

// The final day of a 31-day month still belongs to this month's projection.
const fullMonth = buildMonthProjection(
  [], [], [subscription("2026-07-31")], [income("2026-08-01")],
  1000, ctx, new Date("2026-07-01T14:30:00Z"),
);
assert.equal(fullMonth.committedOutflow, 10);
assert.equal(fullMonth.committedInflow, 0);

// No future-month FX omissions may contaminate this month's warning count.
const missingRate = buildMonthProjection(
  [], [], [{ ...subscription("2026-09-29"), currencyCode: "CHF" },
    { ...subscription("2026-10-01"), currencyCode: "JPY" }], [],
  1000, ctx, new Date("2026-09-28T14:30:00Z"),
);
assert.equal(missingRate.committedOutflow, 0);
assert.equal(missingRate.unconvertedCount, 1);

const closedMonth = buildMonthProjection(
  [], [], [subscription("2026-10-01")], [income("2026-10-01")],
  1000, ctx, new Date("2026-09-30T14:30:00Z"),
);
assert.equal(closedMonth.remainingDays, 0);
assert.equal(closedMonth.expectedBalance, 1000);
console.log("month-projection: OK — cierre del mes, cuotas, estados y conversiones");
