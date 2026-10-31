import assert from "node:assert/strict";
import { load, dom } from "./lib/web-ui-harness.mjs";
const { prepareDetectionQuickSave, savePreparedDetection } = await import(load("src/modules/notifications/lib/detection-quick-save.ts"));
const suggestion = { id: 4, userId: "u", workspaceId: 8, status: "pending", movementType: "expense", amount: 12.5, currencyCode: "PEN", description: "Compra", occurredAt: "2026-10-20T13:40:50Z", updatedAt: "2026-10-20T13:45:00Z", financialAppKey: "bank", metadata: { accountId: 1, categoryId: 2 } };
const accounts = [{ id: 1, workspaceId: 8, currencyCode: "PEN", isArchived: false }], categories = [{ id: 2, kind: "expense", isActive: true }];
const prepare = (row = suggestion, a = accounts, c = categories) => prepareDetectionQuickSave(row, a, c, [], "u", 8);
const valid = prepare(); assert.equal(valid.sourceAccountId, 1); assert.equal(valid.sourceAmount, 12.5); assert.equal(valid.destinationAccountId, null); assert.equal(valid.categoryId, 2); assert.equal(valid.occurredAt, suggestion.occurredAt);
for (const extra of [{ userId: "other" }, { workspaceId: 9 }, { status: "needs_review" }, { status: "registered" }, { updatedAt: null }, { movementType: "transfer" }, { movementType: "unknown" }, { amount: 0 }, { description: " " }, { occurredAt: "invalid" }, { metadata: {} }]) assert.equal(prepare({ ...suggestion, ...extra }), null, JSON.stringify(extra));
assert.equal(prepare(suggestion, [{ ...accounts[0], isArchived: true }]), null); assert.equal(prepare(suggestion, accounts, [{ ...categories[0], isActive: false }]), null); assert.equal(prepare(suggestion, accounts, [{ ...categories[0], kind: "income" }]), null);
const income = prepare({ ...suggestion, movementType: "income" }, accounts, [{ ...categories[0], kind: "income" }]); assert.equal(income.destinationAccountId, 1); assert.equal(income.destinationAmount, 12.5); assert.equal(income.sourceAmount, null);
let fresh = suggestion, allowed = true, created = 0;
const deps = { signal: new AbortController().signal, proAccessEnabled: true,
  checker: { check: async () => ({ allowed }) }, create: async () => { created++; return 44; },
  store: { register: async (_id, input, _accounts, create, check) => { await check(fresh, null); return { movementId: await create(input) }; } } };
const saved = await savePreparedDetection(suggestion, valid, accounts, categories, [], deps); assert.equal(saved.movementId, 44); assert.equal(created, 1);
allowed = false; await assert.rejects(() => savePreparedDetection(suggestion, valid, accounts, categories, [], deps), /posible coincidencia/); assert.equal(created, 1);
allowed = true; fresh = { ...suggestion, updatedAt: "new", amount: 200 }; await assert.rejects(() => savePreparedDetection(suggestion, valid, accounts, categories, [], deps), /cambió/); assert.equal(created, 1);
const cancelled = new AbortController(); cancelled.abort(); await assert.rejects(() => savePreparedDetection(suggestion, valid, accounts, categories, [], { ...deps, signal: cancelled.signal }), /canceló/); assert.equal(created, 1);
dom.window.close(); console.log("Detection direct-save eligibility: scope, version, account, category and fields passed.");
