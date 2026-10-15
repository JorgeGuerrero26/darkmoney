import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, dom, root, load, mock, createRoot } from "./lib/web-ui-harness.mjs";

// Read and execute the real pure mobile functions; never import its native UI/runtime.
const mobileBase = "../DarkMoneyApp/features/projection/lib/";
const viewerFile = resolve(root, "../DarkMoneyApp/lib/obligation-viewer-labels.ts");
const viewerSource = ts.createSourceFile(viewerFile, readFileSync(viewerFile, "utf8"), ts.ScriptTarget.Latest, true);
const viewer = viewerSource.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === "obligationViewerDirection");
assert.ok(viewer);
mock("../DarkMoneyApp/lib/obligation-viewer-labels.ts", ts.transpileModule(viewer.getText(viewerSource), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText);
const web = await import(load("src/modules/dashboard/lib/projection/cashflow-calendar.ts"));
const mobile = await import(load(`${mobileBase}cashflow-calendar.ts`));
const webPlan = await import(load("src/modules/obligations/lib/payment-plan.ts"));
const mobilePlan = await import(load("../DarkMoneyApp/features/obligations/lib/payment-plan.ts"));
const { buildDashboardCashflow } = await import(load("src/modules/dashboard/lib/projection/build-dashboard-cashflow.ts"));
const localLiquid = await import(load("src/modules/dashboard/lib/projection/liquid-balance.ts"));
const phoneLiquid = await import(load(`${mobileBase}liquid-balance.ts`));
const localHistory = await import(load("src/modules/dashboard/lib/projection/discretionary-history.ts"));
const phoneHistory = await import(load(`${mobileBase}discretionary-history.ts`));
const localPlanned = await import(load("src/modules/dashboard/lib/projection/planned-cash-effect.ts"));
const phonePlanned = await import(load(`${mobileBase}planned-cash-effect.ts`));
const convert = (amount, currency) => currency === "PEN" ? amount : currency === "USD" ? amount * 3.7 : null;
const obligation = {
  id: 1, title: "Cuotas", direction: "receivable", status: "active", currencyCode: "PEN",
  pendingAmount: 800, principalCurrentAmount: 1200, openingPrincipal: 1000,
  startDate: "2026-03-15", dueDate: "2027-02-15", paymentPlan: { mode: "equal", count: 6, firstDueDate: "2026-09-15" },
  payments: [{ amount: 300, date: "2026-08-31" }, { amount: 100, date: "2026-09-10" }],
};
const base = {
  startingBalance: 1300, fromDate: "2026-10-15", months: 3, convert, typicalDiscretionarySpend: 710,
  subscriptions: [{ id: 2, name: "Servicio", amount: 15, currencyCode: "USD", frequency: "monthly", intervalCount: 2, nextDueDate: "2026-10-25", status: "active" }],
  recurringIncome: [{ id: 3, name: "Sueldo", amount: 2600, currencyCode: "PEN", frequency: "monthly", nextExpectedDate: "2026-10-30", status: "active", scheduledChanges: [{ effectiveDate: "2026-11-01", amount: 3000 }] }],
  obligations: [obligation, { ...obligation, id: 2, title: "Compartida", viewerMode: "shared_viewer" }],
  plannedMovements: [{ id: 4, description: "Compra", signedAmount: -40, currencyCode: "PEN", occurredAt: "2026-10-17T12:00:00-05:00" }],
  creditCards: [{ id: 5, name: "Tarjeta", currencyCode: "USD", currentDebt: 120, paymentDay: 28, typicalMonthlySpend: 60 }],
};
let comparisons = 0;
const compare = input => { assert.deepEqual(web.buildCashflowCalendar(input), mobile.buildCashflowCalendar(input)); comparisons++; };
compare(base);
for (const frequency of ["daily", "weekly", "monthly", "quarterly", "yearly"]) {
  for (const step of [1, 2, 14]) compare({ ...base, subscriptions: [{ ...base.subscriptions[0], frequency, intervalCount: step }], months: 12 });
}
// Explicit correction, not certified parity: current mobile calendar treats custom as months,
// contrary to the subscription registration contract (custom intervalCount is DAYS).
const custom = { ...base, months: 1, subscriptions: [{ ...base.subscriptions[0], currencyCode: "PEN", nextDueDate: "2026-10-15", frequency: "custom", intervalCount: 7 }] };
assert.equal(web.buildCashflowCalendar(custom).months[0].outflows.filter(l => l.kind === "subscription").length, 3);
assert.equal(mobile.buildCashflowCalendar(custom).months[0].outflows.filter(l => l.kind === "subscription").length, 1);
const webWindows = await import(load("src/modules/dashboard/lib/projection/flow-windows.ts"));
const phoneFlow = await import(load("../DarkMoneyApp/features/dashboard/lib/projectionFlowItems.ts"));
const builderFile = resolve(root, "../DarkMoneyApp/features/dashboard/lib/dashboard-builders.ts");
const builderSource = ts.createSourceFile(builderFile, readFileSync(builderFile, "utf8"), ts.ScriptTarget.Latest, true);
const windowsNode = builderSource.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === "windowsFromFlowItems"); assert.ok(windowsNode);
const windowsJs = ts.transpileModule(windowsNode.getText(builderSource).replace("export function", "function"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const phoneWindows = new Function("addDays", `${windowsJs};return windowsFromFlowItems;`)((await import("date-fns")).addDays);
const today = new Date(2026, 9, 15, 12);
const calendar = web.buildCashflowCalendar(base);
const flow = webWindows.projectionFlowItems(calendar.months, today);
assert.deepEqual(flow, phoneFlow.projectionFlowItems(calendar.months, today));
assert.deepEqual(webWindows.windowsFromFlowItems(flow, 1300, today), phoneWindows(flow, 1300, today));
assert.ok(flow.some(row => row.title.includes("atrasada")));
assert.equal(flow.some(row => row.source === "typical_spend"), false);
for (const fromDate of ["2026-01-31", "2028-02-29", "2026-09-30", "2026-12-31"]) {
  for (const months of [1, 2, 12]) {
    const input = { ...base, fromDate, months };
    compare(input);
    assert.equal(web.buildCashflowCalendar(input).months[0].closingBalance, web.buildCashflowCalendar({ ...input, months: 1 }).endingBalance);
  }
}
compare({ ...base, recurringIncome: [{ ...base.recurringIncome[0], currencyCode: "EUR" }], subscriptions: [{ ...base.subscriptions[0], endDate: "2026-11-01" }], creditCards: [{ ...base.creditCards[0], paymentDay: null }] });
for (const paymentPlan of [obligation.paymentPlan, { mode: "custom", firstDueDate: "2026-09-15", agreed: [{ amount: 100 }, { amount: 200 }], tail: 150 }]) {
  const input = { ...obligation, paymentPlan };
  compare({ ...base, obligations: [input] });
  const rows = webPlan.coverPlan(paymentPlan, input.openingPrincipal, input.principalCurrentAmount, input.startDate, input.payments);
  const phone = mobilePlan.coverPlan({ plan: paymentPlan, openingPrincipal: input.openingPrincipal, currentDebt: input.principalCurrentAmount, startDate: input.startDate, payments: input.payments });
  assert.deepEqual(rows, phone);
}
const newlyAgreed = webPlan.coverPlan({ mode: "equal", count: 2, firstDueDate: "2026-09-15" }, 1000, 1000, "2026-03-15", [{ amount: 300, date: "2026-08-31" }, { amount: 100, date: "2026-09-10" }]);
assert.deepEqual(newlyAgreed.map(r => [r.amount, r.covered, r.remaining]), [[350, 100, 250], [350, 0, 350]]);

const types = new Map([[1, "bank"], [2, "investment"], [3, "cash"], [4, "credit_card"]]);
for (const [sourceAccountId, destinationAccountId] of [[1, 2], [2, 1], [1, 3], [1, 4], [2, 4], [1, 99]]) {
  const movement = { movementType: "transfer", sourceAccountId, destinationAccountId, sourceAmount: 100, destinationAmount: 27 };
  assert.deepEqual(localPlanned.plannedCashEffect(movement, types), phonePlanned.plannedCashEffect(movement, types));
}
const account = (id, type, balance, extra = {}) => ({ id, workspaceId: 7, name: `Cuenta ${id}`, type, currentBalance: balance, currencyCode: "PEN", includeInNetWorth: true, isArchived: false, ...extra });
const accounts = [account(1, "bank", 1000), account(2, "cash", 100), account(3, "savings", 200, { includeInNetWorth: false }), account(4, "investment", 10000), account(5, "credit_card", -120, { currencyCode: "USD", paymentDay: 28 }), account(6, "bank", 99, { isArchived: true }), account(7, "bank", 500, { currencyCode: "EUR" })];
assert.deepEqual(localLiquid.liquidBalance(accounts, convert), phoneLiquid.liquidBalance(accounts, convert));
assert.deepEqual(localLiquid.liquidBalance(accounts, convert), { total: 1300, unconvertedCount: 1 });
const expense = (id, month, amount, extra = {}) => ({ id, workspaceId: 7, movementType: "expense", status: "posted", occurredAt: `2026-${month}-16T12:00:00-05:00`, sourceAmount: amount, sourceAccountId: 1, destinationAmount: null, destinationAccountId: null, categoryId: 1, description: "Gasto", ...extra });
const movements = [];
for (const [index, total] of [600, 800, 700, 720, 680, 4000].entries()) {
  const month = String(index + 4).padStart(2, "0");
  movements.push(expense(index * 10, month, total), expense(index * 10 + 1, month, 10000, { categoryId: 9 }), expense(index * 10 + 2, month, 60, { sourceAccountId: 5 }), expense(index * 10 + 3, month, 90, { movementType: "subscription_payment" }), expense(index * 10 + 4, month, 100, { movementType: "obligation_payment" }));
}
const historyArgs = { movements, months: 6, earliestCoveredDate: new Date(2026, 3, 1), now: new Date(2026, 9, 15), expenseAmountOf: m => m.sourceAmount };
assert.deepEqual(localHistory.monthlyDiscretionarySpend(historyArgs), phoneHistory.monthlyDiscretionarySpend(historyArgs));
assert.equal(localHistory.isOneOffSpend({ categoryId: 9 }, new Set([99]), new Map([[9, 99]])), true);
assert.equal(localHistory.isOneOffSpend({ categoryId: 9, spendTypeId: 1 }, new Set([99]), new Map([[9, 99]])), false);
assert.deepEqual(localHistory.monthlyDiscretionarySpend({ ...historyArgs, earliestCoveredDate: new Date(2026, 8, 2) }), []);

const snapshot = { workspace: { id: 7 }, accounts, movements, catalogs: { categories: [{ id: 1 }, { id: 9, defaultSpendTypeId: 99 }] }, subscriptions: base.subscriptions, recurringIncome: base.recurringIncome, obligations: [{ ...obligation, workspaceId: 7, principalAmount: obligation.openingPrincipal, currentPrincipalAmount: obligation.principalCurrentAmount, events: obligation.payments.map(p => ({ eventType: "payment", amount: p.amount, eventDate: p.date })) }] };
const supplement = { workspaceId: 7, oneOffTypeIds: [99], scheduledChanges: [{ id: 3, changes: base.recurringIncome[0].scheduledChanges }] };
const ctx = { baseCurrency: "PEN", displayCurrency: "PEN", exchangeRateMap: new Map([["USD:PEN", 3.7]]), accountCurrencyMap: new Map(accounts.map(a => [a.id, a.currencyCode])) };
const model = buildDashboardCashflow(snapshot, [], supplement, ctx, new Date(2026, 9, 15, 12));
assert.equal(model.typicalSpend.typical, 710);
assert.equal(model.liquid.total, 1300);
assert.equal(model.projection.months[1].inflows.find(l => l.kind === "recurring_income").amount, 3000);
assert.equal(model.projection.months[0].outflows.find(l => l.kind === "credit_card_payment").amount, 444);
assert.equal(model.projection.months[1].outflows.find(l => l.kind === "credit_card_payment").amount, 222); // USD 60, once only.
assert.ok(Math.abs(model.monthEnd.expectedBalance - (model.liquid.total + model.monthEnd.committedInflow - model.monthEnd.committedOutflow - model.monthEnd.variableExpenseProjection)) < 1e-8);
assert.equal(model.monthEnd.expectedBalance, buildDashboardCashflow(snapshot, [], supplement, ctx, new Date(2026, 9, 15, 12), 1).projection.endingBalance);
assert.throws(() => buildDashboardCashflow(snapshot, [], { ...supplement, workspaceId: 8 }, ctx), /otro espacio/);
const shared = { ...snapshot.obligations[0], id: 12, viewerMode: "shared_viewer" };
const sharedModel = buildDashboardCashflow(snapshot, [shared, { ...shared, id: 1 }], supplement, ctx, new Date(2026, 9, 15, 12));
assert.ok(sharedModel.projection.months[0].outflows.some(l => l.refId === 12 && l.kind === "obligation_payable"));
assert.equal(sharedModel.projection.months[0].inflows.length, model.projection.months[0].inflows.length);

// Execute the actual mobile orchestration hook too. Only query constants are substituted;
// React memoization, classification, native money, history and calendar remain the real code.
mock("../DarkMoneyApp/services/queries/workspace-data.ts", "export const DASHBOARD_MOVEMENTS_WINDOW_DAYS=90;export const PROJECTION_HISTORY_MONTHS=6;");
const { useCashflowProjection } = await import(load("../DarkMoneyApp/features/dashboard/hooks/useCashflowProjection.ts"));
const mobileContainer = document.createElement("div"); document.body.append(mobileContainer); const mobileRenderer = createRoot(mobileContainer);
let mobileResult;
function MobileHost() {
  mobileResult = useCashflowProjection({
    ...snapshot, ...ctx, accounts, historyMovements: movements, historyCoveredFrom: new Date(2026, 3, 1),
    oneOffSpend: { typeIds: new Set([99]), categoryDefaults: new Map([[9, 99]]) },
  }, 2);
  return null;
}
const OriginalDate = globalThis.Date;
globalThis.Date = class extends OriginalDate {
  constructor(...args) { if (args.length) super(...args); else super(today.getTime()); }
  static now() { return today.getTime(); }
};
try { await act(async () => mobileRenderer.render(React.createElement(MobileHost))); }
finally { globalThis.Date = OriginalDate; }
assert.equal(mobileResult.liquid.total, model.liquid.total);
assert.equal(mobileResult.typicalSpend.typical, model.typicalSpend.typical);
assert.equal(mobileResult.projection.months[0].closingBalance, model.projection.months[0].closingBalance);
const mobileTypicalCard = mobileResult.projection.months[1].outflows.find(l => l.kind === "credit_card_payment").amount;
assert.ok(Math.abs(mobileTypicalCard - 821.4) < 1e-8);
assert.notEqual(mobileTypicalCard, model.projection.months[1].outflows.find(l => l.kind === "credit_card_payment").amount);
await act(async () => mobileRenderer.unmount()); mobileContainer.remove();

// Real read service, bounded pages and no monetary writes. Errors never become empty metadata.
mock("src/services/supabase/client.ts", "export const supabase=null;");
const { readProjectionSupplement, parseProjectionChanges } = await import(load("src/services/queries/dashboard-projection.ts"));
assert.deepEqual(parseProjectionChanges([{ effective_date: "2027-01-01", amount: 5 }, { effective_date: "2027-01-01", amount: 6 }, { effective_date: "x", amount: 9 }, { effective_date: "2026-01-01", amount: -1 }]), [{ effectiveDate: "2027-01-01", amount: 6 }]);
const calls = [];
let readError = false, foreign = false;
const client = { from(table) { const entry = { table }; calls.push(entry); return {
  select(columns) { entry.columns = columns; return this; }, eq(column, value) { entry.scope = [column, value]; return this; }, order() { return this; }, range(start, end) { entry.range = [start, end]; return this; },
  async abortSignal(signal) { assert.equal(signal.aborted, false); if (readError) return { data: null, error: new Error("unavailable") }; return { data: table === "spend_types" ? Array.from({ length: entry.range[0] === 0 ? 500 : 1 }, (_, i) => ({ id: i + entry.range[0], workspace_id: foreign ? 8 : 7, excluded_from_typical: i === 0 })) : [{ id: 3, workspace_id: 7, scheduled_changes: [{ effective_date: "2026-11-01", amount: 3000 }] }], error: null }; },
}; } };
const read = await readProjectionSupplement(client, 7, new AbortController().signal);
assert.equal(read.scheduledChanges[0].changes[0].amount, 3000); assert.equal(calls.filter(c => c.table === "spend_types").length, 2);
assert.ok(calls.every(c => c.scope[0] === "workspace_id" && c.scope[1] === 7));
readError = true; await assert.rejects(readProjectionSupplement(client, 7, new AbortController().signal), /unavailable/);
readError = false; foreign = true; await assert.rejects(readProjectionSupplement(client, 7, new AbortController().signal), /otro espacio/);
const aborted = new AbortController(); aborted.abort(); await assert.rejects(readProjectionSupplement(client, 7, aborted.signal), { name: "AbortError" });

const { CashflowMonthPanel } = await import(load("src/modules/dashboard/components/cashflow-month-panel.tsx"));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container); let retries = 0;
const completeModel = buildDashboardCashflow({ ...snapshot, accounts: accounts.filter(account => account.currencyCode !== "EUR") }, [], supplement, ctx, today);
const render = async extra => act(async () => renderer.render(React.createElement(CashflowMonthPanel, { model: completeModel, currency: "PEN", ready: true, failed: false, onRetry: () => retries++, ...extra })));
await render({});
assert.match(container.textContent, /Caja disponible hoy/); assert.match(container.textContent, /Cobros previstos/); assert.match(container.textContent, /mediana de 6 meses/);
assert.equal(container.querySelectorAll("dl > div").length, 4); assert.ok(container.querySelector("details"));
await render({ model }); assert.match(container.textContent, /Sin estimación/); assert.match(container.textContent, /sin conversión/); assert.equal(container.querySelector("details"), null);
await render({ ready: false, failed: true }); assert.match(container.textContent, /Sin estimación/); assert.doesNotMatch(container.textContent, /1,300|1.300/);
await act(async () => container.querySelector("button").click()); assert.equal(retries, 1);
await render({ ready: false }); assert.match(container.textContent, /Comprobando/); assert.equal(container.querySelector("button"), null);
await act(async () => renderer.unmount()); container.remove(); dom.window.close();
const page = readFileSync(resolve(root, "src/modules/dashboard/pages/dashboard-page.tsx"), "utf8");
assert.match(page, /const parityMonthProjection = cashflow.monthEnd/); assert.match(page, /<CashflowMonthPanel model=\{cashflow\}/); assert.doesNotMatch(page, /buildMonthProjection\(/);
console.log(`dashboard-cashflow: OK (${comparisons} real mobile calendar comparisons plus real mobile hook/windows, plan coverage, liquid/history/planned rules, explicit custom-day/card-FX corrections, scoped paginated reads, cancellation/failure and actual panel; local fixtures only)`);
