import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { computeNextRecurringDate, rollDueDateForward } from "../src/modules/subscriptions/lib/subscriptions-presenters.ts";
import { subscriptionStandingCopy } from "../src/modules/subscriptions/lib/subscription-standing.ts";
import { subscriptionMonthlyFactor, summarizeSubscriptionsMonthly } from "../src/modules/subscriptions/lib/subscription-monthly.ts";
import { suggestSubscriptionFields } from "../src/modules/subscriptions/lib/subscription-patterns.ts";
import { subscriptionRecurrencePhrase, subscriptionRowSubtitle } from "../src/modules/subscriptions/lib/subscription-detail-presentation.ts";

assert.equal(subscriptionRecurrencePhrase({ frequency: "custom", intervalCount: 14 }), "Cada 14 días");
assert.equal(subscriptionRecurrencePhrase({ frequency: "monthly", intervalCount: 2 }), "Cada 2 meses");
assert.equal(subscriptionRecurrencePhrase({ frequency: "monthly", intervalCount: 1, dayOfMonth: 31 }), "Cada mes, el último día");
assert.equal(subscriptionRowSubtitle({ status: "paused", nextDueDate: "2026-09-01" }, "2026-10-02", (day) => day), "Pausada · el cobro quedó en el 2026-09-01");
assert.equal(subscriptionRowSubtitle({ status: "cancelled", nextDueDate: "2026-09-01" }, "2026-10-02", (day) => day), "Cancelada · sin cobros programados");
assert.equal(subscriptionRowSubtitle({ status: "active", nextDueDate: "2026-10-02" }, "2026-10-02", (day) => day), "Se cobra el 2026-10-02");

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

const fmtDate = (ymd) => ymd.slice(8) + " " + ymd.slice(5, 7);
const fmtMoney = (n) => `S/ ${n.toFixed(2)}`;
const base = { status: "active", amount: 60.07, frequency: "monthly", intervalCount: 1, nextDueDate: "2026-06-04" };
const paid = [{ dueDate: "2026-06-04", status: "paid", expectedAmount: 60.07 }];
const settled = subscriptionStandingCopy({ subscription: base, today: "2026-09-02", formatAmount: fmtMoney, formatDate: fmtDate, occurrences: paid });
assert.equal(settled.daysUntilDue, 2);
assert.match(settled.detail, /Próximo cobro el 04 09, en 2 días/);
assert.doesNotMatch(settled.detail, /04 06/);
const far = subscriptionStandingCopy({ subscription: { ...base, nextDueDate: "2026-08-20" }, today: "2026-09-02", formatAmount: fmtMoney, formatDate: fmtDate, occurrences: paid });
assert.equal(far.label, "Al día");
assert.equal(far.daysUntilDue, 18);
const late = subscriptionStandingCopy({ subscription: base, today: "2026-09-02", formatAmount: fmtMoney, formatDate: fmtDate });
assert.equal(late.label, "Atrasada");
assert.equal(late.missedCharges, 3);
assert.match(late.detail, /hace 90 días/);

// Do not copy the native selector's verified-history omission: overdue rows are unpaid,
// and advancing the pointer does not settle earlier scheduled rows.
const standingSource = ts.createSourceFile("standing.ts", readFileSync(new URL("../../DarkMoneyApp/features/subscriptions/lib/subscriptionStanding.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const standingDeclarations = standingSource.statements.filter(node => ts.isFunctionDeclaration(node));
const standingJs = ts.transpileModule(standingDeclarations.map(node => node.getText(standingSource).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const nativeStanding = new Function("DUE_SOON_DAYS", "computeNextRecurringDate", "rollDueDateForward", `${standingJs};return subscriptionStanding;`)(7, computeNextRecurringDate, rollDueDateForward);
for (const pointer of ["2026-06-04", "2026-09-20"]) for (const status of ["scheduled", "overdue"]) {
  const args = { subscription: { ...base, nextDueDate: pointer }, today: "2026-09-02", formatAmount: fmtMoney, formatDate: fmtDate, occurrences: [
    { dueDate: "2026-08-04", status, expectedAmount: 40 },
    { dueDate: "2026-07-04", status: "paid", expectedAmount: 100 },
    { dueDate: "2026-09-04", status: "scheduled", expectedAmount: 60 },
  ] };
  const actual = subscriptionStandingCopy(args); assert.equal(actual.label, "Atrasada"); assert.equal(actual.missedCharges, 1); assert.equal(actual.daysUntilDue, -29); assert.match(actual.detail, /04 08/); assert.match(actual.detail, /S\/ 40\.00/);
  if (pointer === "2026-09-20" || status === "overdue") assert.equal(nativeStanding(args).missedCharges, 0);
}
const severalPending = subscriptionStandingCopy({ subscription: { ...base, nextDueDate: "2026-10-04" }, today: "2026-09-02", formatAmount: fmtMoney, formatDate: fmtDate,
  occurrences: [{ dueDate: "2026-08-04", status: "scheduled", expectedAmount: 40 }, { dueDate: "2026-06-04", status: "overdue", expectedAmount: 60 }] });
assert.equal(severalPending.missedCharges, 2); assert.equal(severalPending.daysUntilDue, -90); assert.match(severalPending.detail, /04 06/); assert.match(severalPending.detail, /S\/ 100\.00/);
for (const status of ["paused", "cancelled"]) assert.equal(subscriptionStandingCopy({ subscription: { ...base, status }, today: "2026-09-02", formatAmount: fmtMoney, formatDate: fmtDate, occurrences: [{ dueDate: "2026-06-04", status: "overdue", expectedAmount: 40 }] }).missedCharges, 0);

assert.ok(Math.abs(subscriptionMonthlyFactor("monthly", 2) - 0.5) < 1e-9);
assert.ok(Math.abs(subscriptionMonthlyFactor("quarterly", 2) - 1 / 6) < 1e-9);
assert.ok(Math.abs(subscriptionMonthlyFactor("custom", 30) - 365 / 12 / 30) < 1e-9);
const sub = (o) => ({ status: "active", amount: 100, currencyCode: "PEN", amountInBaseCurrency: null, frequency: "monthly", intervalCount: 1, ...o });
const monthly = summarizeSubscriptionsMonthly([
  sub({}),
  sub({ amount: 10, currencyCode: "USD" }),
  sub({ amount: 10, currencyCode: "USD", amountInBaseCurrency: 37 }),
  sub({ status: "paused", amount: 999 }),
], "PEN");
assert.ok(Math.abs(monthly.total - 137) < 1e-9);
assert.equal(monthly.comparableCount, 2);
assert.equal(monthly.unconvertedCount, 1);
// Run the mobile pure factor/summary functions, without importing native hooks or editing mobile.
const mobileSource = ts.createSourceFile("subscriptionFilters.ts", readFileSync("../DarkMoneyApp/features/subscriptions/lib/subscriptionFilters.ts", "utf8"), ts.ScriptTarget.Latest, true);
const names = ["getSubscriptionMonthlyFactor", "summarizeSubscriptionsMonthly"];
const declarations = mobileSource.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
assert.equal(declarations.length, 2);
const compiled = ts.transpileModule(declarations.map(node => node.getText(mobileSource).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const phone = new Function(`${compiled};return {getSubscriptionMonthlyFactor,summarizeSubscriptionsMonthly};`)();
for (const frequency of ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"]) {
  for (const intervalCount of [null, 1, 2, 7, 30]) {
    assert.equal(subscriptionMonthlyFactor(frequency, intervalCount), phone.getSubscriptionMonthlyFactor(frequency, intervalCount));
    const rows = [sub({frequency,intervalCount}), sub({frequency,intervalCount, currencyCode:"USD",amountInBaseCurrency:37}), sub({currencyCode:"USD"}), sub({status:"cancelled"})];
    assert.deepEqual(summarizeSubscriptionsMonthly(rows,"PEN"), phone.summarizeSubscriptionsMonthly(rows,"PEN"));
  }
}

// Qué cobro se paga y con qué fecha: mismas reglas que el oldestUnpaidDueDate.ts móvil actual.
{
  const { oldestUnpaidDueDate, defaultPaymentDate } = await import("../src/modules/subscriptions/lib/subscription-payment-dates.ts");
  const source = readFileSync(new URL("../../DarkMoneyApp/features/subscriptions/lib/oldestUnpaidDueDate.ts", import.meta.url), "utf8");
  const phone = {};
  new Function("exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(phone);
  const histories = [
    undefined, null, [],
    [{ dueDate: "2026-09-04", status: "scheduled" }, { dueDate: "2026-08-04", status: "paid" }],
    [{ dueDate: "2026-10-04", status: "scheduled" }, { dueDate: "2026-09-04", status: "scheduled" }, { dueDate: "2026-07-04", status: "skipped" }],
    [{ dueDate: "2026-11-04", status: "scheduled" }],
  ];
  for (const nextDueDate of ["2026-10-04", "2026-09-04", "2026-12-04"]) for (const history of histories) {
    const due = oldestUnpaidDueDate(nextDueDate, history);
    assert.equal(due, phone.oldestUnpaidDueDate(nextDueDate, history));
    assert.ok(due <= nextDueDate);
    for (const today of ["2026-08-01", "2026-09-04", "2026-10-22"]) assert.equal(defaultPaymentDate(due, today), phone.defaultPaymentDate(due, today));
  }
  assert.equal(oldestUnpaidDueDate("2026-10-04", histories[3]), "2026-09-04");
  assert.equal(defaultPaymentDate("2026-09-04", "2026-10-22"), "2026-10-22");
  assert.equal(defaultPaymentDate("2026-11-04", "2026-10-22"), "2026-11-04");
}
console.log("subscription-parity: OK");
