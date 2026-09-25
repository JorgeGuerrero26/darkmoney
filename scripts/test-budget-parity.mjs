import assert from "node:assert/strict";
import {
  budgetRowNote,
  duplicateBudgetPeriod,
  firstBudgetPeriod,
  groupBudgetRules,
  nextBudgetPeriod,
} from "../src/modules/budgets/lib/budget-periods.ts";
import { buildBudgetComputedMetrics } from "../src/modules/budgets/lib/budget-metrics.ts";

assert.deepEqual(firstBudgetPeriod("2026-09-25", "monthly"), { periodStart: "2026-09-25", periodEnd: "2026-09-30" });
assert.deepEqual(nextBudgetPeriod({ periodStart: "2026-09-25", periodEnd: "2026-09-30" }, "monthly"), { periodStart: "2026-10-01", periodEnd: "2026-10-31" });
assert.deepEqual(nextBudgetPeriod({ periodStart: "2026-12-20", periodEnd: "2026-12-31" }, "yearly"), { periodStart: "2027-01-01", periodEnd: "2027-12-31" });
assert.deepEqual(duplicateBudgetPeriod({ periodStart: "2026-01-01", periodEnd: "2026-01-31" }), { periodStart: "2026-02-01", periodEnd: "2026-03-03" });

const base = {
  id: 1, name: "Alimentación", categoryId: 7, accountId: null, spendTypeId: null,
  periodStart: "2026-08-01", periodEnd: "2026-08-31", spentAmount: 450,
  limitAmount: 400,
};
const current = { ...base, id: 2, periodStart: "2026-09-01", periodEnd: "2026-09-30", spentAmount: 120 };
const other = { ...current, id: 3, spendTypeId: 2 };
const rules = groupBudgetRules([base, current, other], "2026-09-25");
assert.equal(rules.length, 2);
assert.equal(rules.find((rule) => rule.current?.id === 2)?.closed[0].id, 1);
assert.equal(budgetRowNote({ ...current, spentAmount: 410 }, "2026-09-25", (amount) => `S/ ${amount}`), "Te pasaste S/ 10, y quedan 5 días.");

const scopedBudget = { ...current, spendTypeId: 2, currencyCode: "PEN" };
const movement = {
  id: 10, movementType: "expense", status: "posted", occurredAt: "2026-09-12T12:00:00Z",
  description: "Cena", sourceAmount: 25, destinationAmount: null, sourceAccountId: 1,
  sourceAccountName: "Principal", sourceCurrencyCode: "PEN", categoryId: 7,
  category: "Alimentación", spendTypeId: null, categoryDefaultSpendTypeId: 2,
};
const context = { workspaceBaseCurrencyCode: "PEN", exchangeRates: [] };
assert.equal(buildBudgetComputedMetrics(scopedBudget, [movement], context).spentAmount, 25);
assert.equal(buildBudgetComputedMetrics(scopedBudget, [{ ...movement, categoryDefaultSpendTypeId: 1 }], context).spentAmount, 0);
assert.equal(buildBudgetComputedMetrics(scopedBudget, [{ ...movement, movementType: "transfer" }], context).spentAmount, 0);

console.log("Budget parity checks passed.");
