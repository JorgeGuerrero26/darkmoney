import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { monthlyEquivalent, monthlyRecurringIncomeEquivalent, summarizeRecurringIncomeMonthly } from "../src/modules/recurring-income/lib/recurring-income-parity.ts";
function extract(path, names) { const source = readFileSync(new URL(path, import.meta.url), "utf8"), ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true); return ts.transpileModule(ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; }
const nativeMonthly = new Function(`${extract("../../DarkMoneyApp/features/recurring-income/lib/recurringIncomeFilters.ts", ["monthlyRecurringIncomeEquivalent"])};return monthlyRecurringIncomeEquivalent;`)();
const nativeSummary = new Function("monthlyRecurringIncomeEquivalent", "recurringIncomeStanding", `${extract("../../DarkMoneyApp/features/recurring-income/lib/summarizeRecurringIncome.ts", ["summarizeRecurringIncome"])};return summarizeRecurringIncome;`)(nativeMonthly, () => { throw new Error("Standing is outside this monthly-summary comparison; fixtures are future dated."); });
let comparisons = 0;
for (const frequency of ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"]) for (const interval of [1, 2, 3, 10, 14, 365]) for (const amount of [0, 20, 100, 2630.5]) {
  assert.equal(monthlyRecurringIncomeEquivalent(amount, frequency, interval), nativeMonthly(amount, frequency, interval));
  assert.equal(monthlyEquivalent({ frequency, intervalCount: interval, amountInBaseCurrency: amount }), nativeMonthly(amount, frequency, interval)); comparisons++;
}
const income = { id: 1, workspaceId: 8, status: "active", amount: 100, currencyCode: "PEN", frequency: "monthly", intervalCount: 1, nextExpectedDate: "2099-01-01" };
const fixtures = [income, { ...income, id: 2, currencyCode: "USD", amount: 50, amountInBaseCurrency: null }, { ...income, id: 3, currencyCode: "USD", amount: 20, amountInBaseCurrency: 74 }, { ...income, id: 4, status: "paused", amount: 500 }, { ...income, id: 5, status: "cancelled" }, { ...income, id: 6, amount: 0, amountInBaseCurrency: null }];
for (const base of ["PEN", "USD", "pen"]) for (const frequency of ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"]) for (const intervalCount of [1, 2, 10]) {
  const items = fixtures.map(item => ({ ...item, frequency, intervalCount })), expected = nativeSummary(items, base, "2026-10-17"), actual = summarizeRecurringIncomeMonthly(items, base);
  for (const key of ["monthlyTotal", "activeCount", "pausedCount", "comparableActiveCount", "excludedActiveCount"]) assert.equal(actual[key], expected[key], key); comparisons++;
}
assert.equal(summarizeRecurringIncomeMonthly(fixtures, "PEN").monthlyTotal, 174);
assert.equal(summarizeRecurringIncomeMonthly([{ ...income, amountInBaseCurrency: 999 }], "PEN").monthlyTotal, 100); // Own currency is already comparable, even if conversion is stale/absent.
for (const patch of [{ amount: NaN }, { amount: -1 }, { amount: 1e100 }, { intervalCount: Infinity }, { frequency: "unknown" }, { currencyCode: "USD", amountInBaseCurrency: null }, { currencyCode: "USD", amountInBaseCurrency: NaN }, { currencyCode: "USD", amountInBaseCurrency: -1 }, { currencyCode: "USD", amountInBaseCurrency: 0 }]) {
  const summary = summarizeRecurringIncomeMonthly([{ ...income, ...patch }], "PEN"); assert.equal(summary.monthlyTotal, 0); assert.equal(summary.comparableActiveCount, 0); assert.equal(summary.excludedActiveCount, 1);
}
assert.deepEqual(summarizeRecurringIncomeMonthly([], "PEN"), { monthlyTotal: 0, activeCount: 0, pausedCount: 0, comparableActiveCount: 0, excludedActiveCount: 0 });
assert.equal(summarizeRecurringIncomeMonthly([{ ...income, currencyCode: "USD", amount: 0, amountInBaseCurrency: 0 }], "PEN").comparableActiveCount, 1);
console.log(`recurring-income-monthly: OK (${comparisons} original mobile cadence/monthly-summary comparisons; base preference, interval/custom days, active-only/paused/FX, invalid exclusions and zero; not standing or history)`);
