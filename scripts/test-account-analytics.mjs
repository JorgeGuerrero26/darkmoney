import assert from "node:assert/strict";
import { React, act, createRoot, dom, load, settle } from "./lib/web-ui-harness.mjs";

const { buildAccountAnalytics, accountBalanceHistoryReady, ACCOUNT_ANALYTICS_LIMIT } = await import(load("src/modules/accounts/lib/account-analytics.ts"));
const { buildAccountBalanceEvolution } = await import(load("src/modules/accounts/lib/account-balance-evolution.ts"));
const { AccountAnalyticsModal } = await import(load("src/modules/accounts/components/account-analytics-modal.tsx"));
const { AccountDetailDialog } = await import(load("src/modules/accounts/components/account-detail-dialog.tsx"));
const { buildAccountAnalytics: mobileAnalytics } = await import(load("../DarkMoneyApp/features/accounts/lib/account-analytics.ts"));
const { buildLocalAccountAnalytics } = await import(load("../DarkMoneyApp/features/accounts/lib/offlineAccountAnalytics.ts"));
const account = { id: 1, workspaceId: 8, name: "Cuenta Sueldo", currencyCode: "PEN", type: "bank", currentBalance: 5133.29, openingBalance: 0, color: "#d6b69b", includeInNetWorth: true, icon: "landmark", isArchived: false };
const movement = (id, extra = {}) => ({ id, workspaceId: 8, occurredAt: new Date(Date.UTC(2026, 8, 1, 12, id % 60)).toISOString(), description: `Movimiento ${id}`, movementType: "expense", status: "posted", sourceAccountId: 1, sourceAmount: id + 1, sourceCurrencyCode: "PEN", destinationAccountId: null, destinationAmount: null, categoryId: id % 8, category: `Categoría ${id % 8}`, ...extra });
function nativeInput(items) {
  return buildLocalAccountAnalytics({ accountId: account.id, limit: ACCOUNT_ANALYTICS_LIMIT,
    categories: Array.from({ length: 8 }, (_, id) => ({ id, name: `Categoría ${id}` })),
    movements: items.filter(item => item.workspaceId === account.workspaceId).map(item => ({ id: item.id, occurred_at: item.occurredAt, description: item.description, movement_type: item.movementType, status: item.status, source_account_id: item.sourceAccountId, source_amount: item.sourceAmount, destination_account_id: item.destinationAccountId, destination_amount: item.destinationAmount, category_id: item.categoryId })) });
}
let comparisons = 0;
for (const count of [1, 8, 80, 300, 330]) for (const offset of [0, 1, 2, 3]) {
  const rows = Array.from({ length: count }, (_, index) => {
    const id = index + 1, kind = ["expense", "income", "transfer", "subscription_payment", "obligation_payment", "adjustment", "refund"][(index + offset) % 7], incoming = index % 3 === 0;
    return movement(id, { movementType: kind, status: index % 17 === 0 ? "voided" : index % 13 === 0 ? "planned" : "posted", occurredAt: new Date(Date.UTC(2026, index % 10, 1, index % 2 ? 2 : 8, id % 60, id % 30)).toISOString(), sourceAccountId: incoming ? null : 1, sourceAmount: incoming ? null : id + 1, destinationAccountId: incoming ? 1 : null, destinationAmount: incoming ? id + 1 : null, destinationCurrencyCode: incoming ? "PEN" : null, categoryId: index % 5 === 0 ? null : index % 8, category: `Categoría ${index % 8}` });
  });
  rows.push(movement(99999, { workspaceId: 99, sourceAmount: 999999 }));
  const nativeRows = nativeInput(rows), expected = mobileAnalytics(1, nativeRows, 300), actual = buildAccountAnalytics(account, rows);
  assert.equal(actual.complete, true); assert.deepEqual(actual.selected.map(item => item.id), nativeRows.map(item => item.id));
  if (!expected) { assert.equal(actual.count, 0); continue; }
  for (const key of ["count", "totalIn", "totalOut", "netFlow", "spent", "transferOut", "uncategorized", "uncategorizedCount", "remainingCategoryCount", "remainingCategoryTotal"]) assert.equal(actual[key], expected[key], key);
  assert.deepEqual(actual.visibleCategories.map(item => [item.name, item.amount]), expected.visibleCategories);
  assert.deepEqual(actual.months.map(({ key, income, expense, net }) => ({ key, income, expense, net })), expected.months.map(({ key, income, expense, net }) => ({ key, income, expense, net })));
  comparisons++;
}
assert.equal(buildAccountAnalytics(account, []).count, 0);
const transfer = movement(1, { movementType: "transfer", sourceAmount: 40 }), debt = movement(2, { movementType: "obligation_payment", sourceAmount: 20, categoryId: null });
const example = buildAccountAnalytics(account, [transfer, debt]); assert.equal(example.totalOut, 60); assert.equal(example.spent, 20); assert.equal(example.transferOut, 40); assert.equal(example.months[0].expense, 60);
const boundary = buildAccountAnalytics(account, [movement(1, { occurredAt: "2026-10-01T02:00:00Z" })]); assert.equal(boundary.months[0].key, "2026-09");
const tie = buildAccountAnalytics(account, [movement(1, { occurredAt: "2026-09-01T12:00:00Z" }), movement(2, { occurredAt: "2026-09-01T12:00:00Z" })]); assert.deepEqual(tie.selected.map(item => item.id), [2, 1]);
const many = Array.from({ length: 305 }, (_, i) => movement(i + 1)); assert.equal(buildAccountAnalytics(account, many).count, 300); assert.equal(buildAccountAnalytics(account, many).truncated, true); assert.equal(buildAccountAnalytics(account, many.slice(0, 300)).truncated, false);
for (const bad of [movement(1, { sourceAmount: null }), movement(1, { sourceAmount: NaN }), movement(1, { sourceCurrencyCode: "USD" }), movement(1, { occurredAt: "bad-date" })]) {
  const result = buildAccountAnalytics(account, [bad, debt]); assert.equal(result.complete, false); assert.equal(result.totalOut, null); assert.equal(result.netFlow, null); assert.deepEqual(result.months, []); assert.deepEqual(result.visibleCategories, []);
}
assert.equal(buildAccountAnalytics(account, [movement(1, { sourceAmount: 0 })]).complete, true); // Mobile legacy mapper turns zero into null; web preserves a verified zero.
const now = Date.parse("2026-10-16T12:00:00Z"), recent = movement(1, { occurredAt: "2026-10-15T12:00:00Z", sourceAmount: 20 });
assert.equal(accountBalanceHistoryReady(account, [recent], now), true); assert.equal(accountBalanceHistoryReady(account, [{ ...recent, sourceAmount: null }], now), false);
assert.equal(accountBalanceHistoryReady(account, [{ ...recent, sourceAmount: null, workspaceId: 99 }], now), true);
const points = buildAccountBalanceEvolution({ accountId: 1, currentBalance: account.currentBalance, movements: [recent], now }); assert.equal(points.at(-1).value, 5133.29); assert.equal(points[0].value, 5153.29);

// Real rendered analytics and detail: scope, cap, unknowns, account anchored curve and no zero bars.
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
async function render(items, detail = false) { await act(async () => renderer.render(React.createElement(detail ? AccountDetailDialog : AccountAnalyticsModal, { account, movements: items, onClose() {}, onAnalyze() {}, onArchive() {}, onEdit() {}, onViewMovements() {}, onCreateMovement() {} }))); await settle(); }
await render(many); assert.match(container.textContent, /300 más recientes de 305/); assert.match(container.textContent, /no incluyen los anteriores/); assert.match(container.textContent, /historial completo/); assert.ok(container.querySelector("polyline").closest("svg").querySelectorAll("circle").length <= 1);
await render([transfer, debt]); assert.match(container.textContent, /Salidas sin traspasos/); assert.match(container.textContent, /traspasos y abonos/);
await render([movement(1, { sourceAmount: null })]); assert.match(container.textContent, /Por comprobar/); assert.match(container.textContent, /no.*parcial/i);
await render([movement(1, { sourceAmount: null, occurredAt: "bad-date" })], true); assert.match(container.textContent, /Fecha por comprobar/); assert.match(container.textContent, /no se dibuja una evolución parcial/);
await act(async () => renderer.unmount()); container.remove(); dom.window.close();
console.log(`account-analytics: OK (${comparisons} actual mobile reader/model comparisons; scoped posted 300 cap, deterministic ties, Lima months, transfers/debt, category remainder/uncategorized, invalid evidence, anchored 90-day curve and real UI; local only)`);
